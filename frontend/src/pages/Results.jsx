import { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { resolveMediaUrl } from '../utils/mediaUrl.js';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatIeltsAiTranscriptForDisplay } from '../utils/ieltsAiSpeaking.js';

function WritingScoresExplainer() {
  return (
    <details className="border rounded mb-3 br-writing-scores-explainer">
      <summary className="px-3 py-2 fw-semibold small user-select-none">
        <i className="bi bi-info-circle me-1 text-br-rose" aria-hidden />
        How writing scores work
      </summary>
      <div className="px-3 pb-3 pt-2 small text-muted border-top">
        <p className="mb-2 text-body">
          Numbers are <strong>AI estimates for practice</strong> (0–100), except the band. They are not official exam marks.
        </p>
        <ul className="mb-2 ps-3">
          <li className="mb-1">
            <strong className="text-body">Overall</strong> — Holistic quality for this task; also drives how much this essay
            contributes to the approximate <strong className="text-body">test %</strong> above (averaged with other questions).
          </li>
          <li className="mb-1">
            <strong className="text-body">Relevance</strong> — How well you answered the prompt (on-topic, addresses the question).
          </li>
          <li className="mb-1">
            <strong className="text-body">Task</strong> — Ideas, development, and structure suited to the task (e.g. essay, email).
          </li>
          <li className="mb-1">
            <strong className="text-body">Language</strong> — Vocabulary and grammar (rough indication).
          </li>
          <li className="mb-0">
            <strong className="text-body">Band (indicative)</strong> — Rough IELTS-style level (0–9, half-band steps). For
            orientation only; real tests use human examiners and different criteria.
          </li>
        </ul>
        <p className="mb-0 small">
          If you see a short note instead of scores, AI feedback was not used for this attempt (e.g. subscription or service
          issue); the test % may use a simpler completion estimate for writing.
        </p>
      </div>
    </details>
  );
}

