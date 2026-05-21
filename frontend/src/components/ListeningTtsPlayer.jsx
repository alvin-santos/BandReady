import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { spokenPlainTextFromScript } from '../utils/ttsDialogue.js';
import {
  cancelSpeechSynthesis,
  getLiveSpeechVoices,
  getSpeechSynthesisEngineStatus,
  waitForSpeechVoices,
} from '../utils/ttsSpeechSynthesis.js';
import { planDialogueScriptVoices, speakDialogueScript } from '../utils/ttsSpeak.js';
import { getTtsDisabledVoiceKeysSet } from '../utils/ttsVoiceSettingsCache.js';

const WAVE_BAR_COUNT = 26;

/** Decorative equalizer-style bars (browser TTS has no waveform samples). */
function ListeningTtsWaveform({ active }) {
  return (
    <div
      className={`br-listen-tts-wave ${active ? 'br-listen-tts-wave--active' : ''}`}
      aria-hidden
      title={active ? 'Playing' : 'Ready'}
    >
      {Array.from({ length: WAVE_BAR_COUNT }, (_, i) => (
        <span key={i} className="br-listen-tts-wave__bar" style={{ '--br-wave-i': i }} />
      ))}
    </div>
  );
}

/**
 * Reads listening `audio_script` with the browser Speech Synthesis API. The script is not shown on screen.
 *
 * Lines like `Customer: Hello`, `Receptionist: Hi`, or `Agent:Hi` are spoken without the role label. With two or more distinct role names
 * and multiple English voices installed, each role uses a different voice when possible.
 *
 * `instruction` is optional visible text — not spoken.
 * `onListenComplete` runs when playback finishes naturally (not when the user stops).
 * `onPlaybackChange(true|false)` when TTS starts/stops (for disabling exam navigation while audio plays).
 */
