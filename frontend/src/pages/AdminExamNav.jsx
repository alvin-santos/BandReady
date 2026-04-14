import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { api } from '../api/client.js';
import { CELPIP_SECTION_TASKS } from '../data/celpipOfficialTasks.js';

const SECTION_ORDER = ['Listening', 'Reading', 'Writing', 'Speaking'];

/** @param {Record<string, Record<string, string>>} inputs */
function payloadFromInputs(inputs) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  for (const section of SECTION_ORDER) {
    const tasks = CELPIP_SECTION_TASKS[section];
    if (!tasks) {
      continue;
    }
    const row = inputs[section] || {};
    /** @type {Record<string, number>} */
    const sec = {};
    for (const t of tasks) {
      const raw = row[String(t.id)] ?? '';
      const trimmed = String(raw).trim();
      if (trimmed === '') {
        continue;
      }
      const n = Math.trunc(Number(trimmed));
      if (!Number.isFinite(n) || n < 0) {
        continue;
      }
      sec[String(t.id)] = Math.min(n, 500);
    }
    if (Object.keys(sec).length) {
      out[section] = sec;
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * @param {Record<string, Record<string, number>> | null | undefined} saved
 * @returns {Record<string, Record<string, string>>}
 */
function inputsFromSaved(saved) {
  /** @type {Record<string, Record<string, string>>} */
  const inputs = {};
  for (const section of SECTION_ORDER) {
    inputs[section] = {};
    const tasks = CELPIP_SECTION_TASKS[section] || [];
    const sec = saved && typeof saved === 'object' ? saved[section] : null;
    for (const t of tasks) {
      const v = sec && typeof sec === 'object' ? sec[String(t.id)] ?? sec[t.id] : undefined;
      inputs[section][String(t.id)] =
        v != null && v !== '' && Number.isFinite(Number(v)) ? String(Math.trunc(Number(v))) : '';
    }
  }
  return inputs;
}

export default function AdminExamNav() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [inputs, setInputs] = useState(() => inputsFromSaved(null));

  const sectionsToRender = useMemo(
    () => SECTION_ORDER.filter((s) => Array.isArray(CELPIP_SECTION_TASKS[s]) && CELPIP_SECTION_TASKS[s].length),
    []
  );

  useEffect(() => {
    api
      .get('/admin/exam-nav-settings')
      .then((res) => {
        setInputs(inputsFromSaved(res.data.celpip_default_questions_per_task));
      })
      .catch(() => setErr('Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  function setTaskField(section, taskId, value) {
    setInputs((prev) => ({
      ...prev,
      [section]: { ...prev[section], [String(taskId)]: value },
    }));
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    const payload = payloadFromInputs(inputs);
    setSaving(true);
    try {
      await api.put('/admin/exam-nav-settings', {
        celpip_default_questions_per_task: payload,
      });
      setOk('Saved.');
      setInputs(inputsFromSaved(payload));
    } catch (e2) {
      const msg = e2.response?.data?.message;
      const details = e2.response?.data?.errors;
      setErr(msg || (details ? JSON.stringify(details) : 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-5 text-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-grid-3x3-gap text-br-rose" aria-hidden />
        CELPIP task question counts
      </h1>
      <p className="text-muted mb-4">
        Defaults for how many questions to draw <strong>per official CELPIP-style task</strong> (task numbers match the
        catalog) when an attempt starts. Applies by section (Listening, Reading, etc.). Per-test caps in{' '}
        <strong>Tests</strong> admin override these for the same task number. Blank = no site default for that task.{' '}
        <strong>0</strong> = exclude that task from the pool when saved here.
      </p>

      {err && (
        <Alert variant="danger" className="mb-3">
          {err}
        </Alert>
      )}
      {ok && (
        <Alert variant="success" className="mb-3">
          {ok}
        </Alert>
      )}

      <Form onSubmit={save}>
        {sectionsToRender.map((section) => (
          <div key={section} className="br-card p-4 mb-3">
            <h2 className="h6 fw-bold mb-3">{section}</h2>
            <div className="row g-3">
              {(CELPIP_SECTION_TASKS[section] || []).map((t) => (
                <div key={t.id} className="col-md-6 col-xl-4">
                  <Form.Group>
                    <Form.Label className="small text-muted mb-1">
                      Task {t.id} — {t.label}
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      value={inputs[section]?.[String(t.id)] ?? ''}
                      onChange={(e) => setTaskField(section, t.id, e.target.value)}
                      placeholder="Default blank"
                    />
                  </Form.Group>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button type="submit" disabled={saving} className="d-inline-flex align-items-center gap-2">
          {saving ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check-lg" aria-hidden />}
          Save settings
        </Button>
      </Form>
    </div>
  );
}
