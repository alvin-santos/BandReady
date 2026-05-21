import { stableVoiceKey } from './ttsDialogue.js';

const LANG_ONLY_RETRY_KEY = '__lang_only__';

/** @param {SpeechSynthesisVoice | null | undefined} voice @param {string} lang */
function voiceLabelForRetry(voice, lang) {
  if (!voice) {
    return `Browser default (${lang})`;
  }
  const name = voice.name?.trim() || 'Unnamed voice';
  return `${name} (${voice.lang?.trim() || lang})`;
}

/**
 * @param {Set<string>} triedKeys
 * @param {SpeechSynthesisVoice[]} alternates
 * @param {string} fallbackLang
 * @returns {{ voice: SpeechSynthesisVoice | null, label: string }}
 */
function pickNextVoiceForRetry(triedKeys, alternates, fallbackLang) {
  for (const v of alternates) {
    const k = stableVoiceKey(v);
    if (triedKeys.has(k)) {
      continue;
    }
    triedKeys.add(k);
    const live = resolveVoiceFromLiveList(v) ?? v;
    return { voice: live, label: voiceLabelForRetry(live, fallbackLang) };
  }
  if (!triedKeys.has(LANG_ONLY_RETRY_KEY)) {
    triedKeys.add(LANG_ONLY_RETRY_KEY);
    return { voice: null, label: voiceLabelForRetry(null, fallbackLang) };
  }
  return { voice: null, label: voiceLabelForRetry(null, fallbackLang) };
}

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

/** @type {ReturnType<typeof setInterval> | null} */
let chromeKeepAliveInterval = null;

function stopChromeSpeechKeepAlive() {
  if (chromeKeepAliveInterval != null) {
    clearInterval(chromeKeepAliveInterval);
    chromeKeepAliveInterval = null;
  }
}

/** Chromium can queue speech then stay silent until pause/resume (known Web Speech bug). */
function startChromeSpeechKeepAlive() {
  if (!isSpeechSynthesisSupported()) {
    return;
  }
  stopChromeSpeechKeepAlive();
  const synth = window.speechSynthesis;
  chromeKeepAliveInterval = setInterval(() => {
    if (!synth.speaking && !synth.pending) {
      stopChromeSpeechKeepAlive();
      return;
    }
    try {
      synth.pause();
      synth.resume();
    } catch {
      /* ignore */
    }
  }, 250);
}

/**
 * Wait until the engine is not speaking or pending (or timeout).
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export function waitForSpeechSynthesisIdle(timeoutMs = 900) {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    const started = Date.now();
    const tick = () => {
      if (!synth.speaking && !synth.pending) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve();
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

export function getSpeechSynthesisEngineStatus() {
  if (!isSpeechSynthesisSupported()) {
    return 'unsupported';
  }
  const synth = window.speechSynthesis;
  if (synth.paused) {
    return 'paused';
  }
  if (synth.speaking) {
    return 'speaking';
  }
  if (synth.pending) {
    return 'pending';
  }
  return 'idle';
}

/**
 * Queue utterances on the synthesis engine (call from a user gesture when possible).
 * @param {SpeechSynthesisUtterance | SpeechSynthesisUtterance[]} utterances
 * @param {{ onUtteranceError?: (event: SpeechSynthesisErrorEvent, utterance: SpeechSynthesisUtterance, index: number, meta?: { attempt: number, maxAttempts: number, nextVoiceLabel: string }) => void }} [options]
 */
export function speakSpeechUtterances(utterances, options) {
  const list = Array.isArray(utterances) ? utterances : [utterances];
  if (!isSpeechSynthesisSupported() || list.length === 0) {
    return;
  }
  stopChromeSpeechKeepAlive();
  resumeSpeechSynthesisIfPaused();
  const synth = window.speechSynthesis;
  if (options?.onUtteranceError) {
    list.forEach((u, i) => {
      const prev = u.onerror;
      u.onerror = (ev) => {
        options.onUtteranceError?.(ev, u, i, {
          attempt: 1,
          maxAttempts: 1,
          nextVoiceLabel: voiceLabelForRetry(u.voice ?? null, u.lang || 'en-US'),
        });
        if (typeof prev === 'function') {
          prev.call(u, ev);
        }
      };
    });
  }
  for (const u of list) {
    synth.speak(u);
  }
  startChromeSpeechKeepAlive();
}

/**
 * @param {SpeechSynthesisVoice | null | undefined} a
 * @param {SpeechSynthesisVoice | null | undefined} b
 */
function sameVoiceInstance(a, b) {
  if (!a || !b) {
    return a === b;
  }
  return stableVoiceKey(a) === stableVoiceKey(b);
}

