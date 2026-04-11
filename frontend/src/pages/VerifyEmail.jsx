import { useState } from 'react';
import { Alert, Button, Col, Container, Row } from 'react-bootstrap';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyEmail() {
  const { user, loading, logout } = useAuth();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);

  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.email_verified) {
    return <Navigate to="/dashboard" replace />;
  }

  async function resend() {
    setMsg('');
    setErr('');
    setSending(true);
    try {
      await api.post('/email/resend-verification');
      setMsg('We sent another link. Check your inbox and spam folder.');
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Could not send email. Try again shortly.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={7} lg={6}>
          <div className="br-card p-4">
            <h1 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-envelope-check text-br-rose" aria-hidden />
              Confirm your email
            </h1>
            <p className="text-muted mb-3">
              We sent a verification link to <strong>{user.email}</strong>. Open that email and click the button to
              activate your account. You can close this tab after you verify.
            </p>
            {msg && (
              <Alert variant="success" className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill" aria-hidden />
                {msg}
              </Alert>
            )}
            {err && (
              <Alert variant="danger" className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden />
                {err}
              </Alert>
            )}
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Button type="button" variant="primary" disabled={sending} onClick={resend} className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-arrow-repeat" aria-hidden />
                {sending ? 'Sending…' : 'Resend email'}
              </Button>
              <Button type="button" variant="outline-secondary" onClick={() => logout()} className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-box-arrow-right" aria-hidden />
                Log out
              </Button>
            </div>
            <p className="small text-muted mt-4 mb-0">
              <Link to="/login">Back to log in</Link>
              {' · '}
              After you verify, use <strong>Log in</strong> if this page does not update automatically.
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
