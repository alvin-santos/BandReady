import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { AD_PLACEMENT_OPTIONS, AD_SLOT_SPECS } from '../constants/adPlacements.js';
import { useAuth } from '../context/AuthContext.jsx';

function placementLabel(value) {
  const spec = AD_SLOT_SPECS[value];
  return spec ? spec.label : value || 'Not sure yet';
}

export default function AdvertisePage() {
  const { user } = useAuth();
  const [search] = useSearchParams();
  const placementFromUrl = search.get('placement') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [placement, setPlacement] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [proposal, setProposal] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const validPlacement = useMemo(
    () => (placementFromUrl && AD_SLOT_SPECS[placementFromUrl] ? placementFromUrl : ''),
    [placementFromUrl]
  );

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    if (validPlacement) {
      setPlacement(validPlacement);
    }
  }, [validPlacement]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSending(true);
    const placementLine = placement ? placementLabel(placement) : 'Not specified';
    const body = [
      'Advertising / sponsorship proposal',
      '',
      `Preferred placement: ${placementLine}${placement ? ` (${placement})` : ''}`,
      `Company / brand: ${company.trim() || '(not provided)'}`,
      `Landing URL: ${landingUrl.trim() || '(not provided)'}`,
      '',
      'Creative / sample copy:',
      proposal.trim(),
      '',
      'Note: You can reply to this thread by email if you have image or HTML assets to share.',
    ].join('\n');

    try {
      await api.post('/contact-messages', {
        name,
        email,
        message: body,
        category: 'advertising',
      });
      setDone(true);
      setProposal('');
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
        <Row className="justify-content-center">
          <Col lg={8}>
            <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-badge-ad-fill" aria-hidden />
              Sponsorship
            </p>
            <h1 className="h3 fw-bold mb-3">
              Advertise on <span className="text-br-rose">BandReady</span>
            </h1>
            <p className="text-muted mb-4">
              BandReady has display slots on practice pages, exam runs, rankings, resources, and the community forum.
              Submit a short proposal with your brand, preferred placement, and sample copy or creative notes. We review
              messages manually—no payment is collected on this form.
            </p>

            {validPlacement && (
              <Alert variant="info" className="border-0 small mb-4">
                <i className="bi bi-pin-angle me-2" aria-hidden />
                You clicked a slot on the site: <strong>{placementLabel(validPlacement)}</strong>. You can change the
                placement below.
              </Alert>
            )}

            <div className="br-card p-4">
              {done ? (
                <Alert variant="success" className="border-0 mb-0">
                  <i className="bi bi-check-circle me-2" aria-hidden />
                  Thanks — your proposal was received. We will reply by email when we can.
                </Alert>
              ) : (
                <Form onSubmit={submit}>
                  <Row className="g-2 mb-3">
                    <Col sm={6}>
                      <Form.Label className="small">Your name</Form.Label>
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
                    <Form.Label className="small">Company or brand</Form.Label>
                    <Form.Control
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      maxLength={160}
                      placeholder="e.g. Your Language School"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Preferred placement</Form.Label>
                    <Form.Select value={placement} onChange={(e) => setPlacement(e.target.value)}>
                      <option value="">Not sure — recommend one for me</option>
                      {AD_PLACEMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">Landing page URL (optional)</Form.Label>
                    <Form.Control
                      type="url"
                      value={landingUrl}
                      onChange={(e) => setLandingUrl(e.target.value)}
                      maxLength={500}
                      placeholder="https://example.com/your-offer"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small">
                      Ad sample / proposal (min. 10 characters)
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={7}
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                      required
                      minLength={10}
                      maxLength={8000}
                      placeholder="Describe your offer, headline, CTA, image ideas, or paste sample HTML/copy. Mention if you will send banner files by email."
                    />
                  </Form.Group>
                  {err && (
                    <Alert variant="danger" className="py-2 small">
                      {err}
                    </Alert>
                  )}
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <Button type="submit" disabled={sending} className="d-inline-flex align-items-center gap-2">
                      {sending ? (
                        <>
                          <Spinner animation="border" size="sm" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send-fill" aria-hidden />
                          Submit proposal
                        </>
                      )}
                    </Button>
                    <Link to="/contact" className="small text-muted">
                      General contact instead
                    </Link>
                  </div>
                </Form>
              )}
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
