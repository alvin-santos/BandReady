import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { api } from '../api/client.js';

const SECTION_KEYS = ['speaking', 'reading', 'writing', 'listening'];

const SECTION_LABELS = {
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
};

/** @param {Record<string, string[]> | undefined} bank */
function bankToTextareas(bank) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of SECTION_KEYS) {
    const arr = bank && Array.isArray(bank[k]) ? bank[k] : [];
    out[k] = arr.join('\n');
  }
  return out;
}

/** @param {Record<string, string>} textareas */
function textareasToBank(textareas) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const k of SECTION_KEYS) {
    const raw = textareas[k] ?? '';
    out[k] = String(raw)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return out;
}

export default function AdminBandieTutor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [tipsDetailed, setTipsDetailed] = useState(true);
  const [compactText, setCompactText] = useState(() => bankToTextareas(undefined));
  const [detailedText, setDetailedText] = useState(() => bankToTextareas(undefined));

  const applyLoaded = useCallback((data) => {
    setEnabled(!!data.bandie_tutor_enabled);
    setTipsDetailed(data.bandie_tips_detailed !== false);
    setCompactText(bankToTextareas(data.bandie_tutor_tips_compact));
    setDetailedText(bankToTextareas(data.bandie_tutor_tips_detailed));
  }, []);

  useEffect(() => {
    api
      .get('/admin/bandie-tutor-settings')
      .then((res) => applyLoaded(res.data))
      .catch(() => setErr('Could not load settings.'))
      .finally(() => setLoading(false));
  }, [applyLoaded]);

  async function save(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setSaving(true);
    try {
      const { data } = await api.put('/admin/bandie-tutor-settings', {
        bandie_tutor_enabled: enabled,
        bandie_tips_detailed: tipsDetailed,
        bandie_tutor_tips_compact: textareasToBank(compactText),
        bandie_tutor_tips_detailed: textareasToBank(detailedText),
      });
      applyLoaded(data);
      setOk('Saved.');
    } catch (e2) {
      const msg = e2.response?.data?.message;
      const details = e2.response?.data?.errors;
      setErr(msg || (details ? JSON.stringify(details) : 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }

  async function resetTipsToDefaults() {
    setErr('');
    setOk('');
    setSaving(true);
    try {
      const { data } = await api.put('/admin/bandie-tutor-settings', {
        bandie_tutor_enabled: enabled,
        bandie_tips_detailed: tipsDetailed,
        reset_bandie_tips_to_defaults: true,
      });
      applyLoaded(data);
      setOk('Tips reset to built-in defaults.');
    } catch (e2) {
      const msg = e2.response?.data?.message;
      const details = e2.response?.data?.errors;
      setErr(msg || (details ? JSON.stringify(details) : 'Reset failed.'));
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
        <i className="bi bi-chat-heart text-br-rose" aria-hidden />
        Bandie tutor
      </h1>
      <p className="text-muted mb-4">
        Bandie is the floating tips companion on practice and exam screens. Turn it off here to hide it for everyone
        (including signed-in users). Tip lines are stored in the database; leave a section blank on a line to skip
        empty rows. If every line in a bank matches the built-in defaults, it is stored as “using defaults”. Learners
        should refresh the app after you change tips.
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

      <Form onSubmit={save} className="br-card p-4 mb-3">
        <Form.Check
          type="switch"
          id="bandie-on"
          className="mb-3"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Show Bandie tutor site-wide"
        />
        <Form.Check
          type="switch"
          id="bandie-tips-detailed"
          className="mb-4"
          checked={tipsDetailed}
          onChange={(e) => setTipsDetailed(e.target.checked)}
          label="Use longer tip bank by default (detailed vs compact rotation)"
        />

        <h2 className="h6 fw-bold mb-3">Compact tips (one line per tip)</h2>
        <p className="small text-muted mb-3">
          Shown when &quot;longer tip bank&quot; is off, or rotated with detailed tips depending on learner state.
        </p>
        {SECTION_KEYS.map((k) => (
          <Form.Group key={`c-${k}`} className="mb-3">
            <Form.Label>{SECTION_LABELS[k]}</Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
              value={compactText[k]}
              onChange={(e) => setCompactText((prev) => ({ ...prev, [k]: e.target.value }))}
              className="font-monospace small"
              spellCheck
            />
          </Form.Group>
        ))}

        <h2 className="h6 fw-bold mb-3 mt-4">Detailed tips (one line per tip)</h2>
        <p className="small text-muted mb-3">Longer coaching lines with a bit of exam context.</p>
        {SECTION_KEYS.map((k) => (
          <Form.Group key={`d-${k}`} className="mb-3">
            <Form.Label>{SECTION_LABELS[k]}</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={detailedText[k]}
              onChange={(e) => setDetailedText((prev) => ({ ...prev, [k]: e.target.value }))}
              className="font-monospace small"
              spellCheck
            />
          </Form.Group>
        ))}

        <div className="d-flex flex-wrap gap-2">
          <Button type="submit" disabled={saving} className="d-inline-flex align-items-center gap-2">
            {saving ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check-lg" aria-hidden />}
            Save settings
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            disabled={saving}
            className="d-inline-flex align-items-center gap-2"
            onClick={resetTipsToDefaults}
          >
            <i className="bi bi-arrow-counterclockwise" aria-hidden />
            Reset tips to built-in defaults
          </Button>
        </div>
      </Form>
    </div>
  );
}
