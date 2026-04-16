import { Button, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function StudyPlanAbout() {
  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col lg={9}>
          <div className="br-card p-4 p-md-5">
            <h1 className="h3 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-calendar-check text-br-rose" aria-hidden />
              Smart Exam Planner
            </h1>
            <p className="text-muted lead fs-6 mb-4">
              BandReady&apos;s AI study roadmap helps you pace IELTS General or CELPIP General prep from today through
              your exam — with a schedule that matches how often you can study.
            </p>
            <ul className="small text-body mb-4 ps-3">
              <li className="mb-2">Session-by-session plan from Bandie (OpenAI), aligned to your exam date and weak areas.</li>
              <li className="mb-2">Rhythm options: every day, weekdays, weekends, or custom weekdays.</li>
              <li className="mb-2">Track completion as you go; edit your exam date when plans change.</li>
              <li className="mb-2">
                <strong className="text-body">Free accounts</strong> include a limited exam window and a small number of
                plan generations; <strong className="text-body">BandReady Pro</strong> unlocks a longer window and unlimited
                generations.
              </li>
            </ul>
            <p className="small text-muted mb-4">
              Create and manage your plan from your dashboard after you sign up and verify your email. Guests can explore
              this page; generating a plan requires a verified account.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <Button as={Link} to="/register" variant="primary" className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-person-plus" aria-hidden />
                Create account
              </Button>
              <Button as={Link} to="/login" variant="outline-primary" className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-box-arrow-in-right" aria-hidden />
                Log in
              </Button>
              <Button as={Link} to="/subscription" variant="outline-secondary" className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-star" aria-hidden />
                Compare Pro
              </Button>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
