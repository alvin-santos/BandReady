import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { api } from '../api/client.js';

export default function AdminBandieTutor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    api
      .get('/admin/bandie-tutor-settings')
      .then((res) => {
        setEnabled(!!res.data.bandie_tutor_enabled);
      })
      .catch(() => setErr('Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setSaving(true);
    try {
      await api.put('/admin/bandie-tutor-settings', {
        bandie_tutor_enabled: enabled,
      });
      setOk('Saved.');
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
        <i className="bi bi-chat-heart text-br-rose" aria-hidden />
        Bandie tutor
      </h1>
      <p className="text-muted mb-4">
        Bandie is the floating tips companion on practice and exam screens. Turn it off here to hide it for everyone
        (including signed-in users). Per-user &quot;Don&apos;t show again&quot; still applies when Bandie is enabled.
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

      <Form onSubmit={save} className="br-card p-4">
        <Form.Check
          type="switch"
          id="bandie-on"
          className="mb-4"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Show Bandie tutor site-wide"
        />
        <Button type="submit" disabled={saving} className="d-inline-flex align-items-center gap-2">
          {saving ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check-lg" aria-hidden />}
          Save settings
        </Button>
      </Form>
    </div>
  );
}
