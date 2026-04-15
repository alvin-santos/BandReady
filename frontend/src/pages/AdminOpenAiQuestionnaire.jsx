import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { CELPIP_SECTION_CARD_THEME, CELPIP_SECTION_TASKS } from '../data/celpipOfficialTasks.js';

const SECTIONS = ['Listening', 'Reading', 'Writing', 'Speaking'];

/** Empty string = no section filter (full exam scope in OpenAI). */
const SECTION_SCOPE_ALL = '';

const DEFAULT_SECTION_SCOPE = 'Listening';
const DEFAULT_QUESTIONS_PER_TEST = '1';
const DEFAULT_EXAM_TITLE = 'CELPIP General';

/** Matches backend `AdminOpenAiQuestionnaireController::EXTRA_PROMPT_HISTORY_LIMIT`. */
const SAVED_PROMPT_LIST_LIMIT = 50;

/** Suggested `--test-title`: "{exam} {Section…}" in canonical section order; no sections → "{exam} Multi". */
function buildSuggestedTestTitle(examTitle, orderedSectionNames) {
  const base = String(examTitle ?? '').trim() || 'CELPIP General';
  if (!orderedSectionNames || orderedSectionNames.length === 0) {
    return `${base} Multi`;
  }
  return `${base} ${orderedSectionNames.join(' ')}`;
}

function celpipTaskLabel(section, taskId) {
  if (!section || taskId == null || !Number.isFinite(Number(taskId))) {
    return null;
  }
  const t = CELPIP_SECTION_TASKS[section]?.find((x) => x.id === taskId);
  return t?.label ?? null;
}

