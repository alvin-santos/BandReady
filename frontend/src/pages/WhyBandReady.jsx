import { Col, Container, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Exam-style practice',
    icon: 'bi-fullscreen',
    items: [
      'Fullscreen timed tests with optional strict timer and forward-only navigation when your team configures it.',
      'Programs for IELTS and CELPIP-style tracks—pick Academic, General Training, or listening/speaking-focused flows from exam selection.',
      'Question grid with flags, autosave, and the ability to resume an in-progress attempt after sign-in.',
    ],
  },
  {
    title: 'Listening & reading',
    icon: 'bi-volume-up-fill',
    items: [
      'Listening with browser text-to-speech or uploaded audio, plus reading passages in a test-style layout.',
      'Pacing tools so you can rehearse how long you spend on each passage or part.',
    ],
  },
  {
    title: 'Writing & speaking',
    icon: 'bi-pencil-square',
    items: [
      'Writing tasks with structured prompts; your answers are saved with the attempt.',
      'Speaking practice with recording and transcript capture for review on results.',
      'BandReady Pro can unlock AI-assisted feedback on writing and speaking where your team enables it—see the Pro page for current limits.',
    ],
  },
  {
    title: 'Automated scoring & checking',
    icon: 'bi-check2-circle',
    items: [
      'Objective items—such as multiple choice, true/false, fill-in-the-blank, and multi-select—are checked automatically against the published answers when you submit. No manual marking step for those types.',
      'Writing and speaking are scored on submit from your text or transcript: Pro accounts can use AI rubric-style feedback where configured; otherwise a completion-based estimate may apply so you still get a scored attempt.',
      'Results show which objective items were right or wrong (where applicable) together with your overall attempt score.',
    ],
  },
  {
    title: 'Dashboard',
    icon: 'bi-speedometer2',
    items: [
      'After email verification, your Dashboard summarizes how you are tracking: readiness-style signals overall and by skill (listening, reading, writing, speaking) so you can spot weak areas.',
      'See recent completed attempts, resume in-progress tests, and jump back into practice from one place.',
      'Your Profile includes a compact stats view alongside account details.',
    ],
  },
  {
    title: 'Analytics',
    icon: 'bi-graph-up-arrow',
    items: [
      'A dedicated Analytics page (signed-in, verified accounts) turns your history into charts: average score and number of tests per day.',
      'Break down trends by skill—listening, reading, writing, speaking—so you can compare how each section moves over time.',
      'Summary counts include total answers recorded alongside tests completed, so volume of practice is visible as well as scores.',
    ],
  },
  {
    title: 'Results, explanations & mistakes',
    icon: 'bi-clipboard-check',
    items: [
      'Each finished attempt has a results view with your score and explanations where your authors provide them.',
      'The Mistakes hub lists items you missed across attempts so you can target review.',
    ],
  },
  {
    title: 'Rankings',
    icon: 'bi-trophy',
    items: [
      'Public rankings let you compare your pace and scores with other learners when your administrators publish leaderboards.',
    ],
  },
  {
    title: 'Resources & downloadable content',
    icon: 'bi-file-earmark-arrow-down',
    items: [
      'The Resources page lists printable-style guides and files (plain text) that your team publishes.',
      'Downloading requires a signed-in account. Some items are free for every member; others are labelled Pro and unlock with BandReady Pro.',
    ],
  },
  {
    title: 'Account & prep',
    icon: 'bi-person-badge',
    items: [
      'Free registration with email verification unlocks saved attempts, dashboard, analytics, mistakes, and eligible downloads.',
      'A dedicated practice disclaimer explains how on-screen and AI practice differs from official IELTS and CELPIP delivery.',
      'Pro subscription adds higher limits and AI feedback on eligible sections—details on the Pro page.',
    ],
  },
];

export default function WhyBandReady() {
  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-stars" aria-hidden />
          Why BandReady
        </p>
        <h1 className="h3 fw-bold mb-3">
          Everything <span className="text-br-rose">BandReady</span> is built to do
        </h1>
        <p className="text-muted mb-4 col-lg-10">
          Below is a full picture of the product: timed practice, automatic scoring, dashboards and analytics, downloads,
          and account features. Availability of specific exams and Pro features depends on your team&apos;s configuration.
        </p>

        <Row className="g-4 mb-4">
          {sections.map((block) => (
            <Col lg={6} key={block.title}>
              <div className="br-card p-4 h-100">
                <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className={`bi ${block.icon} text-br-rose`} aria-hidden />
                  {block.title}
                </h2>
                <ul className="list-unstyled mb-0 text-muted small">
                  {block.items.map((line) => (
                    <li key={line} className="mb-2 d-flex gap-2">
                      <span className="text-br-rose flex-shrink-0" aria-hidden>
                        ·
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Col>
          ))}
        </Row>

        <div className="br-card p-4 mb-4">
          <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-rocket-takeoff text-br-rose" aria-hidden />
            Get started
          </h2>
          <p className="text-muted mb-3">
            Jump into a timed run, read the practice disclaimer, or create an account to keep progress across devices.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/exam/start" className="btn btn-primary d-inline-flex align-items-center gap-2">
              <i className="bi bi-play-circle-fill" aria-hidden />
              Start practice
            </Link>
            <Link to="/practice-disclaimer" className="btn btn-outline-primary d-inline-flex align-items-center gap-2">
              <i className="bi bi-shield-exclamation" aria-hidden />
              Practice disclaimer
            </Link>
            <Link to="/resources" className="btn btn-outline-primary d-inline-flex align-items-center gap-2">
              <i className="bi bi-file-earmark-arrow-down" aria-hidden />
              Resources
            </Link>
            <Link to="/dashboard" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
              <i className="bi bi-speedometer2" aria-hidden />
              Dashboard
            </Link>
            <Link to="/analytics" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
              <i className="bi bi-graph-up-arrow" aria-hidden />
              Analytics
            </Link>
            <Link to="/register" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
              <i className="bi bi-person-plus" aria-hidden />
              Create account
            </Link>
            <Link to="/subscription" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
              <i className="bi bi-star-fill" aria-hidden />
              Pro
            </Link>
          </div>
        </div>

        <p className="mt-4 mb-0">
          <Link to="/" className="text-decoration-none">
            ← Back to home
          </Link>
        </p>
      </Container>
    </div>
  );
}