export default function ListeningTtsPlayer({
  script,
  instruction,
  utteranceKey,
  lang = 'en-US',
  onListenComplete,
  onPlaybackChange,
}) {
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState(() =>
    typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []
  );
  const [playbackError, setPlaybackError] = useState('');
  const [engineStatus, setEngineStatus] = useState('idle');
  const [showVoiceDetails, setShowVoiceDetails] = useState(false);
  const voicesRef = useRef(voices);
  voicesRef.current = voices;
  /** Prefetched so Play can call `speak()` synchronously (async before speak breaks Chromium user-gesture audio). */
  const disabledVoiceKeysRef = useRef(new Set());
  const [disabledKeysTick, setDisabledKeysTick] = useState(0);
  /** Bumps on stop / question change so a cancelled clip does not count as “finished”. */
  const playbackGenRef = useRef(0);
  /** Set to true in stop() so {@link speakDialogueScript} does not chain after cancel(). */
  const cancelPlaybackRef = useRef(false);

  const voicePlan = useMemo(
    () =>
      planDialogueScriptVoices(script, voicesRef.current, lang, disabledVoiceKeysRef.current, utteranceKey),
    [script, lang, utteranceKey, voices, disabledKeysTick]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const load = () => {
      const list = getLiveSpeechVoices();
      setVoices(list);
      voicesRef.current = list;
    };
    load();
    void waitForSpeechVoices().then(load);
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    void getTtsDisabledVoiceKeysSet().then((set) => {
      disabledVoiceKeysRef.current = set;
      setDisabledKeysTick((t) => t + 1);
    });
  }, [utteranceKey]);

  useEffect(() => {
    return () => {
      cancelPlaybackRef.current = true;
      cancelSpeechSynthesis();
    };
  }, []);

  useEffect(() => {
    playbackGenRef.current += 1;
    cancelPlaybackRef.current = true;
    cancelSpeechSynthesis();
    setPlaying(false);
    setPlaybackError('');
    setShowVoiceDetails(false);
  }, [utteranceKey]);

  useEffect(() => {
    if (playbackError) {
      setShowVoiceDetails(true);
    }
  }, [playbackError]);

  useEffect(() => {
    onPlaybackChange?.(playing);
  }, [playing, onPlaybackChange]);

  useEffect(() => {
    if (!supported && onListenComplete) {
      onListenComplete();
    }
  }, [supported, onListenComplete]);

  useEffect(() => {
    if (!playing) {
      setEngineStatus(getSpeechSynthesisEngineStatus());
      return;
    }
    const tick = () => setEngineStatus(getSpeechSynthesisEngineStatus());
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [playing]);

  const speak = useCallback(() => {
    const plain = spokenPlainTextFromScript(script);
    if (!plain || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    const liveVoices = getLiveSpeechVoices();
    if (liveVoices.length) {
      voicesRef.current = liveVoices;
    }
    setPlaybackError('');
    cancelPlaybackRef.current = false;
    cancelSpeechSynthesis();
    playbackGenRef.current += 1;
    const gen = playbackGenRef.current;
    setPlaying(true);
    speakDialogueScript(
      script,
      voicesRef.current,
      lang,
      () => {
        setPlaying(false);
        setEngineStatus(getSpeechSynthesisEngineStatus());
        if (playbackGenRef.current === gen && !cancelPlaybackRef.current) {
          onListenComplete?.();
        }
      },
      disabledVoiceKeysRef.current,
      cancelPlaybackRef,
      {
        voiceSeed: utteranceKey,
        onUtteranceError: (_ev, _u, _i, meta) => {
          if (!meta) {
            setPlaybackError('A line failed to play. Open voice details or try en-US Desktop voices in Windows Speech settings.');
            return;
          }
          if (meta.nextVoiceLabel === 'skipped') {
            setPlaybackError(
              `Playback failed after ${meta.maxAttempts} attempts for one line — try en-US Desktop voices in Windows Speech settings.`
            );
            return;
          }
          setPlaybackError(
            `Attempt ${meta.attempt}/${meta.maxAttempts} failed — trying ${meta.nextVoiceLabel}.`
          );
        },
      }
    );
    void getTtsDisabledVoiceKeysSet().then((set) => {
      disabledVoiceKeysRef.current = set;
    });
  }, [script, lang, onListenComplete, utteranceKey]);

  const stop = useCallback(() => {
    cancelPlaybackRef.current = true;
    playbackGenRef.current += 1;
    cancelSpeechSynthesis();
    setPlaying(false);
    setEngineStatus(getSpeechSynthesisEngineStatus());
  }, []);

  if (!supported) {
    return (
      <div className="mb-4 p-3 rounded border border-warning border-opacity-50 bg-warning bg-opacity-10 small">
        <i className="bi bi-exclamation-triangle me-2" aria-hidden />
        This browser does not support speech playback. Add an <strong>audio URL</strong> for this question or try Chrome /
        Edge / Safari. On the official exam, listening is played from professional recordings — not computer speech.
      </div>
    );
  }

  if (!spokenPlainTextFromScript(script)) {
    return null;
  }

  return (
    <div className="mb-4">
      {instruction && (
        <div className="small text-muted mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-info-circle" aria-hidden />
          <span>{instruction}</span>
        </div>
      )}
      <div className="br-listen-tts-shell">
        <div className="br-listen-tts-shell__track">
          <Button
            type="button"
            variant="primary"
            className={`br-listen-tts-play ${playing ? 'br-listen-tts-play--playing' : 'br-listen-tts-play--idle'}`}
            onClick={playing ? stop : speak}
            aria-label={playing ? 'Stop playback' : 'Play listening clip'}
          >
            <span className="br-listen-tts-play__icon-wrap" aria-hidden>
              <i
                className={playing ? 'bi bi-stop-fill br-listen-tts-play__glyph' : 'bi bi-play-fill br-listen-tts-play__glyph'}
              />
            </span>
            <span className="br-listen-tts-play__label">{playing ? 'Stop' : 'Play'}</span>
          </Button>
          <ListeningTtsWaveform active={playing} />
        </div>
        <div className="br-listen-tts-shell__meta small text-muted">
          <span className="br-listen-tts-shell__meta-dot" aria-hidden />
          {playing ? 'Playing — device speech' : 'Ready — tap play to listen'}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-link btn-sm text-muted text-decoration-none px-0 mt-2 d-inline-flex align-items-center gap-1"
        onClick={() => setShowVoiceDetails((open) => !open)}
        aria-expanded={showVoiceDetails}
        aria-controls="br-listen-tts-voice-panel"
      >
        <i className={`bi bi-chevron-${showVoiceDetails ? 'up' : 'down'}`} aria-hidden />
        {showVoiceDetails ? 'Hide voice details' : 'Voice details'}
      </button>
      {showVoiceDetails && (
        <div
          id="br-listen-tts-voice-panel"
          className="br-listen-tts-voice-panel small mt-2 p-3 rounded border bg-light border-secondary border-opacity-25"
          aria-live="polite"
        >
          <div className="fw-semibold text-body-secondary mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-mic" aria-hidden />
            TTS voice for this question
          </div>
          {voicePlan.mode === 'dialogue' ? (
            <ul className="mb-2 ps-3">
              {voicePlan.assignments.map((a) => (
                <li key={a.speaker}>
                  <span className="text-muted">{a.speaker}:</span> {a.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2">
              <span className="text-muted">Narrator:</span> {voicePlan.assignments[0]?.label ?? '—'}
            </p>
          )}
          <p className="mb-1 text-muted">
            Browser voices loaded: <strong>{voicePlan.browserVoiceCount}</strong>
            {' · '}
            Exam-style pool: <strong>{voicePlan.examPoolSize}</strong>
            {' · '}
            Engine: <strong>{playing ? engineStatus : getSpeechSynthesisEngineStatus()}</strong>
          </p>
          {voicePlan.warnings.map((w) => (
            <p key={w} className="mb-1 text-warning-emphasis">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden />
              {w}
            </p>
          ))}
          {playbackError && (
            <p className="mb-0 text-danger">
              <i className="bi bi-x-circle me-1" aria-hidden />
              Playback error: <code>{playbackError}</code>
            </p>
          )}
        </div>
      )}

      <p className="small text-muted mt-3 mb-0 border-start border-3 ps-3 border-secondary border-opacity-25">
        <strong className="text-muted">Note:</strong> This clip is read by your device using computer speech (not a studio
        recording). The voice, accent, speed, and sound will differ from the official test, where listening is played from
        professionally recorded audio.
      </p>
    </div>
  );
}
