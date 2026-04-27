import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const steps = [
  {
    title: 'Step 1 — Enter your exam date',
    icon: 'bi-calendar-event',
    body:
      'Tell BandReady when you plan to take CELPIP or IELTS. Your date sets the pacing: what to focus on now, what to review weekly, and how to increase difficulty as the exam approaches.',
  },
  {
    title: 'Step 2 — BandReady generates a study plan',
    icon: 'bi-stars',
    body:
      'A plan is more than “study grammar.” BandReady turns your time into an actionable schedule: daily tasks, repeat loops, and checkpoints you can actually follow.',
  },
  {
    title: 'Step 3 — Practice real tasks (not just drills)',
    icon: 'bi-stopwatch',
    body:
      'Timed practice is where confidence is built. You rehearse reading, listening, speaking, and writing tasks in an exam-style flow so the timer and screen format stop being a surprise.',
  },
  {
    title: 'Step 4 — Get feedback and clear next actions',
    icon: 'bi-clipboard-check',
    body:
      'BandReady highlights what to improve next. When AI tools are enabled, you can get writing evaluation, speaking practice feedback, and band/level guidance to keep the loop tight.',
  },
  {
    title: 'Step 5 — Improve your score by repeating with intention',
    icon: 'bi-graph-up-arrow',
    body:
      'Progress comes from repetition with one improvement target at a time: clarity, cohesion, vocabulary precision, or pacing. Track weak areas, fix patterns, and watch your stability improve.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-diagram-3" aria-hidden />
          How it works
        </p>
        <h1 className="h2 fw-bold mb-3">
          How <span className="text-br-rose">BandReady</span> works
        </h1>
        <p className="lead text-muted mb-4" style={{ maxWidth: '46rem' }}>
          BandReady is an AI-powered CELPIP &amp; IELTS preparation platform. We combine a practical study plan with
          exam-style practice tasks, so you can train timing, improve weak areas, and build confidence before test day.
        </p>

        <Row className="g-4 mb-4">
          {steps.map((s) => (
            <Col key={s.title} md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100 br-card">
                <Card.Body className="p-4">
                  <h2 className="h6 fw-bold mb-2 d-flex align-items-center gap-2">
                    <i className={`bi ${s.icon} text-br-rose`} aria-hidden />
                    {s.title}
                  </h2>
                  <p className="text-muted small mb-0">{s.body}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <div className="br-card p-4">
          <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-lightbulb text-br-rose" aria-hidden />
            What makes this “high value” practice
          </h2>
          <p className="text-muted mb-2">
            The biggest reason learners stall is not effort—it’s the lack of a feedback loop. BandReady focuses on
            repeatable routines:
          </p>
          <ul className="text-muted ps-3 mb-3">
            <li className="mb-2">
              <strong>Specific tasks</strong> (speaking prompts, writing tasks, timed reading/listening) instead of
              unfocused study.
            </li>
            <li className="mb-2">
              <strong>Short review</strong> after each session: mistakes, patterns, and a single improvement goal.
            </li>
            <li className="mb-0">
              <strong>Progress tracking</strong> so you can see stability under a timer, not just “I studied a lot.”
            </li>
          </ul>
          <p className="text-muted mb-0">
            Ready to start?{' '}
            <Link to="/study-plan" className="fw-semibold text-decoration-none">
              Open the study plan
            </Link>{' '}
            or{' '}
            <Link to="/exam/start" className="fw-semibold text-decoration-none">
              run a practice session
            </Link>
            .
          </p>
        </div>
      </Container>
    </div>
  );
}

