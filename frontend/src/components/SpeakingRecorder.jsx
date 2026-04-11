import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import AdminQuestionKeyPanel from './AdminQuestionKeyPanel.jsx';
import { api } from '../api/client.js';
import { resolveMediaUrl } from '../utils/mediaUrl.js';

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

export default function SpeakingRecorder({
  question,
  value,
  onChange,
  attemptId,
  questionId,
  maxSeconds = 180,
  showAdminKey = false,
}) {
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const maxTimerRef = useRef(null);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
      }
      stopTracks();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [stopTracks]);

  const uploadBlob = async (blob) => {
    setPhase('processing');
    setError('');
    const form = new FormData();
    form.append('attempt_id', String(attemptId));
    form.append('question_id', String(questionId));
    const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    form.append('audio', blob, `recording.${ext}`);
    try {
      const { data } = await api.post('/speaking/transcribe', form);
      const text = data?.transcript ?? '';
      onChange(text);
      setPhase('done');
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Transcription failed.';
      setError(msg);
      setPhase('idle');
    }
  };

  const stopRecording = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
  }, []);

  const startRecording = async () => {
    setError('');
    onChange('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.onerror = () => {
        setError('Recording error.');
        setPhase('idle');
        stopTracks();
      };
      mr.onstop = () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        if (blob.size < 200) {
          setError('Recording was too short. Try again.');
          setPhase('idle');
          return;
        }
        uploadBlob(blob);
      };

      mr.start(200);
      setPhase('recording');
      maxTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxSeconds * 1000);
    } catch {
      setError('Could not access the microphone. Check permissions and try again.');
      setPhase('idle');
    }
  };

  const raw = value || '';
  const len = [...raw].length;
  const sceneSrc = resolveMediaUrl(question.image_url ?? question.imageUrl);

  return (
    <div>
      <AdminQuestionKeyPanel question={question} show={showAdminKey} />
      {sceneSrc ? (
        <figure className="mb-3 br-speaking-scene">
          <img
            src={sceneSrc}
            alt=""
            className="img-fluid rounded border br-speaking-scene__img"
          />
          <figcaption className="small text-muted mt-2">Scene for this speaking task</figcaption>
        </figure>
      ) : null}
      <p className="fw-semibold mb-3 br-speaking-question-text">{question.question_text}</p>

      {error && (
        <Alert variant="danger" className="py-2 small">
          {error}
        </Alert>
      )}

      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        {phase === 'idle' || phase === 'done' ? (
          <Button
            type="button"
            variant="primary"
            className="d-inline-flex align-items-center gap-2"
            onClick={startRecording}
            disabled={phase === 'processing'}
          >
            <i className="bi bi-mic-fill" aria-hidden />
            Start speaking
          </Button>
        ) : null}

        {phase === 'recording' ? (
          <>
            <Button type="button" variant="outline-danger" className="d-inline-flex align-items-center gap-2" onClick={stopRecording}>
              <i className="bi bi-stop-fill" aria-hidden />
              Stop
            </Button>
            <div className="d-flex align-items-center gap-2 br-speaking-recording-pill" role="status" aria-live="polite">
              <span className="br-recording-dot" />
              <span className="small fw-semibold text-danger">Recording…</span>
              <span className="small text-muted">(max {maxSeconds}s)</span>
            </div>
          </>
        ) : null}

        {phase === 'processing' ? (
          <div className="d-flex align-items-center gap-2 text-muted small">
            <Spinner animation="border" size="sm" />
            Converting speech to text…
          </div>
        ) : null}
      </div>

      {(phase === 'done' || (phase === 'idle' && raw)) && (
        <div>
          <div className="small text-muted mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-lock-fill text-secondary" aria-hidden />
            <span>
              <strong>Transcript</strong> (read-only — matches what will be scored)
            </span>
          </div>
          <div
            className="border rounded p-3 bg-body-secondary bg-opacity-25 small br-speaking-transcript"
            role="region"
            aria-label="Transcript"
          >
            {raw || '—'}
          </div>
          <div className="small text-muted mt-2 d-flex justify-content-between flex-wrap gap-2">
            <span>
              This exact text is saved and used for scoring after submit (Pro: AI on transcript). Pronunciation is not graded.
              To try again, tap <strong>Start speaking</strong> to re-record.
            </span>
            {len > 0 && (
              <span className="text-nowrap text-muted" aria-hidden>
                {len} characters
              </span>
            )}
          </div>
        </div>
      )}

      {phase === 'idle' && !raw && (
        <p className="small text-muted mb-0">
          Read the prompt, then tap <strong>Start speaking</strong>. We transcribe your answer so it can be scored like writing.
        </p>
      )}
    </div>
  );
}
