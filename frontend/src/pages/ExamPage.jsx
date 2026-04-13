import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Col, Container, Modal, Row, Spinner } from 'react-bootstrap';
import { Link, useBeforeUnload, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { resolveMediaUrl } from '../utils/mediaUrl.js';
import { pickAdFromResponse } from '../utils/pickAdFromResponse.js';

function clampIndex(i, len) {
  if (len < 1) {
    return 0;
  }
  return Math.min(Math.max(0, i), len - 1);
}

/** First question index to show when resuming forward-only (indices below min are locked on the server). */
function forwardOnlyInitialIndex(attempt, questionCount) {
  if (!attempt?.forward_only || questionCount < 1) {
    return 0;
  }
  return clampIndex(Number(attempt.forward_only_min_allowed_index ?? 0), questionCount);
}

import ExamLayout from '../components/ExamLayout.jsx';
import ListeningTtsPlayer from '../components/ListeningTtsPlayer.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatAudioScriptForDisplay } from '../utils/ttsDialogue.js';
import { isIeltsAiSpeakingQuestion, isSpeakingPictureTaskQuestion } from '../utils/ieltsAiSpeaking.js';

function useDebouncedCallback(fn, delay) {
  const t = useRef();
  return useCallback(
    (...args) => {
      clearTimeout(t.current);
      t.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

const emptyExamRailAds = {
  exam_rail_left: null,
  exam_rail_right: null,
};

export default function ExamPage() {
  const { isAdmin, isSubscribed, loading: authLoading } = useAuth();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [bundle] = useState(location.state?.bundle || null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [test, setTest] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [limits, setLimits] = useState(() => ({
    essay_max_chars: 4000,
    speaking_max_chars: 4000,
    speaking_conversation_max_chars: 16000,
    speaking_max_seconds: 180,
  }));
  const [fs, setFs] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paused, setPaused] = useState(false);
  /** Per question: user reached end of listening audio / TTS (or bypass). */
  const [listenFinished, setListenFinished] = useState({});
  /** Listening section: true while HTML5 audio or browser TTS is actively playing (locks Prev/Next/grid). */
  const [listeningPlaybackActive, setListeningPlaybackActive] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [examRailAds, setExamRailAds] = useState(emptyExamRailAds);
  const startedRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const allowNavigateRef = useRef(false);

  const shouldBlockNavigation = useCallback(
    ({ currentLocation, nextLocation }) => {
      if (allowNavigateRef.current) {
        return false;
      }
      if (loading || !attempt) {
        return false;
      }
      if (currentLocation.pathname === nextLocation.pathname) {
        return false;
      }
      if (nextLocation.pathname.startsWith('/results/')) {
        return false;
      }
      return true;
    },
    [loading, attempt]
  );

  const blocker = useBlocker(shouldBlockNavigation);

  useBeforeUnload(
    useCallback(
      (e) => {
        if (loading || !attempt || allowNavigateRef.current) {
          return;
        }
        e.preventDefault();
        e.returnValue = '';
      },
      [loading, attempt]
    )
  );

  const saveRemote = useDebouncedCallback(async (payload) => {
    await api.post('/save-answer', payload);
  }, 500);

  useEffect(() => {
    if (fs) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [fs]);

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    allowNavigateRef.current = true;
    const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
    setSubmitting(true);
    try {
      await api.post('/submit-attempt', {
        attempt_id: Number(attemptId),
        time_spent_seconds: elapsed,
      });
      navigate(`/results/${attemptId}`);
    } catch {
      submittedRef.current = false;
      allowNavigateRef.current = false;
    } finally {
      setSubmitting(false);
      setShowSubmit(false);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (bundle) {
        const qs = Array.isArray(bundle.questions) ? bundle.questions : [];
        setLoadError('');
        setLimits(
          bundle.limits || {
            essay_max_chars: 4000,
            speaking_max_chars: 4000,
            speaking_conversation_max_chars: 16000,
            speaking_max_seconds: 180,
          }
        );
        setQuestions(qs);
        setAttempt(bundle.attempt ?? null);
        setTest(bundle.test ?? null);
        setCurrent(forwardOnlyInitialIndex(bundle.attempt, qs.length));
        const init = {};
        qs.forEach((q) => {
          init[q.id] = '';
        });
        setAnswers(init);
        if (qs.length === 0) {
          setLoadError('This attempt has no questions to show. Start a new test from Practice — your question list may have been refreshed.');
        }
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get(`/attempts/${attemptId}/resume`);
        if (cancelled) {
          return;
        }
        setLoadError('');
        const qs = Array.isArray(data.questions) ? data.questions : [];
        setLimits(
          data.limits || {
            essay_max_chars: 4000,
            speaking_max_chars: 4000,
            speaking_conversation_max_chars: 16000,
            speaking_max_seconds: 180,
          }
        );
        setAttempt(data.attempt);
        setTest(data.test);
        setQuestions(qs);
        setCurrent(forwardOnlyInitialIndex(data.attempt, qs.length));
        const init = {};
        qs.forEach((q) => {
          const row = data.saved_answers?.[q.id];
          init[q.id] = row?.answer ?? '';
        });
        setAnswers(init);
        if (qs.length === 0) {
          setLoadError(
            'No questions found for this attempt. It may be from an older version of the test — start a new attempt from Practice.'
          );
        }
      } catch {
        navigate('/exam/start');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, bundle, navigate]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (isSubscribed && !isAdmin) {
      setExamRailAds(emptyExamRailAds);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [leftRes, rightRes] = await Promise.all([
          api.get('/ads', { params: { location: 'exam_rail_left' } }),
          api.get('/ads', { params: { location: 'exam_rail_right' } }),
        ]);
        if (cancelled) {
          return;
        }
        setExamRailAds({
          exam_rail_left: pickAdFromResponse(leftRes),
          exam_rail_right: pickAdFromResponse(rightRes),
        });
      } catch {
        if (!cancelled) {
          setExamRailAds(emptyExamRailAds);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSubscribed, isAdmin, authLoading]);

  useEffect(() => {
    if (!questions.length || !attempt?.forward_only) {
      return;
    }
    const m = Number(attempt.forward_only_min_allowed_index ?? 0);
    setCurrent((prev) => clampIndex(Math.max(prev, m), questions.length));
  }, [attempt?.id, attempt?.forward_only, attempt?.forward_only_min_allowed_index, questions.length]);

  const q = questions[current];
  const total = questions.length;
  const isListeningSection = useMemo(
    () => String(test?.section?.name || '').toLowerCase().includes('listen'),
    [test?.section?.name]
  );

  useEffect(() => {
    setListeningPlaybackActive(false);
  }, [q?.id]);
  const strictMode = !!attempt?.strict_mode;
  const forwardOnly = !!attempt?.forward_only;
  const minAllowed = Number(attempt?.forward_only_min_allowed_index ?? 0);
  const prevDisabled = forwardOnly && current <= minAllowed;

  const goNext = useCallback(async () => {
    if (!attempt || total < 1) {
      return;
    }
    if (!attempt.forward_only) {
      setCurrent((c) => Math.min(total - 1, c + 1));
      return;
    }
    if (current >= total - 1) {
      return;
    }
    const serverMin = Number(attempt.forward_only_min_allowed_index ?? 0);
    /** Stay in sync if UI index lags behind the server (e.g. first paint before effects). */
    const newMin = Math.max(current + 1, serverMin);
    try {
      await api.post(`/attempts/${attemptId}/forward-only`, { min_allowed_index: newMin });
      setAttempt((a) => (a ? { ...a, forward_only_min_allowed_index: newMin } : a));
      setCurrent(clampIndex(newMin, total));
    } catch (e) {
      if (e.response?.status === 422 && attempt.forward_only) {
        try {
          const { data: sync } = await api.get(`/attempts/${attemptId}/resume`);
          setAttempt(sync.attempt);
          setQuestions(sync.questions);
          const m = Number(sync.attempt.forward_only_min_allowed_index ?? 0);
          setCurrent((prev) => clampIndex(Math.max(prev, m), sync.questions.length));
        } catch {
          /* ignore */
        }
      }
    }
  }, [attempt, attemptId, current, total]);

  const goPrev = useCallback(() => {
    const m = Number(attempt?.forward_only_min_allowed_index ?? 0);
    const fo = !!attempt?.forward_only;
    if (fo && current <= m) {
      return;
    }
    setCurrent((c) => Math.max(fo ? m : 0, c - 1));
  }, [attempt?.forward_only, attempt?.forward_only_min_allowed_index, current]);

  const selectQuestion = useCallback(
    (i) => {
      const m = Number(attempt?.forward_only_min_allowed_index ?? 0);
      if (attempt?.forward_only && i < m) {
        return;
      }
      setCurrent(i);
    },
    [attempt?.forward_only, attempt?.forward_only_min_allowed_index]
  );

  const instructionText = useMemo(() => {
    const bits = [];
    if (strictMode) {
      bits.push('Strict mode: the timer cannot be paused.');
    } else {
      bits.push('You may pause the timer for breaks.');
    }
    if (forwardOnly) {
      bits.push('Forward-only: after Next, earlier questions stay locked.');
    }
    bits.push('Autosave is on. Submit ends the section.');
    return bits.join(' ');
  }, [strictMode, forwardOnly]);

  function resolveAudioUrl(url) {
    return resolveMediaUrl(url);
  }

  function questionAudioScript(question) {
    const raw = question?.audio_script ?? question?.audioScript;
    return typeof raw === 'string' ? raw.trim() : '';
  }

  function questionHasAudioFile(question) {
    const u = question?.audio_url ?? question?.audioUrl;
    return typeof u === 'string' && u.trim().length > 0;
  }

  const answeredNumbers = useMemo(() => {
    const s = new Set();
    questions.forEach((qq, i) => {
      const v = answers[qq.id];
      if (v != null && String(v).length > 0) {
        s.add(i + 1);
      }
    });
    return s;
  }, [questions, answers]);

  /** Writing/speaking items are scored on the server (often with AI); submit can take noticeably longer. */
  const hasEssayOrSpeaking = useMemo(
    () => questions.some((qq) => qq.type === 'essay' || qq.type === 'speaking_prompt'),
    [questions]
  );

  const progress = total ? (answeredNumbers.size / total) * 100 : 0;

  function updateAnswer(val) {
    if (!q) {
      return;
    }
    setAnswers((a) => ({ ...a, [q.id]: val }));
    saveRemote({
      attempt_id: Number(attemptId),
      question_id: q.id,
      answer: val,
      is_flagged: false,
    });
  }

  const markListenFinished = useCallback(() => {
    setListenFinished((prev) => {
      const id = questions[current]?.id;
      if (!id) {
        return prev;
      }
      return { ...prev, [id]: true };
    });
  }, [questions, current]);

  /** Browser TTS: only `audio_script` is spoken; `passage_text` is the on-screen hint, not read aloud. */
  const ttsListening = !!q && !questionHasAudioFile(q) && !!questionAudioScript(q);
  /** AI mock interview is turn-by-turn in-app; never hide it behind listen-first (mis-set audio would block the whole card). */
  const listeningGated =
    !!q && !isIeltsAiSpeakingQuestion(q) && (questionHasAudioFile(q) || ttsListening);
  const listenDone = q ? !!listenFinished[q.id] : false;
  const showQuestionAfterListen = !listeningGated || listenDone;
  const listeningNavLocked = isListeningSection && listeningPlaybackActive;

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  if (!attempt) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  if (!q) {
    return (
      <Container className="py-5 text-center" style={{ maxWidth: 520 }}>
        <p className="text-muted mb-3">{loadError || 'There are no questions in this attempt.'}</p>
        <Button as={Link} to="/exam/start" variant="primary" className="d-inline-flex align-items-center gap-2">
          <i className="bi bi-arrow-left" aria-hidden />
          Back to practice
        </Button>
      </Container>
    );
  }

  return (
    <>
      <ExamLayout
        title={test?.title || 'Exam'}
        sectionName={test?.section?.name || 'Section'}
        timerSeconds={attempt.time_limit_seconds || 3600}
        startedAt={attempt.started_at}
        onTimerExpire={submitAttempt}
        totalQuestions={total}
        currentIndex={current}
        onSelectQuestion={selectQuestion}
        answeredNumbers={answeredNumbers}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={() => setShowSubmit(true)}
        progress={progress}
        instructions={instructionText}
        fullscreen={fs}
        strictMode={strictMode}
        forwardOnly={forwardOnly}
        minSelectableIndex={minAllowed}
        prevDisabled={prevDisabled}
        navigationLocked={listeningNavLocked}
        paused={paused}
        onTogglePause={strictMode ? undefined : () => setPaused((p) => !p)}
        leftRailExtra={
          isSubscribed && !isAdmin ? null : <AdSlot location="exam_rail_left" ad={examRailAds.exam_rail_left} />
        }
        rightRailExtra={
          isSubscribed && !isAdmin ? null : <AdSlot location="exam_rail_right" ad={examRailAds.exam_rail_right} />
        }
        questionNavQuestions={questions}
      >
        <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge rounded-pill bg-primary d-inline-flex align-items-center gap-1">
              <i className="bi bi-hash" aria-hidden />
              Q{current + 1}
            </span>
            <span className="text-muted small">
              of {total}
            </span>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <Button
              size="sm"
              variant="outline-secondary"
              type="button"
              className="d-inline-flex align-items-center gap-1"
              onClick={() => setFs((v) => !v)}
            >
              <i className={fs ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen'} aria-hidden />
              {fs ? 'Exit fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        </div>
        {questionHasAudioFile(q) && (
          <div className="mb-4">
            <div className="small text-muted mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-headphones" aria-hidden />
              <span>Listen before answering.</span>
            </div>
            <audio
              key={q.id}
              className="w-100 br-audio-player"
              controls
              controlsList="nodownload"
              src={resolveAudioUrl(q.audio_url ?? q.audioUrl) ?? undefined}
              onPlay={() => {
                if (isListeningSection) {
                  setListeningPlaybackActive(true);
                }
              }}
              onPause={() => {
                if (isListeningSection) {
                  setListeningPlaybackActive(false);
                }
              }}
              onEnded={() => {
                if (isListeningSection) {
                  setListeningPlaybackActive(false);
                }
                markListenFinished();
              }}
            >
              <a href={resolveAudioUrl(q.audio_url ?? q.audioUrl) ?? '#'}>Audio</a>
            </audio>
            <p className="small text-muted mt-2 mb-0 border-start border-3 ps-3 border-secondary border-opacity-25">
              <strong className="text-muted">Note:</strong> This is practice audio only. It is not the official exam
              recording, so voices, accents, and studio quality may differ from what you hear on test day.
            </p>
          </div>
        )}
        {ttsListening && (
          <ListeningTtsPlayer
            script={questionAudioScript(q)}
            instruction={q.passage_text || undefined}
            utteranceKey={`${attemptId}-${q.id}`}
            onListenComplete={markListenFinished}
            onPlaybackChange={isListeningSection ? setListeningPlaybackActive : undefined}
          />
        )}
        {isAdmin && questionAudioScript(q) && (
          <div
            className="mb-4 p-3 rounded border border-warning border-opacity-50 bg-warning bg-opacity-10 small"
            aria-label="Admin-only listening script preview"
          >
            <div className="fw-semibold text-body-secondary mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-shield-lock text-warning" aria-hidden />
              <span>Admin: audio script (reference — not shown to candidates)</span>
            </div>
            <div className="br-admin-audio-script text-dark">
              {formatAudioScriptForDisplay(questionAudioScript(q))}
            </div>
          </div>
        )}
        {q.passage_text && !ttsListening && !isSpeakingPictureTaskQuestion(q) && (
          <div className="br-passage mb-4">{q.passage_text}</div>
        )}
        {listeningGated && !listenDone && (
          <div className="alert alert-light border small text-muted mb-4 mb-md-3" role="status">
            <i className="bi bi-hourglass-split me-2" aria-hidden />
            {q.type === 'speaking_prompt' ? (
              <>
                The recording area stays hidden until you finish the examiner clip (play through to the end). Use Play again
                if you need another listen.
              </>
            ) : (
              <>
                The question and choices stay hidden until you finish the clip (play through to the end). Use Play again if
                you need another listen.
              </>
            )}
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0 d-block mt-2"
              onClick={markListenFinished}
            >
              Show question anyway (accessibility / audio issues)
            </button>
          </div>
        )}
        {showQuestionAfterListen && (
          <QuestionCard
            question={q}
            value={answers[q.id]}
            onChange={updateAnswer}
            essayMaxChars={limits.essay_max_chars ?? 4000}
            attemptId={Number(attemptId)}
            speakingMaxSeconds={limits.speaking_max_seconds ?? 180}
            speakingConversationMaxChars={limits.speaking_conversation_max_chars ?? 16000}
            showAdminKey={isAdmin}
          />
        )}
        <Row className="mt-4">
          <Col>
            <AdSlot location="between_sections" />
          </Col>
        </Row>
      </ExamLayout>

      <Modal
        show={blocker.state === 'blocked'}
        onHide={() => blocker.reset?.()}
        centered
        backdrop="static"
        keyboard
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="bi bi-box-arrow-up-right text-warning" aria-hidden />
            Leave this exam?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Your answers are saved automatically as you go. If you leave now, this attempt stays open — you can continue
            later from your <strong>Dashboard</strong> (resume) or by opening the same practice link again.
          </p>
          <p className="small text-muted mb-0">
            The timer may keep running while you are away unless you pause (when pausing is allowed).
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" className="d-inline-flex align-items-center gap-1" onClick={() => blocker.reset?.()}>
            <i className="bi bi-arrow-left" aria-hidden />
            Stay on exam
          </Button>
          <Button
            variant="outline-secondary"
            className="d-inline-flex align-items-center gap-1"
            onClick={() => {
              allowNavigateRef.current = true;
              blocker.proceed?.();
            }}
          >
            <i className="bi bi-box-arrow-right" aria-hidden />
            Leave
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showSubmit}
        onHide={() => !submitting && setShowSubmit(false)}
        centered
        backdrop={submitting ? 'static' : true}
        keyboard={!submitting}
        aria-busy={submitting}
      >
        <Modal.Header closeButton={!submitting}>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="bi bi-patch-question-fill text-br-rose" aria-hidden />
            {submitting ? 'Submitting…' : 'Submit exam?'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {submitting ? (
            <div className="text-center py-2">
              <Spinner animation="border" role="status" className="mb-3 text-br-rose" />
              <p className="fw-semibold text-body mb-2">Saving and scoring your attempt…</p>
              {hasEssayOrSpeaking ? (
                <p className="small text-muted mb-0">
                  This test includes <strong className="text-body">writing or speaking</strong>. Final scores and feedback
                  are prepared on the server and may take a little longer — please keep this tab open.
                </p>
              ) : (
                <p className="small text-muted mb-0">Please wait while we finalize your results.</p>
              )}
            </div>
          ) : (
            <p className="d-flex align-items-start gap-2 mb-0">
              <i className="bi bi-exclamation-circle text-warning mt-1" aria-hidden />
              <span>
                You answered {answeredNumbers.size} of {total} items. Submitting will lock your attempt and show
                results.
                {hasEssayOrSpeaking && (
                  <>
                    {' '}
                    <span className="d-block mt-2 text-muted small">
                      <i className="bi bi-cpu me-1" aria-hidden />
                      Writing or speaking sections are scored after you submit — expect a short wait while your answers are
                      processed.
                    </span>
                  </>
                )}
              </span>
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={submitting}
            className="d-inline-flex align-items-center gap-1"
            onClick={() => setShowSubmit(false)}
          >
            <i className="bi bi-arrow-left" aria-hidden />
            Continue
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            className="d-inline-flex align-items-center gap-2"
            onClick={submitAttempt}
          >
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" role="status" aria-hidden />
                Submitting…
              </>
            ) : (
              <>
                <i className="bi bi-send-check-fill" aria-hidden />
                Submit now
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
