import { useEffect, useState } from 'react';
import { Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import AdSlot from '../components/AdSlot.jsx';
import HomeFloatingFeatureCards from '../components/HomeFloatingFeatureCards.jsx';
import PracticeDisclaimerCallout from '../components/PracticeDisclaimerCallout.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** @param {{ code?: string }} exam */
function iconForExam(exam) {
  const c = String(exam.code || '').toLowerCase();
  if (c.includes('academic')) {
    return 'bi-journal-bookmark-fill';
  }
  if (c.includes('ielts') && c.includes('general')) {
    return 'bi-newspaper';
  }
  if (c.includes('celpip') && (c.includes('_ls') || c.endsWith('ls'))) {
    return 'bi-mic-fill';
  }
  if (c.includes('celpip')) {
    return 'bi-globe2';
  }
  if (c.includes('ielts')) {
    return 'bi-journal-text';
  }
  return 'bi-ui-checks-grid';
}

/** @param {{ type?: string, code?: string }} exam */
function descriptionForExam(exam) {
  const t = String(exam.type || '').toLowerCase().replace(/\s+/g, '_');
  const c = String(exam.code || '').toLowerCase();
  if (t === 'academic' || c.includes('academic')) {
    return 'Timed sections and long reading where configured.';
  }
  if (t === 'general' || (c.includes('general') && !c.includes('celpip'))) {
    return 'General Training–style everyday English and pacing.';
  }
  if (t === 'ls' || c.includes('_ls') || c.endsWith('ls')) {
    return 'Listening- and speaking-focused tracks.';
  }
  if (c.includes('celpip')) {
    return 'Listening, reading, writing, and speaking where published.';
  }
  if (t) {
    return `${String(exam.type).replace(/_/g, ' ')} — see tests inside.`;
  }
  return 'Timed practice and section tests from your team.';
}

const features = [
  {
    icon: 'bi-window-fullscreen',
    text: 'Full exams run in the browser—no PDF packs or downloads; optional strict timer and forward-only navigation.',
  },
  {
    icon: 'bi-volume-up-fill',
    text: 'Listening (browser speech or uploaded audio) and reading passages in a test-style layout.',
  },
  {
    icon: 'bi-grid-3x3-gap',
    text: 'Question grid, flags, autosave, resume, and mistakes review for signed-in learners.',
  },
  {
    icon: 'bi-graph-up-arrow',
    text: 'Results and explanations, dashboard, rankings, resources, and a clear practice disclaimer.',
  },
];

export default function Home() {
  const { user, isSubscribed, isAdmin } = useAuth();
  const [topAd, setTopAd] = useState(null);
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState(null);

  useEffect(() => {
    if (isSubscribed && !isAdmin) {
      setTopAd(null);
      return;
    }
    api.get('/ads', { params: { location: 'top_banner' } }).then((res) => {
      const list = res.data || [];
      setTopAd(list.find((a) => a.active) || list[0] || null);
    });
  }, [isSubscribed, isAdmin]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/exams')
      .then((res) => {
        if (!cancelled) {
          setExams(Array.isArray(res.data) ? res.data : []);
          setExamsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExamsError('Could not load exam programs.');
          setExams([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setExamsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="br-gradient-hero br-home-landing">
      <Container className="py-5">
        <Row className="align-items-center py-lg-5">
          <Col lg={7} className="position-relative">
            <div className="br-home-hero-blobs" aria-hidden>
              <span className="br-home-hero-blob br-home-hero-blob--a" />
              <span className="br-home-hero-blob br-home-hero-blob--b" />
              <span className="br-home-hero-blob br-home-hero-blob--c" />
            </div>
            <p className="br-home-eyebrow text-uppercase small fw-semibold mb-2 d-inline-flex align-items-center gap-2">
              <i className="bi bi-window-desktop" aria-hidden />
              In-browser exam simulation
            </p>
            <h1 className="display-5 fw-bold mb-3">
              <span className="text-br-rose">IELTS &amp; CELPIP</span> practice with{' '}
              <span className="text-body">exam-style timing and on-screen flow</span>—in your browser.
            </h1>
            <p className="lead text-muted mb-3">
              {user ? (
                <>
                  Timed sections, audio, navigation, autosave, and scoring in one on-screen flow—built so rehearsal
                  matches test-day rhythm and pressure more than a PDF ever could.
                </>
              ) : (
                <>
                  <strong className="text-body">No exam PDFs or installs</strong>—run the same kind of timed,
                  full-screen flow you will face on test day. Guests can try Reading and Writing with no account; sign in
                  for Listening, Speaking, and saved progress.
                </>
              )}
            </p>
            {!user && (
              <p className="small fw-semibold mb-3 d-flex flex-wrap align-items-center gap-2">
                <span className="br-home-quick-badge badge rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2">
                  <i className="bi bi-lightning-charge-fill" aria-hidden />
                  Live in-browser · no download for guests
                </span>
              </p>
            )}
            <div className="d-flex flex-wrap gap-2">
              <Link
                to="/exam/start"
                className="btn btn-primary btn-lg d-inline-flex align-items-center gap-2 px-4"
              >
                <i className="bi bi-play-circle-fill" aria-hidden />
                {user ? 'Start practice' : 'Try it now'}
              </Link>
              <Link
                to="/practice-disclaimer"
                className="btn btn-outline-primary btn-lg d-inline-flex align-items-center gap-2"
              >
                <i className="bi bi-shield-exclamation" aria-hidden />
                Practice disclaimer
              </Link>
              {!user && (
              <Link
                to="/register"
                className="btn btn-outline-secondary btn-lg d-inline-flex align-items-center gap-2"
              >
                <i className="bi bi-person-plus" aria-hidden />
                Create account
              </Link>
              )}
            </div>
            {!user && (
              <p className="small text-muted mt-3 mb-0">
                Prefer to explore first? You can <strong className="text-body">save results, readiness, and dashboard</strong>{' '}
                after you <Link to="/register">create a free account</Link> — whenever you are ready.
              </p>
            )}
          </Col>
          <Col lg={5} className="mt-4 mt-lg-0">
            <div className="br-card br-home-feature-card br-home-feature-card--accent p-3 position-relative overflow-hidden">
              <div className="br-home-feature-card-deco" aria-hidden />
              <h2 className="h6 fw-bold mb-2 d-flex align-items-center gap-2 position-relative">
                <span className="br-home-feature-title-icon d-inline-flex align-items-center justify-content-center">
                  <i className="bi bi-stars" aria-hidden />
                </span>
                Why <span className="text-br-rose">BandReady</span>
              </h2>
              <ul className="list-unstyled mb-0 text-muted br-home-feature-list">
                {features.map((f) => (
                  <li key={f.text} className="mb-2 d-flex gap-2">
                    <span className="br-feature-icon br-home-feature-icon flex-shrink-0">
                      <i className={`bi ${f.icon}`} aria-hidden />
                    </span>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-0 mt-3 pt-3 border-top" style={{ borderColor: 'var(--br-border)' }}>
                <Link
                  to="/why-bandready"
                  className="fw-semibold text-decoration-none d-inline-flex align-items-center gap-2 text-br-rose"
                >
                  <span>Complete features</span>
                  <i className="bi bi-arrow-right" aria-hidden />
                </Link>
              </p>
            </div>
          </Col>
        </Row>

        <HomeFloatingFeatureCards />

        <div className="mb-4">
          <AdSlot location="top_banner" ad={topAd} />
        </div>

        <div className="br-home-section-heading d-flex flex-wrap align-items-center gap-3 mb-4">
          <h2 className="h4 fw-bold mb-0 d-flex align-items-center gap-2">
            <span className="br-home-section-icon d-inline-flex align-items-center justify-content-center">
              <i className="bi bi-ui-checks-grid" aria-hidden />
            </span>
            Choose your <span className="text-br-rose">exam</span>
          </h2>
          <div className="br-home-section-dots d-none d-sm-flex gap-1 align-items-center" aria-hidden>
            <span className="br-home-section-dot br-home-section-dot--rose" />
            <span className="br-home-section-dot br-home-section-dot--blue" />
            <span className="br-home-section-dot br-home-section-dot--amber" />
            <span className="br-home-section-dot br-home-section-dot--violet" />
            <span className="br-home-section-dot br-home-section-dot--teal" />
          </div>
        </div>
        {examsError && (
          <p className="text-danger small mb-3" role="alert">
            {examsError}{' '}
            <Link to="/exam/start" className="text-danger fw-semibold">
              Open exam selection
            </Link>{' '}
            to pick a program manually.
          </p>
        )}
        {examsLoading && (
          <div className="py-5 text-center text-muted">
            <Spinner animation="border" size="sm" className="me-2" aria-hidden />
            Loading exam programs…
          </div>
        )}
        {!examsLoading && !examsError && exams.length === 0 && (
          <p className="text-muted mb-4">
            No exam programs are published yet.{' '}
            <Link to="/exam/start">Go to exam selection</Link> or check back later.
          </p>
        )}
        {!examsLoading && exams.length > 0 && (
          <Row className="g-4 mb-5 justify-content-center">
            {exams.filter((e) => String(e.code || '').trim()).map((exam, examIdx) => {
              const code = String(exam.code || '').trim();
              const name = String(exam.name || code || 'Exam').trim();
              const tint = examIdx % 6;
              return (
                <Col xs={12} sm={6} lg={4} xl={3} key={exam.id ?? code}>
                  <Link
                    to={`/exam/start?exam=${encodeURIComponent(code)}`}
                    className="text-decoration-none text-reset d-block h-100"
                  >
                    <div
                      className={`br-card br-card-hover br-exam-card-shell br-exam-card-shell--c${tint} p-4 h-100 position-relative overflow-hidden`}
                    >
                      <div className="br-exam-card-glow" aria-hidden />
                      <div className="d-flex justify-content-between align-items-start position-relative">
                        <i className={`bi ${iconForExam(exam)} br-exam-card-icon`} aria-hidden />
                        <i className="bi bi-chevron-right text-muted small opacity-50" aria-hidden />
                      </div>
                      <h3 className="h5 fw-bold text-br-rose">{name}</h3>
                      <p className="small text-muted mb-0">{descriptionForExam(exam)}</p>
                    </div>
                  </Link>
                </Col>
              );
            })}
          </Row>
        )}
      </Container>
    </div>
  );
}
