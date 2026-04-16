import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Container,
  Form,
  Modal,
  ProgressBar,
  Row,
  Spinner,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createStudyPlan,
  deleteStudyPlan,
  fetchStudyPlan,
  regenerateStudyPlan,
  updateStudyPlan,
} from '../utils/studyPlanApi.js';
import { parseStudyPlanText } from '../utils/parseStudyPlanText.js';

const EXAM_TYPES = [
  { value: 'ielts_general', label: 'IELTS General' },
  { value: 'celpip_general', label: 'CELPIP General' },
];

const STUDY_TIMES = [
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '3h_plus', label: '3+ hours' },
];

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'not_sure', label: 'Not sure' },
];

const WEAK = [
  { value: 'speaking', label: 'Speaking' },
  { value: 'writing', label: 'Writing' },
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
];

const SCHEDULE_MODES = [
  { value: 'everyday', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'weekends', label: 'Weekends (Sat–Sun)' },
  { value: 'custom', label: 'Custom days' },
];

/** Carbon-style ISO weekday: 1 = Monday … 7 = Sunday */
const ISO_WEEKDAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

function tomorrowISODate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function maxExamISODate() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

function daysBetweenTodayAnd(isoDate) {
  const end = new Date(`${isoDate}T12:00:00`);
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function pacingLabel(key) {
  switch (key) {
    case 'emergency':
      return 'Emergency plan';
    case 'intensive':
      return 'Intensive plan';
    case 'balanced':
      return 'Balanced plan';
    case 'steady':
      return 'Steady plan';
    default:
      return null;
  }
}

export default function StudyPlan() {
  const { user, isSubscribed } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showEditDate, setShowEditDate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [actionErr, setActionErr] = useState('');

  const [examType, setExamType] = useState('ielts_general');
  const [examDate, setExamDate] = useState(tomorrowISODate());
  const [studyTime, setStudyTime] = useState('1h');
  const [currentLevel, setCurrentLevel] = useState('');
  const [weakAreas, setWeakAreas] = useState([]);
  const [scheduleMode, setScheduleMode] = useState('everyday');
  /** @type {number[]} */
  const [scheduleCustomDays, setScheduleCustomDays] = useState([1, 2, 3, 4, 5]);

  const [editExamDate, setEditExamDate] = useState('');

  const load = useCallback(async () => {
    if (!isSubscribed) {
      setLoading(false);
      setPlan(null);
      return;
    }
    setLoadErr('');
    try {
      const p = await fetchStudyPlan();
      setPlan(p);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Could not load your study plan.';
      setLoadErr(msg);
      if (e?.response?.status === 403) {
        setShowUpgrade(true);
      }
    } finally {
      setLoading(false);
    }
  }, [isSubscribed]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setLoading(true);
    load();
  }, [user, load]);

  useEffect(() => {
    if (!showCreate) {
      return;
    }
    if (plan) {
      setExamType(plan.exam_type || 'ielts_general');
      setExamDate(plan.exam_date || tomorrowISODate());
      setStudyTime(plan.study_time || '1h');
      setCurrentLevel(plan.current_level || '');
      setWeakAreas(Array.isArray(plan.weak_areas) ? [...plan.weak_areas] : []);
      setScheduleMode(plan.schedule_mode || 'everyday');
      setScheduleCustomDays(
        plan.schedule_mode === 'custom' && Array.isArray(plan.schedule_custom_days) && plan.schedule_custom_days.length
          ? [...plan.schedule_custom_days].sort((a, b) => a - b)
          : [1, 2, 3, 4, 5]
      );
    } else {
      setScheduleMode('everyday');
      setScheduleCustomDays([1, 2, 3, 4, 5]);
    }
  }, [showCreate, plan]);

  const parsed = useMemo(() => parseStudyPlanText(plan?.plan ?? ''), [plan]);

  const totalDays = plan?.days_remaining ?? 0;
  const totalSessions = plan?.study_session_count ?? plan?.days_remaining ?? 0;
  const completed = plan?.completed_days?.length ?? 0;
  const progress = totalSessions > 0 ? Math.min(100, Math.round((completed / totalSessions) * 100)) : 0;

  const validateFormDate = () => {
    if (!examDate) {
      return 'Please choose your exam date.';
    }
    const d = new Date(`${examDate}T12:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d <= today) {
      return 'Please choose a future exam date.';
    }
    const ahead = daysBetweenTodayAnd(examDate);
    if (ahead > 90) {
      return 'Exam date must be within 90 days.';
    }
    if (ahead < 1) {
      return 'Exam date must be at least one day from today.';
    }
    return '';
  };

  const toggleWeak = (value) => {
    setWeakAreas((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleScheduleIso = (iso) => {
    setScheduleCustomDays((prev) => {
      if (prev.includes(iso)) {
        return prev.filter((x) => x !== iso);
      }
      return [...prev, iso].sort((a, b) => a - b);
    });
  };

  const onGenerate = async () => {
    setFormErr('');
    const v = validateFormDate();
    if (v) {
      setFormErr(v);
      return;
    }
    if (scheduleMode === 'custom' && scheduleCustomDays.length === 0) {
      setFormErr('Select at least one day for a custom schedule.');
      return;
    }
    setGenerating(true);
    setActionErr('');
    try {
      const payload = {
        exam_type: examType,
        exam_date: examDate,
        study_time: studyTime,
        current_level: currentLevel || null,
        weak_areas: weakAreas,
        schedule_mode: scheduleMode,
        schedule_custom_days: scheduleMode === 'custom' ? [...scheduleCustomDays].sort((a, b) => a - b) : null,
      };
      const data = await createStudyPlan(payload);
      setPlan(data);
      setShowCreate(false);
    } catch (e) {
      const st = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (st === 403) {
        setShowUpgrade(true);
        setShowCreate(false);
      } else if (st === 503) {
        setFormErr('Unable to generate plan. Try again.');
      } else if (st === 429) {
        setFormErr(msg || 'Daily regenerate limit reached. Try again tomorrow.');
      } else {
        setFormErr(msg || 'Something went wrong. Try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const onRegenerate = async () => {
    if (!window.confirm('Regenerate your plan? Day completion progress will reset.')) {
      return;
    }
    setGenerating(true);
    setActionErr('');
    try {
      const data = await regenerateStudyPlan({});
      setPlan(data);
    } catch (e) {
      const st = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (st === 403) {
        setShowUpgrade(true);
      } else if (st === 503) {
        setActionErr('Unable to generate plan. Try again.');
      } else if (st === 429) {
        setActionErr(msg || 'You can regenerate up to 5 times per day.');
      } else {
        setActionErr(msg || 'Could not regenerate.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete your study plan?')) {
      return;
    }
    setActionErr('');
    try {
      await deleteStudyPlan();
      setPlan(null);
    } catch (e) {
      setActionErr(e?.response?.data?.message || 'Could not delete plan.');
    }
  };

  const openEditDate = () => {
    setEditExamDate(plan?.exam_date ?? tomorrowISODate());
    setShowEditDate(true);
    setFormErr('');
  };

  const onSaveExamDate = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(`${editExamDate}T12:00:00`);
    if (!editExamDate) {
      setFormErr('Please choose your exam date.');
      return;
    }
    if (d <= today) {
      setFormErr('Please choose a future exam date.');
      return;
    }
    const ahead = daysBetweenTodayAnd(editExamDate);
    if (ahead > 90 || ahead < 1) {
      setFormErr('Exam date must be between 1 and 90 days from today.');
      return;
    }
    setFormErr('');
    try {
      const data = await updateStudyPlan({ exam_date: editExamDate });
      setPlan(data);
      setShowEditDate(false);
    } catch (e) {
      setFormErr(e?.response?.data?.message || 'Could not update date.');
    }
  };

  const onToggleDay = async (dayNum) => {
    if (!plan) return;
    const set = new Set(plan.completed_days || []);
    if (set.has(dayNum)) {
      set.delete(dayNum);
    } else {
      set.add(dayNum);
    }
    const next = [...set].sort((a, b) => a - b);
    try {
      const data = await updateStudyPlan({ completed_days: next });
      setPlan(data);
    } catch (e) {
      setActionErr(e?.response?.data?.message || 'Could not update progress.');
    }
  };

  if (!user) {
    return (
      <Container className="py-5">
        <p className="mb-0">
          Please <Link to="/login">log in</Link> to use the Smart Exam Planner.
        </p>
      </Container>
    );
  }

  if (!user.email_verified) {
    return (
      <Container className="py-5">
        <p className="mb-0">
          Verify your email to access Pro tools. <Link to="/verify-email">Continue</Link>
        </p>
      </Container>
    );
  }

  if (!isSubscribed) {
    return (
      <Container className="py-4">
        <div className="br-card p-4 mx-auto" style={{ maxWidth: 520 }}>
          <h1 className="h4 fw-bold d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-calendar-check text-br-rose" aria-hidden />
            Smart Exam Planner
          </h1>
          <p className="text-muted mb-3">This feature is available for Pro users only.</p>
          <Button as={Link} to="/subscription" variant="primary" className="d-inline-flex align-items-center gap-2">
            <i className="bi bi-star-fill" aria-hidden />
            Upgrade to Pro
          </Button>
        </div>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" className="text-br-rose" />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-calendar-check text-br-rose" aria-hidden />
            Smart Exam Planner
          </h1>
          <p className="text-muted small mb-0">AI day-by-day roadmap for IELTS General or CELPIP General.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {plan && (
            <>
              <Button variant="outline-primary" size="sm" onClick={openEditDate} className="d-inline-flex align-items-center gap-1">
                <i className="bi bi-pencil" aria-hidden />
                Edit exam date
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={onRegenerate} className="d-inline-flex align-items-center gap-1">
                <i className="bi bi-arrow-repeat" aria-hidden />
                Regenerate
              </Button>
              <Button variant="outline-danger" size="sm" onClick={onDelete} className="d-inline-flex align-items-center gap-1">
                <i className="bi bi-trash" aria-hidden />
                Delete
              </Button>
            </>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} className="d-inline-flex align-items-center gap-1">
            <i className="bi bi-magic" aria-hidden />
            {plan ? 'New plan' : 'Create your study plan'}
          </Button>
        </div>
      </div>

      {loadErr && (
        <Alert variant="danger" className="d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-octagon-fill mt-1" aria-hidden />
          <span>{loadErr}</span>
        </Alert>
      )}
      {actionErr && (
        <Alert variant="warning" className="d-flex align-items-start gap-2" dismissible onClose={() => setActionErr('')}>
          <i className="bi bi-exclamation-triangle mt-1" aria-hidden />
          <span>{actionErr}</span>
        </Alert>
      )}

      {!plan && !loadErr && (
        <div className="br-card p-4 text-center">
          <p className="mb-3">You do not have a study plan yet. Create one with your exam date and preferences.</p>
          <Button variant="primary" onClick={() => setShowCreate(true)} className="d-inline-flex align-items-center gap-2">
            <i className="bi bi-magic" aria-hidden />
            Create your study plan
          </Button>
        </div>
      )}

      {plan && (
        <>
          <div className="br-card p-4 mb-4">
            <h2 className="h4 fw-bold mb-1">Your Study Plan</h2>
            <p className="text-muted mb-2">
              {totalDays} calendar day{totalDays === 1 ? '' : 's'} until your exam
              {totalSessions ? ` · ${totalSessions} study session${totalSessions === 1 ? '' : 's'}` : ''}
              {pacingLabel(plan.plan_pacing) ? ` · ${pacingLabel(plan.plan_pacing)}` : ''}
            </p>
            <p className="small text-muted mb-2">
              {plan.schedule_summary ? (
                <>
                  <span className="fw-semibold text-body">Schedule:</span> {plan.schedule_summary}{' '}
                </>
              ) : null}
              &quot;Day 1&quot;, &quot;Day 2&quot;, … each mean one study session on that rhythm (not always a calendar day).
            </p>
            <div className="small text-muted mb-2">
              Regenerations left today: <span className="fw-semibold text-body">{plan.regenerations_remaining ?? 0}</span>
            </div>
            <div className="d-flex align-items-center gap-3 mb-1">
              <span className="small text-muted">Progress</span>
              <span className="small fw-semibold">
                {completed} / {totalSessions} sessions
              </span>
            </div>
            <ProgressBar
              now={progress}
              variant="success"
              className="br-study-plan-progress"
              style={{ height: 10, borderRadius: 8 }}
              aria-label="Study plan progress"
            />
          </div>

          {plan.plan_summary ? (
            <div className="br-card p-4 mb-4">
              <h3 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-journal-text text-br-rose" aria-hidden />
                Plan summary
              </h3>
              <div className="small text-body br-study-plan-summary">{plan.plan_summary}</div>
            </div>
          ) : null}

          <Row className="g-3 mb-4">
            {parsed.days.length > 0 ? (
              parsed.days.map((block) => {
                const done = (plan.completed_days || []).includes(block.day);
                return (
                  <Col md={6} xl={4} key={block.day}>
                    <div className={`br-card p-3 h-100 ${done ? 'opacity-75 border-success' : ''}`}>
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <h3 className="h6 fw-bold mb-0">Day {block.day}</h3>
                        <Form.Check
                          type="checkbox"
                          id={`day-done-${block.day}`}
                          checked={done}
                          onChange={() => onToggleDay(block.day)}
                          aria-label={`Mark session ${block.day} complete`}
                        />
                      </div>
                      <ul className="small mb-2 ps-3">
                        {block.tasks.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                      {block.tip ? (
                        <div className="br-study-plan-tip small rounded-3 px-3 py-2">
                          <span className="fw-semibold text-br-rose">Tip:</span> {block.tip}
                        </div>
                      ) : null}
                    </div>
                  </Col>
                );
              })
            ) : (
              <Col xs={12}>
                <div className="br-card p-3">
                  <p className="small text-muted mb-2">We could not split this plan into day cards. Here is the full text:</p>
                  <pre className="small mb-0 br-study-plan-raw">{plan.plan}</pre>
                </div>
              </Col>
            )}
          </Row>

          {parsed.finalSection && (
            <div className="br-card p-4 mb-4">
              <h3 className="h5 fw-bold mb-3">Final section</h3>
              <pre className="small mb-0 br-study-plan-raw">{parsed.finalSection}</pre>
            </div>
          )}
        </>
      )}

      <Modal show={showCreate} onHide={() => !generating && setShowCreate(false)} size="lg" centered>
        <Modal.Header closeButton={!generating}>
          <Modal.Title>Create Your Study Plan</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {generating ? (
            <div className="text-center py-5">
              <Spinner animation="border" className="text-br-rose mb-3" role="status" />
              <p className="fw-semibold mb-1">Bandie is creating your study plan...</p>
              <p className="small text-muted mb-0">Creating your personalized study plan...</p>
            </div>
          ) : (
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                onGenerate();
              }}
            >
              {formErr && <Alert variant="danger">{formErr}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Exam type</Form.Label>
                <Form.Select value={examType} onChange={(e) => setExamType(e.target.value)}>
                  {EXAM_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Exam date</Form.Label>
                <Form.Control
                  type="date"
                  value={examDate}
                  min={tomorrowISODate()}
                  max={maxExamISODate()}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Study rhythm</Form.Label>
                <Form.Select value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value)}>
                  {SCHEDULE_MODES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Plans count study sessions from tomorrow through your exam date. Weekends/weekdays modes skip other days.
                </Form.Text>
              </Form.Group>
              {scheduleMode === 'custom' && (
                <Form.Group className="mb-3">
                  <Form.Label>Custom days</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {ISO_WEEKDAYS.map(({ iso, label }) => (
                      <Button
                        key={iso}
                        type="button"
                        size="sm"
                        variant={scheduleCustomDays.includes(iso) ? 'primary' : 'outline-secondary'}
                        onClick={() => toggleScheduleIso(iso)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </Form.Group>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Study time per session</Form.Label>
                <Form.Select value={studyTime} onChange={(e) => setStudyTime(e.target.value)}>
                  {STUDY_TIMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Current level (optional)</Form.Label>
                <Form.Select value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)}>
                  <option value="">—</option>
                  {LEVELS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Weak areas</Form.Label>
                <div className="d-flex flex-wrap gap-3">
                  {WEAK.map((w) => (
                    <Form.Check
                      key={w.value}
                      type="checkbox"
                      id={`weak-${w.value}`}
                      label={w.label}
                      checked={weakAreas.includes(w.value)}
                      onChange={() => toggleWeak(w.value)}
                    />
                  ))}
                </div>
              </Form.Group>
              <Button type="submit" variant="primary" className="d-inline-flex align-items-center gap-2">
                <i className="bi bi-magic" aria-hidden />
                Generate My Plan
              </Button>
            </Form>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={showEditDate} onHide={() => setShowEditDate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit exam date</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formErr && <Alert variant="danger">{formErr}</Alert>}
          <Form.Group>
            <Form.Label>Exam date</Form.Label>
            <Form.Control
              type="date"
              value={editExamDate}
              min={tomorrowISODate()}
              max={maxExamISODate()}
              onChange={(e) => setEditExamDate(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditDate(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSaveExamDate}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={generating && !showCreate} onHide={() => {}} centered backdrop="static" keyboard={false}>
        <Modal.Body className="text-center py-5">
          <Spinner animation="border" className="text-br-rose mb-3" role="status" />
          <p className="fw-semibold mb-1">Creating your personalized study plan...</p>
          <p className="small text-muted mb-0">Bandie is on it — this can take up to a minute.</p>
        </Modal.Body>
      </Modal>

      <Modal show={showUpgrade} onHide={() => setShowUpgrade(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Pro feature</Modal.Title>
        </Modal.Header>
        <Modal.Body>This feature is available for Pro users only.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUpgrade(false)}>
            Close
          </Button>
          <Button as={Link} to="/subscription" variant="primary" onClick={() => setShowUpgrade(false)}>
            View Pro
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
