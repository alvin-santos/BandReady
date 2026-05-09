import { Card, Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function ContentStandardsPage() {
  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5" style={{ maxWidth: '50rem' }}>
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-patch-check" aria-hidden />
          Editorial &amp; quality
        </p>
        <h1 className="h2 fw-bold mb-3">Content standards</h1>
        <p className="lead text-muted mb-4">
          This page explains how BandReady approaches editorial quality, practice materials, AI-assisted features, and
          community spaces. We publish it so learners and partners know what to expect—and how we reduce misleading or
          thin content on the site.
        </p>

        <section className="mb-4">
          <h2 className="h5 fw-bold mb-2">1. Original guides and articles</h2>
          <p className="text-body-secondary mb-0">
            Articles on our blog and static guides (such as the{' '}
            <Link to="/guides" className="fw-semibold text-decoration-none">
              study guides
            </Link>
            ) are written for BandReady to help exam candidates study with clearer routines. They reflect common classroom
            coaching patterns—planning, repetition under time pressure, and targeted feedback—not copied passages from
            third-party courses. Where we summarize public facts about tests (section lengths, skills assessed), we aim for
            accuracy and date our updates when material is revised.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 fw-bold mb-2">2. Practice tasks and scoring</h2>
          <p className="text-body-secondary mb-2">
            Exam-style tasks are configured by administrators and may draw on licensed or original item banks. Automated
            scoring and band estimates are <strong>practice guidance only</strong>. They do not replace official scoring
            by IELTS or Paragon (CELPIP). We label AI-assisted estimates clearly and link to the{' '}
            <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
              practice disclaimer
            </Link>{' '}
            wherever results could be misunderstood as official outcomes.
          </p>
          <p className="text-body-secondary mb-0">
            If you believe a question or explanation is incorrect, please{' '}
            <Link to="/contact" className="fw-semibold text-decoration-none">
              contact us
            </Link>
            —we investigate substantive errors.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 fw-bold mb-2">3. AI-assisted features</h2>
          <p className="text-body-secondary mb-0">
            Where enabled, tools such as writing feedback, speaking suggestions, study-plan generation, or interview
            practice send relevant learner input to model providers to produce outputs. Those outputs can be imperfect.
            You should treat them as drafts for revision, not authoritative judgments. Do not paste sensitive personal data
            into AI flows; see the{' '}
            <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
              Privacy Policy
            </Link>{' '}
            for how processing works.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 fw-bold mb-2">4. Forum and user-generated content</h2>
          <p className="text-body-secondary mb-0">
            Community posts reflect individual learners’ opinions and study notes. They are not official guidance from test
            providers. Moderators may remove spam, harassment, or clearly misleading claims when reported. Disagreement on
            strategy is fine; fabricated facts about tests or impersonation are not.
          </p>
        </section>

        <section className="mb-4">
          <h2 className="h5 fw-bold mb-2">5. Advertising and independence</h2>
          <p className="text-body-secondary mb-0">
            BandReady may display ads (for example through Google AdSense) on free tiers to support hosting and
            development. Ads do not determine editorial topics on our blog or guides. Pro subscriptions may reduce ad
            exposure where product settings allow. Funding relationships are disclosed here and in the{' '}
            <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <Row className="g-3 mb-0">
          <Col md={6}>
            <Card className="border-0 shadow-sm h-100 br-card">
              <Card.Body className="p-4">
                <h3 className="h6 fw-bold mb-2">Looking for depth?</h3>
                <p className="small text-muted mb-0">
                  Read the long-form{' '}
                  <Link to="/guides" className="fw-semibold text-decoration-none">
                    study guides
                  </Link>{' '}
                  for routines and decision-making frameworks.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border-0 shadow-sm h-100 br-card">
              <Card.Body className="p-4">
                <h3 className="h6 fw-bold mb-2">Questions or corrections</h3>
                <p className="small text-muted mb-0">
                  <Link to="/contact" className="fw-semibold text-decoration-none">
                    Contact BandReady
                  </Link>{' '}
                  with feedback on accuracy, accessibility, or policy—we read messages even if we cannot reply instantly.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
