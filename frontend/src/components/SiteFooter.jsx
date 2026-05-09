import { Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import AppDisclaimer from './AppDisclaimer.jsx';

export default function SiteFooter() {
  return (
    <footer
      className="br-page-stack border-top mt-auto py-4"
      style={{ borderColor: 'color-mix(in srgb, var(--br-blush-edge) 40%, var(--br-border))' }}
    >
      <Container>
        <Row className="g-4 mb-3">
          <Col sm={6} lg={3}>
            <h2 className="h6 fw-bold text-body mb-2">Practice &amp; study</h2>
            <ul className="list-unstyled small mb-0">
              <li className="mb-1">
                <Link to="/exam/start" className="link-secondary text-decoration-none">
                  Start practice
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/study-plan" className="link-secondary text-decoration-none">
                  Study plan
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/how-it-works" className="link-secondary text-decoration-none">
                  How it works
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/features" className="link-secondary text-decoration-none">
                  Features
                </Link>
              </li>
              <li className="mb-0">
                <Link to="/guides" className="link-secondary text-decoration-none">
                  Study guides
                </Link>
              </li>
            </ul>
          </Col>
          <Col sm={6} lg={3}>
            <h2 className="h6 fw-bold text-body mb-2">Community &amp; resources</h2>
            <ul className="list-unstyled small mb-0">
              <li className="mb-1">
                <Link to="/blog" className="link-secondary text-decoration-none">
                  Blog
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/forum" className="link-secondary text-decoration-none">
                  Forum
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/resources" className="link-secondary text-decoration-none">
                  Downloads &amp; guides
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/rankings" className="link-secondary text-decoration-none">
                  Rankings
                </Link>
              </li>
              <li className="mb-0">
                <Link to="/contact" className="link-secondary text-decoration-none">
                  Contact
                </Link>
              </li>
            </ul>
          </Col>
          <Col sm={6} lg={3}>
            <h2 className="h6 fw-bold text-body mb-2">Trust &amp; policies</h2>
            <ul className="list-unstyled small mb-0">
              <li className="mb-1">
                <Link to="/about" className="link-secondary text-decoration-none">
                  About
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/content-standards" className="link-secondary text-decoration-none">
                  Content standards
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/privacy-policy" className="link-secondary text-decoration-none">
                  Privacy Policy
                </Link>
              </li>
              <li className="mb-1">
                <Link to="/terms" className="link-secondary text-decoration-none">
                  Terms
                </Link>
              </li>
              <li className="mb-0">
                <Link to="/practice-disclaimer" className="link-secondary text-decoration-none">
                  Practice disclaimer
                </Link>
              </li>
            </ul>
          </Col>
          <Col sm={6} lg={3}>
            <h2 className="h6 fw-bold text-body mb-2">Why BandReady</h2>
            <p className="small text-muted mb-0">
              Independent CELPIP- and IELTS-style practice with timers, progress tracking, and optional AI feedback—clearly
              separated from official exams. Explore{' '}
              <Link to="/why-bandready" className="fw-semibold text-decoration-none">
                why we built this
              </Link>
              .
            </p>
          </Col>
        </Row>
        <AppDisclaimer />
      </Container>
    </footer>
  );
}
