import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { api } from '../api/client.js';
import { CELPIP_SECTION_CARD_THEME, CELPIP_SECTION_TASKS } from '../data/celpipOfficialTasks.js';

const SECTIONS = ['Listening', 'Reading', 'Writing', 'Speaking'];

/** Empty string = no section filter (full exam scope in OpenAI). */
const SECTION_SCOPE_ALL = '';

const DEFAULT_SECTION_SCOPE = 'Listening';
const DEFAULT_QUESTIONS_PER_TEST = '1';
const DEFAULT_EXAM_TITLE = 'CELPIP General';

/** Suggested `--test-title`: "{exam} {Section…}" in canonical section order; no sections → "{exam} Multi". */
function buildSuggestedTestTitle(examTitle, orderedSectionNames) {
  const base = String(examTitle ?? '').trim() || 'CELPIP General';
  if (!orderedSectionNames || orderedSectionNames.length === 0) {
    return `${base} Multi`;
  }
  return `${base} ${orderedSectionNames.join(' ')}`;
}

function buildArtisanPreview(body) {
  const parts = ['php artisan openai:generate-questionnaire'];
  if (Array.isArray(body.sections) && body.sections.length === 1) {
    parts.push(`--section=${body.sections[0]}`);
  }
  if (body.questions_per_test != null) {
    parts.push(`--questions-per-test=${body.questions_per_test}`);
  }
  if (body.exam_title) {
    parts.push(`--exam-title=${JSON.stringify(body.exam_title)}`);
  }
  if (body.test_title) {
    parts.push(`--test-title=${JSON.stringify(body.test_title)}`);
  }
  if (body.extra_prompt) {
    parts.push(`--prompt=${JSON.stringify(body.extra_prompt)}`);
  }
  if (body.model) {
    parts.push(`--model=${JSON.stringify(body.model)}`);
  }
  if (body.dry_run) {
    parts.push('--dry-run');
  }
  if (body.file_json && body.file_json.trim() !== '') {
    parts.push('--file=path/to/payload.json');
  }
  if (body.no_question_preview) {
    parts.push('--no-question-preview');
  }
  if (body.with_speaking_images) {
    parts.push('--with-speaking-images');
  }
  return parts.join(' ');
}

function initialFormState() {
  const ordered = DEFAULT_SECTION_SCOPE ? [DEFAULT_SECTION_SCOPE] : [];
  return {
    sectionScope: DEFAULT_SECTION_SCOPE,
    /** Single CELPIP task for the selected section, or null to omit `celpip_section_tasks`. */
    celpipTaskId: null,
    questionsPerTest: DEFAULT_QUESTIONS_PER_TEST,
    examTitle: DEFAULT_EXAM_TITLE,
    testTitle: buildSuggestedTestTitle(DEFAULT_EXAM_TITLE, ordered),
    extraPrompt: '',
    model: '',
    dryRun: false,
    noQuestionPreview: false,
    withSpeakingImages: false,
    fileJson: '',
  };
}

