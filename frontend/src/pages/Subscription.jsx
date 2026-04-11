import { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Modal, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const features = [
  'Unlimited Speaking — free accounts get a small number of Speaking exams; Pro removes the cap',
  'AI writing feedback — rubric-style comments plus a scored contribution on essay tasks (not an official IELTS/CELPIP band)',
  'AI speaking feedback — feedback and scoring from your spoken response transcript',
  'Speaking transcription — speech-to-text for speaking prompts so responses can be reviewed and graded',
  'Pro downloads — printable guides and files in Resources marked for Pro members',
  'Dashboard, analytics, and mistakes stay available on free accounts — Pro adds unlimited Speaking, AI tools, and locked downloads',
];

export default function Subscription() {
  const { user, isSubscribed, refresh } = useAuth();
  const [showPay, setShowPay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const expiryLabel = useMemo(() => {
    if (!user?.subscription_expires_at) {
      return null;
    }
    try {
      return new Date(user.subscription_expires_at).toLocaleDateString(undefined, {
        dateStyle: 'long',
      });
    } catch {
      return user.subscription_expires_at;
    }
  }, [user?.subscription_expires_at]);

  async function completeSimulatedPayment() {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/subscription/simulate-checkout', {});
      await refresh();
      setShowPay(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="py-4 py-md-5">
      <div className="text-center mb-4 mb-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2">BandReady Pro</p>
        <h1 className="h2 fw-bold mb-2">One-time access for your prep window</h1>
        <p className="text-muted mb-0 mx-auto" style={{ maxWidth: '40rem' }}>
          Most people train until exam day, then move on — so Pro is a <strong>single payment</strong> for{' '}
          <strong>12 months</strong> of access to unlimited Speaking, AI-assisted feedback,
          transcription, and Pro-only downloads. Free accounts can still use many quick/full listening and reading runs;
          Pro adds the locked sections and tools below. Need more time later (e.g. a retake)? You can purchase another
          year anytime. Payment is <strong>simulated</strong> here until a gateway is connected.
        </p>
      </div>

      {isSubscribed && user && (
        <Alert variant="success" className="border-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span className="d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill" aria-hidden />
            <span>
              Your Pro access is active{expiryLabel ? ` through ${expiryLabel}` : ''}. You can add another 12 months
              with a second simulated one-time checkout if you need to extend.
            </span>
          </span>
        </Alert>
      )}

      {!user && (
        <Alert variant="light" className="border mb-4">
          <span className="d-flex flex-wrap align-items-center gap-2">
            <i className="bi bi-person-lock" aria-hidden />
            <span>
              <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to run a simulated
              checkout.
            </span>
          </span>
        </Alert>
      )}

      <Row className="justify-content-center mb-4">
        <Col md={10} lg={8} xl={7}>
          <Card className="br-card border-primary border-2">
            <Card.Body className="p-4 p-md-5">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                  <h2 className="h4 fw-bold mb-1">Pro — 12 months</h2>
                  <p className="small text-muted mb-0">One-time purchase · not a subscription</p>
                </div>
                <div className="text-md-end">
                  <span className="display-5 fw-bold">$99</span>
                  <span className="text-muted d-block small">placeholder price</span>
                </div>
              </div>
              <p className="small text-muted mb-4">
                Unlocks everything in the list for <strong>12 months</strong> from purchase (stacked after any current end
                date if you renew). Objective questions are still auto-marked on submit; Pro adds subjective AI feedback
                and access to subscription-gated tests and files.
              </p>
              <ul className="list-unstyled small mb-0">
                {features.map((f) => (
                  <li key={f} className="mb-2 d-flex gap-2">
                    <i className="bi bi-check2 text-success flex-shrink-0" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="text-center">
        {user ? (
          <Button
            size="lg"
            className="d-inline-flex align-items-center gap-2"
            onClick={() => {
              setError('');
              setShowPay(true);
            }}
          >
            <i className="bi bi-credit-card" aria-hidden />
            Continue to simulated one-time payment
          </Button>
        ) : (
          <Button as={Link} to="/login" size="lg" className="d-inline-flex align-items-center gap-2">
            <i className="bi bi-box-arrow-in-right" aria-hidden />
            Log in to continue
          </Button>
        )}
        <p className="small text-muted mt-3 mb-0">
          Price is a placeholder. No card is charged — the next step is a demo only.
        </p>
      </div>

      <Modal show={showPay} onHide={() => !submitting && setShowPay(false)} centered>
        <Modal.Header closeButton={!submitting}>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="bi bi-shop text-br-rose" aria-hidden />
            Simulated one-time payment
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">
            This app does not process real payments yet. Confirming below adds <strong>12 months</strong> of Pro access
            to your account (stacked after any current end date). No recurring charges — this is a one-time flow for
            testing only.
          </p>
          <div className="br-card p-3 mb-3">
            <div className="small text-muted mb-1">Demo card (not charged)</div>
            <div className="font-monospace fw-semibold d-flex align-items-center gap-2">
              <i className="bi bi-credit-card-2-front" aria-hidden />
              •••• •••• •••• 4242
            </div>
            <div className="small text-muted mt-2 mb-0">Name on card: Demo User · Expires: 12 / 29</div>
          </div>
          {error && (
            <Alert variant="danger" className="py-2 small mb-0">
              {error}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="outline-secondary" disabled={submitting} onClick={() => setShowPay(false)}>
            Cancel
          </Button>
          <Button className="d-inline-flex align-items-center gap-2" disabled={submitting} onClick={completeSimulatedPayment}>
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" />
                Processing…
              </>
            ) : (
              <>
                <i className="bi bi-check-lg" aria-hidden />
                Complete simulated payment
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