/**
 * Speak one utterance at a time (required when switching cloud/neural voices — bulk queue drops later lines).
 *
 * @param {SpeechSynthesisUtterance[]} utterances
 * @param {{
 *   cancelled?: { current: boolean },
 *   onComplete?: () => void,
 *   onUtteranceError?: (
 *     event: SpeechSynthesisErrorEvent,
 *     utterance: SpeechSynthesisUtterance,
 *     index: number,
 *     meta: { attempt: number, maxAttempts: number, nextVoiceLabel: string }
 *   ) => void,
 *   fallbackVoice?: SpeechSynthesisVoice | null,
 *   fallbackLang?: string,
 *   alternateVoices?: SpeechSynthesisVoice[],
 *   maxAttempts?: number,
 *   voiceSwitchDelayMs?: number,
 * }} [options]
 */
export function speakSpeechUtterancesSequential(utterances, options) {
  const list = utterances.filter(Boolean);
  if (!isSpeechSynthesisSupported() || list.length === 0) {
    options?.onComplete?.();
    return;
  }

  const cancelled = options?.cancelled ?? { current: false };
  const synth = window.speechSynthesis;
  const switchDelay = options?.voiceSwitchDelayMs ?? 380;
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const alternates = options?.alternateVoices ?? getLiveSpeechVoices();
  const fallbackLang = options?.fallbackLang || 'en-US';
  let index = 0;
  /** @type {SpeechSynthesisVoice | null | undefined} */
  let lastVoice = null;
  /** @type {Map<number, { attempt: number, triedKeys: Set<string> }>} */
  const lineRetryState = new Map();

  const finish = () => {
    stopChromeSpeechKeepAlive();
    if (!cancelled.current) {
      options?.onComplete?.();
    }
  };

  const prepBeforeSpeak = async (voiceChanged) => {
    stopChromeSpeechKeepAlive();
    if (voiceChanged) {
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      await waitForSpeechSynthesisIdle();
      await new Promise((r) => setTimeout(r, switchDelay));
    } else {
      resumeSpeechSynthesisIfPaused();
    }
  };

  const advance = () => {
    index += 1;
    if (index < list.length) {
      if (!cancelled.current) {
        void runNext();
      }
    } else {
      finish();
    }
  };

  const getLineRetry = (lineIndex) => {
    if (!lineRetryState.has(lineIndex)) {
      lineRetryState.set(lineIndex, { attempt: 0, triedKeys: new Set() });
    }
    return lineRetryState.get(lineIndex);
  };

  const speakLineAt = async (lineIndex) => {
    const u = list[lineIndex];
    const voiceChanged =
      lineIndex > 0 && !sameVoiceInstance(lastVoice, u.voice ?? null);
    await prepBeforeSpeak(voiceChanged);
    if (cancelled.current) {
      stopChromeSpeechKeepAlive();
      return;
    }

    lastVoice = u.voice ?? null;

    const prevEnd = u.onend;
    const prevErr = u.onerror;

    u.onend = () => {
      if (typeof prevEnd === 'function') {
        prevEnd.call(u);
      }
      if (!cancelled.current) {
        advance();
      }
    };

    u.onerror = (ev) => {
      if (typeof prevErr === 'function') {
        prevErr.call(u, ev);
      }
      if (cancelled.current) {
        stopChromeSpeechKeepAlive();
        return;
      }

      const state = getLineRetry(lineIndex);
      if (u.voice) {
        state.triedKeys.add(stableVoiceKey(u.voice));
      }
      state.attempt += 1;

      if (state.attempt >= maxAttempts) {
        options?.onUtteranceError?.(ev, u, lineIndex, {
          attempt: state.attempt,
          maxAttempts,
          nextVoiceLabel: 'skipped',
        });
        advance();
        return;
      }

      const { voice: nextVoice, label: nextVoiceLabel } = pickNextVoiceForRetry(
        state.triedKeys,
        alternates,
        fallbackLang
      );

      options?.onUtteranceError?.(ev, u, lineIndex, {
        attempt: state.attempt,
        maxAttempts,
        nextVoiceLabel,
      });

      const retry = new SpeechSynthesisUtterance(u.text);
      retry.rate = u.rate;
      retry.pitch = u.pitch;
      retry.volume = u.volume;
      if (nextVoice) {
        retry.voice = nextVoice;
        retry.lang = nextVoice.lang || u.lang || fallbackLang;
      } else {
        retry.lang = u.lang || fallbackLang;
      }
      list[lineIndex] = retry;
      void speakLineAt(lineIndex);
    };

    synth.speak(u);
  };

  const runNext = async () => {
    if (cancelled.current) {
      stopChromeSpeechKeepAlive();
      return;
    }
    if (index >= list.length) {
      finish();
      return;
    }
    await speakLineAt(index);
  };

  stopChromeSpeechKeepAlive();
  void runNext();
}

export function cancelSpeechSynthesis() {
  stopChromeSpeechKeepAlive();
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
