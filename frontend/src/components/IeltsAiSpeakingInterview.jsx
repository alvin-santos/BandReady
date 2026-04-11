import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Form, Modal, Spinner } from 'react-bootstrap';
import AdminQuestionKeyPanel from './AdminQuestionKeyPanel.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function isAbortError(e) {
  return e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError';
}

/**
 * Single in-flight POST with deadline; aborts any previous request held in `abortHolderRef`.
 * @param {import('axios').AxiosInstance} client
 */
async function postWithDeadline(client, url, data, timeoutMs, abortHolderRef) {
  abortHolderRef.current?.abort();
  const ac = new AbortController();
  abortHolderRef.current = ac;
  const tid = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await client.post(url, data, { signal: ac.signal });
  } finally {
    clearTimeout(tid);
    if (abortHolderRef.current === ac) {
      abortHolderRef.current = null;
    }
  }
}
import { parseIeltsAiTranscript, serializeIeltsAiTranscript } from '../utils/ieltsAiSpeaking.js';
import {
  computeInterviewSessionStats,
  getInterviewProgressLabel,
  IELTS_AI_PREP_MARKER as PREP_MARKER,
} from '../utils/ieltsAiInterviewSession.js';
import { friendlySpeakingServiceError } from '../utils/friendlySpeakingApiError.js';
import { sanitizeExaminerMessageForTts } from '../utils/ieltsExaminerTtsSanitize.js';
import { speakWithStableEnglishVoice } from '../utils/ttsSpeak.js';
import { getTtsDisabledVoiceKeysSet } from '../utils/ttsVoiceSettingsCache.js';

const WEAK_MODE_STORAGE_KEY = 'bandready_ielts_ai_weak_connection';

/** Abort long-hanging OpenAI / network calls for the interview step. */
const IELTS_AI_JSON_TIMEOUT_MS = 120_000;
const IELTS_AI_JSON_TIMEOUT_WEAK_MS = 90_000;
/** Upload + Whisper can exceed step timeout for long takes. */
const IELTS_AI_TRANSCRIBE_TIMEOUT_MS = 180_000;
const IELTS_AI_TRANSCRIBE_TIMEOUT_WEAK_MS = 120_000;
/** Failsafe if the browser never fires MediaRecorder `stop` at max duration (seconds past cap). */
const RECORDING_FAILSAFE_EXTRA_SEC = 15;

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return '';
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return '';
}

