import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { api } from '../api/client.js';

const SECTIONS = ['Listening', 'Reading', 'Writing', 'Speaking'];

/** Defaults matching: `openai:generate-questionnaire --section=Listening --questions-per-test=10 --exam-title="CELPIP General" --test-title="Full mock — CELPIP General — Listening"` */
const DEFAULT_SECTION_PICK = Object.fromEntries(
  SECTIONS.map((s) => [s, s === 'Listening'])
);
const DEFAULT_QUESTIONS_PER_TEST = '10';
const DEFAULT_EXAM_TITLE = 'CELPIP General';
const DEFAULT_TEST_TITLE = 'Full mock — CELPIP General — Listening';

function buildArtisanPreview(body) {
  const parts = ['php artisan openai:generate-questionnaire'];
  if (Array.isArray(body.sections) && body.sections.length > 0) {
    for (const s of body.sections) {
      parts.push(`--section=${s}`);
    }
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
  return {
    sectionPick: { ...DEFAULT_SECTION_PICK },
    questionsPerTest: DEFAULT_QUESTIONS_PER_TEST,
    examTitle: DEFAULT_EXAM_TITLE,
    testTitle: DEFAULT_TEST_TITLE,
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
  const { sectionPick, questionsPerTest, examTitle, testTitle, extraPrompt, model, dryRun, noQuestionPreview, withSpeakingImages, fileJson } = form;

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
    () => SECTIONS.filter((s) => sectionPick[s]),
    [sectionPick]
  );

  const requestBody = useMemo(() => {
    const q = String(questionsPerTest).trim();
    const body = {
      extra_prompt: extraPrompt.trim() || undefined,
      model: model.trim() || undefined,
      dry_run: dryRun || undefined,
      no_question_preview: noQuestionPreview || undefined,
      with_speaking_images: withSpeakingImages || undefined,
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
    return body;
  }, [
    dryRun,
    examTitle,
    extraPrompt,
    fileJson,
    model,
    noQuestionPreview,
    questionsPerTest,
    selectedSections,
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
                Reset to CELPIP Listening example
              </Button>
            </div>
            <p className="small text-muted mb-3">
              Same flags as Artisan (order below follows your usual CLI: section → count → titles, then the rest).
            </p>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">
                <code className="text-body">--section</code> — OpenAI scope (repeat per section; leave all off = no filter / full
                exam)
              </Form.Label>
              <div className="d-flex flex-wrap gap-3">
                {SECTIONS.map((s) => (
                  <Form.Check
                    key={s}
                    type="checkbox"
                    id={`sec-${s}`}
                    label={s}
                    checked={sectionPick[s]}
                    onChange={(ev) =>
                      setForm((prev) => ({
                        ...prev,
                        sectionPick: { ...prev.sectionPick, [s]: ev.target.checked },
                      }))
                    }
                  />
                ))}
              </div>
            </Form.Group>

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
                    (Speaking scope only; skipped on dry-run)
                  </span>
                }
              />
            </Form.Group>

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
