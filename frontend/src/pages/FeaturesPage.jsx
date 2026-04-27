import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const features = [
  {
    title: 'AI study plan',
    icon: 'bi-calendar-check',
    body:
      'Enter your exam date and goals. BandReady builds a step-by-step plan that balances skill building, timed runs, review sessions, and repeat loops.',
  },
  {
    title: 'Speaking practice',
    icon: 'bi-mic-fill',
    body:
      'Practice speaking prompts with a clear structure, pacing targets, and repeat attempts. Where enabled, AI feedback helps you fix clarity, vocabulary precision, and coherence.',
  },
  {
    title: 'Writing evaluation',
    icon: 'bi-pencil-square',
    body:
      'Get writing feedback that focuses on the issues that hold scores back: task response, organization, sentence clarity, grammar patterns, and high-impact vocabulary use.',
  },
  {
    title: 'Band score prediction (practice guidance)',
    icon: 'bi-speedometer2',
    body:
      'BandReady can estimate your current practice level based on your work. This is guidance for study—not a guarantee of official results.',
  },
  {
    title: 'Daily tasks',
    icon: 'bi-check2-circle',
    body:
      'Small daily tasks keep momentum. You always know what to do next: a speaking prompt, a writing task, or a timed practice section plus a short review.',
  },
  {
    title: 'Progress tracking',
    icon: 'bi-graph-up-arrow',
    body:
      'Track attempts, mistakes, and weak areas. The goal is stability under exam timing—so test day feels familiar and controlled.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-ui-checks-grid" aria-hidden />
          Features
        </p>
        <h1 className="h2 fw-bold mb-3">
          BandReady <span className="text-br-rose">features</span>
        </h1>
        <p className="lead text-muted mb-4" style={{ maxWidth: '46rem' }}>
          BandReady combines exam-style practice with AI-powered guidance. Use it for CELPIP and IELTS Academic or IELTS
          General Training preparation.
        </p>

        <Row className="g-4 mb-4">
          {features.map((f) => (
            <Col key={f.title} md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100 br-card">
                <Card.Body className="p-4">
                  <h2 className="h6 fw-bold mb-2 d-flex align-items-center gap-2">
                    <i className={`bi ${f.icon} text-br-rose`} aria-hidden />
                    {f.title}
                  </h2>
                  <p className="text-muted small mb-0">{f.body}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <div className="br-card p-4">
          <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-play-circle text-br-rose" aria-hidden />
            Next steps
          </h2>
          <p className="text-muted mb-0">
            Start with{' '}
            <Link to="/how-it-works" className="fw-semibold text-decoration-none">
              How it works
            </Link>
            , then try{' '}
            <Link to="/exam/start" className="fw-semibold text-decoration-none">
              a practice session
            </Link>{' '}
            or build your schedule in{' '}
            <Link to="/study-plan" className="fw-semibold text-decoration-none">
              Study plan
            </Link>
            .
          </p>
        </div>
      </Container>
    </div>
  );
}