export default function IeltsAiSpeakingInterview({
  question,
  value,
  onChange,
  attemptId,
  questionId,
  speakingMaxSeconds = 180,
  speakingConversationMaxChars = 16000,
  showAdminKey = false,
}) {
  const { refresh: refreshAuth } = useAuth();
  const [exchanges, setExchanges] = useState(() => parseIeltsAiTranscript(value));
  const exchangesRef = useRef(exchanges);
  exchangesRef.current = exchanges;

  const [awaiting, setAwaiting] = useState(null);
  const [part, setPart] = useState(1);
  const [prepLeft, setPrepLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const [recording, setRecording] = useState(false);
  const [started, setStarted] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [needsResumeHeal, setNeedsResumeHeal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const voicesRef = useRef([]);
  const prepIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordingFailsafeRef = useRef(null);
  const prepFinishingRef = useRef(false);
  const runStepRef = useRef(async () => {});
  /** One TTS voice for the whole AI examiner interview (not re-randomized each line). */
  const examinerTtsVoiceRef = useRef(null);
  /** Retry handler after a friendly API error (bootstrap, step, or transcribe+step). */
  const retryFnRef = useRef(null);
  /** AbortController for the in-flight interview API request (step / start / transcribe). */
  const inFlightAbortRef = useRef(null);
  /** When true, the next MediaRecorder `onstop` discards audio (reset / safety) instead of uploading. */
  const discardNextRecordingRef = useRef(false);
  const recordingWallStartRef = useRef(0);

  const [weakConnection, setWeakConnection] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(WEAK_MODE_STORAGE_KEY) === '1';
  });
  const [sessionSpeakingMs, setSessionSpeakingMs] = useState(0);

  const setLocalError = useCallback((msg) => {
    setError(msg);
    setShowRetry(false);
    retryFnRef.current = null;
  }, []);

  const setApiError = useCallback((err, retryAction) => {
    const { message, canRetry } = friendlySpeakingServiceError(err);
    setError(message);
    const fn = canRetry && typeof retryAction === 'function' ? retryAction : null;
    setShowRetry(!!fn);
    retryFnRef.current = fn;
  }, []);

  useEffect(() => {
    examinerTtsVoiceRef.current = null;
  }, [questionId, attemptId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(WEAK_MODE_STORAGE_KEY, weakConnection ? '1' : '0');
  }, [weakConnection]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices() ?? [];
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    return () => {
      if (prepIntervalRef.current) {
        clearInterval(prepIntervalRef.current);
      }
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
      }
      if (recordingFailsafeRef.current) {
        clearTimeout(recordingFailsafeRef.current);
      }
      inFlightAbortRef.current?.abort();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const persist = useCallback(
    (next) => {
      const s = serializeIeltsAiTranscript(next);
      if ([...s].length > speakingConversationMaxChars) {
        setLocalError(`This interview log is too long for the server limit (${speakingConversationMaxChars} characters).`);
        return;
      }
      onChange(s);
    },
    [onChange, speakingConversationMaxChars, setLocalError]
  );

  const speakExaminer = useCallback(async (text) => {
    const t = sanitizeExaminerMessageForTts(text);
    if (!t || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    const disabled = await getTtsDisabledVoiceKeysSet();
    const plain = t.replace(/\n+/g, ' ');
    const ttsOpts = weakConnection ? { chunkMaxChars: 140 } : undefined;
    await new Promise((resolve) => {
      speakWithStableEnglishVoice(plain, voicesRef.current, 'en-US', resolve, disabled, examinerTtsVoiceRef, ttsOpts);
    });
  }, [weakConnection]);

  const readExaminerMessageFromPayload = useCallback((payload) => {
    const raw = (payload.examiner_message || '').trim() || 'Could you say that again?';
    return sanitizeExaminerMessageForTts(raw) || 'Could you say that again?';
  }, []);

  /** Part / awaiting / done flags (safe to update before TTS; record stays disabled while `loading`). */
  const applyStepResponseUi = useCallback((payload) => {
    setAwaiting(payload.awaiting ?? 'candidate_short');
    setPart(typeof payload.part === 'number' ? payload.part : 1);
    setInterviewComplete(!!payload.interview_complete);
  }, []);

  /** Append examiner line to transcript + save — call only after examiner TTS so learners are not spoiled by on-screen text. */
  const commitExaminerExchange = useCallback(
    (baseExchanges, msg) => {
      const next = [...baseExchanges, { role: 'examiner', text: msg }];
      setExchanges(next);
      exchangesRef.current = next;
      persist(next);
    },
    [persist]
  );

  const startPrepTimer = useCallback(
    (seconds) => {
      if (prepIntervalRef.current) {
        clearInterval(prepIntervalRef.current);
      }
      prepFinishingRef.current = false;
      const sec = Math.min(120, Math.max(15, seconds || 60));
      let left = sec;
      setPrepLeft(left);
      prepIntervalRef.current = setInterval(() => {
        left -= 1;
        if (left > 0) {
          setPrepLeft(left);
        }
        if (left <= 0 && prepIntervalRef.current) {
          clearInterval(prepIntervalRef.current);
          prepIntervalRef.current = null;
          setPrepLeft(null);
          if (!prepFinishingRef.current) {
            prepFinishingRef.current = true;
            const withCandidate = [...exchangesRef.current, { role: 'candidate', text: PREP_MARKER }];
            void runStepRef.current(withCandidate).finally(() => {
              prepFinishingRef.current = false;
            });
          }
        }
      }, 1000);
    },
    []
  );

  const runStep = useCallback(
    async (withCandidate) => {
      setError('');
      setShowRetry(false);
      retryFnRef.current = null;
      setLoading(true);
      try {
        const jsonTimeout = weakConnection ? IELTS_AI_JSON_TIMEOUT_WEAK_MS : IELTS_AI_JSON_TIMEOUT_MS;
        const { data } = await postWithDeadline(
          api,
          '/speaking/ielts-ai/step',
          {
            attempt_id: Number(attemptId),
            question_id: Number(questionId),
            exchanges: withCandidate,
          },
          jsonTimeout,
          inFlightAbortRef
        );
        const msg = readExaminerMessageFromPayload(data);
        applyStepResponseUi(data);
        try {
          await speakExaminer(msg);
        } finally {
          commitExaminerExchange(withCandidate, msg);
        }
        if (!data.interview_complete && data.awaiting === 'silent_prep') {
          startPrepTimer(data.prep_seconds);
        }
      } catch (e) {
        if (isAbortError(e)) {
          return;
        }
        if (e?.response?.data?.code === 'speaking_ai_suspended') {
          void refreshAuth();
        }
        setApiError(e, () => {
          void runStep(withCandidate);
        });
      } finally {
        setLoading(false);
      }
    },
    [
      attemptId,
      questionId,
      readExaminerMessageFromPayload,
      applyStepResponseUi,
      speakExaminer,
      commitExaminerExchange,
      startPrepTimer,
      setApiError,
      weakConnection,
      refreshAuth,
    ]
  );

  runStepRef.current = runStep;

  useEffect(() => {
    if (!needsResumeHeal) {
      return;
    }
    setNeedsResumeHeal(false);
    void runStep(exchangesRef.current);
  }, [needsResumeHeal, runStep]);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const bootstrapOpen = useCallback(async () => {
    setLoading(true);
    setError('');
    setShowRetry(false);
    retryFnRef.current = null;
    try {
      const jsonTimeout = weakConnection ? IELTS_AI_JSON_TIMEOUT_WEAK_MS : IELTS_AI_JSON_TIMEOUT_MS;
      const { data } = await postWithDeadline(
        api,
        '/speaking/ielts-ai/start',
        {
          attempt_id: Number(attemptId),
          question_id: Number(questionId),
        },
        jsonTimeout,
        inFlightAbortRef
      );
      const msg = readExaminerMessageFromPayload(data);
      applyStepResponseUi(data);
      try {
        await speakExaminer(msg);
      } finally {
        commitExaminerExchange([], msg);
      }
      if (!data.interview_complete && data.awaiting === 'silent_prep') {
        startPrepTimer(data.prep_seconds);
      }
    } catch (e) {
      if (!isAbortError(e)) {
        if (e?.response?.data?.code === 'speaking_ai_suspended') {
          void refreshAuth();
        }
        setApiError(e, () => {
          void bootstrapOpen();
        });
      }
    } finally {
      setLoading(false);
    }
  }, [
    attemptId,
    questionId,
    readExaminerMessageFromPayload,
    applyStepResponseUi,
    speakExaminer,
    commitExaminerExchange,
    startPrepTimer,
    setApiError,
    refreshAuth,
    weakConnection,
  ]);

  const resetInterview = useCallback(async () => {
    setShowResetModal(false);
    setResetting(true);
    setSessionSpeakingMs(0);
    setLocalError('');
    setShowRetry(false);
    retryFnRef.current = null;

    inFlightAbortRef.current?.abort();
    inFlightAbortRef.current = null;

    discardNextRecordingRef.current = true;
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordingFailsafeRef.current) {
      clearTimeout(recordingFailsafeRef.current);
      recordingFailsafeRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    } else {
      discardNextRecordingRef.current = false;
      stopTracks();
    }

    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
    setPrepLeft(null);
    prepFinishingRef.current = false;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setRecording(false);
    setNeedsResumeHeal(false);
    examinerTtsVoiceRef.current = null;
    setInterviewComplete(false);
    setPart(1);
    setAwaiting(null);

    persist([]);
    setExchanges([]);
    exchangesRef.current = [];

    try {
      await bootstrapOpen();
    } catch (e) {
      if (!isAbortError(e)) {
        const { message } = friendlySpeakingServiceError(e);
        setLocalError(message || 'Could not restart the interview.');
      }
    } finally {
      setResetting(false);
    }
  }, [bootstrapOpen, persist, stopTracks, setLocalError]);

  useEffect(() => {
    if (started) {
      return;
    }
    const initial = parseIeltsAiTranscript(value);
    if (initial.length > 0) {
      setExchanges(initial);
      exchangesRef.current = initial;
      const last = initial[initial.length - 1];
      if (last?.role === 'candidate') {
        setNeedsResumeHeal(true);
      } else if (last?.role === 'examiner') {
        setAwaiting('candidate_short');
      }
      setStarted(true);
    }
    // Fresh attempts: user taps "Start interview" (no auto-call to /ielts-ai/start).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate from saved transcript
  }, [started, attemptId, questionId]);

  const beginInterview = useCallback(() => {
    void bootstrapOpen();
  }, [bootstrapOpen]);

  const recordMaxSeconds = awaiting === 'candidate_long' ? Math.min(120, speakingMaxSeconds) : Math.min(90, speakingMaxSeconds);

  const startRecording = async () => {
    if (loading || interviewComplete || prepLeft !== null) {
      return;
    }
    setLocalError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setLocalError('Microphone recording is not supported in this browser.');
      return;
    }
    try {
      discardNextRecordingRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      /** @type {MediaRecorderOptions} */
      const recOpts = {};
      if (mimeType) {
        recOpts.mimeType = mimeType;
      }
      if (weakConnection && mimeType && /opus|webm/i.test(mimeType)) {
        recOpts.audioBitsPerSecond = 56000;
      }
      const mr =
        Object.keys(recOpts).length > 0 ? new MediaRecorder(stream, recOpts) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.onstop = () => {
        const wallStart = recordingWallStartRef.current;
        recordingWallStartRef.current = 0;
        if (recordingFailsafeRef.current) {
          clearTimeout(recordingFailsafeRef.current);
          recordingFailsafeRef.current = null;
        }
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecording(false);
        if (wallStart > 0 && !discardNextRecordingRef.current) {
          setSessionSpeakingMs((ms) => ms + Math.max(0, Date.now() - wallStart));
        }
        if (discardNextRecordingRef.current) {
          discardNextRecordingRef.current = false;
          return;
        }
        if (blob.size < 200) {
          setLocalError('Recording was too short. Try again.');
          return;
        }
        void uploadAndStep(blob, mimeType || 'audio/webm');
      };
      recordingWallStartRef.current = Date.now();
      mr.start(weakConnection ? 400 : 200);
      setRecording(true);
      if (recordTimerRef.current) {
        clearTimeout(recordTimerRef.current);
      }
      recordTimerRef.current = setTimeout(() => {
        recordTimerRef.current = null;
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, recordMaxSeconds * 1000);
      if (recordingFailsafeRef.current) {
        clearTimeout(recordingFailsafeRef.current);
      }
      recordingFailsafeRef.current = setTimeout(() => {
        recordingFailsafeRef.current = null;
        const r = mediaRecorderRef.current;
        if (r && r.state !== 'inactive') {
          try {
            r.stop();
          } catch {
            /* ignore */
          }
        }
        setRecording(false);
      }, (recordMaxSeconds + RECORDING_FAILSAFE_EXTRA_SEC) * 1000);
    } catch {
      setLocalError('Could not access the microphone. Check permissions and try again.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (recordingFailsafeRef.current) {
      clearTimeout(recordingFailsafeRef.current);
      recordingFailsafeRef.current = null;
    }
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    setRecording(false);
  };

  const uploadAndStep = async (blob, mimeLabel) => {
    setLoading(true);
    setError('');
    setShowRetry(false);
    retryFnRef.current = null;
    try {
      const form = new FormData();
      form.append('attempt_id', String(attemptId));
      form.append('question_id', String(questionId));
      const ext = mimeLabel.includes('webm') ? 'webm' : mimeLabel.includes('mp4') ? 'm4a' : 'webm';
      form.append('audio', blob, `recording.${ext}`);
      const transcribeTimeout = weakConnection ? IELTS_AI_TRANSCRIBE_TIMEOUT_WEAK_MS : IELTS_AI_TRANSCRIBE_TIMEOUT_MS;
      const { data } = await postWithDeadline(api, '/speaking/transcribe', form, transcribeTimeout, inFlightAbortRef);
      const transcript = (data?.transcript ?? '').trim();
      if (!transcript) {
        setLocalError('No speech detected. Try again.');
        return;
      }
      const withCandidate = [...exchangesRef.current, { role: 'candidate', text: transcript }];
      await runStep(withCandidate);
    } catch (e) {
      if (isAbortError(e)) {
        return;
      }
      setApiError(e, () => {
        void uploadAndStep(blob, mimeLabel);
      });
    } finally {
      setLoading(false);
    }
  };

  const progressUi = useMemo(() => {
    const hasStarted = exchanges.length > 0 || loading;
    const label = getInterviewProgressLabel({
      part,
      awaiting,
      prepLeft,
      interviewComplete,
      hasStarted,
    });
    const order = ['p1', 'p2prep', 'p2long', 'p3', 'done'];
    let stepIdx = order.indexOf(label.key);
    if (label.key === 'ready') {
      stepIdx = -1;
    }
    return { label, stepIdx, order };
  }, [part, awaiting, prepLeft, interviewComplete, exchanges.length, loading]);

  const sessionStats = useMemo(
    () => computeInterviewSessionStats(exchanges, sessionSpeakingMs),
    [exchanges, sessionSpeakingMs]
  );

  const skipPrepEarly = () => {
    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
    setPrepLeft(null);
    if (prepFinishingRef.current) {
      return;
    }
    prepFinishingRef.current = true;
    const withCandidate = [...exchangesRef.current, { role: 'candidate', text: PREP_MARKER }];
    void runStep(withCandidate).finally(() => {
      prepFinishingRef.current = false;
    });
  };

  return (
    <div className="br-ielts-ai-speaking">
      <AdminQuestionKeyPanel question={question} show={showAdminKey} />
      <p className="fw-semibold mb-3">{question.question_text}</p>

      <Alert variant="light" className="small mb-3 py-2 border">
        <span className="text-body-secondary">
          <strong className="text-body">Tip:</strong> After you start, listen to the examiner (browser voice), then use{' '}
          <strong>Record answer</strong>. Part 2 includes prep time; recording stops at the time limit.{' '}
          <strong>Start over</strong> appears in the bar once the interview has begun.
        </span>
      </Alert>

      <Form.Check
        type="switch"
        id="br-ielts-ai-weak-connection"
        className="small mb-3"
        label="Weak connection — shorter voice chunks, lower recording quality, shorter request timeouts"
        checked={weakConnection}
        onChange={(e) => setWeakConnection(e.target.checked)}
      />

      {exchanges.length > 0 || loading ? (
        <div className="mb-3" aria-label="Interview progress">
          <div className="small text-muted mb-1">Progress</div>
          <div className="d-flex flex-wrap gap-1 align-items-center mb-1">
            {progressUi.order.map((key, i) => {
              const short =
                key === 'p1'
                  ? 'Part 1'
                  : key === 'p2prep'
                    ? 'Part 2 prep'
                    : key === 'p2long'
                      ? 'Part 2 long'
                      : key === 'p3'
                        ? 'Part 3'
                        : 'Done';
              const done = progressUi.stepIdx > i;
              const active = progressUi.stepIdx === i;
              return (
                <Badge
                  key={key}
                  bg={active ? 'primary' : done ? 'secondary' : 'light'}
                  text={active || done ? undefined : 'dark'}
                  className="fw-normal border"
                >
                  {short}
                </Badge>
              );
            })}
          </div>
          <div className="small fw-semibold text-body">{progressUi.label.full}</div>
        </div>
      ) : null}

      {exchanges.length > 0 || sessionSpeakingMs > 0 ? (
        <div className="small text-muted mb-3 d-flex flex-wrap gap-3" aria-live="polite">
          <span>
            <strong className="text-body">Speaking time</strong> {sessionStats.speakingLabel}
          </span>
          <span>
            <strong className="text-body">Your turns</strong> {sessionStats.turns}
          </span>
          <span>
            <strong className="text-body">Words (you)</strong> ~{sessionStats.words}
          </span>
        </div>
      ) : null}

      {exchanges.length === 0 && !loading && !resetting ? (
        <div className="mb-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="d-inline-flex align-items-center gap-2"
            disabled={loading || resetting}
            onClick={beginInterview}
          >
            <i className="bi bi-play-fill" aria-hidden />
            Start interview
          </Button>
        </div>
      ) : (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Badge bg="secondary">Part {part}</Badge>
          {prepLeft !== null && prepLeft > 0 ? (
            <Badge bg="info" className="d-inline-flex align-items-center gap-1">
              <i className="bi bi-pencil-square" aria-hidden />
              Prep: {prepLeft}s
            </Badge>
          ) : null}
          {interviewComplete ? <Badge bg="success">Interview complete</Badge> : null}
          {exchanges.length > 0 ? (
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              className="d-inline-flex align-items-center gap-1 ms-auto"
              disabled={loading || resetting}
              onClick={() => setShowResetModal(true)}
            >
              <i className="bi bi-arrow-counterclockwise" aria-hidden />
              Start over
            </Button>
          ) : null}
        </div>
      )}

      {error ? (
        <Alert variant="danger" className="py-2 small">
          <div className="mb-2">{error}</div>
          {showRetry ? (
            <>
              <p className="small text-muted mb-2">
                Enable <strong>Weak connection</strong> above if the network is slow or keeps dropping, then try again.
              </p>
              <Button
                type="button"
                variant="outline-danger"
                size="sm"
                className="d-inline-flex align-items-center gap-2"
                disabled={loading}
                onClick={() => {
                  const fn = retryFnRef.current;
                  if (typeof fn !== 'function') {
                    return;
                  }
                  setError('');
                  setShowRetry(false);
                  retryFnRef.current = null;
                  fn();
                }}
              >
                <i className="bi bi-arrow-clockwise" aria-hidden />
                Try again
              </Button>
            </>
          ) : null}
        </Alert>
      ) : null}

      <div
        className="border rounded p-3 mb-3 bg-body-secondary bg-opacity-25"
        style={{ maxHeight: 'min(50vh, 420px)', overflowY: 'auto' }}
        aria-live="polite"
      >
        {exchanges.length === 0 && loading ? (
          <div className="text-muted small d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            Starting examiner…
          </div>
        ) : null}
        {exchanges.length === 0 && !loading && !resetting ? (
          <p className="text-muted small mb-0">Your conversation will show here.</p>
        ) : null}
        {exchanges.map((ex, i) => (
          <div
            key={`${i}-${ex.role}-${String(ex.text).slice(0, 24)}`}
            className={`mb-3 ${ex.role === 'examiner' ? 'pe-3' : 'ps-3 border-start border-3 border-primary'}`}
          >
            <div className="small text-muted mb-1">{ex.role === 'examiner' ? 'Examiner' : 'You'}</div>
            <div className="small text-break">{ex.text}</div>
          </div>
        ))}
        {loading &&
        !interviewComplete &&
        exchanges.length > 0 &&
        exchanges[exchanges.length - 1]?.role === 'candidate' ? (
          <p className="text-muted small fst-italic mb-0 mt-2 border-top border-secondary border-opacity-25 pt-2">
            Examiner is speaking — their line appears in this log when the audio finishes.
          </p>
        ) : null}
      </div>

      {prepLeft !== null && prepLeft > 0 ? (
        <Alert variant="light" className="border small">
          <strong>Part 2 preparation.</strong> Use this time to plan your talk. When the timer ends, the examiner will invite
          you to speak.
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline-secondary" onClick={skipPrepEarly}>
              Skip prep (practice)
            </Button>
          </div>
        </Alert>
      ) : null}

      {!interviewComplete &&
      exchanges.length > 0 &&
      awaiting !== 'silent_prep' &&
      awaiting !== 'none' ? (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          {!recording ? (
            <Button
              type="button"
              variant="primary"
              className="d-inline-flex align-items-center gap-2"
              disabled={loading || prepLeft !== null}
              onClick={() => void startRecording()}
            >
              <i className="bi bi-mic-fill" aria-hidden />
              {awaiting === 'candidate_long' ? 'Record long turn (up to 2 min)' : 'Record answer'}
            </Button>
          ) : (
            <Button type="button" variant="outline-danger" className="d-inline-flex align-items-center gap-2" onClick={stopRecording}>
              <i className="bi bi-stop-fill" aria-hidden />
              Stop
            </Button>
          )}
          {recording ? (
            <span className="small text-muted">
              Max {recordMaxSeconds}s ·{' '}
              {awaiting === 'candidate_long' ? 'Speak until you naturally finish or time stops.' : 'Short answer.'}
            </span>
          ) : null}
          {loading && !recording ? (
            <span className="small text-muted d-inline-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              Working…
            </span>
          ) : null}
        </div>
      ) : null}

      {interviewComplete ? (
        <p className="small text-muted mb-0">
          You can use <strong>Next</strong> to leave this task. Your conversation is saved for results and feedback after
          submit.
        </p>
      ) : (
        <p className="small text-muted mb-0">Spoken replies are transcribed and sent to the AI examiner for the next turn.</p>
      )}

      <Modal show={showResetModal} onHide={() => !resetting && setShowResetModal(false)} centered backdrop="static">
        <Modal.Header closeButton={!resetting}>
          <Modal.Title>Start this interview over?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            This clears the <strong>conversation on this question</strong> and calls the examiner opening again. Anything
            you have said so far in this AI interview will be removed from your saved answer for this item.
          </p>
          <p className="small text-muted mb-0">
            Use this if you want a clean practice run or if the page seemed stuck (recording or loading will be stopped).
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="outline-secondary" disabled={resetting} onClick={() => setShowResetModal(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={resetting} onClick={() => void resetInterview()}>
            {resetting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Resetting…
              </>
            ) : (
              <>
                <i className="bi bi-arrow-counterclockwise me-1" aria-hidden />
                Start over
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
