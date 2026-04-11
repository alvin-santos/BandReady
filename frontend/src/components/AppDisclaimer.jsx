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
      <p className="mb-0">
        <Link to="/practice-disclaimer" className="link-secondary fw-semibold">
          Full practice disclaimer
        </Link>{' '}
        — how formats, AI speaking, and scoring relate to official tests.
      </p>
    </div>
  );
}
