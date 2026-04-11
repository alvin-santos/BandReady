import { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { api } from '../api/client.js';

/** Sample demo rows: null/null = only the fully unfiltered board. Pin exam_code and/or practice_mode to show when those filters match. */
export const SAMPLE_FAKE_RANKING_JSON = `[
  { "display_name": "Alex M.", "score": 94.2, "exam_code": null, "practice_mode": null },
  { "display_name": "Priya S.", "score": 91.0, "exam_code": null, "practice_mode": null },
  { "display_name": "Jordan K.", "score": 88.5, "exam_code": null, "practice_mode": null },
  { "display_name": "Sam L.", "score": 85.3, "exam_code": null, "practice_mode": null },
  { "display_name": "Taylor R.", "score": 82.1, "exam_code": null, "practice_mode": null },
  { "display_name": "Jamie P.", "score": 90.0, "exam_code": "ielts_academic", "practice_mode": null },
  { "display_name": "Riley C.", "score": 87.4, "exam_code": "ielts_general", "practice_mode": null },
  { "display_name": "Casey N.", "score": 86.0, "exam_code": "celpip_general", "practice_mode": null },
  { "display_name": "Morgan D.", "score": 83.5, "exam_code": "celpip_ls", "practice_mode": null },
  { "display_name": "Drew W.", "score": 89.0, "exam_code": null, "practice_mode": "full" },
  { "display_name": "Quinn H.", "score": 84.0, "exam_code": null, "practice_mode": "quick" },
  { "display_name": "Avery B.", "score": 80.5, "exam_code": null, "practice_mode": "quick" },
  { "display_name": "Rohan V.", "score": 88.8, "exam_code": "ielts_academic", "practice_mode": "full" },
  { "display_name": "Nina O.", "score": 79.5, "exam_code": "ielts_general", "practice_mode": "quick" }
]`;

export default function AdminRanking() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [mergeFake, setMergeFake] = useState(true);
  const [fakeJson, setFakeJson] = useState(SAMPLE_FAKE_RANKING_JSON);

  useEffect(() => {
    api
      .get('/admin/ranking-settings')
      .then((res) => {
        setEnabled(!!res.data.rankings_public_enabled);
        setMergeFake(!!res.data.rankings_merge_fake);
        const f = res.data.rankings_fake_entries;
        setFakeJson(JSON.stringify(f ?? [], null, 2));
      })
      .catch(() => setErr('Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function save(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    let parsed;
    try {
      parsed = JSON.parse(fakeJson);
    } catch {
      setErr('Fake entries must be valid JSON.');
      return;
    }
    if (!Array.isArray(parsed)) {
      setErr('Fake entries must be a JSON array.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/admin/ranking-settings', {
        rankings_public_enabled: enabled,
        rankings_merge_fake: mergeFake,
        rankings_fake_entries: parsed,
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
        <i className="bi bi-trophy text-br-rose" aria-hidden />
        Public rankings
      </h1>
      <p className="text-muted mb-4">
        Control whether the leaderboard is visible, and optionally merge demo names so the list looks full while the
        community grows. Each fake row can pin to an <code>exam_code</code> and/or <code>practice_mode</code> (
        <code>full</code>, <code>quick</code>); use <code>null</code> for both to show only on
        the unfiltered board.
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
          id="rank-on"
          className="mb-3"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Show public rankings to everyone"
        />
        <Form.Check
          type="switch"
          id="rank-fake"
          className="mb-4"
          checked={mergeFake}
          onChange={(e) => setMergeFake(e.target.checked)}
          label="Merge demo leaderboard rows (when enabled below)"
        />
        <Form.Group className="mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <Form.Label className="mb-0">Demo entries (JSON array)</Form.Label>
            <Button type="button" variant="outline-secondary" size="sm" onClick={() => setFakeJson(SAMPLE_FAKE_RANKING_JSON)}>
              Load sample JSON
            </Button>
          </div>
          <Form.Control
            as="textarea"
            rows={16}
            value={fakeJson}
            onChange={(e) => setFakeJson(e.target.value)}
            className="font-monospace small"
            spellCheck={false}
          />
          <Form.Text muted>
            Required: <code>display_name</code>, <code>score</code> (0–100). Optional: <code>exam_code</code> (e.g.{' '}
            <code>ielts_academic</code>, <code>ielts_general</code>, <code>celpip_general</code>, <code>celpip_ls</code>),{' '}
            <code>practice_mode</code> (<code>quick</code>, <code>full</code>). Use{' '}
            <code>null</code> for both to pad only the <strong>all programs + all test types</strong> leaderboard; pin one
            or both dimensions for filtered views.
          </Form.Text>
        </Form.Group>
        <Button type="submit" disabled={saving} className="d-inline-flex align-items-center gap-2">
          {saving ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check-lg" aria-hidden />}
          Save settings
        </Button>
      </Form>
    </div>
  );
}
