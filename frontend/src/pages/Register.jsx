import { useState } from 'react';
import { Button, Container, Form, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      await register({ name, email, password, password_confirmation: passwordConfirmation });
      navigate('/verify-email');
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Registration failed.');
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
              <Button type="submit" className="w-100 d-inline-flex align-items-center justify-content-center gap-2">
                <i className="bi bi-check-lg" aria-hidden />
                Sign up
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
