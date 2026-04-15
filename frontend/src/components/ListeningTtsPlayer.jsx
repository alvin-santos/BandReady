import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { spokenPlainTextFromScript } from '../utils/ttsDialogue.js';
import { speakDialogueScript } from '../utils/ttsSpeak.js';
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
  const voicesRef = useRef(voices);
  voicesRef.current = voices;
  /** Bumps on stop / question change so a cancelled clip does not count as “finished”. */
  const playbackGenRef = useRef(0);
  /** Set to true in stop() so {@link speakDialogueScript} does not chain after cancel(). */
  const cancelPlaybackRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const load = () => setVoices(window.speechSynthesis.getVoices() ?? []);
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    return () => {
      cancelPlaybackRef.current = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    playbackGenRef.current += 1;
    cancelPlaybackRef.current = true;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setPlaying(false);
    }
  }, [utteranceKey]);

  useEffect(() => {
    onPlaybackChange?.(playing);
  }, [playing, onPlaybackChange]);

  useEffect(() => {
    if (!supported && onListenComplete) {
      onListenComplete();
    }
  }, [supported, onListenComplete]);

  const speak = useCallback(() => {
    const plain = spokenPlainTextFromScript(script);
    if (!plain || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    void (async () => {
      const disabled = await getTtsDisabledVoiceKeysSet();
      cancelPlaybackRef.current = false;
      window.speechSynthesis.cancel();
      playbackGenRef.current += 1;
      const gen = playbackGenRef.current;
      setPlaying(true);
      speakDialogueScript(
        script,
        voicesRef.current,
        lang,
        () => {
          setPlaying(false);
          if (playbackGenRef.current === gen && !cancelPlaybackRef.current) {
            onListenComplete?.();
          }
        },
        disabled,
        cancelPlaybackRef
      );
    })();
  }, [script, lang, onListenComplete]);

  const stop = useCallback(() => {
    cancelPlaybackRef.current = true;
    playbackGenRef.current += 1;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.requestAnimationFrame(() => {
        window.speechSynthesis.cancel();
      });
    }
    setPlaying(false);
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
      <p className="small text-muted mt-3 mb-0 border-start border-3 ps-3 border-secondary border-opacity-25">
        <strong className="text-muted">Note:</strong> This clip is read by your device using computer speech (not a studio
        recording). The voice, accent, speed, and sound will differ from the official test, where listening is played from
        professionally recorded audio.
      </p>
    </div>
  );
}
