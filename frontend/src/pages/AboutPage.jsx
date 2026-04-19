import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-building" aria-hidden />
          About BandReady
        </p>
        <h1 className="h2 fw-bold mb-3">
          About <span className="text-br-rose">BandReady</span>
        </h1>
        <p className="lead text-muted mb-4" style={{ maxWidth: '40rem' }}>
          BandReady is an independent online practice platform for English proficiency exams. We help learners rehearse
          timed sections, review results, and build confidence before test day.
        </p>

        <Row className="g-4 mb-4">
          <Col md={6}>
            <Card className="border-0 shadow-sm h-100 br-card">
              <Card.Body className="p-4">
                <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-bullseye text-br-rose" aria-hidden />
                  What we do
                </h2>
                <p className="text-muted small mb-0">
                  We host exam-style runs—listening, reading, writing, and speaking flows your programme configures—plus
                  dashboards, analytics, rankings, resources, a community forum, and optional AI-assisted tools such as
                  interview practice where enabled. Features depend on your account type and what your administrators
                  publish.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border-0 shadow-sm h-100 br-card">
              <Card.Body className="p-4">
                <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-shield-check text-br-rose" aria-hidden />
                  Independence
                </h2>
                <p className="text-muted small mb-0">
                  BandReady is <strong>not</strong> affiliated with, endorsed by, or connected to IELTS, CELPIP, or
                  official test providers. Names refer to the <em>style</em> of practice content only. Scores and AI
                  output are for learning—not a prediction of official results. Read our{' '}
                  <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
                    practice disclaimer
                  </Link>{' '}
                  for full detail.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <div className="br-card p-4 mb-4">
          <h2 className="h5 fw-bold mb-3">Transparency &amp; policies</h2>
          <ul className="text-muted small mb-0 ps-3">
            <li className="mb-2">
              <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
                Privacy Policy
              </Link>{' '}
              — how we collect, use, and protect information (including cookies and advertising).
            </li>
            <li className="mb-2">
              <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
                Practice disclaimer
              </Link>{' '}
              — how practice formats and scoring relate to official tests.
            </li>
            <li className="mb-0">
              <Link to="/contact" className="fw-semibold text-decoration-none">
                Contact
              </Link>{' '}
              — questions, feedback, or data requests.
            </li>
          </ul>
        </div>

        <p className="small text-muted mb-0">
          Want the full product tour? See{' '}
          <Link to="/why-bandready" className="fw-semibold text-decoration-none">
            Why BandReady
          </Link>
          .
        </p>
      </Container>
    </div>
  );
}
