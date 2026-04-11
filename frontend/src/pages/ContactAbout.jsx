import { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const categories = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

export default function ContactAbout() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('feedback');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSending(true);
    try {
      await api.post('/contact-messages', { name, email, category, message });
      setDone(true);
      setMessage('');
    } catch (ex) {
      const msg = ex.response?.data?.message;
      const errors = ex.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        setErr(Object.values(errors).flat().join(' '));
      } else {
        setErr(msg || 'Could not send. Please try again in a moment.');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5">
        <Row className="g-4 mb-4">
          <Col lg={6}>
            <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-info-circle" aria-hidden />
              About
            </p>
            <h1 className="h3 fw-bold mb-3">
              About <span className="text-br-rose">BandReady</span>
            </h1>
            <p className="text-muted">
              BandReady is an exam-style practice platform for IELTS and CELPIP-style programs: timed sections, listening
              and reading layouts, writing and speaking where your team publishes them, autosave, results, and tools like
              dashboard readiness and analytics for learners who create an account.
            </p>
            <p className="text-muted mb-0">
              We are not affiliated with official test providers — scores and AI feedback are for practice only. See our
              in-app disclaimer on each run and on the home page.
            </p>
            <p className="mt-3 mb-0">
              <Link to="/why-bandready" className="fw-semibold text-decoration-none">
                Full feature list
                <i className="bi bi-arrow-right ms-1" aria-hidden />
              </Link>
            </p>
          </Col>
          <Col lg={6}>
            <div className="br-card p-4 h-100">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-envelope-paper text-br-rose" aria-hidden />
                Contact &amp; feedback
              </h2>
              <p className="small text-muted mb-4">
                Questions, ideas, or issues? Send a message — we read every submission. You can write as a guest or while
                logged in (we&apos;ll attach your account for context).
              </p>
              {done ? (
                <Alert variant="success" className="border-0 mb-0">
                  <i className="bi bi-check-circle me-2" aria-hidden />
                  Thanks — your message was received.
                </Alert>
              ) : (
                <Form onSubmit={submit}>
                  <Row className="g-2 mb-3">
                    <Col sm={6}>
                      <Form.Label className="small">Name</Form.Label>
                      <Form.Control
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={120}
                        autoComplete="name"
                      />
                    </Col>
                    <Col sm={6}>
                      <Form.Label className="small">Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        maxLength={190}
                        autoComplete="email"
                      />
                    </Col>
                  </Row>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Topic</Form.Label>
                    <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Message (min. 10 characters)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      minLength={10}
                      maxLength={8000}
                    />
                  </Form.Group>
                  {err && (
                    <Alert variant="danger" className="py-2 small">
                      {err}
                    </Alert>
                  )}
                  <Button type="submit" disabled={sending} className="d-inline-flex align-items-center gap-2">
                    {sending ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill" aria-hidden />
                        Send message
                      </>
                    )}
                  </Button>
                </Form>
              )}
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
