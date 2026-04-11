import { useEffect, useMemo, useState } from 'react';
import { Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setGuestSession } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AdSlot from '../components/AdSlot.jsx';
import PracticeDisclaimerCallout from '../components/PracticeDisclaimerCallout.jsx';

const modeMeta = {
  full: { icon: 'bi-layers-fill', label: 'Full mock test' },
  quick: { icon: 'bi-lightning-charge-fill', label: 'Quick practice' },
};

/** @param {{ code?: string }} exam */
function iconForExamProgram(exam) {
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

/** @param {string | undefined} sectionName */
function iconForTestSection(sectionName) {
  const n = String(sectionName || '').toLowerCase();
  if (n.includes('listen')) {
    return 'bi-volume-up-fill';
  }
  if (n.includes('read')) {
    return 'bi-book';
  }
  if (n.includes('writ')) {
    return 'bi-pen';
  }
  if (n.includes('speak')) {
    return 'bi-mic-fill';
  }
  return 'bi-journal-text';
}

export default function ExamStart() {
  const { user, isSubscribed, refresh } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [tests, setTests] = useState([]);
  const [ads, setAds] = useState([]);
  const [examId, setExamId] = useState('');
  const [mode, setMode] = useState('full');
  const [testId, setTestId] = useState('');
  const [strictMode, setStrictMode] = useState(false);
  const [forwardOnly, setForwardOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const examParam = search.get('exam');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eRes = await api.get('/exams');
        if (cancelled) {
          return;
        }
        setExams(eRes.data);
        if (examParam) {
          const found = eRes.data.find((x) => x.code === examParam);
          if (found) {
            setExamId(String(found.id));
          }
        }
        if (!isSubscribed) {
          const aRes = await api.get('/ads');
          if (!cancelled) {
            setAds(aRes.data || []);
          }
        } else {
          setAds([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examParam, isSubscribed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!examId) {
      setTests([]);
      return;
    }
    let cancelled = false;
    api
      .get('/tests', { params: { exam_id: examId, practice_mode: mode } })
      .then((res) => {
        if (!cancelled) {
          setTests(res.data);
          setTestId('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [examId, mode]);

  const sidebarAd = useMemo(() => ads.find((a) => a.location === 'sidebar'), [ads]);

  /** Free-tier Speaking quota: used / limit (e.g. 2/3). */
  const speakingQuota = useMemo(() => {
    if (!user || isSubscribed) {
      return null;
    }
    const limit = user.speaking_attempts_limit;
    if (limit == null || limit <= 0) {
      return null;
    }
    const used = Math.min(limit, Math.max(0, Number(user.speaking_attempts_used) || 0));

    return { used, limit, fraction: `${used}/${limit}` };
  }, [user, isSubscribed]);

  const selectedTest = useMemo(
    () => tests.find((t) => String(t.id) === String(testId)),
    [tests, testId]
  );
  const cannotStart = !testId || selectedTest?.is_available === false || selectedTest?.locked;

  async function start() {
    if (!testId) {
      return;
    }
    setStarting(true);
    try {
      const body = { test_id: Number(testId) };
      if (user) {
        body.strict_mode = strictMode;
        body.forward_only = forwardOnly;
      }
      const { data } = await api.post('/start-attempt', body);
      if (data.attempt.guest_session) {
        setGuestSession(data.attempt.guest_session);
      }
      navigate(`/exam/run/${data.attempt.id}`, { state: { bundle: data } });
    } catch (e) {
      const code = e.response?.data?.code;
      const msg = e.response?.data?.message;
      if (e.response?.status === 403) {
        if (code === 'subscription_required') {
          alert(msg || 'This test requires an active subscription.');
        } else if (code === 'speaking_limit_reached') {
          alert(msg || 'You have used all free Speaking attempts. Pro unlocks unlimited Speaking.');
        } else if (code === 'speaking_ai_suspended') {
          alert(
            msg ||
              'Speaking practice was disabled on your account because inappropriate language was detected. See your profile for details.'
          );
          void refresh();
        } else if (code === 'guest_section_denied') {
          alert(msg || 'Sign in to use Listening and Speaking. Guests may use Reading and Writing only.');
        } else {
          alert(msg || 'Please sign in to access this test.');
        }
      }
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="g-4">
        <Col lg={8}>
          <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-ui-checks text-br-rose" aria-hidden />
            Exam selection
          </h1>
          <p className="text-muted mb-4 d-flex align-items-start gap-2">
            <i className="bi bi-info-circle mt-1 flex-shrink-0" aria-hidden />
            <span>
              Pick your program, practice mode, and test. <strong>Guests</strong> can start <strong>Reading</strong> and{' '}
              <strong>Writing</strong> only. <strong>Signed-in</strong> users also get <strong>Listening</strong> and{' '}
              <strong>Speaking</strong> (a limited number of free Speaking exams; <strong>Pro</strong> is unlimited).{' '}
              <strong>Pro</strong> also enables AI feedback on essays and speaking where the site has it configured.
            </span>
          </p>

          <PracticeDisclaimerCallout className="mb-4" />

          <div className="br-card p-4 mb-4">
            <Form.Group as="fieldset" className="mb-4">
              <Form.Label as="legend" className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-mortarboard" aria-hidden />
                Exam program
              </Form.Label>
              <Row className="g-3" role="radiogroup" aria-label="Exam program">
                {exams.map((ex) => {
                  const sel = String(examId) === String(ex.id);
                  return (
                    <Col key={ex.id} xs={6} md={4} xl={3}>
                      <label
                        className={`br-select-thumb ${sel ? 'br-select-thumb--selected' : ''}`}
                        htmlFor={`exam-opt-${ex.id}`}
                      >
                        <input
                          id={`exam-opt-${ex.id}`}
                          type="radio"
                          className="br-select-thumb-input"
                          name="exam-program"
                          checked={sel}
                          onChange={() => setExamId(String(ex.id))}
                          autoComplete="off"
                        />
                        {sel && (
                          <span className="br-select-thumb-check" aria-hidden>
                            <i className="bi bi-check-circle-fill" />
                          </span>
                        )}
                        <div className="d-flex align-items-start gap-2 pe-3">
                          <span className="br-select-thumb-icon" aria-hidden>
                            <i className={`bi ${iconForExamProgram(ex)}`} />
                          </span>
                          <span className="small fw-semibold text-body lh-sm pt-0">{ex.name}</span>
                        </div>
                      </label>
                    </Col>
                  );
                })}
              </Row>
              {exams.length === 0 && <p className="small text-muted mb-0">No exam programs are available yet.</p>}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="d-flex align-items-center gap-2">
                <i className="bi bi-sliders" aria-hidden />
                Practice mode
              </Form.Label>
              <div>
                {(['full', 'quick']).map((key) => {
                  const m = modeMeta[key];
                  return (
                    <Form.Check
                      key={key}
                      className="mb-2"
                      type="radio"
                      name="pmode"
                      id={`pm-${key}`}
                      checked={mode === key}
                      onChange={() => setMode(key)}
                      label={
                        <span className="d-inline-flex align-items-center gap-2">
                          <i className={`bi ${m.icon}`} aria-hidden />
                          {m.label}
                        </span>
                      }
                    />
                  );
                })}
              </div>
              {speakingQuota && (
                <div
                  className="mt-3 p-3 rounded border border-secondary border-opacity-25 bg-body-secondary bg-opacity-10"
                  role="status"
                  aria-label={`Speaking exams used: ${speakingQuota.used} of ${speakingQuota.limit}`}
                >
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <span className="small text-muted mb-0">Free Speaking uses</span>
                    <span
                      className={`font-monospace fw-bold fs-5 mb-0 ${speakingQuota.used >= speakingQuota.limit ? 'text-danger' : 'text-body'}`}
                    >
                      {speakingQuota.fraction}
                    </span>
                  </div>
                  <p className="small text-muted mb-0 mt-1">
                    {speakingQuota.used >= speakingQuota.limit ? (
                      <>
                        Limit reached — <Link to="/subscription">Pro</Link> unlocks unlimited Speaking.
                      </>
                    ) : (
                      <>
                        {speakingQuota.limit - speakingQuota.used} remaining · {speakingQuota.used} of {speakingQuota.limit}{' '}
                        started.
                      </>
                    )}
                  </p>
                </div>
              )}
              {user && !isSubscribed && !speakingQuota && (
                <p className="small text-muted mb-0 mt-2 d-flex align-items-start gap-2">
                  <i className="bi bi-star-fill mt-1 flex-shrink-0" aria-hidden />
                  <span>
                    <Link to="/subscription" className="fw-semibold">
                      Get Pro (one-time)
                    </Link>{' '}
                    for unlimited <strong>Speaking</strong> and AI feedback. Speaking is Pro-only here unless the server sets{' '}
                    <code className="text-body">EXAM_ACCESS_FREE_SPEAKING_LIMIT</code>.
                  </span>
                </p>
              )}
              {user && !isSubscribed && speakingQuota && (
                <p className="small text-muted mb-0 mt-2 d-flex align-items-start gap-2">
                  <i className="bi bi-star-fill mt-1 flex-shrink-0" aria-hidden />
                  <span>
                    <Link to="/subscription" className="fw-semibold">
                      Get Pro (one-time)
                    </Link>{' '}
                    for unlimited Speaking and AI feedback on writing and speaking.
                  </span>
                </p>
              )}
            </Form.Group>

            <Form.Group className={`mb-3 ${!user ? 'opacity-50' : ''}`}>
              <Form.Label className="d-flex align-items-center gap-2">
                <i className="bi bi-shield-lock" aria-hidden />
                Timer
                {!user && (
                  <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 fw-normal">
                    Sign in
                  </span>
                )}
              </Form.Label>
              <Form.Check
                type="checkbox"
                id="strict-mode"
                disabled={!user}
                checked={user ? strictMode : false}
                onChange={(e) => setStrictMode(e.target.checked)}
                label="Strict mode (test-day simulation: timer cannot be paused)"
              />
              <p className="small text-muted mb-0 mt-1">
                {user
                  ? 'Leave unchecked to allow pausing the timer during practice.'
                  : 'Available when you are logged in — strict mode locks the timer like test day.'}
              </p>
            </Form.Group>

            <Form.Group className={`mb-3 ${!user ? 'opacity-50' : ''}`}>
              <Form.Label className="d-flex align-items-center gap-2">
                <i className="bi bi-arrow-right-circle" aria-hidden />
                Navigation
                {!user && (
                  <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 fw-normal">
                    Sign in
                  </span>
                )}
              </Form.Label>
              <Form.Check
                type="checkbox"
                id="forward-only"
                disabled={!user}
                checked={user ? forwardOnly : false}
                onChange={(e) => setForwardOnly(e.target.checked)}
                label="Forward-only (cannot go back to earlier questions after Next)"
              />
              <p className="small text-muted mb-0 mt-1">
                {user
                  ? 'When enabled, the question grid and Previous are disabled for items you have already moved past.'
                  : 'Available when you are logged in — forward-only prevents returning to earlier questions.'}
              </p>
            </Form.Group>

            <Form.Group as="fieldset" className="mb-3">
              <Form.Label as="legend" className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-list-task" aria-hidden />
                Test
              </Form.Label>
              {!examId && (
                <p className="small text-muted mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-arrow-up-circle" aria-hidden />
                  Choose an exam program above to see tests for this mode.
                </p>
              )}
              {examId && tests.length === 0 && (
                <p className="small text-muted mb-0">No tests match this program and mode.</p>
              )}
              {examId && tests.length > 0 && (
                <Row className="g-3" role="radiogroup" aria-label="Test">
                  {tests.map((t) => {
                    const comingSoon = t.is_available === false;
                    const locked = t.locked;
                    const blocked = comingSoon || locked;
                    const sel = String(testId) === String(t.id);
                    const sectionName = String(t.section?.name || '');
                    const isSpeaking = sectionName.toLowerCase().includes('speak');
                    return (
                      <Col key={t.id} xs={12} sm={6}>
                        <label
                          className={`br-select-thumb br-select-thumb--test ${sel ? 'br-select-thumb--selected' : ''} ${blocked ? 'br-select-thumb--disabled' : ''}`}
                          htmlFor={`test-opt-${t.id}`}
                        >
                          <input
                            id={`test-opt-${t.id}`}
                            type="radio"
                            className="br-select-thumb-input"
                            name="test-pick"
                            checked={sel}
                            disabled={blocked}
                            onChange={() => {
                              if (!blocked) {
                                setTestId(String(t.id));
                              }
                            }}
                            autoComplete="off"
                          />
                          {sel && !blocked && (
                            <span className="br-select-thumb-check" aria-hidden>
                              <i className="bi bi-check-circle-fill" />
                            </span>
                          )}
                          <div className="d-flex align-items-start gap-3">
                            <span className="br-select-thumb-icon" aria-hidden>
                              <i className={`bi ${iconForTestSection(t.section?.name)}`} />
                            </span>
                            <div className="flex-grow-1 min-w-0 pe-3">
                              <div className="fw-semibold text-body small mb-1">{t.title}</div>
                              <div className="text-muted small mb-2">{t.section?.name ?? 'Section'}</div>
                              <div className="d-flex flex-wrap gap-1">
                                {comingSoon && (
                                  <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25">
                                    Coming soon
                                  </span>
                                )}
                                {locked && !comingSoon && t.requires_subscription && (
                                  <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25">
                                    Pro
                                  </span>
                                )}
                                {locked && !comingSoon && t.lock_reason === 'guest_sign_in_required' && (
                                  <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25">
                                    Sign in
                                  </span>
                                )}
                                {locked && !comingSoon && t.lock_reason === 'speaking_ai_suspended' && (
                                  <span className="badge bg-warning bg-opacity-15 text-warning-emphasis border border-warning border-opacity-25">
                                    Speaking paused
                                  </span>
                                )}
                                {speakingQuota && isSpeaking && (
                                  <span
                                    className={`badge font-monospace ${speakingQuota.used >= speakingQuota.limit ? 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' : 'bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25'}`}
                                    title="Speaking exams started / free limit"
                                  >
                                    {speakingQuota.fraction}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      </Col>
                    );
                  })}
                </Row>
              )}
              <p className="small text-muted mt-3 mb-0 d-flex align-items-start gap-2">
                <i className="bi bi-info-circle mt-1 flex-shrink-0" aria-hidden />
                <span>
                  Lists reflect your mode. <strong>Sign in</strong> appears when a guest needs an account for that skill;{' '}
                  <strong>Pro</strong> appears when you have used all free Speaking attempts.{' '}
                  <strong>Speaking paused</strong> means Speaking was disabled on your account after inappropriate language was
                  detected—see Profile. <strong>Coming soon</strong> means the test is not available to start yet.
                </span>
              </p>
            </Form.Group>

            <Button
              disabled={cannotStart || starting}
              onClick={start}
              className="d-inline-flex align-items-center gap-2"
            >
              {starting ? (
                <>
                  <Spinner animation="border" size="sm" />
                  Starting…
                </>
              ) : (
                <>
                  <i className="bi bi-play-fill" aria-hidden />
                  Begin exam
                </>
              )}
            </Button>
            {!user && (
              <p className="small text-muted mt-3 mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-person-lock" aria-hidden />
                <span>
                  <Link to="/login">Log in</Link> for Listening and Speaking, saved history, and Pro purchase options.
                </span>
              </p>
            )}
          </div>

          <AdSlot location="between_sections" />
        </Col>
        <Col lg={4}>
          <AdSlot location="sidebar" ad={sidebarAd} />
        </Col>
      </Row>
    </Container>
  );
}