export default function AdminOpenAiQuestionnaire() {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(initialFormState);
  const {
    sectionScope,
    celpipTaskId,
    questionsPerTest,
    examTitle,
    testTitle,
    extraPrompt,
    model,
    dryRun,
    noQuestionPreview,
    withSpeakingImages,
    fileJson,
  } = form;

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lines, setLines] = useState([]);
  const [lastPayload, setLastPayload] = useState(null);
  const [lastOk, setLastOk] = useState(null);
  const terminalEndRef = useRef(null);

  const selectedSections = useMemo(
    () => (sectionScope && SECTIONS.includes(sectionScope) ? [sectionScope] : []),
    [sectionScope]
  );

  const requestBody = useMemo(() => {
    const q = String(questionsPerTest).trim();
    const body = {
      extra_prompt: extraPrompt.trim() || undefined,
      model: model.trim() || undefined,
      dry_run: dryRun || undefined,
      no_question_preview: noQuestionPreview || undefined,
      with_speaking_images:
        sectionScope === 'Speaking' && withSpeakingImages ? true : undefined,
      exam_title: examTitle.trim() || undefined,
      test_title: testTitle.trim() || undefined,
      file_json: fileJson.trim() || undefined,
    };
    if (q !== '') {
      const n = Number.parseInt(q, 10);
      if (!Number.isNaN(n) && n >= 1) {
        body.questions_per_test = n;
      }
    }
    if (selectedSections.length > 0) {
      body.sections = selectedSections;
    }
    if (
      sectionScope &&
      SECTIONS.includes(sectionScope) &&
      celpipTaskId != null &&
      Number.isFinite(Number(celpipTaskId))
    ) {
      const id = Math.trunc(Number(celpipTaskId));
      if (id >= 1) {
        body.celpip_section_tasks = { [sectionScope]: [id] };
      }
    }
    return body;
  }, [
    dryRun,
    examTitle,
    extraPrompt,
    fileJson,
    model,
    noQuestionPreview,
    questionsPerTest,
    celpipTaskId,
    sectionScope,
    testTitle,
    withSpeakingImages,
  ]);

  const artisanPreview = useMemo(() => buildArtisanPreview(requestBody), [requestBody]);

  const onJsonFile = useCallback((ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setField('fileJson', text);
    };
    reader.readAsText(f, 'UTF-8');
  }, [setField]);

  const run = useCallback(async () => {
    setErr('');
    setLastPayload(null);
    setLastOk(null);
    setBusy(true);
    setLines(['$ ' + artisanPreview, '…']);
    try {
      const res = await api.post('/admin/openai-questionnaire/run', requestBody, { timeout: 600000 });
      const { ok, exit_code: exitCode, lines: outLines, payload } = res.data;
      setLines([`$ ${artisanPreview}`, `(exit ${exitCode})`, ...outLines]);
      setLastPayload(payload ?? null);
      setLastOk(ok);
    } catch (e) {
      const d = e.response?.data;
      let msg = d?.message || e.message || 'Request failed';
      if (d?.errors && typeof d.errors === 'object') {
        const flat = Object.values(d.errors)
          .flat()
          .filter(Boolean)
          .join(' ');
        if (flat) {
          msg = flat;
        }
      }
      setErr(msg);
      const serverLines = e.response?.data?.lines;
      if (Array.isArray(serverLines) && serverLines.length > 0) {
        setLines([`$ ${artisanPreview}`, `ERROR: ${msg}`, ...serverLines]);
      } else {
        setLines([`$ ${artisanPreview}`, `ERROR: ${msg}`]);
      }
      setLastOk(false);
    } finally {
      setBusy(false);
    }
  }, [artisanPreview, requestBody]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  /** Keep `--test-title` in sync with `--exam-title` + `--section` (overwrites manual edits when those change). */
  useEffect(() => {
    setForm((prev) => {
      const ordered =
        prev.sectionScope && SECTIONS.includes(prev.sectionScope) ? [prev.sectionScope] : [];
      const next = {
        ...prev,
        testTitle: buildSuggestedTestTitle(prev.examTitle, ordered),
      };
      if (prev.sectionScope !== 'Speaking' && prev.withSpeakingImages) {
        next.withSpeakingImages = false;
      }
      return next;
    });
  }, [examTitle, sectionScope]);

  /** Changing section clears the selected CELPIP task (tasks are section-specific). */
  useEffect(() => {
    setForm((prev) => ({ ...prev, celpipTaskId: null }));
  }, [sectionScope]);

  const showSpeakingImagesOption = sectionScope === 'Speaking';

  return (
    <div>
      <h1 className="h3 fw-bold mb-1 d-flex align-items-center gap-2">
        <i className="bi bi-robot text-br-rose" aria-hidden />
        OpenAI questionnaire
      </h1>
      <p className="text-muted small mb-4">
        Same flags as <code className="text-body">openai:generate-questionnaire</code> (generate → validate →{' '}
        <strong className="text-body">importPayload</strong>). Paste or upload JSON for <code className="text-body">--file</code>{' '}
        instead of a path. Requires <code className="text-body">OPENAI_API_KEY</code> when not using file JSON. Long jobs
        can take several minutes.
      </p>

      {err && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
      {lastOk === true && (
        <Alert variant="success" className="py-2 small">
          Finished successfully.
        </Alert>
      )}
      {lastOk === false && !err && (
        <Alert variant="warning" className="py-2 small">
          Completed with errors (see terminal).
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <div className="br-card p-3 h-100">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h2 className="h6 fw-bold mb-0">Command options</h2>
              <Button variant="outline-secondary" size="sm" type="button" disabled={busy} onClick={() => setForm(initialFormState())}>
                Reset to defaults
              </Button>
            </div>
            <p className="small text-muted mb-3">
              Same flags as Artisan (order below follows your usual CLI: section → count → titles, then the rest).
            </p>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                <code className="text-body">--section</code> — OpenAI scope (one section per run, or no filter)
              </Form.Label>
              <Row
                className="g-2 row-cols-1 row-cols-sm-2 row-cols-lg-3"
                role="radiogroup"
                aria-label="Section scope for generation"
              >
                <Col>
                  <Form.Check
                    type="radio"
                    name="br-openai-section-scope"
                    id="openai-sec-all"
                    className="small"
                    label="All sections (no filter)"
                    checked={sectionScope === SECTION_SCOPE_ALL}
                    onChange={() => setField('sectionScope', SECTION_SCOPE_ALL)}
                  />
                </Col>
                {SECTIONS.map((s) => (
                  <Col key={s}>
                    <Form.Check
                      type="radio"
                      name="br-openai-section-scope"
                      id={`openai-sec-${s}`}
                      className="small"
                      label={`${s} only`}
                      checked={sectionScope === s}
                      onChange={() => setField('sectionScope', s)}
                    />
                  </Col>
                ))}
              </Row>
              <Form.Text className="text-muted">
                Only one <code className="text-body">--section=</code> flag is sent per run. Choose a single skill or “All
                sections” for an unrestricted generate.
              </Form.Text>
            </Form.Group>

            {sectionScope && selectedSections.length > 0 && (
              <div className="mb-3">
                <div className="small fw-semibold mb-1">CELPIP General — task type (optional)</div>
                <p className="small text-muted mb-2">
                  Pick at most one task for <strong>{sectionScope}</strong>, or “No task filter”. When a task is selected it
                  is sent as <code className="text-body">celpip_section_tasks</code> and merged into the OpenAI user prompt with
                  exact <code className="text-body">celpip_task_number</code> / <code className="text-body">celpip_task_label</code>{' '}
                  bindings (unofficial practice; not affiliated with Paragon).
                </p>
                <Row className="g-2">
                  {(() => {
                    const sec = sectionScope;
                    const theme = CELPIP_SECTION_CARD_THEME[sec];
                    const tasks = CELPIP_SECTION_TASKS[sec];
                    return (
                      <Col key={sec} xs={12}>
                        <div
                          className="rounded-3 p-2 h-100"
                          style={{
                            borderLeft: `4px solid ${theme.border}`,
                            background: theme.softBg,
                          }}
                        >
                          <div className="d-flex align-items-center gap-2 mb-2 small fw-semibold text-body">
                            <i className={`bi ${theme.icon}`} style={{ color: theme.border }} aria-hidden />
                            {sec}
                          </div>
                          <Row
                            className="g-2 row-cols-1 row-cols-sm-2 row-cols-lg-3"
                            role="radiogroup"
                            aria-label={`CELPIP tasks for ${sec}`}
                          >
                            <Col>
                              <Form.Check
                                type="radio"
                                name={`br-openai-celpip-${sec}`}
                                id={`celpip-${sec}-none`}
                                className="small"
                                label="No task filter"
                                checked={celpipTaskId === null}
                                onChange={() => setField('celpipTaskId', null)}
                              />
                            </Col>
                            {tasks.map((t) => (
                              <Col key={t.id}>
                                <Form.Check
                                  type="radio"
                                  name={`br-openai-celpip-${sec}`}
                                  id={`celpip-${sec}-${t.id}`}
                                  className="small"
                                  checked={celpipTaskId === t.id}
                                  onChange={() => setField('celpipTaskId', t.id)}
                                  label={
                                    <>
                                      <span className="text-muted">Task {t.id}</span>{' '}
                                      <span className="fw-semibold">{t.label}</span>
                                    </>
                                  }
                                />
                              </Col>
                            ))}
                          </Row>
                        </div>
                      </Col>
                    );
                  })()}
                </Row>
              </div>
            )}

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                <code className="text-body">--questions-per-test</code> — target count (OpenAI mode only; ignored with file JSON)
              </Form.Label>
              <Form.Control
                type="number"
                min={1}
                value={questionsPerTest}
                onChange={(e) => setField('questionsPerTest', e.target.value)}
              />
            </Form.Group>

            <Row className="g-2 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    <code className="text-body">--exam-title</code> — exams.name
                  </Form.Label>
                  <Form.Control value={examTitle} onChange={(e) => setField('examTitle', e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">
                    <code className="text-body">--test-title</code> — tests.title
                  </Form.Label>
                  <Form.Control value={testTitle} onChange={(e) => setField('testTitle', e.target.value)} />
                  <Form.Text className="text-muted">
                    Updates automatically from exam + section scope (e.g. Listening + CELPIP General →{' '}
                    <strong className="text-body">CELPIP General Listening</strong>). Changing exam or section overwrites
                    this field; you can still edit it before Run.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <Form.Text className="text-muted d-block mb-3">
              Provide both exam and test title together, or clear both for a new hierarchy. With file JSON, payload can be
              merged onto this target.
            </Form.Text>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                <code className="text-body">--prompt</code> — extra instructions
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Optional; appended to the generation request"
                value={extraPrompt}
                onChange={(e) => setField('extraPrompt', e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                <code className="text-body">--model</code> — overrides OPENAI_MODEL
              </Form.Label>
              <Form.Control
                placeholder="Leave empty for .env default"
                value={model}
                onChange={(e) => setField('model', e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="dry-run"
                checked={dryRun}
                onChange={(e) => setField('dryRun', e.target.checked)}
                label={
                  <span>
                    <code className="text-body">--dry-run</code> — validate and print JSON only; do not write to the database
                  </span>
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                <code className="text-body">--file</code> — import JSON (skips OpenAI)
              </Form.Label>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <input ref={fileInputRef} type="file" accept=".json,application/json" className="d-none" onChange={onJsonFile} />
                <Button variant="outline-primary" size="sm" type="button" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                  <i className="bi bi-file-earmark-arrow-up me-1" aria-hidden />
                  Choose JSON file…
                </Button>
                {fileJson.trim() !== '' && (
                  <Button variant="outline-danger" size="sm" type="button" disabled={busy} onClick={() => setField('fileJson', '')}>
                    Clear file JSON
                  </Button>
                )}
              </div>
              <Form.Control
                as="textarea"
                rows={4}
                className="font-monospace small"
                placeholder='Paste full {"exams":[...]} JSON (same shape as --file on disk)'
                value={fileJson}
                onChange={(e) => setField('fileJson', e.target.value)}
              />
              <Form.Text className="text-muted">
                When non-empty, behaves like <code className="text-body">--file=…</code>: OpenAI is not called; payload is
                validated then imported.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="no-preview"
                checked={noQuestionPreview}
                onChange={(e) => setField('noQuestionPreview', e.target.checked)}
                label={
                  <span>
                    <code className="text-body">--no-question-preview</code> — do not print per-question passage/stem previews
                    during import
                  </span>
                }
              />
            </Form.Group>

            {showSpeakingImagesOption && (
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  id="speaking-img"
                  checked={withSpeakingImages}
                  onChange={(e) => setField('withSpeakingImages', e.target.checked)}
                  label={
                    <span>
                      <code className="text-body">--with-speaking-images</code> — after import, generate DALL·E scene images for
                      speaking_prompt rows that include <code className="text-body">options_json.speaking.image_generation_prompt</code>{' '}
                      (skipped on dry-run)
                    </span>
                  }
                />
              </Form.Group>
            )}

            <Button variant="primary" className="me-2" disabled={busy} onClick={() => void run()}>
              {busy ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Running…
                </>
              ) : (
                <>
                  <i className="bi bi-play-fill me-1" aria-hidden />
                  Run
                </>
              )}
            </Button>
            <Button variant="outline-secondary" size="sm" type="button" disabled={busy} onClick={() => setLines([])}>
              Clear terminal
            </Button>
          </div>
        </Col>
        <Col lg={6}>
          <div className="br-card p-3 h-100 d-flex flex-column">
            <h2 className="h6 fw-bold mb-2">Equivalent command</h2>
            <pre className="br-admin-cli-preview small mb-3 flex-grow-1">{artisanPreview}</pre>
            <h2 className="h6 fw-bold mb-2">Terminal</h2>
            <pre className="br-admin-terminal flex-grow-1 small mb-0" role="log" aria-live="polite">
              {lines.length === 0 ? (
                <span className="text-secondary">Output appears here after you run.</span>
              ) : (
                lines.map((line, i) => (
                  <span key={i}>
                    {line}
                    {'\n'}
                  </span>
                ))
              )}
              <span ref={terminalEndRef} />
            </pre>
          </div>
        </Col>
      </Row>

      {lastPayload && (
        <div className="br-card p-3 mb-4">
          <h2 className="h6 fw-bold mb-2">Dry-run payload (JSON)</h2>
          <pre className="br-admin-terminal br-admin-terminal--tall small mb-0 overflow-auto">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