function formatPromptLibraryWhen(iso) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
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
  if (body.omit_passage_text) {
    parts.push('--omit-passage-text');
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
    omitPassageText: false,
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
    omitPassageText,
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
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [savedPromptModalOpen, setSavedPromptModalOpen] = useState(false);
  const [savedPromptModalLoading, setSavedPromptModalLoading] = useState(false);
  const [saveHistoryBusy, setSaveHistoryBusy] = useState(false);
  /** When > 0, skip auto test-title sync and CELPIP task clear for that many effect runs (preset apply). */
  const skipHistoryEffects = useRef(0);
  const terminalEndRef = useRef(null);

  const selectedSections = useMemo(
    () => (sectionScope && SECTIONS.includes(sectionScope) ? [sectionScope] : []),
    [sectionScope]
  );

  /** Saved prompts shown in the library modal: match single `--section`, or all rows when scope is unrestricted. */
  const savedPromptsForModal = useMemo(() => {
    if (!sectionScope || !SECTIONS.includes(sectionScope)) {
      return savedPrompts;
    }
    return savedPrompts.filter((p) => p.section === sectionScope);
  }, [savedPrompts, sectionScope]);

  const requestBody = useMemo(() => {
    const q = String(questionsPerTest).trim();
    const body = {
      extra_prompt: extraPrompt.trim() || undefined,
      model: model.trim() || undefined,
      dry_run: dryRun || undefined,
      no_question_preview: noQuestionPreview || undefined,
      with_speaking_images:
        sectionScope === 'Speaking' && withSpeakingImages ? true : undefined,
      omit_passage_text: omitPassageText ? true : undefined,
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
    omitPassageText,
    questionsPerTest,
    celpipTaskId,
    sectionScope,
    testTitle,
    withSpeakingImages,
  ]);

  const artisanPreview = useMemo(() => buildArtisanPreview(requestBody), [requestBody]);

  const loadSavedPrompts = useCallback(async () => {
    try {
      const res = await api.get('/admin/openai-questionnaire/extra-prompts');
      setSavedPrompts(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setSavedPrompts([]);
    }
  }, []);

  useEffect(() => {
    void loadSavedPrompts();
  }, [loadSavedPrompts]);

  const applySavedPromptFromRow = useCallback((row) => {
    if (!row || typeof row.body !== 'string') {
      return;
    }
    const hasScopeMeta =
      Boolean(row.exam_title) ||
      Boolean(row.test_title) ||
      (row.section && SECTIONS.includes(row.section)) ||
      (row.celpip_task_number != null && row.section && SECTIONS.includes(row.section));

    if (hasScopeMeta) {
      skipHistoryEffects.current = 1;
      setForm((prev) => {
        const next = { ...prev, extraPrompt: row.body };
        if (row.exam_title) {
          next.examTitle = String(row.exam_title);
        }
        if (row.test_title) {
          next.testTitle = String(row.test_title);
        }
        if (row.section && SECTIONS.includes(row.section)) {
          next.sectionScope = row.section;
          next.celpipTaskId =
            row.celpip_task_number != null && Number.isFinite(Number(row.celpip_task_number))
              ? Math.trunc(Number(row.celpip_task_number))
              : null;
        } else {
          next.sectionScope = SECTION_SCOPE_ALL;
          next.celpipTaskId = null;
        }
        if (prev.sectionScope !== 'Speaking' && next.sectionScope !== 'Speaking') {
          next.withSpeakingImages = false;
        }
        return next;
      });
    } else {
      setField('extraPrompt', row.body);
    }
  }, [setField]);

  const openSavedPromptModal = useCallback(async () => {
    setSavedPromptModalOpen(true);
    setSavedPromptModalLoading(true);
    try {
      await loadSavedPrompts();
    } finally {
      setSavedPromptModalLoading(false);
    }
  }, [loadSavedPrompts]);

  const saveCurrentPromptToHistory = useCallback(async () => {
    const t = extraPrompt.trim();
    if (!t) {
      setErr('Nothing to save — extra instructions are empty.');
      return;
    }
    setSaveHistoryBusy(true);
    setErr('');
    try {
      const payload = { body: t };
      const et = examTitle.trim();
      const tt = testTitle.trim();
      if (et) {
        payload.exam_title = et;
      }
      if (tt) {
        payload.test_title = tt;
      }
      if (sectionScope && SECTIONS.includes(sectionScope)) {
        payload.section = sectionScope;
        if (celpipTaskId != null && Number.isFinite(Number(celpipTaskId))) {
          const tn = Math.trunc(Number(celpipTaskId));
          if (tn >= 1) {
            payload.celpip_task_number = tn;
            const lab = celpipTaskLabel(sectionScope, tn);
            if (lab) {
              payload.celpip_task_label = lab;
            }
          }
        }
      }
      await api.post('/admin/openai-questionnaire/extra-prompts', payload);
      await loadSavedPrompts();
    } catch (e) {
      const d = e.response?.data;
      setErr(d?.message || e.message || 'Could not save prompt.');
    } finally {
      setSaveHistoryBusy(false);
    }
  }, [celpipTaskId, examTitle, extraPrompt, loadSavedPrompts, sectionScope, testTitle]);

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
      if (ok) {
        void loadSavedPrompts();
      }
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
  }, [artisanPreview, loadSavedPrompts, requestBody]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const prevSectionForCelpipClear = useRef(sectionScope);

  /** Keep `--test-title` in sync with exam + section; clear CELPIP task when the section actually changes. */
  useEffect(() => {
    if (skipHistoryEffects.current > 0) {
      skipHistoryEffects.current -= 1;
      prevSectionForCelpipClear.current = sectionScope;
      return;
    }
    setForm((prev) => {
      const sectionChanged = prevSectionForCelpipClear.current !== prev.sectionScope;
      prevSectionForCelpipClear.current = prev.sectionScope;
      const ordered =
        prev.sectionScope && SECTIONS.includes(prev.sectionScope) ? [prev.sectionScope] : [];
      const next = {
        ...prev,
        testTitle: buildSuggestedTestTitle(prev.examTitle, ordered),
        celpipTaskId: sectionChanged ? null : prev.celpipTaskId,
      };
      if (next.sectionScope !== 'Speaking') {
        next.withSpeakingImages = false;
      }
      return next;
    });
  }, [examTitle, sectionScope]);

  const showSpeakingImagesOption = sectionScope === 'Speaking';

  return (
    <div>
      <h1 className="h3 fw-bold mb-1 d-flex align-items-center gap-2">
        <i className="bi bi-robot text-br-rose" aria-hidden />
        OpenAI questionnaire
      </h1>
      <p className="text-muted small mb-2">
        Same flags as <code className="text-body">openai:generate-questionnaire</code> (generate → validate →{' '}
        <strong className="text-body">importPayload</strong>). Paste or upload JSON for <code className="text-body">--file</code>{' '}
        instead of a path. Requires <code className="text-body">OPENAI_API_KEY</code> when not using file JSON. Long jobs
        can take several minutes.
      </p>
      <p className="small mb-4">
        <Link to="/admin/openai-questionnaire/prompts" className="fw-semibold">
          Manage saved extra prompts
        </Link>
        <span className="text-muted"> — view, edit, or delete stored </span>
        <code className="text-body">--prompt</code>
        <span className="text-muted"> text and metadata.</span>
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
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="d-inline-flex align-items-center gap-1"
                  disabled={busy}
                  onClick={() => void openSavedPromptModal()}
                >
                  <i className="bi bi-journal-richtext" aria-hidden />
                  Browse saved prompts…
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="mb-0"
                  disabled={busy || saveHistoryBusy || extraPrompt.trim() === ''}
                  onClick={() => void saveCurrentPromptToHistory()}
                >
                  {saveHistoryBusy ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-1" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-bookmark-plus me-1" aria-hidden />
                      Save to history
                    </>
                  )}
                </Button>
              </div>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Optional; appended to the generation request"
                value={extraPrompt}
                onChange={(e) => setField('extraPrompt', e.target.value)}
              />
              <Form.Text className="text-muted">
                Successful runs with non-empty text here are stored automatically (up to {SAVED_PROMPT_LIST_LIMIT}{' '}
                recent; not on dry-run), with exam, section, and CELPIP task when set. Same instruction text replaces the
                existing row (SHA-256 dedupe). Use <strong className="text-body">Save to history</strong> anytime without
                running.
              </Form.Text>
              <Form.Check
                id="openai-omit-passage"
                className="small mt-2"
                type="checkbox"
                label="Omit optional passage_text (JSON null)"
                checked={omitPassageText}
                onChange={(e) => setField('omitPassageText', e.target.checked)}
              />
              <Form.Text className="text-muted">
                Sends the same rule as <code className="text-body">--omit-passage-text</code>: for types like{' '}
                <strong className="text-body">speaking_prompt</strong> and <strong className="text-body">essay</strong>, put
                instructions in <code className="text-body">question_text</code> only—do not duplicate a long block in{' '}
                <code className="text-body">passage_text</code>. Listening and Reading MCQ still follow mandatory passage
                rules.
              </Form.Text>
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

      <Modal
        show={savedPromptModalOpen}
        onHide={() => !savedPromptModalLoading && setSavedPromptModalOpen(false)}
        size="lg"
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title className="h5">Saved extra prompts</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {savedPromptModalLoading ? (
            <div className="d-flex align-items-center gap-2 text-muted small">
              <Spinner animation="border" size="sm" />
              Loading…
            </div>
          ) : savedPrompts.length === 0 ? (
            <p className="small text-muted mb-0">
              No saved prompts yet. Use <strong className="text-body">Save to history</strong> below the textarea, or run a
              successful generation with non-empty instructions.
            </p>
          ) : savedPromptsForModal.length === 0 ? (
            <p className="small text-muted mb-0">
              No saved prompts are tagged for{' '}
              <strong className="text-body">
                {sectionScope && SECTIONS.includes(sectionScope) ? sectionScope : 'this section'}
              </strong>
              . Choose <strong className="text-body">All sections (no filter)</strong> above to see every prompt, save the
              current instructions with this section selected, or edit tags in the{' '}
              <Link to="/admin/openai-questionnaire/prompts" onClick={() => setSavedPromptModalOpen(false)}>
                prompt library
              </Link>
              .
            </p>
          ) : (
            <div className="table-responsive">
              {sectionScope && SECTIONS.includes(sectionScope) && (
                <p className="small text-muted mb-2">
                  Showing only prompts saved for <strong className="text-body">{sectionScope}</strong> (same as your{' '}
                  <code className="text-body">--section</code> scope). Prompts saved as “All sections” are hidden here.
                </p>
              )}
              <Table hover size="sm" className="mb-0 align-middle small">
                <thead className="table-light">
                  <tr>
                    <th className="text-nowrap">#</th>
                    <th>Exam</th>
                    <th>Section</th>
                    <th>CELPIP</th>
                    <th>Preview</th>
                    <th className="text-nowrap">Updated</th>
                    <th className="text-end text-nowrap"> </th>
                  </tr>
                </thead>
                <tbody>
                  {savedPromptsForModal.map((row) => (
                    <tr key={row.id}>
                      <td className="text-muted">{row.id}</td>
                      <td>{row.exam_title || '—'}</td>
                      <td>{row.section || <span className="text-muted">All</span>}</td>
                      <td>
                        {row.celpip_task_number != null ? (
                          <>
                            T{row.celpip_task_number}
                            {row.celpip_task_label ? (
                              <>
                                <br />
                                <span className="text-body">{row.celpip_task_label}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ maxWidth: '220px' }} className="text-break">
                        {String(row.preview || '').trim() || '(empty)'}
                      </td>
                      <td className="text-muted text-nowrap">{formatPromptLibraryWhen(row.updated_at)}</td>
                      <td className="text-end text-nowrap">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            applySavedPromptFromRow(row);
                            setSavedPromptModalOpen(false);
                          }}
                        >
                          Use
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="d-flex flex-wrap gap-2 justify-content-between">
          <Link
            to="/admin/openai-questionnaire/prompts"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setSavedPromptModalOpen(false)}
          >
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden />
            Open prompt library
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={savedPromptModalLoading}
            onClick={() => setSavedPromptModalOpen(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

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
