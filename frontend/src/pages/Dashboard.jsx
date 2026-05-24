import { useEffect, useState } from 'react';
import { Button, Col, Container, ListGroup, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AdSlot from '../components/AdSlot.jsx';
import { pickAdFromResponse } from '../utils/pickAdFromResponse.js';
import ReadinessCard from '../components/ReadinessCard.jsx';

export default function Dashboard() {
  const { user, isSubscribed, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState('');
  const [dashboardAd, setDashboardAd] = useState(null);

  useEffect(() => {
    if (isSubscribed && !isAdmin) {
      setDashboardAd(null);
      return;
    }
    api.get('/ads', { params: { location: 'dashboard' } }).then((res) => {
      setDashboardAd(pickAdFromResponse(res));
    });
  }, [isSubscribed, isAdmin]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [dash, act] = await Promise.all([
          api.get('/dashboard'),
          api.get('/attempts/active'),
        ]);
        if (!cancelled) {
          setData(dash.data);
          setActive(act.data);
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load dashboard.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <Container className="py-5">
        <p className="d-flex align-items-center gap-2">
          <i className="bi bi-lock" aria-hidden />
          Please <Link to="/login">log in</Link> to view your dashboard.
        </p>
      </Container>
    );
  }

  if (!data && !err) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-speedometer2 text-br-rose" aria-hidden />
          Dashboard
        </h1>
        <Link
          to="/analytics"
          className="small text-decoration-none d-inline-flex align-items-center gap-1 text-br-rose fw-semibold"
        >
          <i className="bi bi-graph-up-arrow" aria-hidden />
          Analytics
        </Link>
      </div>
      {err && (
        <p className="text-danger d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon-fill" aria-hidden />
          {err}
        </p>
      )}
          <ReadinessCard readiness={data?.readiness} />
          <div className="br-card p-4 mb-4 border border-br-rose border-opacity-25">
            <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-calendar-check text-br-rose" aria-hidden />
              Smart Exam Planner
            </h2>
            <p className="small text-muted mb-3">
              Get a personalized day-by-day IELTS or CELPIP study roadmap from Bandie (OpenAI), tailored to your exam date
              and weak areas. Free accounts include a limited exam window and a few plan generations; Pro unlocks more.
            </p>
            <Button as={Link} to="/study-plan" variant="primary" size="sm" className="d-inline-flex align-items-center gap-2">
              <i className="bi bi-magic" aria-hidden />
              Open study plan
            </Button>
          </div>
          <Row className="g-4">
        <Col lg={8}>
          {active?.attempt && (
            <div className="br-card p-4 mb-4">
              <h2 className="h5 fw-bold d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-play-circle text-br-rose" aria-hidden />
                Continue test
              </h2>
              <p className="text-muted small mb-2 d-flex align-items-start gap-2">
                <i className="bi bi-journal-text mt-1" aria-hidden />
                {active.test?.title}
              </p>
              <Button as={Link} to={`/exam/run/${active.attempt.id}`} className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-arrow-right-circle-fill" aria-hidden />
                Resume
              </Button>
            </div>
          )}

          <div className="br-card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h2 className="h5 fw-bold mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-clock-history" aria-hidden />
                Past attempts
              </h2>
              <Button as={Link} to="/exam/start" size="sm" variant="primary" className="d-inline-flex align-items-center gap-1">
                <i className="bi bi-plus-lg" aria-hidden />
                Start new test
              </Button>
            </div>
            <ListGroup variant="flush">
              {data?.recent_attempts?.length ? (
                data.recent_attempts.map((a) => (
                  <ListGroup.Item key={a.id} className="px-0 d-flex justify-content-between">
                    <div>
                      <div className="fw-semibold d-flex align-items-center gap-2">
                        <i className="bi bi-file-earmark-text text-muted" aria-hidden />
                        {a.test?.title}
                      </div>
                      <div className="small text-muted d-flex align-items-center gap-1 ms-4">
                        <i className="bi bi-calendar3" aria-hidden />
                        {a.completed_at?.slice(0, 10)}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold">{a.score != null ? `${a.score}%` : '—'}</div>
                      <Link to={`/results/${a.id}`} className="small d-inline-flex align-items-center gap-1">
                        <i className="bi bi-bar-chart-line" aria-hidden />
                        Results
                      </Link>
                    </div>
                  </ListGroup.Item>
                ))
              ) : (
                <p className="text-muted mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-inbox" aria-hidden />
                  No completed attempts yet.
                </p>
              )}
            </ListGroup>
          </div>

          <div className="br-card p-4 mb-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-graph-up" aria-hidden />
              Stats
            </h2>
            <Row>
              <Col sm={6}>
                <div className="small text-muted d-flex align-items-center gap-1">
                  <i className="bi bi-trophy" aria-hidden />
                  Average score (approx.)
                </div>
                <div className="fs-4 fw-bold">
                  {data?.average_score != null ? `${data.average_score}%` : '—'}
                </div>
              </Col>
              <Col sm={6}>
                <div className="small text-muted d-flex align-items-center gap-1">
                  <i className="bi bi-check2-circle" aria-hidden />
                  Completed
                </div>
                <div className="fs-4 fw-bold">{data?.completed_count ?? 0}</div>
              </Col>
            </Row>
          </div>

          {data?.section_stats?.length > 0 && (
            <div className="br-card p-4 mb-4">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-pie-chart" aria-hidden />
                Progress by section
              </h2>
              <ListGroup variant="flush">
                {data.section_stats.map((s) => (
                  <ListGroup.Item key={`${s.exam_name}-${s.section_name}`} className="px-0 d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="fw-semibold">
                        {s.exam_name} · {s.section_name}
                      </div>
                      <div className="small text-muted">
                        {s.attempts_count} attempt{s.attempts_count === 1 ? '' : 's'}
                        {s.last_completed_at && ` · last ${s.last_completed_at.slice(0, 10)}`}
                      </div>
                    </div>
                    <div className="fw-bold text-nowrap">{s.avg_score != null ? `${s.avg_score}%` : '—'}</div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}

          {data?.weak_sections?.length > 0 && (
            <div className="br-card p-4 mb-4">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-bullseye text-warning" aria-hidden />
                Focus areas
              </h2>
              <p className="small text-muted mb-2">Sections with the lowest averages among those you attempted at least twice.</p>
              <ListGroup variant="flush">
                {data.weak_sections.map((s) => (
                  <ListGroup.Item key={`w-${s.exam_name}-${s.section_name}`} className="px-0 d-flex justify-content-between">
                    <span>
                      {s.exam_name} · {s.section_name}
                    </span>
                    <span className="fw-bold">{s.avg_score != null ? `${s.avg_score}%` : '—'}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}

          {data?.review_mistakes?.length > 0 && (
            <div className="br-card p-4 mb-4">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center flex-wrap gap-2">
                <i className="bi bi-arrow-counterclockwise" aria-hidden />
                Review mistakes
                <Link to="/practice/mistakes" className="ms-lg-auto small fw-semibold">
                  Open mistakes hub
                </Link>
              </h2>
              <p className="small text-muted mb-3">Recent incorrect objective items. Open results to see full prompts and explanations.</p>
              <ListGroup variant="flush">
                {data.review_mistakes.map((m) => (
                  <ListGroup.Item key={m.answer_id} className="px-0">
                    <div className="small text-muted mb-1">
                      {m.exam_name} · {m.section_name} · {m.completed_at?.slice(0, 10)}
                    </div>
                    <div className="mb-1">{m.question_excerpt}</div>
                    {m.explanation && <div className="small text-muted mb-2">{m.explanation}</div>}
                    <Link to={`/results/${m.attempt_id}`} className="small d-inline-flex align-items-center gap-1">
                      <i className="bi bi-box-arrow-up-right" aria-hidden />
                      View result
                    </Link>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
        </Col>
        <Col lg={4}>
          <AdSlot location="dashboard" ad={dashboardAd} />
          <div className="br-card p-3 mt-3">
            <h3 className="h6 fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-lightbulb text-warning" aria-hidden />
              Recommended
            </h3>
            <p className="small text-muted mb-2">Try a timed reading set, a full mock, or review how practice relates to real tests.</p>
            <Button as={Link} to="/exam/start" variant="outline-primary" size="sm" className="d-inline-flex align-items-center gap-1 mb-2 w-100">
              <i className="bi bi-search" aria-hidden />
              Browse tests
            </Button>
            <Button as={Link} to="/practice-disclaimer" variant="outline-secondary" size="sm" className="d-inline-flex align-items-center gap-1 w-100 mb-2">
              <i className="bi bi-shield-exclamation" aria-hidden />
              Practice disclaimer
            </Button>
            <Button as={Link} to="/practice/mistakes" variant="outline-primary" size="sm" className="d-inline-flex align-items-center gap-1 w-100 mb-2">
              <i className="bi bi-bullseye" aria-hidden />
              Mistakes hub
            </Button>
            <Button as={Link} to="/resources" variant="outline-secondary" size="sm" className="d-inline-flex align-items-center gap-1 w-100">
              <i className="bi bi-download" aria-hidden />
              Downloads &amp; guides
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
