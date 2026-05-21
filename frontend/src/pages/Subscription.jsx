import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Container, Modal, Row, Spinner } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPay, setShowPay] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stripeRedirecting, setStripeRedirecting] = useState(false);
  const [verifyingReturn, setVerifyingReturn] = useState(false);
  const [error, setError] = useState('');
  const [successFlash, setSuccessFlash] = useState('');
  const [offer, setOffer] = useState(null);

  const checkoutCancelled = searchParams.get('checkout') === 'cancelled';
  const sessionId = searchParams.get('session_id');

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

  const priceLabel = offer?.price?.formatted || null;
  const stripeEnabled = Boolean(offer?.stripe_checkout_enabled);
  const simulateEnabled = Boolean(offer?.simulate_enabled);

  const loadOffer = useCallback(async () => {
    try {
      const { data } = await api.get('/subscription/offer');
      setOffer(data);
    } catch {
      setOffer({ stripe_checkout_enabled: false, simulate_enabled: false, price: {} });
    }
  }, []);

  useEffect(() => {
    void loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    if (!user || !sessionId) {
      return undefined;
    }
    let cancelled = false;
    setVerifyingReturn(true);
    setError('');
    (async () => {
      try {
        const { data } = await api.post('/subscription/verify-checkout-session', { session_id: sessionId });
        await refresh();
        if (!cancelled) {
          setSuccessFlash(
            data?.extended
              ? 'Payment confirmed — your Pro access is active.'
              : 'Checkout complete — if Pro was already applied, your account is up to date.',
          );
          setSearchParams({}, { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e.response?.data?.message ||
              'We could not confirm that payment. If you were charged, contact support with your receipt.',
          );
        }
      } finally {
        if (!cancelled) {
          setVerifyingReturn(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sessionId, refresh, setSearchParams]);

  async function completeSimulatedPayment() {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/subscription/simulate-checkout', {});
      await refresh();
      setShowPay(false);
      setSuccessFlash('Pro access activated (simulated checkout).');
    } catch (e) {
      setError(e.response?.data?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function startStripeCheckout() {
    setStripeRedirecting(true);
    setError('');
    try {
      const { data } = await api.post('/subscription/checkout-session');
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError('Checkout could not be started.');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Checkout could not be started.');
    } finally {
      setStripeRedirecting(false);
    }
  }

  return (
    <Container className="py-4 py-md-5">
      <div className="text-center mb-4 mb-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2">BandReady Pro</p>
        <h1 className="h2 fw-bold mb-2">One-time access for your prep window</h1>
        <p className="text-muted mb-0 mx-auto" style={{ maxWidth: '40rem' }}>
          Most people train until exam day, then move on — so Pro is a <strong>single payment</strong> for{' '}
          <strong>12 months</strong> of access to unlimited Speaking, AI-assisted feedback, transcription, and Pro-only
          downloads. Free accounts can still use many listening and reading runs; Pro adds the locked sections and tools
          below. Need more time later (e.g. a retake)? You can purchase another year anytime.
          {stripeEnabled ? (
            <>
              {' '}
              Checkout is processed securely by <strong>Stripe</strong>.
            </>
          ) : (
            <>
              {' '}
              Configure <strong>Stripe</strong> keys on the server to take real card payments; until then you can use a
              simulated checkout in development if it is enabled.
            </>
          )}
        </p>
      </div>

      {successFlash && (
        <Alert variant="success" className="border-0" dismissible onClose={() => setSuccessFlash('')}>
          {successFlash}
        </Alert>
      )}

      {checkoutCancelled && (
        <Alert variant="secondary" className="border-0 d-flex align-items-center gap-2">
          <i className="bi bi-x-circle" aria-hidden />
          Checkout was cancelled — no charge was made.
        </Alert>
      )}

      {isSubscribed && user && (
        <Alert variant="success" className="border-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span className="d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill" aria-hidden />
            <span>
              Your Pro access is active{expiryLabel ? ` through ${expiryLabel}` : ''}.
              {stripeEnabled
                ? ' You can purchase another 12 months anytime to extend from your current end date.'
                : ' You can extend with another checkout when billing is enabled (or simulated checkout in dev).'}
            </span>
          </span>
        </Alert>
      )}

      {!user && (
        <Alert variant="light" className="border mb-4">
          <span className="d-flex flex-wrap align-items-center gap-2">
            <i className="bi bi-person-lock" aria-hidden />
            <span>
              <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link> to purchase Pro.
            </span>
          </span>
        </Alert>
      )}

      {sessionId && user && verifyingReturn && (
        <Alert variant="light" className="border mb-4 d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Confirming your payment…</span>
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
                  {priceLabel ? (
                    <>
                      <span className="display-5 fw-bold">{priceLabel}</span>
                      <span className="text-muted d-block small">Stripe price</span>
                    </>
                  ) : (
                    <>
                      <span className="display-5 fw-bold">—</span>
                      <span className="text-muted d-block small">
                        {stripeEnabled ? 'Price unavailable' : 'Set STRIPE_PRICE_ID to show price'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <p className="small text-muted mb-4">
                Unlocks everything in the list for <strong>12 months</strong> from purchase (stacked after any current end
                date if you renew). Objective questions are still auto-marked on submit; Pro adds subjective AI feedback and
                access to subscription-gated tests and files.
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

      {user && !stripeEnabled && !simulateEnabled && (
        <Alert variant="warning" className="text-center border-0">
          Pro checkout is not enabled on this server yet. Set <code className="text-body">STRIPE_SECRET</code> and{' '}
          <code className="text-body">STRIPE_PRICE_ID</code>, or enable{' '}
          <code className="text-body">SUBSCRIPTION_SIMULATE_ENABLED</code> for local testing only.
        </Alert>
      )}

      <div className="text-center">
        {user ? (
          <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-2">
            {stripeEnabled && (
              <Button
                size="lg"
                className="d-inline-flex align-items-center gap-2"
                disabled={stripeRedirecting || verifyingReturn}
                onClick={() => {
                  setError('');
                  void startStripeCheckout();
                }}
              >
                {stripeRedirecting ? (
                  <>
                    <Spinner animation="border" size="sm" />
                    Redirecting to Stripe…
                  </>
                ) : (
                  <>
                    <i className="bi bi-credit-card-fill" aria-hidden />
                    Pay with card (Stripe)
                  </>
                )}
              </Button>
            )}
            {simulateEnabled && (
              <Button
                size="lg"
                variant={stripeEnabled ? 'outline-secondary' : 'primary'}
                className="d-inline-flex align-items-center gap-2"
                disabled={verifyingReturn}
                onClick={() => {
                  setError('');
                  setShowPay(true);
                }}
              >
                <i className="bi bi-bug" aria-hidden />
                Simulated checkout (dev)
              </Button>
            )}
          </div>
        ) : (
          <Button as={Link} to="/login" size="lg" className="d-inline-flex align-items-center gap-2">
            <i className="bi bi-box-arrow-in-right" aria-hidden />
            Log in to continue
          </Button>
        )}
        <p className="small text-muted mt-3 mb-0 mx-auto" style={{ maxWidth: '36rem' }}>
          {stripeEnabled ? (
            user
              ? 'You will leave this site briefly to enter card details on Stripe. We never store your full card number.'
              : 'After you log in, checkout uses Stripe — we never store your full card number.'
          ) : (
            'Stripe is not configured on this server yet — set STRIPE_SECRET and STRIPE_PRICE_ID (and webhook secret for production).'
          )}
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
            This path is for <strong>local testing only</strong> when <code className="text-body">SUBSCRIPTION_SIMULATE_ENABLED</code> is
            true. Confirming below adds <strong>12 months</strong> of Pro access (stacked after any current end date). No
            payment is processed.
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
          <Button className="d-inline-flex align-items-center gap-2" disabled={submitting} onClick={() => void completeSimulatedPayment()}>
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
