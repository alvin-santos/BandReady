import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const LAST_UPDATED = 'May 9, 2026';

export default function PrivacyPolicyPage() {
  return (
    <Container className="py-4 py-lg-5" style={{ maxWidth: '46rem' }}>
      <h1 className="h2 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-file-lock2 text-br-rose" aria-hidden />
        Privacy Policy
      </h1>
      <p className="text-muted small mb-4">
        Last updated: <strong>{LAST_UPDATED}</strong>
      </p>
      <p className="lead text-muted mb-4">
        This Privacy Policy explains how BandReady (&quot;we&quot;, &quot;us&quot;) collects, uses, and shares
        information when you use our website and services (the &quot;Service&quot;). If you do not agree, please do not
        use the Service.
      </p>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">1. Who we are</h2>
        <p className="text-body-secondary mb-0">
          BandReady is an independent English exam practice platform. For privacy questions or requests, use the{' '}
          <Link to="/contact">Contact</Link> page so we can respond by email.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">2. Information we collect</h2>
        <ul className="text-body-secondary mb-0 ps-3">
          <li className="mb-2">
            <strong>Account data</strong> — when you register or sign in with Google, we process your name, email
            address, and authentication details needed to operate your account (including email verification status).
          </li>
          <li className="mb-2">
            <strong>Practice &amp; usage data</strong> — answers, attempts, scores, timestamps, and related content you
            submit during exams or practice modes (including speaking transcripts or audio where the product records
            them, and AI interview practice text or audio you send).
          </li>
          <li className="mb-2">
            <strong>Community &amp; support</strong> — forum posts and messages you send through our contact form.
          </li>
          <li className="mb-2">
            <strong>Billing</strong> — if you purchase BandReady Pro, our payment provider (Stripe) processes payment
            data. We receive fulfillment-related identifiers from Stripe; we do not store full card numbers on our
            servers.
          </li>
          <li className="mb-2">
            <strong>Technical data</strong> — we may log IP address, device/browser information, and basic request logs
            for security, troubleshooting, and service performance.
          </li>
          <li className="mb-0">
            <strong>Analytics</strong> — we may record page visits and interactions (for example, the page path and time
            of visit). We may store an anonymous visitor identifier in your browser (localStorage) to understand traffic
            trends and improve the Service.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">3. Cookies and similar technologies</h2>
        <p className="text-body-secondary mb-2">
          We use cookies and local storage as needed for sign-in sessions, preferences, and the anonymous visitor id
          described above. Third-party services (such as advertising or embedded tools) may also set cookies.
        </p>
        <p className="text-body-secondary mb-2">
          When you first visit, you may see a cookie notice banner with a link to this policy and an option to accept.
          Accepting stores your choice in the browser so we do not repeat the prompt on every page.
        </p>
        <p className="text-body-secondary mb-0">
          You can control cookies through your browser settings. Blocking required cookies may prevent sign-in or core
          features from working correctly.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">4. Advertising (Google AdSense)</h2>
        <p className="text-body-secondary mb-2">
          BandReady may display advertisements served by{' '}
          <a href="https://policies.google.com/technologies/ads" className="fw-semibold" rel="noopener noreferrer">
            Google AdSense
          </a>
          . Google and its partners may use cookies or similar technologies to show personalized ads based on your visits
          to this and other sites. Pro subscribers typically see sponsored slots disabled where the product is
          configured that way; administrators may still see slots for verification.
        </p>
        <p className="text-body-secondary mb-0">
          You can manage ad personalization through{' '}
          <a href="https://www.google.com/settings/ads" className="fw-semibold" rel="noopener noreferrer">
            Google Ads Settings
          </a>{' '}
          and learn how Google uses data in{' '}
          <a href="https://policies.google.com/privacy" className="fw-semibold" rel="noopener noreferrer">
            Google&apos;s Privacy Policy
          </a>
          .
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">5. Third-party services</h2>
        <p className="text-body-secondary mb-2">
          We rely on service providers who process data on our behalf or as independent controllers, including:
        </p>
        <ul className="text-body-secondary mb-0 ps-3">
          <li className="mb-2">
            <strong>Google</strong> — optional &quot;Sign in with Google&quot;, fonts, and AdSense as described above.
          </li>
          <li className="mb-2">
            <strong>Stripe</strong> — payment processing for subscriptions or purchases.
          </li>
          <li className="mb-2">
            <strong>AI processing</strong> — where enabled, features like writing feedback, speaking feedback, study plan
            generation, or interview practice may send relevant text (and where applicable audio transcripts) to an AI
            provider to generate outputs. Do not submit sensitive personal data you do not want processed by those
            systems.
          </li>
          <li className="mb-0">
            <strong>Hosting and infrastructure</strong> — servers and databases that store site and account data.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">6. How we use information</h2>
        <p className="text-body-secondary mb-0">
          We use the information above to provide and improve the service, authenticate users, save progress, show
          results and analytics, operate forums, enforce limits, detect abuse, comply with law, communicate about your
          account, and process payments. We do not sell your personal information in the conventional sense of selling
          lists of users to data brokers.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">7. Sharing</h2>
        <p className="text-body-secondary mb-0">
          We share information with service providers (for example, hosting, analytics, payments, or AI processing) as
          needed to operate the Service, and when required by law. We may also share aggregated or de-identified
          information that cannot reasonably be used to identify you.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">8. Retention</h2>
        <p className="text-body-secondary mb-0">
          We keep account and practice data for as long as your account exists and as needed for legal, security, or
          operational purposes. Traffic analytics may be aggregated or retained according to internal needs. You may
          request deletion of personal data where applicable law allows; contact us and we will assist where we can.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">9. Security</h2>
        <p className="text-body-secondary mb-0">
          We use reasonable technical and organizational measures to protect information. No method of transmission over
          the Internet is completely secure; we cannot guarantee absolute security.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">10. Children</h2>
        <p className="text-body-secondary mb-0">
          BandReady is not directed at children under 13 (or the minimum age required in your jurisdiction). We do not
          knowingly collect personal information from children. If you believe we have collected such information,
          please contact us so we can delete it.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">11. International users</h2>
        <p className="text-body-secondary mb-0">
          Our servers and providers may be located in countries other than yours. By using the service, you understand
          that information may be transferred and processed across borders subject to this policy and applicable law.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">12. Your choices and rights</h2>
        <p className="text-body-secondary mb-0">
          Depending on where you live, you may have rights to access, correct, delete, or restrict processing of your
          personal data, or to object to certain processing. Contact us through the{' '}
          <Link to="/contact">Contact</Link> page. We will respond in line with applicable law.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">13. Changes</h2>
        <p className="text-body-secondary mb-0">
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top will change
          when we do. Continued use of the site after changes constitutes acceptance of the revised policy where the law
          allows.
        </p>
      </section>

      <section className="mb-0">
        <h2 className="h5 fw-bold text-body mb-2">14. Related pages</h2>
        <p className="text-body-secondary mb-0">
          <Link to="/about">About BandReady</Link>
          {' · '}
          <Link to="/guides">Study guides</Link>
          {' · '}
          <Link to="/content-standards">Content standards</Link>
          {' · '}
          <Link to="/terms">Terms</Link>
          {' · '}
          <Link to="/practice-disclaimer">Practice disclaimer</Link>
          {' · '}
          <Link to="/contact">Contact</Link>
        </p>
      </section>
    </Container>
  );
}
