import { useEffect, useState } from 'react';
import { Accordion, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
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
    icon: 'bi-calendar-check',
    text: 'AI study plan that turns your exam date into a practical weekly schedule and daily tasks.',
  },
  {
    icon: 'bi-mic-fill',
    text: 'Speaking practice routines with structure, timing discipline, and feedback loops (where enabled).',
  },
  {
    icon: 'bi-pencil-square',
    text: 'Writing evaluation that focuses on clarity, coherence, grammar patterns, and band/level improvement (where enabled).',
  },
  {
    icon: 'bi-speedometer2',
    text: 'Band/level guidance and progress tracking so you can measure stability under a timer—not just “time spent”.',
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
              <i className="bi bi-stars" aria-hidden />
              AI-powered CELPIP &amp; IELTS preparation
            </p>
            <h1 className="display-5 fw-bold mb-3">
              <span className="text-body">Meet </span>
              <span className="text-br-rose">BandReady</span>
              <span className="text-body"> — AI-powered CELPIP &amp; IELTS preparation.</span>
            </h1>
            <p className="lead text-muted mb-3">
              {user ? (
                <>
                  Keep your prep focused with a plan you can follow: daily tasks, timed practice, and progress tracking.
                  Run exam-style sections in the browser and review what to improve next.
                </>
              ) : (
                <>
                  BandReady is built for learners who want structure, not guesswork. Start with a personalized study plan,
                  practice realistic tasks, and use feedback to improve your speaking and writing faster.
                </>
              )}
            </p>
            {!user && (
              <p className="small fw-semibold mb-3 d-flex flex-wrap align-items-center gap-2">
                <span className="br-home-quick-badge badge rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2">
                  <i className="bi bi-lightning-charge-fill" aria-hidden />
                  Public guides + practice tools in one place
                </span>
              </p>
            )}
            <div className="d-flex flex-wrap gap-2">
              <Link
                to="/study-plan"
                className="btn btn-primary btn-lg d-inline-flex align-items-center gap-2 px-4"
              >
                <i className="bi bi-calendar-check" aria-hidden />
                Build my study plan
              </Link>
              <Link
                to="/exam/start"
                className="btn btn-outline-primary btn-lg d-inline-flex align-items-center gap-2"
              >
                <i className="bi bi-play-circle-fill" aria-hidden />
                Start practice
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
                Prefer to explore first? Start with{' '}
                <Link to="/how-it-works" className="fw-semibold text-decoration-none">
                  how it works
                </Link>
                , browse the{' '}
                <Link to="/guides" className="fw-semibold text-decoration-none">
                  study guides
                </Link>
                , or read the{' '}
                <Link to="/blog" className="fw-semibold text-decoration-none">
                  blog
                </Link>
                . You can create an account later to save progress.
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
                  to="/features"
                  className="fw-semibold text-decoration-none d-inline-flex align-items-center gap-2 text-br-rose"
                >
                  <span>See all features</span>
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

        <Row className="g-4 mb-4">
          <Col lg={7}>
            <div className="br-card p-4 h-100">
              <h2 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-book text-br-rose" aria-hidden />
                What is BandReady?
              </h2>
              <p className="text-muted mb-3">
                <strong className="text-body">BandReady</strong> is an AI-powered CELPIP &amp; IELTS preparation platform
                designed to move you from “I studied a lot” to “I know exactly what to do next.” Many learners spend
                weeks collecting random tips, watching videos, and doing occasional practice sets—but they never build a
                reliable routine. BandReady turns your exam date into a personalized study plan and a repeatable practice
                cycle.
              </p>
              <p className="text-muted mb-3">
                With BandReady, you can rehearse <strong className="text-body">exam-style timing</strong> in the browser,
                practice the tasks that matter, and shorten the feedback loop. When AI tools are enabled in your plan,
                BandReady can support <strong className="text-body">speaking practice</strong>, <strong className="text-body">writing evaluation</strong>,
                and <strong className="text-body">band/level guidance</strong> so you can focus on the improvements that
                actually raise scores: clarity, coherence, vocabulary precision, and controlled grammar patterns.
              </p>
              <p className="text-muted mb-0">
                The result is a more confident test-day routine: you practice under realistic constraints, review
                mistakes, and repeat with one improvement goal at a time. If you want a clear next step, start by
                entering your date and building your plan.
              </p>
            </div>
          </Col>
          <Col lg={5}>
            <div className="br-card p-4 h-100">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-award text-br-rose" aria-hidden />
                Supported exams
              </h2>
              <Row className="g-3">
                <Col xs={12}>
                  <Card className="border-0 shadow-sm br-card">
                    <Card.Body className="p-3">
                      <h3 className="h6 fw-bold mb-1">CELPIP</h3>
                      <p className="small text-muted mb-0">Computer-based practice with a focus on timing and structure.</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12}>
                  <Card className="border-0 shadow-sm br-card">
                    <Card.Body className="p-3">
                      <h3 className="h6 fw-bold mb-1">IELTS Academic</h3>
                      <p className="small text-muted mb-0">Academic-style tasks and pacing for study or migration paths.</p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col xs={12}>
                  <Card className="border-0 shadow-sm br-card">
                    <Card.Body className="p-3">
                      <h3 className="h6 fw-bold mb-1">IELTS General Training</h3>
                      <p className="small text-muted mb-0">General Training practice with everyday English task styles.</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          </Col>
        </Row>

        {/* <div className="br-card p-4 mb-4">
          <h2 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-diagram-3 text-br-rose" aria-hidden />
            How it works (step-by-step)
          </h2>
          <Row className="g-3">
            {[
              { n: 'Step 1', t: 'Enter exam date', d: 'Set your timeline so your prep has pacing and checkpoints.' },
              { n: 'Step 2', t: 'AI generates plan', d: 'Get a schedule with daily tasks you can follow consistently.' },
              { n: 'Step 3', t: 'Practice tasks', d: 'Do speaking and writing practice plus timed sections where available.' },
              { n: 'Step 4', t: 'Get feedback', d: 'Review mistakes and (where enabled) get AI evaluation to guide your next move.' },
              { n: 'Step 5', t: 'Improve score', d: 'Repeat with one improvement target at a time until performance stabilizes.' },
            ].map((s) => (
              <Col key={s.n} md={6} lg={4} xl={2}>
                <Card className="border-0 shadow-sm h-100 br-card">
                  <Card.Body className="p-3">
                    <p className="small text-uppercase fw-semibold text-br-rose mb-1">{s.n}</p>
                    <h3 className="h6 fw-bold mb-2">{s.t}</h3>
                    <p className="small text-muted mb-0">{s.d}</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <p className="text-muted mt-3 mb-0">
            Want the full walkthrough?{' '}
            <Link to="/how-it-works" className="fw-semibold text-decoration-none">
              Read How it works
            </Link>
            .
          </p>
        </div> */}

        {/* <div className="br-card p-4 mb-4">
          <h2 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-ui-checks-grid text-br-rose" aria-hidden />
            Features
          </h2>
          <Row className="g-3">
            {[
              { icon: 'bi-calendar-check', title: 'AI study plan', text: 'A plan built around your exam date, with pacing and priorities.' },
              { icon: 'bi-mic-fill', title: 'Speaking practice', text: 'Prompts, structure, and repeat attempts to improve fluency and coherence.' },
              { icon: 'bi-pencil-square', title: 'Writing evaluation', text: 'Actionable feedback on clarity, cohesion, grammar patterns, and vocabulary.' },
              { icon: 'bi-speedometer2', title: 'Band score prediction', text: 'Practice-level guidance to help you set realistic next goals.' },
              { icon: 'bi-check2-circle', title: 'Daily tasks', text: 'Small tasks you can complete every day without burnout.' },
              { icon: 'bi-graph-up-arrow', title: 'Progress tracking', text: 'See weak areas and stability under time limits across sessions.' },
            ].map((f) => (
              <Col key={f.title} md={6} lg={4}>
                <Card className="border-0 shadow-sm h-100 br-card">
                  <Card.Body className="p-4">
                    <h3 className="h6 fw-bold mb-2 d-flex align-items-center gap-2">
                      <i className={`bi ${f.icon} text-br-rose`} aria-hidden />
                      {f.title}
                    </h3>
                    <p className="small text-muted mb-0">{f.text}</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          <p className="text-muted mt-3 mb-0">
            See details on the{' '}
            <Link to="/features" className="fw-semibold text-decoration-none">
              Features
            </Link>{' '}
            page.
          </p>
        </div> */}

        {/* <Row className="g-4 mb-4">
          <Col lg={6}>
            <div className="br-card p-4 h-100">
              <h2 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-stars text-br-rose" aria-hidden />
                Sample AI output (example)
              </h2>
              <p className="text-muted mb-3">
                This is a static example of what a weekly plan summary might look like. Your real plan depends on your
                exam date, goals, and progress.
              </p>
              <div className="bg-body-tertiary rounded-3 p-3 border" style={{ borderColor: 'var(--br-border)' }}>
                <p className="small fw-semibold mb-2">Week 1 — Build foundations (45–60 minutes/day)</p>
                <ul className="small text-muted ps-3 mb-0">
                  <li className="mb-1">
                    <strong className="text-body">Mon</strong>: Timed Reading (20 min) + review 10 mistakes (15 min) + vocab notebook (10 min)
                  </li>
                  <li className="mb-1">
                    <strong className="text-body">Tue</strong>: Speaking prompt x2 (record, then repeat with one improvement goal)
                  </li>
                  <li className="mb-1">
                    <strong className="text-body">Wed</strong>: Writing task (plan 5 min, write 25 min, revise 10 min) + feedback checklist
                  </li>
                  <li className="mb-1">
                    <strong className="text-body">Thu</strong>: Timed Listening (20–30 min) + review + “why I missed it” notes
                  </li>
                  <li className="mb-1">
                    <strong className="text-body">Fri</strong>: Mixed mini-test + identify 1 weak skill to focus next week
                  </li>
                </ul>
              </div>
            </div>
          </Col>
          <Col lg={6}>
            <div className="br-card p-4 h-100">
              <h2 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-check-circle text-br-rose" aria-hidden />
                Why use BandReady?
              </h2>
              <ul className="text-muted ps-3 mb-3">
                <li className="mb-2">
                  <strong className="text-body">Less overwhelm</strong>: one platform for planning, practice, and tracking.
                </li>
                <li className="mb-2">
                  <strong className="text-body">Better timing discipline</strong>: practice in an exam-style flow, not only untimed drills.
                </li>
                <li className="mb-2">
                  <strong className="text-body">Faster improvement</strong>: feedback loops help you fix patterns instead of repeating them.
                </li>
                <li className="mb-2">
                  <strong className="text-body">More confidence</strong>: repeated practice reduces test-day surprises.
                </li>
                <li className="mb-0">
                  <strong className="text-body">Clear next step</strong>: a study plan you can follow every day.
                </li>
              </ul>
              <p className="text-muted mb-0">
                Ready to begin?{' '}
                <Link to="/study-plan" className="fw-semibold text-decoration-none">
                  Build your study plan
                </Link>{' '}
                or{' '}
                <Link to="/exam/start" className="fw-semibold text-decoration-none">
                  start practice
                </Link>
                .
              </p>
            </div>
          </Col>
        </Row> */}

        <div className="br-card p-4 mb-0">
          <h2 className="h4 fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-question-circle text-br-rose" aria-hidden />
            FAQ
          </h2>
          <Accordion defaultActiveKey="0" alwaysOpen>
            <Accordion.Item eventKey="0">
              <Accordion.Header>Is BandReady free?</Accordion.Header>
              <Accordion.Body className="text-muted">
                BandReady includes free public content and free practice access depending on what your program publishes.
                Some advanced tools (like AI feedback) may be part of a paid plan or enabled features.
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="1">
              <Accordion.Header>Is BandReady affiliated with IELTS or CELPIP?</Accordion.Header>
              <Accordion.Body className="text-muted">
                No. BandReady is an independent practice platform. Names refer to the style of preparation only. Read the{' '}
                <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
                  practice disclaimer
                </Link>{' '}
                for details.
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="2">
              <Accordion.Header>How does the AI study plan help?</Accordion.Header>
              <Accordion.Body className="text-muted">
                It turns your exam date into a schedule with daily tasks and review checkpoints—so you always know what to
                practice next and how to balance skills (speaking, writing, reading, listening).
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="3">
              <Accordion.Header>Can BandReady predict my official band score?</Accordion.Header>
              <Accordion.Body className="text-muted">
                BandReady can provide practice-level guidance, but it cannot guarantee official scores. Use predictions as
                a learning signal—then focus on the improvement actions you can control.
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="4">
              <Accordion.Header>Do I need an account to read the content pages?</Accordion.Header>
              <Accordion.Body className="text-muted">
                No. Pages like About, How it works, Features, Blog, Contact, Privacy Policy, and Terms are public. Create
                an account when you want saved progress and deeper tracking.
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="5">
              <Accordion.Header>What should I do if I’m stuck at the same level?</Accordion.Header>
              <Accordion.Body className="text-muted">
                Stop doing “more of everything.” Choose one weak skill (for example: writing clarity or speaking
                organization), practice it under a timer, get feedback, and repeat the same task with one specific goal.
                BandReady is built to support that loop.
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="6">
              <Accordion.Header>Where can I ask questions?</Accordion.Header>
              <Accordion.Body className="text-muted">
                Use the{' '}
                <Link to="/forum" className="fw-semibold text-decoration-none">
                  forum
                </Link>{' '}
                for community discussion or send a message via{' '}
                <Link to="/contact" className="fw-semibold text-decoration-none">
                  contact
                </Link>
                .
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </div>
      </Container>
    </div>
  );
}
