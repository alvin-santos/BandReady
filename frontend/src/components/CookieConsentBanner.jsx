import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'br_cookie_consent_v1';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="br-cookie-banner border-top shadow-sm py-3 px-3 px-md-4"
      role="dialog"
      aria-modal="false"
      aria-label="Cookies and privacy notice"
    >
      <div className="container-xxl d-flex flex-column flex-lg-row align-items-lg-center gap-3 justify-content-between">
        <p className="small text-body-secondary mb-0" style={{ maxWidth: '52rem' }}>
          We use cookies and similar technologies to run sign-in, remember preferences, measure traffic, and—where
          enabled—show ads through Google AdSense. By continuing, you agree to our{' '}
          <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
            Privacy Policy
          </Link>
          . You can change ad personalization in your Google account settings.
        </p>
        <div className="d-flex flex-shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline-secondary" size="sm" as={Link} to="/privacy-policy">
            Privacy details
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={dismiss}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
