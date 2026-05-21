import { stableVoiceKey } from './ttsDialogue.js';

/** @returns {boolean} */
export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

/** Chromium often leaves synthesis paused after cancel/navigation; speech then appears silent. */
export function resumeSpeechSynthesisIfPaused() {
  if (!isSpeechSynthesisSupported()) {
    return;
  }
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    /* ignore */
  }
}

/**
 * @returns {SpeechSynthesisVoice[]}
 */
export function getLiveSpeechVoices() {
  if (!isSpeechSynthesisSupported()) {
    return [];
  }
  return window.speechSynthesis.getVoices() ?? [];
}

/**
 * Browsers often ignore `utterance.voice` unless it is the same object instance as in `getVoices()`.
 * @param {SpeechSynthesisVoice | null | undefined} voice
 * @param {SpeechSynthesisVoice[]} [voicesList]
 */
export function resolveVoiceFromLiveList(voice, voicesList) {
  if (!voice) {
    return null;
  }
  const list = voicesList ?? getLiveSpeechVoices();
  if (!list.length) {
    return voice;
  }
  const key = stableVoiceKey(voice);
  return list.find((v) => stableVoiceKey(v) === key) ?? voice;
}

/**
 * Wait until `getVoices()` returns at least one voice (or timeout). Safe to call outside a click handler.
 * @param {number} [timeoutMs]
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function waitForSpeechVoices(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    let list = synth.getVoices() ?? [];
    if (list.length > 0) {
      resolve(list);
      return;
    }
    const finish = () => {
      synth.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
      resolve(synth.getVoices() ?? []);
    };
    const onChange = () => {
      list = synth.getVoices() ?? [];
      if (list.length > 0) {
        finish();
      }
    };
    synth.addEventListener('voiceschanged', onChange);
    const timer = setTimeout(finish, timeoutMs);
    synth.getVoices();
  });
}

/**
 * Queue utterances on the synthesis engine (call from a user gesture when possible).
 * @param {SpeechSynthesisUtterance | SpeechSynthesisUtterance[]} utterances
 */
export function speakSpeechUtterances(utterances) {
  const list = Array.isArray(utterances) ? utterances : [utterances];
  if (!isSpeechSynthesisSupported() || list.length === 0) {
    return;
  }
  resumeSpeechSynthesisIfPaused();
  for (const u of list) {
    window.speechSynthesis.speak(u);
  }
}