function WritingFeedbackCard({ feedback, variant = 'writing' }) {
  if (!feedback || typeof feedback !== 'object') {
    return null;
  }
  const mode = feedback.grading_mode;
  if (mode !== 'ai') {
    return (
      <Alert variant="light" className="border small mb-0 py-2">
        <i className="bi bi-info-circle me-1" aria-hidden />
        {feedback.message || 'Approximate score only (no AI feedback for this attempt).'}
      </Alert>
    );
  }
  const o = feedback.overall_score_0_100;
  const r = feedback.relevance_score_0_100;
  const t = feedback.task_score_0_100;
  const l = feedback.language_score_0_100;
  const band = feedback.band_estimate;
  return (
    <div className="small border rounded p-3 bg-body-secondary bg-opacity-25">
      <div className="d-flex flex-wrap gap-3 mb-2 text-muted">
        <span title="Holistic 0–100 for this practice task">
          <strong className="text-body">Overall</strong> {o ?? '—'}
        </span>
        <span
          title={
            variant === 'speaking'
              ? 'Broadly on-topic for the prompt/scene (not a checklist of image details)'
              : 'Addresses the prompt'
          }
        >
          <strong className="text-body">Relevance</strong> {r ?? '—'}
        </span>
        <span title={variant === 'speaking' ? 'Flow, ideas, and structure in the transcript' : 'Ideas and structure'}>
          <strong className="text-body">Task</strong> {t ?? '—'}
        </span>
        <span
          title={
            variant === 'speaking'
              ? 'Vocabulary and grammar (main focus for speaking practice scoring)'
              : 'Vocabulary and grammar'
          }
        >
          <strong className="text-body">Language</strong> {l ?? '—'}
        </span>
        {band != null && (
          <span title="Indicative only — not an official exam band">
            <strong className="text-body">Band (indicative)</strong> {band}
          </span>
        )}
      </div>
      {feedback.off_topic && (
        <p className="text-warning-emphasis small mb-2 mb-0">
          <i className="bi bi-exclamation-triangle me-1" aria-hidden />
          Response may be off-topic or not a full attempt.
        </p>
      )}
      {feedback.summary && <p className="mb-2 mb-md-3">{feedback.summary}</p>}
      {(feedback.strengths?.length > 0 || feedback.improvements?.length > 0) && (
        <Row className="g-2">
          {feedback.strengths?.length > 0 && (
            <Col md={6}>
              <div className="fw-semibold text-success-emphasis small mb-1">Strengths</div>
              <ul className="mb-0 ps-3">
                {feedback.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Col>
          )}
          {feedback.improvements?.length > 0 && (
            <Col md={6}>
              <div className="fw-semibold text-br-rose small mb-1">To improve</div>
              <ul className="mb-0 ps-3">
                {feedback.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Col>
          )}
        </Row>
      )}
      <p className="text-muted mt-2 mb-0 small">
        {variant === 'speaking'
          ? 'Based on speech-to-text; pronunciation and delivery are not judged. AI feedback is approximate — not a certified score.'
          : 'AI feedback is approximate and for practice only — not a certified score.'}
      </p>
    </div>
  );
}

function GuestAccountCta() {
  return (
    <Alert
      variant="light"
      className="mb-4 shadow-sm py-3 py-md-4 border border-2 border-primary"
      role="region"
      aria-label="Create an account to save progress"
    >
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div className="d-flex gap-3">
          <div className="d-none d-sm-flex align-items-start fs-2 lh-1 text-primary" aria-hidden>
            <i className="bi bi-speedometer2" />
          </div>
          <div>
            <div className="fw-bold h5 mb-1 text-body">See your readiness &amp; dashboard</div>
            <p className="mb-0 small text-body">
              This run is not tied to a saved profile.{' '}
              <strong className="text-body">Create a free account</strong> (or log in) to get a readiness summary, full
              dashboard, analytics over time, resume tests, and your mistakes list — all in one place.
            </p>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 flex-shrink-0">
          <Button as={Link} to="/register" variant="primary" className="fw-semibold d-inline-flex align-items-center gap-2">
            <i className="bi bi-person-plus" aria-hidden />
            Create free account
          </Button>
          <Button as={Link} to="/login" variant="outline-primary" className="d-inline-flex align-items-center gap-2">
            <i className="bi bi-box-arrow-in-right" aria-hidden />
            Log in
          </Button>
        </div>
      </div>
    </Alert>
  );
}

export default function Results() {
  const { id } = useParams();
  const { user, isSubscribed, loading: authLoading } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adA, setAdA] = useState(null);
  const [adB, setAdB] = useState(null);

  useEffect(() => {
    if (isSubscribed) {
      setAdA(null);
      setAdB(null);
      return;
    }
    (async () => {
      const [ra, rb] = await Promise.all([
        api.get('/ads', { params: { location: 'results_a' } }),
        api.get('/ads', { params: { location: 'results_b' } }),
      ]);
      const pick = (list) => {
        const data = list.data || [];
        return data.find((a) => a.active) || data[0] || null;
      };
      setAdA(pick(ra));
      setAdB(pick(rb));
    })();
  }, [isSubscribed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/results/${id}`);
        if (!cancelled) {
          setPayload(data);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  if (!payload) {
    return (
      <Container className="py-5">
        <p className="d-flex align-items-center gap-2 text-muted">
          <i className="bi bi-emoji-frown" aria-hidden />
          Results not found.
        </p>
      </Container>
    );
  }

  const { attempt, test, details } = payload;
  const mins = Math.floor((attempt.time_spent_seconds || 0) / 60);
  const secs = (attempt.time_spent_seconds || 0) % 60;

  return (
    <Container className="py-4">
      {!authLoading && !user && <GuestAccountCta />}
      <Row className="g-4 mb-4">
        <Col lg={8}>
          <div className="br-card p-4">
            <p className="text-uppercase small text-muted mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-clipboard-data" aria-hidden />
              Results
            </p>
            <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-journal-check text-br-rose" aria-hidden />
              {test.title}
            </h1>
            <p className="text-muted mb-4 d-flex align-items-center gap-2 flex-wrap">
              <i className="bi bi-bookmark" aria-hidden />
              {test.exam?.name} · {test.section?.name}
            </p>
            <Row className="g-3 mb-4">
              <Col sm={4}>
                <div className="small text-muted d-flex align-items-center gap-1">
                  <i className="bi bi-trophy" aria-hidden />
                  Approx. score
                </div>
                <div className="display-6 fw-bold text-br-rose">{attempt.score ?? '—'}%</div>
              </Col>
              <Col sm={4}>
                <div className="small text-muted d-flex align-items-center gap-1">
                  <i className="bi bi-stopwatch" aria-hidden />
                  Time used
                </div>
                <div className="fs-3 fw-bold">
                  {mins}m {secs}s
                </div>
              </Col>
              <Col sm={4} className="d-flex align-items-end">
                <Button
                  as={Link}
                  to={`/exam/start?exam=${test.exam?.code || ''}`}
                  variant="primary"
                  className="d-inline-flex align-items-center gap-2"
                >
                  <i className="bi bi-arrow-repeat" aria-hidden />
                  Retake
                </Button>
              </Col>
            </Row>

            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-list-check" aria-hidden />
              Review
            </h2>
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th><i className="bi bi-hash" aria-hidden /></th>
                    <th><i className="bi bi-tag me-1" aria-hidden />Type</th>
                    <th><i className="bi bi-pencil me-1" aria-hidden />Your answer</th>
                    <th><i className="bi bi-check2-square me-1" aria-hidden />Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => (
                    <tr key={d.question.id}>
                      <td>{i + 1}</td>
                      <td className="text-muted small">{d.question.type}</td>
                      <td>
                        <span className="small text-break">
                          {formatIeltsAiTranscriptForDisplay(String(d.your_answer ?? '—')).slice(0, 220)}
                        </span>
                      </td>
                      <td>
                        {d.is_correct === null ? (
                          <span className="badge bg-secondary">Subjective</span>
                        ) : d.is_correct ? (
                          <span className="badge bg-success">Yes</span>
                        ) : (
                          <span className="badge bg-danger">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {details.some((d) => d.question.type === 'essay') && (
              <>
                <h3 className="h6 fw-bold mt-4 d-flex align-items-center gap-2">
                  <i className="bi bi-pen" aria-hidden />
                  Writing feedback
                </h3>
                <WritingScoresExplainer />
                {details
                  .filter((d) => d.question.type === 'essay')
                  .map((d, idx) => (
                    <div key={d.question.id} className="border rounded p-3 mb-3">
                      <div className="fw-semibold small mb-2 text-muted">
                        Task {idx + 1}
                      </div>
                      <WritingFeedbackCard feedback={d.writing_feedback} variant="writing" />
                    </div>
                  ))}
              </>
            )}

            {details.some((d) => d.question.type === 'speaking_prompt') && (
              <>
                <h3 className="h6 fw-bold mt-4 d-flex align-items-center gap-2">
                  <i className="bi bi-mic" aria-hidden />
                  Speaking feedback
                </h3>
                <p className="small text-muted mb-2">
                  Scores reflect the <strong>transcript</strong> of what you said (automatic speech-to-text), not your voice or accent. Estimates prioritize{' '}
                  <strong>English use</strong>—grammar, vocabulary, and coherence—while expecting you to stay{' '}
                  <strong>broadly on topic</strong> for picture or scenario tasks (you do not need to name every detail in the image).
                </p>
                {details
                  .filter((d) => d.question.type === 'speaking_prompt')
                  .map((d, idx) => (
                    <div key={d.question.id} className="border rounded p-3 mb-3">
                      <div className="fw-semibold small mb-2 text-muted">
                        Task {idx + 1}
                      </div>
                      {d.question.image_url && (
                        <img
                          src={resolveMediaUrl(d.question.image_url) ?? d.question.image_url}
                          alt=""
                          className="img-fluid rounded border mb-3 br-speaking-scene__img"
                        />
                      )}
                      <WritingFeedbackCard feedback={d.speaking_feedback} variant="speaking" />
                    </div>
                  ))}
              </>
            )}

            <h3 className="h6 fw-bold mt-4 d-flex align-items-center gap-2">
              <i className="bi bi-chat-square-text" aria-hidden />
              Explanations
            </h3>
            {details.map((d) => (
              <div key={d.question.id} className="border rounded p-3 mb-2">
                <div className="fw-semibold small mb-1 d-flex align-items-start gap-2">
                  <i className="bi bi-question-circle text-br-rose mt-1 flex-shrink-0" aria-hidden />
                  <span>Q. {d.question.question_text.slice(0, 120)}…</span>
                </div>
                <div className="small text-muted">{d.explanation || '—'}</div>
              </div>
            ))}
          </div>
        </Col>
        <Col lg={4}>
          <AdSlot location="results_a" ad={adA} />
          <div className="my-3" />
          <AdSlot location="results_b" ad={adB} />
        </Col>
      </Row>
    </Container>
  );
}
