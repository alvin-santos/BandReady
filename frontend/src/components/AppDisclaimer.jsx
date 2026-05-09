import { Link } from 'react-router-dom';

/**
 * @param {object} props
 * @param {string} [props.className]
 */
export default function AppDisclaimer({ className = '' }) {
  return (
    <div className={`small text-muted ${className}`}>
      <p className="mb-2">
        BandReady is independent and not affiliated with IELTS or CELPIP. Scores are approximate. Practice is automated in
        your browser; real IELTS includes live speaking examiners, and official CELPIP is taken at a test centre—not here.
      </p>
      <p className="mb-2">
        <span className="text-body-secondary me-1">Legal &amp; info:</span>
        <Link to="/about" className="link-secondary fw-semibold">
          About
        </Link>
        {' · '}
        <Link to="/blog" className="link-secondary fw-semibold">
          Blog
        </Link>
        {' · '}
        <Link to="/guides" className="link-secondary fw-semibold">
          Study guides
        </Link>
        {' · '}
        <Link to="/content-standards" className="link-secondary fw-semibold">
          Content standards
        </Link>
        {' · '}
        <Link to="/how-it-works" className="link-secondary fw-semibold">
          How it works
        </Link>
        {' · '}
        <Link to="/privacy-policy" className="link-secondary fw-semibold">
          Privacy Policy
        </Link>
        {' · '}
        <Link to="/terms" className="link-secondary fw-semibold">
          Terms
        </Link>
        {' · '}
        <Link to="/practice-disclaimer" className="link-secondary fw-semibold">
          Practice disclaimer
        </Link>
        {' · '}
        <Link to="/contact" className="link-secondary fw-semibold">
          Contact
        </Link>
      </p>
      <p className="mb-0">
        The practice disclaimer explains how formats, AI speaking, and scoring relate to official tests.
      </p>
    </div>
  );
}
