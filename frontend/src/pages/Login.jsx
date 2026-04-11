import { useEffect, useState } from 'react';
import { Button, Container, Form, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const verifiedBanner = searchParams.get('verified') === '1';

  useEffect(() => {
    if (verifiedBanner) {
      setSearchParams({}, { replace: true });
    }
  }, [verifiedBanner, setSearchParams]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      const user = await login(email, password);
      navigate(user.email_verified ? '/dashboard' : '/verify-email');
    } catch {
      setErr('Invalid credentials.');
    }
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={5}>
          <div className="br-card p-4">
            <h1 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-box-arrow-in-right text-br-rose" aria-hidden />
              Log in
            </h1>
            {verifiedBanner && (
              <Alert variant="success" className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill" aria-hidden />
                Email confirmed. You can sign in below.
              </Alert>
            )}
            {err && (
              <Alert variant="danger" className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden />
                {err}
              </Alert>
            )}
            <Form onSubmit={onSubmit}>
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
                  required
                />
              </Form.Group>
              <Button type="submit" className="w-100 d-inline-flex align-items-center justify-content-center gap-2">
                <i className="bi bi-unlock-fill" aria-hidden />
                Continue
              </Button>
            </Form>
            <p className="small text-muted mt-3 mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-person-plus" aria-hidden />
              <span>
                No account? <Link to="/register">Register</Link>
              </span>
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
