import { Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';

/**
 * Short prompt with link to the full practice disclaimer page.
 * @param {{ className?: string }} props
 */
export default function PracticeDisclaimerCallout({ className = 'mb-4' }) {
  return (
    <Alert variant="info" className={`small py-3 border border-info border-opacity-25 ${className}`}>
      <p className="fw-semibold text-body mb-2">Important: practice vs official IELTS &amp; CELPIP</p>
      <p className="text-body-info mb-3">
        Question formats, pacing, on-screen layout, and AI speaking interviews on this site are{' '}
        <strong>not identical</strong> to the official tests. Scores here are practice-only. Please read the full
        disclaimer so you know what this product is—and is not—before you rely on it for test-day decisions.
      </p>
      <Link
        to="/practice-disclaimer"
        className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-2 fw-semibold"
      >
        Read the full practice disclaimer
        <i className="bi bi-arrow-right" aria-hidden />
      </Link>
    </Alert>
  );
}
