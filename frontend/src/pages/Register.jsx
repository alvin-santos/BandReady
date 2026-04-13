import { useState } from 'react';
import { Alert, Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { googleOAuthStartUrl } from '../auth/googleOAuth.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      await register({ name, email, password, password_confirmation: passwordConfirmation });
      navigate('/verify-email');
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={5}>
          <div className="br-card p-4">
            <h1 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-person-plus-fill text-br-rose" aria-hidden />
              Create account
            </h1>
            {err && (
              <Alert variant="danger" className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden />
                {typeof err === 'string' ? err : 'Check form errors'}
              </Alert>
            )}
            <div className="d-grid gap-2 mb-3">
              <Button
                variant="outline-secondary"
                className="d-inline-flex align-items-center justify-content-center gap-2"
                href={googleOAuthStartUrl()}
                as="a"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                  <path
                    fill="#FFC107"
                    d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.145-2.652-.389-3.917z"
                  />
                  <path
                    fill="#FF3D00"
                    d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 0-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.145-2.652-.389-3.917z"
                  />
                </svg>
                Sign up with Google
              </Button>
            </div>
            <p className="text-center small text-muted text-uppercase mb-3">or</p>
            <Form onSubmit={onSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex align-items-center gap-2">
                  <i className="bi bi-person" aria-hidden />
                  Name
                </Form.Label>
                <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex align-items-center gap-2">
                  <i className="bi bi-envelope" aria-hidden />
                  Email
                </Form.Label>
                <Form.Control
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex align-items-center gap-2">
                  <i className="bi bi-key" aria-hidden />
                  Password
                </Form.Label>
                <Form.Control
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={8}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex align-items-center gap-2">
                  <i className="bi bi-key-fill" aria-hidden />
                  Confirm password
                </Form.Label>
                <Form.Control
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  type="password"
                  required
                />
              </Form.Group>
              <Button
                type="submit"
                disabled={submitting}
                className="w-100 d-inline-flex align-items-center justify-content-center gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" role="status" aria-hidden />
                    Signing up…
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" aria-hidden />
                    Sign up
                  </>
                )}
              </Button>
            </Form>
            <p className="small text-muted mt-3 mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-box-arrow-in-right" aria-hidden />
              <span>
                Already have an account? <Link to="/login">Log in</Link>
              </span>
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
