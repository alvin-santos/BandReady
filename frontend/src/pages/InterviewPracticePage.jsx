import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  ProgressBar,
  Row,
  Spinner,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DEFAULT_SECTION, useBandieTutor } from '../context/BandieTutorContext.jsx';
import { speakWithStableEnglishVoice } from '../utils/ttsSpeak.js';
import { getTtsDisabledVoiceKeysSet } from '../utils/ttsVoiceSettingsCache.js';

const SILENCE_SESSION_MS = 15_000;
const SILENCE_STOP_RECORD_MS = 1200;
const RMS_THRESHOLD = 0.018;
const RECORD_MAX_SEC = 120;

const INTERVIEW_TYPES = [
  { value: 'general_job', label: 'General Job Interview' },
  { value: 'customer_service', label: 'Customer Service / Call Center' },
  { value: 'software_developer', label: 'Software Developer Interview' },
  { value: 'fresh_graduate', label: 'Fresh Graduate Interview' },
  { value: 'sales', label: 'Sales Interview' },
  { value: 'manager_supervisor', label: 'Manager / Supervisor Interview' },
  { value: 'nurse_healthcare', label: 'Nurse / Healthcare Interview' },
  { value: 'ielts_speaking', label: 'IELTS Speaking Interview' },
  { value: 'celpip_speaking', label: 'CELPIP Speaking Interview' },
  { value: 'custom_role', label: 'Custom Job Role' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

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

function buildTranscriptDownload(messages) {
  return messages
    .map((m) => {
      const who = m.role === 'ai' ? 'Bandie (interviewer)' : 'You';
      return `${who}: ${m.body}`;
    })
    .join('\n\n');
}

export default function InterviewPracticePage() {
  const { isSubscribed, refresh: refreshAuth } = useAuth();
  const { setTutorSection } = useBandieTutor();

  const [status, setStatus] = useState(null);
  const [statusErr, setStatusErr] = useState('');

  const [interviewType, setInterviewType] = useState('general_job');
  const [difficulty, setDifficulty] = useState('normal');
  const [customRole, setCustomRole] = useState('');
  const [starting, setStarting] = useState(false);

  const [phase, setPhase] = useState('setup');
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [remainingSec, setRemainingSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [textFallback, setTextFallback] = useState('');
  const [replaying, setReplaying] = useState(false);

  const voicesRef = useRef([]);
  const bandieVoiceRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordMaxTimerRef = useRef(null);
  const silenceSessionTimerRef = useRef(null);
  const timerAnchorRef = useRef(null);
  const tickRef = useRef(null);
  const audioCtxRef = useRef(null);
  const silenceRafRef = useRef(null);
  const discardRecordingRef = useRef(false);

  const sessionId = session?.id;

  const applyPayload = useCallback((data) => {
    setSession(data.session);
    setMessages(data.messages ?? []);
    if (data.session?.remaining_seconds != null) {
      timerAnchorRef.current = Date.now() + Math.max(0, Number(data.session.remaining_seconds)) * 1000;
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusErr('');
    try {
      const { data } = await api.get('/interview-practice/status');
      setStatus(data);
    } catch (e) {
      setStatusErr(e.response?.data?.message || 'Could not load usage status.');
    }
  }, []);

  useEffect(() => {
    setTutorSection('speaking');
    return () => setTutorSection(DEFAULT_SECTION);
  }, [setTutorSection]);

  useEffect(() => {
    void loadStatus();
    void refreshAuth();
  }, [loadStatus, refreshAuth]);

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
    if (phase !== 'live' || !session?.is_active) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    const tick = () => {
      if (!timerAnchorRef.current) {
        return;
      }
      const left = Math.max(0, Math.ceil((timerAnchorRef.current - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        void endSession('time_limit');
      }
    };
    tick();
    tickRef.current = setInterval(tick, 500);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [phase, session?.is_active, sessionId]);

  const clearSilenceSessionTimer = useCallback(() => {
    if (silenceSessionTimerRef.current) {
      clearTimeout(silenceSessionTimerRef.current);
      silenceSessionTimerRef.current = null;
    }
  }, []);

  const armSilenceSessionTimer = useCallback(() => {
    clearSilenceSessionTimer();
    if (phase !== 'live' || !session?.is_active) {
      return;
    }
    silenceSessionTimerRef.current = setTimeout(() => {
      silenceSessionTimerRef.current = null;
      void endSessionRef.current('silence_timeout');
    }, SILENCE_SESSION_MS);
  }, [phase, session?.is_active, clearSilenceSessionTimer]);

  const endSessionRef = useRef(async () => {});

  const endSession = useCallback(
    async (reason = 'stopped_user') => {
      clearSilenceSessionTimer();
      if (!sessionId) {
        return;
      }
      try {
        window.speechSynthesis?.cancel();
        const { data } = await api.patch(`/interview-practice/${sessionId}/end`, {
          reason,
          with_feedback: true,
        });
        applyPayload(data);
        setPhase('summary');
      } catch (e) {
        setError(e.response?.data?.message || 'Could not end session.');
      }
    },
    [sessionId, applyPayload, clearSilenceSessionTimer]
  );

  endSessionRef.current = endSession;

  const speakBandie = useCallback(
    async (text) => {
      if (muted || !text?.trim() || typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
    const disabled = await getTtsDisabledVoiceKeysSet();
      const plain = String(text).replace(/\n+/g, ' ').trim();
      await new Promise((resolve) => {
        speakWithStableEnglishVoice(
          plain,
          voicesRef.current,
          'en-US',
          resolve,
          disabled,
          bandieVoiceRef,
          { rate: speechRate }
        );
      });
    },
    [muted, speechRate]
  );

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    }
    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSilenceSessionTimer();
      stopTracks();
      if (recordMaxTimerRef.current) {
        clearTimeout(recordMaxTimerRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, [clearSilenceSessionTimer, stopTracks]);

  const startInterview = async () => {
    setError('');
    setStarting(true);
    bandieVoiceRef.current = null;
    try {
      const payload = { interview_type: interviewType, difficulty };
      if (interviewType === 'custom_role') {
        payload.custom_role = customRole.trim();
      }
      const { data } = await api.post('/interview-practice/start', payload);
      applyPayload(data);
      setPhase('live');
      setLiveTranscript('');
      setTextFallback('');
      const lastAi = [...(data.messages ?? [])].reverse().find((m) => m.role === 'ai');
      if (lastAi?.body) {
        await speakBandie(lastAi.body);
      }
      armSilenceSessionTimer();
      void loadStatus();
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not start the interview.';
      setError(msg);
    } finally {
      setStarting(false);
    }
  };

  const sendUserText = async (raw) => {
    const text = String(raw ?? '').trim();
    if (!text || !sessionId) {
      return;
    }
    clearSilenceSessionTimer();
    window.speechSynthesis?.cancel();
    setTyping(true);
    setError('');
    setLiveTranscript('');
    try {
      const { data } = await api.post(`/interview-practice/${sessionId}/reply`, { text });
      applyPayload(data);
      setTextFallback('');
      const last = [...(data.messages ?? [])].reverse().find((m) => m.role === 'ai');
      if (last?.body) {
        await speakBandie(last.body);
      }
      if (!data.session?.is_active) {
        const st = data.session?.status;
        const reason =
          st === 'turn_limit' || st === 'time_limit' || st === 'silence_timeout' ? st : 'stopped_user';
        try {
          const { data: endData } = await api.patch(`/interview-practice/${sessionId}/end`, {
            with_feedback: true,
            reason,
          });
          applyPayload(endData);
        } catch {
          /* session already summarized */
        }
        setPhase('summary');
        void loadStatus();
      } else {
        armSilenceSessionTimer();
      }
    } catch (e) {
      const code = e.response?.data?.code;
      const msg = e.response?.data?.message || e.message || 'Request failed.';
      if (code === 'time_limit' || code === 'turn_limit') {
        const d = e.response?.data;
        if (d?.session) {
          applyPayload({ session: d.session, messages: d.messages ?? [] });
        }
        try {
          const { data: endData } = await api.patch(`/interview-practice/${sessionId}/end`, {
            with_feedback: true,
            reason: code,
          });
          applyPayload(endData);
        } catch {
          /* ignore */
        }
        setPhase('summary');
        void loadStatus();
      } else {
        setError(msg);
      }
    } finally {
      setTyping(false);
    }
  };

  const uploadRecording = async (blob, mimeType) => {
    if (!sessionId || blob.size < 200) {
      setError('Recording was too short. Try again.');
      armSilenceSessionTimer();
      return;
    }
    setTyping(true);
    setError('');
    try {
      const form = new FormData();
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'm4a' : 'webm';
      form.append('audio', blob, `clip.${ext}`);
      const { data: tr } = await api.post(`/interview-practice/${sessionId}/transcribe`, form);
      const t = String(tr?.transcript ?? '').trim();
      setLiveTranscript(t);
      if (!t) {
        setError("I didn't catch that. Please try again.");
        armSilenceSessionTimer();
        return;
      }
      await sendUserText(t);
    } catch (e) {
      setError(e.response?.data?.message || 'Transcription failed.');
      armSilenceSessionTimer();
    } finally {
      setTyping(false);
    }
  };

  const startRecording = async () => {
    if (typing || recording || !session?.is_active) {
      return;
    }
    clearSilenceSessionTimer();
    window.speechSynthesis?.cancel();
    setError('');
    discardRecordingRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const mr =
        mimeType && MediaRecorder.isTypeSupported(mimeType)
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let quietSince = 0;

      const checkSilence = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          return;
        }
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (rms < RMS_THRESHOLD) {
          if (!quietSince) {
            quietSince = now;
          } else if (now - quietSince >= SILENCE_STOP_RECORD_MS) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            }
            return;
          }
        } else {
          quietSince = 0;
        }
        silenceRafRef.current = requestAnimationFrame(checkSilence);
      };

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.onstop = () => {
        if (silenceRafRef.current) {
          cancelAnimationFrame(silenceRafRef.current);
          silenceRafRef.current = null;
        }
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecording(false);
        if (recordMaxTimerRef.current) {
          clearTimeout(recordMaxTimerRef.current);
          recordMaxTimerRef.current = null;
        }
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          armSilenceSessionTimer();
          return;
        }
        void uploadRecording(blob, mimeType || 'audio/webm');
      };

      mr.start(200);
      setRecording(true);
      silenceRafRef.current = requestAnimationFrame(checkSilence);
      recordMaxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, RECORD_MAX_SEC * 1000);
    } catch {
      setError('Could not access the microphone. Check permissions or use text input below.');
      armSilenceSessionTimer();
    }
  };

  const stopRecordingManual = () => {
    discardRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const stopInterviewClick = async () => {
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    window.speechSynthesis?.cancel();
    await endSession('stopped_user');
    void loadStatus();
  };

  const downloadTranscript = () => {
    const body = buildTranscriptDownload(messages);
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bandie-interview-${sessionId ?? 'session'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const replayConversation = async () => {
    if (replaying || muted) {
      return;
    }
    setReplaying(true);
    window.speechSynthesis?.cancel();
    const aiLines = messages.filter((m) => m.role === 'ai');
    try {
      for (const m of aiLines) {
        await speakBandie(m.body);
      }
    } finally {
      setReplaying(false);
    }
  };

  const resetToSetup = () => {
    window.speechSynthesis?.cancel();
    setPhase('setup');
    setSession(null);
    setMessages([]);
    setError('');
    setLiveTranscript('');
    bandieVoiceRef.current = null;
    void loadStatus();
  };

  const maxTurns = session?.max_turns ?? status?.limits?.max_turns ?? 10;
  const userTurns = session?.user_turns ?? 0;

  const summaryFeedback = session?.feedback;

  const canStart = status?.can_start !== false;

  return (
    <Container className="py-4 py-md-5">
      <Row className="justify-content-center">
        <Col xs={12} lg={10} xl={9}>
          {phase === 'setup' ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex flex-column flex-md-row gap-3 align-items-start mb-4">
                  <div className="flex-shrink-0 mx-auto mx-md-0">
                    <img src="/bandie.png" alt="" width={88} height={88} className="rounded-3" decoding="async" />
                  </div>
                  <div>
                    <h1 className="h3 mb-1">Bandie Interview Practice</h1>
                    <p className="text-muted mb-0">
                      AI Interview Practice — speak with your microphone (or type). Bandie plays your interviewer with
                      voice and follow-up questions.
                    </p>
                  </div>
                </div>

                {statusErr ? <Alert variant="warning">{statusErr}</Alert> : null}

                {status ? (
                  <Alert variant="info" className="py-2 small">
                    Daily sessions remaining: <strong>{status.sessions_remaining_today ?? '—'}</strong>
                    {!isSubscribed ? (
                      <span className="ms-1">(Free: 1 session per day — upgrade to Pro for more.)</span>
                    ) : null}
                  </Alert>
                ) : null}

                <Form.Group className="mb-3">
                  <Form.Label>Interview type</Form.Label>
                  <Form.Select value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
                    {INTERVIEW_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {interviewType === 'custom_role' ? (
                  <Form.Group className="mb-3">
                    <Form.Label>Enter job role</Form.Label>
                    <Form.Control
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="e.g. Dental receptionist"
                      maxLength={200}
                    />
                  </Form.Group>
                ) : null}

                <Form.Group className="mb-4">
                  <Form.Label>Difficulty</Form.Label>
                  <div className="d-flex flex-wrap gap-2">
                    {DIFFICULTIES.map((d) => (
                      <Button
                        key={d.value}
                        variant={difficulty === d.value ? 'primary' : 'outline-primary'}
                        size="sm"
                        onClick={() => setDifficulty(d.value)}
                      >
                        {d.label}
                      </Button>
                    ))}
                  </div>
                </Form.Group>

                {error ? (
                  <Alert variant="danger" className="py-2">
                    {error}
                  </Alert>
                ) : null}

                <Button variant="primary" size="lg" disabled={starting || !canStart} onClick={() => void startInterview()}>
                  {starting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Starting…
                    </>
                  ) : (
                    'Start Interview'
                  )}
                </Button>
                {!canStart ? (
                  <p className="small text-muted mt-2 mb-0">
                    You have used today&apos;s practice sessions. Come back tomorrow, or{' '}
                    <Link to="/subscription">upgrade to Pro</Link> for higher limits.
                  </p>
                ) : null}
              </Card.Body>
            </Card>
          ) : null}

          {phase === 'live' ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-3 p-md-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <img src="/bandie.png" alt="" width={40} height={40} className="rounded-2" decoding="async" />
                    <div>
                      <div className="fw-semibold">Bandie Interview Practice</div>
                      <div className="small text-muted">
                        {session?.interview_type_label} · {session?.difficulty}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <Badge bg={recording ? 'danger' : 'secondary'} className="rounded-pill">
                      {recording ? 'Listening…' : typing ? 'Bandie is typing…' : 'Ready'}
                    </Badge>
                    <Badge bg="dark" className="rounded-pill">
                      {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')} left
                    </Badge>
                    <Button variant="outline-danger" size="sm" onClick={() => void stopInterviewClick()}>
                      Stop Interview
                    </Button>
                  </div>
                </div>

                <ProgressBar
                  className="mb-3"
                  now={maxTurns ? Math.min(100, (userTurns / maxTurns) * 100) : 0}
                  label={`${userTurns}/${maxTurns} answers`}
                />
                <div className="small text-muted mb-3">
                  Turns: {userTurns} / {maxTurns} · After Bandie speaks, you have {SILENCE_SESSION_MS / 1000}s to start
                  answering before the session times out for silence.
                </div>

                <div
                  className="border rounded-3 p-3 mb-3 bg-body-secondary"
                  style={{ minHeight: 220, maxHeight: 420, overflowY: 'auto' }}
                >
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`mb-3 d-flex ${m.role === 'ai' ? 'justify-content-start' : 'justify-content-end'}`}
                    >
                      <div
                        className={`rounded-3 px-3 py-2 small shadow-sm ${
                          m.role === 'ai' ? 'bg-white text-start' : 'bg-primary text-white'
                        }`}
                        style={{ maxWidth: '88%' }}
                      >
                        {m.role === 'ai' ? (
                          <div className="text-muted text-uppercase fw-semibold mb-1" style={{ fontSize: 10 }}>
                            Bandie
                          </div>
                        ) : (
                          <div className="opacity-75 text-uppercase fw-semibold mb-1" style={{ fontSize: 10 }}>
                            You
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                      </div>
                    </div>
                  ))}
                  {typing ? (
                    <div className="d-flex justify-content-start mb-2">
                      <div className="rounded-3 px-3 py-2 bg-white shadow-sm small text-muted">Bandie is typing…</div>
                    </div>
                  ) : null}
                </div>

                {liveTranscript ? (
                  <Alert variant="secondary" className="py-2 small mb-2">
                    Live transcript: {liveTranscript}
                  </Alert>
                ) : null}

                {error ? (
                  <Alert variant="danger" className="py-2 small">
                    {error}
                  </Alert>
                ) : null}

                <Row className="g-3 align-items-end mb-3">
                  <Col md={4}>
                    <Form.Check
                      type="switch"
                      id="mute-tts"
                      label="Mute Bandie voice"
                      checked={muted}
                      onChange={(e) => setMuted(e.target.checked)}
                    />
                  </Col>
                  <Col md={8}>
                    <Form.Label className="small">Speaking speed ({speechRate.toFixed(2)}×)</Form.Label>
                    <Form.Range
                      min={0.75}
                      max={1.25}
                      step={0.05}
                      value={speechRate}
                      onChange={(e) => setSpeechRate(Number(e.target.value))}
                    />
                  </Col>
                </Row>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Button
                    variant={recording ? 'warning' : 'primary'}
                    onClick={() => (recording ? stopRecordingManual() : void startRecording())}
                    disabled={typing || !session?.is_active}
                  >
                    {recording ? (
                      <>
                        <i className="bi bi-stop-fill me-1" aria-hidden />
                        Stop & send
                      </>
                    ) : (
                      <>
                        <i className="bi bi-mic-fill me-1" aria-hidden />
                        Answer with microphone
                      </>
                    )}
                  </Button>
                </div>

                <Form.Group>
                  <Form.Label>Or type your answer</Form.Label>
                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={textFallback}
                      onChange={(e) => setTextFallback(e.target.value)}
                      placeholder="Type here if you prefer not to use the microphone"
                      disabled={typing || !session?.is_active}
                    />
                    <Button
                      variant="outline-primary"
                      className="flex-shrink-0 align-self-sm-start"
                      disabled={typing || !session?.is_active || !textFallback.trim()}
                      onClick={() => void sendUserText(textFallback)}
                    >
                      Send text
                    </Button>
                  </div>
                </Form.Group>
              </Card.Body>
            </Card>
          ) : null}

          {phase === 'summary' && session ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <img src="/bandie.png" alt="" width={48} height={48} className="rounded-2" decoding="async" />
                  <h2 className="h4 mb-0">Session completed</h2>
                </div>
                <p className="mb-2">
                  You answered <strong>{userTurns}</strong> question{userTurns === 1 ? '' : 's'} · Duration{' '}
                  <strong>{session.duration_seconds ?? '—'}</strong>s
                </p>
                {summaryFeedback?.summary ? (
                  <Alert variant="info" className="small">
                    <div className="fw-semibold mb-1">
                      AI feedback {summaryFeedback.overall_score_0_100 != null ? `(${summaryFeedback.overall_score_0_100}/100)` : ''}
                    </div>
                    {summaryFeedback.summary}
                    {summaryFeedback.speaking_pace_note ? (
                      <div className="mt-2 text-muted">{summaryFeedback.speaking_pace_note}</div>
                    ) : null}
                  </Alert>
                ) : (
                  <p className="text-muted small">Feedback will appear here when available.</p>
                )}

                {Array.isArray(summaryFeedback?.strengths) && summaryFeedback.strengths.length > 0 ? (
                  <div className="mb-2 small">
                    <div className="fw-semibold">Strengths</div>
                    <ul className="mb-0">
                      {summaryFeedback.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(summaryFeedback?.improvements) && summaryFeedback.improvements.length > 0 ? (
                  <div className="mb-3 small">
                    <div className="fw-semibold">Improvements</div>
                    <ul className="mb-0">
                      {summaryFeedback.improvements.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="d-flex flex-wrap gap-2">
                  <Button variant="primary" onClick={resetToSetup}>
                    Start again
                  </Button>
                  <Button variant="outline-secondary" onClick={downloadTranscript}>
                    Download transcript
                  </Button>
                  <Button variant="outline-secondary" onClick={() => void replayConversation()} disabled={replaying || muted}>
                    {replaying ? 'Replaying…' : 'Replay conversation'}
                  </Button>
                  {!isSubscribed ? (
                    <Button as={Link} variant="outline-primary" to="/subscription">
                      Upgrade for more usage
                    </Button>
                  ) : null}
                </div>
              </Card.Body>
            </Card>
          ) : null}
        </Col>
      </Row>
    </Container>
  );
}
