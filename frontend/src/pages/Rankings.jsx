import { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { pickAdFromResponse } from '../utils/pickAdFromResponse.js';

const practiceModes = [
  { value: '', label: 'All test types' },
  { value: 'quick', label: 'Quick practice' },
  { value: 'full', label: 'Full mock' },
];

export default function Rankings() {
  const { user, isSubscribed, isAdmin, loading: authLoading } = useAuth();
  const [adA, setAdA] = useState(null);
  const [adB, setAdB] = useState(null);
  const [exams, setExams] = useState([]);
  const [examCode, setExamCode] = useState('');
  const [practiceMode, setPracticeMode] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/exams').then((res) => setExams(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    const params = {};
    if (examCode) {
      params.exam_code = examCode;
    }
    if (practiceMode) {
      params.practice_mode = practiceMode;
    }
    api
      .get('/rankings', { params })
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load rankings.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [examCode, practiceMode]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (isSubscribed && !isAdmin) {
      setAdA(null);
      setAdB(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [ra, rb] = await Promise.all([
          api.get('/ads', { params: { location: 'rankings_a' } }),
          api.get('/ads', { params: { location: 'rankings_b' } }),
        ]);
        if (cancelled) {
          return;
        }
        setAdA(pickAdFromResponse(ra));
        setAdB(pickAdFromResponse(rb));
      } catch {
        if (!cancelled) {
          setAdA(null);
          setAdB(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSubscribed, isAdmin, authLoading]);

  const filterSummary = useMemo(() => {
    const ex = exams.find((e) => e.code === examCode);
    const pm = practiceModes.find((p) => p.value === practiceMode);
    const parts = [];
    if (ex) {
      parts.push(ex.name);
    } else {
      parts.push('All exam programs');
    }
    parts.push(pm?.label || 'All test types');
    return parts.join(' · ');
  }, [examCode, practiceMode, exams]);

  if (loading && data === null && !err) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  if (err) {
    return (
      <Container className="py-4">
        <p className="text-danger">{err}</p>
      </Container>
    );
  }

  if (data && !data.enabled) {
    return (
      <Container className="py-4 py-md-5">
        <h1 className="h3 fw-bold mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-trophy text-br-rose" aria-hidden />
          Leaderboard
        </h1>
        <Alert variant="light" className="border">
          {data.message || 'Public rankings are not available right now.'}
        </Alert>
      </Container>
    );
  }

  const entries = data?.entries || [];
  const yr = data?.your_rank;

  return (
    <Container className="py-4 py-md-5">
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center flex-wrap gap-2">
        <i className="bi bi-trophy text-br-rose" aria-hidden />
        Leaderboard
        {loading && data !== null && <Spinner animation="border" size="sm" className="ms-1" aria-label="Loading" />}
      </h1>
      <p className="text-muted mb-4">
        Top 100 learners by average score on completed attempts. Names are shortened for privacy. Filters narrow which
        attempts count toward the average.
      </p>

      <AdSlot location="rankings_a" ad={adA} />

      <div className="br-card p-3 p-md-4 mb-4">
        <Row className="g-3 align-items-end">
          <Col md={5}>
            <Form.Label className="small text-muted mb-1">Exam program</Form.Label>
            <Form.Select value={examCode} onChange={(e) => setExamCode(e.target.value)}>
              <option value="">All exam programs</option>
              {exams.map((e) => (
                <option key={e.id} value={e.code}>
                  {e.name}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={5}>
            <Form.Label className="small text-muted mb-1">Test type</Form.Label>
            <Form.Select value={practiceMode} onChange={(e) => setPracticeMode(e.target.value)}>
              {practiceModes.map((p) => (
                <option key={p.value || 'all'} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={2} className="small text-muted">
            <span className="d-none d-md-block">Viewing</span>
            <div className="fw-semibold text-body">{filterSummary}</div>
          </Col>
        </Row>
      </div>

      {user && yr && (
        <Alert
          variant={yr.in_top_100 ? 'success' : 'info'}
          className={`border-0 d-flex flex-wrap align-items-center justify-content-between gap-2 ${yr.in_top_100 ? 'bg-success bg-opacity-10' : ''}`}
        >
          <span className="d-flex align-items-center gap-2">
            <i className="bi bi-person-badge" aria-hidden />
            <span>
              <strong>Your position:</strong> #{yr.rank} · {yr.display_name} · {yr.score}% average
              {!yr.in_top_100 && (
                <span className="ms-1">(outside the top 100 for this view — keep practicing!)</span>
              )}
            </span>
          </span>
          <Link to="/exam/start" className="btn btn-sm btn-outline-primary">
            Practice again
          </Link>
        </Alert>
      )}

      {user && !yr && data?.enabled && (
        <Alert variant="light" className="border mb-4">
          <i className="bi bi-info-circle me-2" aria-hidden />
          You do not have a ranked average for this filter yet. Finish at least one scored attempt that matches these
          filters to appear on the board.
        </Alert>
      )}

      {!user && (
        <Alert variant="light" className="border mb-4">
          <Link to="/login">Log in</Link> to see your rank highlighted when you qualify.
        </Alert>
      )}

      <div className="br-card p-0 overflow-hidden">
        <div className="table-responsive">
          <Table hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: '4rem' }}>#</th>
                <th>Learner</th>
                <th className="text-end" style={{ width: '8rem' }}>
                  Avg score
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted text-center py-4">
                    No ranked attempts for this filter yet.
                  </td>
                </tr>
              ) : (
                entries.map((row) => (
                  <tr
                    key={`${row.rank}-${row.display_name}-${row.is_fake}`}
                    className={row.is_you ? 'table-primary br-rank-you' : undefined}
                  >
                    <td className="fw-semibold">{row.rank}</td>
                    <td>
                      {row.display_name}
                      {/* {row.is_fake && (
                        <span className="badge bg-secondary bg-opacity-25 text-secondary ms-2 small">Demo</span>
                      )} */}
                      {row.is_you && (
                        <span className="badge bg-primary ms-2 small">You</span>
                      )}
                    </td>
                    <td className="text-end font-monospace">{row.score}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <AdSlot location="rankings_b" ad={adB} />

      <p className="small text-muted mt-3 mb-0">
        Demo rows may be shown when enabled by admins so the board never looks empty. Rankings use mean score across
        matching completed attempts.
      </p>
    </Container>
  );
}
