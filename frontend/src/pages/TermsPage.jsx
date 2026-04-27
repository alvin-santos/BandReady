import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const LAST_UPDATED = 'April 27, 2026';

export default function TermsPage() {
  return (
    <Container className="py-4 py-lg-5" style={{ maxWidth: '46rem' }}>
      <h1 className="h2 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-file-earmark-text text-br-rose" aria-hidden />
        Terms of Service
      </h1>
      <p className="text-muted small mb-4">
        Last updated: <strong>{LAST_UPDATED}</strong>
      </p>

      <p className="lead text-muted mb-4">
        These Terms of Service explain the rules for using BandReady. By accessing or using the site, you agree to these
        terms and our{' '}
        <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
          Privacy Policy
        </Link>
        . If you do not agree, please do not use BandReady.
      </p>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">1. What BandReady is (and is not)</h2>
        <p className="text-body-secondary mb-0">
          BandReady is an independent educational platform for CELPIP and IELTS-style preparation: study planning,
          practice tasks, feedback tools, and progress tracking. BandReady is not affiliated with, endorsed by, or
          connected to official exam providers. Results and AI output are for learning only and do not guarantee any
          official exam score.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">2. Accounts and eligibility</h2>
        <p className="text-body-secondary mb-0">
          You may browse public pages without an account. Creating an account allows you to save attempts and access
          additional tools. You are responsible for keeping your login credentials secure and for activity under your
          account.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">3. Acceptable use</h2>
        <ul className="text-body-secondary mb-0 ps-3">
          <li className="mb-2">
            Do not abuse the service, attempt to bypass limits, or interfere with site operation (including automated
            scraping or denial-of-service behavior).
          </li>
          <li className="mb-2">
            Do not upload unlawful content or content that violates the rights of others.
          </li>
          <li className="mb-0">
            Do not attempt to reverse engineer, exploit, or access admin features without authorization.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">4. Educational content and AI features</h2>
        <p className="text-body-secondary mb-2">
          Some features may use AI to generate study plans or provide writing/speaking feedback. AI output can be wrong
          or incomplete and should be used as guidance, not as professional advice.
        </p>
        <p className="text-body-secondary mb-0">
          Do not submit sensitive personal data you do not want processed by those systems. If you choose to use AI
          features, you consent to the processing required to generate outputs.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">5. Subscriptions and payments</h2>
        <p className="text-body-secondary mb-2">
          If BandReady offers paid plans (such as BandReady Pro), billing is handled through our payment provider. Pricing,
          plan limits, and included features may change over time.
        </p>
        <ul className="text-body-secondary mb-0 ps-3">
          <li className="mb-2">
            <strong>Renewals</strong> — subscriptions typically renew automatically until cancelled, subject to what is shown
            in the checkout flow.
          </li>
          <li className="mb-2">
            <strong>Cancellations</strong> — you can cancel according to the options shown in your subscription settings or
            by contacting support. Access may continue until the end of the current billing period.
          </li>
          <li className="mb-0">
            <strong>Refunds</strong> — refunds are handled according to the rules shown at checkout and applicable law.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">6. Disclaimers</h2>
        <p className="text-body-secondary mb-0">
          BandReady is provided “as is” without warranties of any kind. To understand how practice formats relate to
          official tests, read the{' '}
          <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
            practice disclaimer
          </Link>
          .
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">7. No guarantee</h2>
        <p className="text-body-secondary mb-0">
          BandReady does not guarantee any specific outcome, including official CELPIP/IELTS scores, immigration results,
          admissions decisions, or job outcomes. Practice results, analytics, and AI feedback are educational tools and may
          be inaccurate or incomplete.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">8. Changes to these terms</h2>
        <p className="text-body-secondary mb-0">
          We may update these Terms of Service from time to time. The “Last updated” date above will change when we do.
          Continued use after changes means you accept the updated terms where applicable law allows.
        </p>
      </section>

      <section className="mb-0">
        <h2 className="h5 fw-bold text-body mb-2">9. Contact</h2>
        <p className="text-body-secondary mb-0">
          Questions about these terms? Use the{' '}
          <Link to="/contact" className="fw-semibold text-decoration-none">
            Contact
          </Link>{' '}
          page.
        </p>
      </section>
    </Container>
  );
}

