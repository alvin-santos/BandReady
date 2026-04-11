import { useEffect, useState } from 'react';
import { Badge, Button, Col, Container, ListGroup, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function MistakesHub() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    api
      .get('/mistakes/hub')
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load your mistakes hub.');
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
  }, [user]);

  if (!user) {
    return (
      <Container className="py-5">
        <p className="d-flex align-items-center gap-2">
          <i className="bi bi-lock" aria-hidden />
          <Link to="/login">Log in</Link> to review mistakes and weak skills.
        </p>
      </Container>
    );
  }

  if (loading) {
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

  const queue = data?.queue || [];
  const weak = data?.weak_sections || [];
  const tips = data?.tips || [];
  const stats = data?.stats || {};

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-bullseye text-br-rose" aria-hidden />
        Mistakes &amp; weak skills
      </h1>
      <p className="text-muted mb-4">
        Your review queue surfaces <strong>unique questions you missed</strong>, oldest first (simple spaced-style
        priority). Open results for full prompts; use practice links to schedule fresh attempts in the same program.
      </p>

      <Row className="g-4">
        <Col lg={8}>
          <div className="br-card p-4 mb-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-list-ol" aria-hidden />
              Review queue
            </h2>
            <p className="small text-muted mb-3">
              {stats.queued_mistakes ?? 0} unique items in queue · {stats.total_wrong_answers ?? 0} total incorrect
              responses recorded
            </p>
            {queue.length === 0 ? (
              <p className="text-muted mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-emoji-smile" aria-hidden />
                Nothing queued — keep practicing; wrong answers will appear here.
              </p>
            ) : (
              <ListGroup variant="flush">
                {queue.map((m, idx) => (
                  <ListGroup.Item key={`${m.question_id}-${m.answer_id}`} className="px-0 py-3 border-opacity-10">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <Badge bg="secondary" className="me-1">
                          #{idx + 1}
                        </Badge>
                        <Badge bg="light" text="dark" className="border me-1">
                          {m.section_name}
                        </Badge>
                        <span className="small text-muted">{m.exam_name}</span>
                      </div>
                      <span className="small text-muted">{m.completed_at?.slice(0, 10)}</span>
                    </div>
                    <div className="mb-2">{m.question_excerpt}</div>
                    {m.explanation && <div className="small text-muted mb-2">{m.explanation}</div>}
                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        as={Link}
                        to={`/results/${m.attempt_id}`}
                        size="sm"
                        variant="outline-primary"
                        className="d-inline-flex align-items-center gap-1"
                      >
                        <i className="bi bi-journal-text" aria-hidden />
                        View result
                      </Button>
                      {m.exam_code && (
                        <Button
                          as={Link}
                          to={`/exam/start?exam=${encodeURIComponent(m.exam_code)}`}
                          size="sm"
                          variant="outline-secondary"
                          className="d-inline-flex align-items-center gap-1"
                        >
                          <i className="bi bi-play-fill" aria-hidden />
                          More {m.exam_name} practice
                        </Button>
                      )}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>

          {weak.length > 0 && (
            <div className="br-card p-4 mb-4">
              <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-graph-down-arrow text-warning" aria-hidden />
                Weaker sections
              </h2>
              <p className="small text-muted mb-3">Programs where you have at least two attempts and a lower average.</p>
              <ListGroup variant="flush">
                {weak.map((s) => (
                  <ListGroup.Item
                    key={`${s.exam_code}-${s.section_name}`}
                    className="px-0 d-flex flex-wrap justify-content-between align-items-center gap-2"
                  >
                    <span>
                      {s.exam_name} · {s.section_name}{' '}
                      <span className="text-muted small">({s.attempts_count} attempts)</span>
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold">{s.avg_score != null ? `${s.avg_score}%` : '—'}</span>
                      {s.exam_code && (
                        <Button
                          as={Link}
                          size="sm"
                          variant="outline-primary"
                          to={`/exam/start?exam=${encodeURIComponent(s.exam_code)}`}
                        >
                          Practice
                        </Button>
                      )}
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
        </Col>
        <Col lg={4}>
          <div className="br-card p-4 mb-3">
            <h3 className="h6 fw-bold mb-2">How to use this hub</h3>
            <ul className="small text-muted ps-3 mb-0">
              {tips.map((t) => (
                <li key={t} className="mb-2">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="br-card p-4">
            <h3 className="h6 fw-bold mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-download" aria-hidden />
              Resources
            </h3>
            <p className="small text-muted mb-2">Checklists and planners — some are Pro-only.</p>
            <Button as={Link} to="/resources" variant="outline-primary" size="sm" className="w-100 d-inline-flex align-items-center justify-content-center gap-1">
              <i className="bi bi-folder2-open" aria-hidden />
              Open downloads
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
