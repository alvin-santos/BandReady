import {
  buildDialogueVoicePool,
  buildEnglishVoicePool,
  normalizeSpeechFragmentForBrowserTts,
  parseScriptForTts,
  preprocessScript,
  scriptHasDialogueMarkup,
  spokenPlainTextFromScript,
  stableVoiceKey,
} from './ttsDialogue.js';
import {
  cancelSpeechSynthesis,
  getLiveSpeechVoices,
  resolveVoiceFromLiveList,
  speakSpeechUtterances,
  speakSpeechUtterancesSequential,
} from './ttsSpeechSynthesis.js';

export { resolveVoiceFromLiveList };

/** @param {string} seed */
function hashSeed(seed) {
  let h = 2166136261;
  const s = String(seed ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @param {SpeechSynthesisVoice[]} arr @param {string} seed */
function seededShuffle(arr, seed) {
  const a = [...arr];
  let state = hashSeed(seed);
  for (let i = a.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** @param {SpeechSynthesisVoice[]} pool @param {string} seed */
function seededPick(pool, seed) {
  if (!pool.length) {
    return null;
  }
  return pool[hashSeed(seed) % pool.length];
}

/** Cloud/neural voices (e.g. Microsoft *Online*) often fail when queued with another locale. */
function isCloudTtsVoice(v) {
  const blob = `${v.name || ''} ${v.voiceURI || ''}`;
  return /\b(online|natural|neural|multilingual)\b/i.test(blob);
}

/** @param {string} lang */
function normalizeLangTag(lang) {
  return String(lang || 'en-US')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

/** @param {SpeechSynthesisVoice} v @param {string} preferredLang */
function voiceMatchesPreferredLocale(v, preferredLang) {
  const pref = normalizeLangTag(preferredLang);
  const raw = normalizeLangTag(v.lang);
  if (raw === pref) {
    return true;
  }
  if (!raw.startsWith('en-') || !pref.startsWith('en-')) {
    return raw.split('-')[0] === pref.split('-')[0];
  }
  const prefRegion = pref.slice(3, 5);
  const voiceRegion = raw.slice(3, 5);
  return prefRegion === voiceRegion;
}

/**
 * @param {SpeechSynthesisVoice[]} voices
 * @returns {SpeechSynthesisVoice[][]}
 */
function groupVoicesByLocale(voices) {
  /** @type {Map<string, SpeechSynthesisVoice[]>} */
  const byLocale = new Map();
  for (const v of voices) {
    const loc = normalizeLangTag(v.lang) || 'en';
    if (!byLocale.has(loc)) {
      byLocale.set(loc, []);
    }
    byLocale.get(loc).push(v);
  }
  return [...byLocale.values()].sort((a, b) => b.length - a.length);
}

/**
 * Pick two different voices from a candidate list (stable shuffle).
 * @param {SpeechSynthesisVoice[]} candidates
 * @param {string} voiceSeed
 * @returns {SpeechSynthesisVoice[]}
 */
function pickTwoDistinctFrom(candidates, voiceSeed) {
  const shuffled = seededShuffle(candidates, `${voiceSeed}:pair`);
  const out = [];
  const used = new Set();
  for (const v of shuffled) {
    const k = stableVoiceKey(v);
    if (used.has(k)) {
      continue;
    }
    used.add(k);
    out.push(v);
    if (out.length >= 2) {
      break;
    }
  }
  return out;
}

/**
 * Always assign a different voice per speaker when the pool allows (≥2 distinct voices).
 * Prefers Desktop + exam locale; cloud voices only in pairs sharing the same language tag.
 *
 * @param {SpeechSynthesisVoice[]} pool
 * @param {string} voiceSeed
 * @param {string} preferredLang
 * @returns {SpeechSynthesisVoice[]}
 */
function pickTwoDistinctVoices(pool, voiceSeed, preferredLang) {
  const desktopPref = pool.filter((v) => !isCloudTtsVoice(v) && voiceMatchesPreferredLocale(v, preferredLang));
  let pair = pickTwoDistinctFrom(desktopPref, `${voiceSeed}:desktop-pref`);
  if (pair.length >= 2) {
    return pair;
  }

  const desktop = pool.filter((v) => !isCloudTtsVoice(v));
  pair = pickTwoDistinctFrom(desktop, `${voiceSeed}:desktop`);
  if (pair.length >= 2) {
    return pair;
  }

  const cloudPref = pool.filter((v) => isCloudTtsVoice(v) && voiceMatchesPreferredLocale(v, preferredLang));
  pair = pickTwoDistinctFrom(cloudPref, `${voiceSeed}:cloud-pref`);
  if (pair.length >= 2) {
    return pair;
  }

  for (const group of groupVoicesByLocale(pool.filter((v) => isCloudTtsVoice(v)))) {
    pair = pickTwoDistinctFrom(group, `${voiceSeed}:cloud-${normalizeLangTag(group[0]?.lang)}`);
    if (pair.length >= 2) {
      return pair;
    }
  }

  const localePref = pool.filter((v) => voiceMatchesPreferredLocale(v, preferredLang));
  pair = pickTwoDistinctFrom(localePref, `${voiceSeed}:locale`);
  if (pair.length >= 2) {
    return pair;
  }

  for (const group of groupVoicesByLocale(pool)) {
    pair = pickTwoDistinctFrom(group, `${voiceSeed}:any-${normalizeLangTag(group[0]?.lang)}`);
    if (pair.length >= 2) {
      return pair;
    }
  }

  return pickTwoDistinctFrom(pool, `${voiceSeed}:pool`);
}

/**
 * @param {SpeechSynthesisVoice[]} pool
 * @param {string[]} speakerKeys
 * @param {string} voiceSeed
 * @param {string} preferredLang
 * @returns {Map<string, SpeechSynthesisVoice | null>}
 */
function pickDialogueSpeakerVoices(pool, speakerKeys, voiceSeed, preferredLang) {
  const pair = pickTwoDistinctVoices(pool, voiceSeed, preferredLang);
  /** @type {Map<string, SpeechSynthesisVoice | null>} */
  const map = new Map();
  if (pair.length >= 2) {
    speakerKeys.forEach((speaker, i) => {
      map.set(speaker, pair[i % pair.length] ?? null);
    });
    return map;
  }
  if (pair.length === 1) {
    speakerKeys.forEach((speaker, i) => {
      map.set(speaker, i === 0 ? pair[0] : pool.find((v) => stableVoiceKey(v) !== stableVoiceKey(pair[0])) ?? pair[0]);
    });
    return map;
  }
  const shuffled = seededShuffle([...pool], `${voiceSeed}:fallback`);
  speakerKeys.forEach((speaker, i) => {
    map.set(speaker, shuffled[i % shuffled.length] ?? null);
  });
  return map;
}

/**
 * @param {SpeechSynthesisVoice | null | undefined} voice
 * @param {string} lang
 */
/** Max speak attempts per line when synthesis fails (original + alternates). */
export const TTS_LINE_MAX_ATTEMPTS = 3;

/**
 * Ordered fallback voices for retries (Desktop / exam locale first).
 * @param {SpeechSynthesisVoice[]} liveVoices
 * @param {Set<string>} [disabledVoiceKeys]
 * @param {string} lang
 */
export function buildAlternateVoicesForRetry(liveVoices, disabledVoiceKeys, lang) {
  const pool = buildDialogueVoicePool(liveVoices, disabledVoiceKeys, 2);
  const enPool = buildEnglishVoicePool(liveVoices, disabledVoiceKeys);
  const seen = new Set();
  /** @type {SpeechSynthesisVoice[]} */
  const ordered = [];
  const add = (list) => {
    for (const v of list) {
      const k = stableVoiceKey(v);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      ordered.push(resolveVoiceFromLiveList(v, liveVoices) ?? v);
    }
  };
  add(pool.filter((v) => !isCloudTtsVoice(v) && voiceMatchesPreferredLocale(v, lang)));
  add(pool.filter((v) => !isCloudTtsVoice(v)));
  add(enPool.filter((v) => voiceMatchesPreferredLocale(v, lang)));
  add(enPool);
  add(pool);
  add(liveVoices.filter((v) => !disabledVoiceKeys?.has(stableVoiceKey(v))));
  return ordered;
}

export function formatTtsVoiceLabel(voice, lang = 'en-US') {
  if (!voice) {
    return `Browser default (${lang})`;
  }
  const name = voice.name?.trim() || 'Unnamed voice';
  const tag = voice.lang?.trim() || lang;
  return `${name} (${tag})`;
}

/**
 * @typedef {{ speaker: string | null, voice: SpeechSynthesisVoice | null, label: string, key: string | null }} TtsVoiceAssignment
 * @typedef {{ mode: 'dialogue' | 'single' | 'lang_fallback', assignments: TtsVoiceAssignment[], examPoolSize: number, browserVoiceCount: number, warnings: string[] }} DialogueScriptVoicePlan
 */

/**
 * Which voices will be used for this script (stable for a given `voiceSeed`, e.g. question id).
 * @param {string} script
 * @param {SpeechSynthesisVoice[]} voicesList
 * @param {string} lang
 * @param {Set<string>} [disabledVoiceKeys]
 * @param {string} [voiceSeed]
 * @returns {DialogueScriptVoicePlan}
 */
export function planDialogueScriptVoices(script, voicesList, lang, disabledVoiceKeys, voiceSeed = '') {
  const warnings = [];
  const liveVoices = voicesList?.length ? voicesList : getLiveSpeechVoices();
  const browserVoiceCount = liveVoices.length;
  const plain = spokenPlainTextFromScript(script);
  if (!plain) {
    return {
      mode: 'lang_fallback',
      assignments: [{ speaker: null, voice: null, label: formatTtsVoiceLabel(null, lang), key: null }],
      examPoolSize: 0,
      browserVoiceCount,
      warnings: ['No speakable text in script.'],
    };
  }

  const body = preprocessScript(script);
  const segments = parseScriptForTts(script);
  const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
  const dialoguePool = buildDialogueVoicePool(liveVoices, disabledVoiceKeys, 2);
  const useDialogueVoices =
    scriptHasDialogueMarkup(body) && speakers.length >= 2 && dialoguePool.length >= 2;
  const examPoolSize = dialoguePool.length;

  if (browserVoiceCount === 0) {
    warnings.push('No browser voices loaded yet — install a language pack or try Chrome/Edge.');
  }
  if (examPoolSize === 0 && browserVoiceCount > 0) {
    warnings.push('No exam-style voices available (check TTS voice settings / blocklist).');
  }

  /** @param {SpeechSynthesisVoice | null | undefined} voice @param {string | null} speaker */
  const assignment = (voice, speaker = null) => {
    const resolved = voice ? resolveVoiceFromLiveList(voice, liveVoices) : null;
    return {
      speaker,
      voice: resolved,
      label: formatTtsVoiceLabel(resolved, lang),
      key: resolved ? stableVoiceKey(resolved) : null,
    };
  };

  if (useDialogueVoices) {
    const keys = speakers;
    const voiceMap = pickDialogueSpeakerVoices(dialoguePool, keys, voiceSeed, lang);
    voiceMap.set('__default__', voiceMap.get(keys[0]) ?? null);
    const assignments = keys.map((k) => assignment(voiceMap.get(k) ?? null, k));
    const keysUsed = new Set(assignments.map((a) => a.key).filter(Boolean));
    const allCloud = assignments.every((a) => a.voice && isCloudTtsVoice(a.voice));
    const locales = new Set(assignments.map((a) => normalizeLangTag(a.voice?.lang)).filter(Boolean));
    if (keysUsed.size >= 2) {
      if (allCloud) {
        warnings.push(
          'Distinct Online voices per speaker (same language where possible). Lines play one at a time when the voice changes.'
        );
      } else {
        warnings.push('Distinct voices per speaker.');
      }
    } else {
      warnings.push('Only one voice available — all speakers share it. Add more English voices in system speech settings.');
    }
    if (allCloud && locales.size > 1) {
      warnings.push(
        'Speakers use different cloud regions — if audio drops, install two en-US Desktop voices in Windows Speech settings.'
      );
    }
    return { mode: 'dialogue', assignments, examPoolSize, browserVoiceCount, warnings };
  }

  const enPool = buildEnglishVoicePool(liveVoices, disabledVoiceKeys);
  let pick = seededPick(enPool, `${voiceSeed}:single`);
  if (!pick && liveVoices.length) {
    const allowed = liveVoices.filter((v) => !disabledVoiceKeys?.has(stableVoiceKey(v)));
    pick = seededPick(allowed, `${voiceSeed}:single-fallback`);
  }
  if (!pick) {
    warnings.push('Using browser default voice — no allowed voice matched.');
    return {
      mode: 'lang_fallback',
      assignments: [assignment(null)],
      examPoolSize: enPool.length,
      browserVoiceCount,
      warnings,
    };
  }

  return {
    mode: 'single',
    assignments: [assignment(pick)],
    examPoolSize: enPool.length,
    browserVoiceCount,
    warnings,
  };
}

/** Chromium stalls less on several short utterances than one very long string (same voice). */
const TTS_CHUNK_MAX_CHARS = 320;

/**
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string[]}
 */
function splitTextIntoTtsChunks(text, maxChars = TTS_CHUNK_MAX_CHARS) {
  const normalized = normalizeSpeechFragmentForBrowserTts(String(text ?? ''));
  if (!normalized) {
    return [];
  }
  if (normalized.length <= maxChars) {
    return [normalized];
  }
  const sentences = normalized.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  /** @type {string[]} */
  const chunks = [];
  let buf = '';
  const flush = () => {
    const x = buf.trim();
    if (x) {
      chunks.push(x);
    }
    buf = '';
  };
  const pushHardSplit = (longSent) => {
    let rest = longSent;
    while (rest.length > maxChars) {
      const slice = rest.slice(0, maxChars);
      let cut = slice.lastIndexOf(', ');
      if (cut < maxChars * 0.45) {
        cut = slice.lastIndexOf(' ');
      }
      if (cut < maxChars * 0.35) {
        cut = maxChars;
      }
      const advance = cut === maxChars ? cut : cut + 2;
      const part = rest.slice(0, advance).trim();
      if (part) {
        chunks.push(part);
      }
      rest = rest.slice(advance).trim();
    }
    if (rest) {
      buf = buf ? `${buf} ${rest}` : rest;
    }
  };

  for (const sent of sentences) {
    if (sent.length > maxChars) {
      flush();
      pushHardSplit(sent);
      continue;
    }
    const next = buf ? `${buf} ${sent}` : sent;
    if (next.length <= maxChars) {
      buf = next;
    } else {
      flush();
      buf = sent;
    }
  }
  flush();
  return chunks.length > 0 ? chunks : [normalized];
}

/**
 * @param {import('./ttsDialogue.js').DialogueSegment[]} segments
 * @param {Map<string, SpeechSynthesisVoice | null>} voiceMap
 * @param {SpeechSynthesisVoice[]} liveVoices
 * @param {string} lang
 * @param {{ current: boolean }} cancelled
 * @param {() => void} [onComplete]
 * @param {boolean} [chainPlayback] if true, onComplete is only fired by the sequential speaker
 * @returns {SpeechSynthesisUtterance[]}
 */
function buildSegmentUtterances(
  segments,
  voiceMap,
  liveVoices,
  lang,
  cancelled,
  onComplete,
  chainPlayback = false
) {
  /** @type {SpeechSynthesisUtterance[]} */
  const utterances = [];
  for (let idx = 0; idx < segments.length; idx++) {
    const { speaker, text } = segments[idx];
    const mapped = speaker ? voiceMap.get(speaker) : voiceMap.get('__default__');
    const voice = resolveVoiceFromLiveList(mapped, liveVoices);
    const chunks = splitTextIntoTtsChunks(text)
      .map((x) => x.trim())
      .filter(Boolean);
    for (let c = 0; c < chunks.length; c++) {
      const u = new SpeechSynthesisUtterance(chunks[c]);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || lang;
      } else {
        u.lang = lang;
      }
      u.rate = 1;
      u.pitch = 1;
      const isLast = idx === segments.length - 1 && c === chunks.length - 1;
      if (isLast && !chainPlayback) {
        u.onend = () => {
          if (!cancelled.current) {
            onComplete?.();
          }
        };
        u.onerror = () => {
          if (!cancelled.current) {
            onComplete?.();
          }
        };
      }
      utterances.push(u);
    }
  }
  return utterances;
}

/**
 * Speak script with dialogue-aware voices (distinct voice per speaker when possible).
 * @param {string} script
 * @param {SpeechSynthesisVoice[]} voicesList
 * @param {string} lang fallback BCP-47 tag (e.g. en-US) when a voice has no lang
 * @param {() => void} onComplete
 * @param {Set<string>} [disabledVoiceKeys] admin blocklist (stableVoiceKey)
 * @param {{ current: boolean }} [cancelRef] set `current` to true to abort (e.g. user pressed Stop)
 * @param {{ voiceSeed?: string, onUtteranceError?: (event: SpeechSynthesisErrorEvent, utterance: SpeechSynthesisUtterance, index: number, meta: { attempt: number, maxAttempts: number, nextVoiceLabel: string }) => void }} [options]
 */
export function speakDialogueScript(script, voicesList, lang, onComplete, disabledVoiceKeys, cancelRef, options) {
  const plain = spokenPlainTextFromScript(script);
  const cancelled = cancelRef ?? { current: false };
  const voiceSeed = options?.voiceSeed ?? '';
  if (!plain || typeof window === 'undefined' || !window.speechSynthesis) {
    if (!cancelled.current) {
      onComplete?.();
    }
    return;
  }

  const plan = planDialogueScriptVoices(script, voicesList, lang, disabledVoiceKeys, voiceSeed);
  const segments = parseScriptForTts(script);
  const liveVoices = voicesList?.length ? voicesList : getLiveSpeechVoices();

  cancelSpeechSynthesis();

  /** @type {SpeechSynthesisUtterance[]} */
  let utterances = [];

  if (plan.mode === 'dialogue') {
    /** @type {Map<string, SpeechSynthesisVoice | null>} */
    const voiceMap = new Map();
    for (const a of plan.assignments) {
      if (a.speaker) {
        voiceMap.set(a.speaker, a.voice);
      }
    }
    voiceMap.set('__default__', plan.assignments[0]?.voice ?? null);
    utterances = buildSegmentUtterances(segments, voiceMap, liveVoices, lang, cancelled, onComplete, true);
  } else {
    const pick = plan.assignments[0]?.voice ?? null;
    const chunks = splitTextIntoTtsChunks(plain)
      .map((x) => x.trim())
      .filter(Boolean);
    for (let ci = 0; ci < chunks.length; ci++) {
      const u = new SpeechSynthesisUtterance(chunks[ci]);
      if (pick) {
        u.voice = pick;
        u.lang = pick.lang || lang;
      } else {
        u.lang = lang;
      }
      u.rate = 1;
      const isLast = ci === chunks.length - 1;
      if (isLast) {
        u.onend = () => {
          if (!cancelled.current) {
            onComplete?.();
          }
        };
        u.onerror = () => {
          if (!cancelled.current) {
            onComplete?.();
          }
        };
      }
      utterances.push(u);
    }
  }

  if (!cancelled.current && utterances.length === 0) {
    onComplete?.();
    return;
  }
  if (!cancelled.current) {
    const fallbackVoice = plan.assignments[0]?.voice ?? null;
    if (plan.mode === 'dialogue') {
      const alternateVoices = buildAlternateVoicesForRetry(liveVoices, disabledVoiceKeys, lang);
      speakSpeechUtterancesSequential(utterances, {
        cancelled,
        onComplete,
        fallbackVoice,
        fallbackLang: lang,
        alternateVoices,
        maxAttempts: TTS_LINE_MAX_ATTEMPTS,
        onUtteranceError: options?.onUtteranceError,
      });
    } else {
      speakSpeechUtterances(utterances, { onUtteranceError: options?.onUtteranceError });
    }
  }
}

/**
 * Speak plain text with one stable English voice across calls (same ref = same voice).
 * Unlike {@link speakDialogueScript}'s single-speaker branch, this does **not** randomize on every utterance.
 *
 * @param {string} text
 * @param {SpeechSynthesisVoice[]} voicesList
 * @param {string} lang
 * @param {() => void} onComplete
 * @param {Set<string>} [disabledVoiceKeys]
 * @param {{ current: SpeechSynthesisVoice | null }} stableVoiceRef first call picks a voice and stores it here; set `.current = null` to pick again (e.g. new question)
 * @param {{ chunkMaxChars?: number; rate?: number; preferredVoiceKey?: string | null }} [options] smaller `chunkMaxChars` (e.g. 140) queues more short TTS utterances — helps weak connections / Chromium stalls. `rate` is SpeechSynthesisUtterance.rate (typically 0.5–2). `preferredVoiceKey` matches {@link stableVoiceKey}.
 */
export function speakWithStableEnglishVoice(text, voicesList, lang, onComplete, disabledVoiceKeys, stableVoiceRef, options) {
  const plain = String(text ?? '').trim();
  if (!plain || typeof window === 'undefined' || !window.speechSynthesis) {
    onComplete?.();
    return;
  }

  cancelSpeechSynthesis();

  const liveVoices = voicesList?.length ? voicesList : getLiveSpeechVoices();
  let pick = stableVoiceRef.current;
  const prefKey = typeof options?.preferredVoiceKey === 'string' ? options.preferredVoiceKey.trim() : '';
  if (prefKey !== '') {
    const found = liveVoices.find((v) => stableVoiceKey(v) === prefKey);
    if (found && !disabledVoiceKeys?.has(prefKey)) {
      pick = resolveVoiceFromLiveList(found, liveVoices);
      stableVoiceRef.current = pick;
    }
  }
  if (!pick) {
    const enPool = buildEnglishVoicePool(liveVoices, disabledVoiceKeys);
    if (enPool.length > 0) {
      pick = enPool[Math.floor(Math.random() * enPool.length)];
    } else if (liveVoices.length) {
      const allowed = liveVoices.filter((v) => !disabledVoiceKeys?.has(stableVoiceKey(v)));
      if (allowed.length > 0) {
        pick = allowed[Math.floor(Math.random() * allowed.length)];
      }
    }
    if (pick) {
      stableVoiceRef.current = pick;
    }
  }

  const chunkCap =
    typeof options?.chunkMaxChars === 'number' && options.chunkMaxChars >= 60
      ? options.chunkMaxChars
      : TTS_CHUNK_MAX_CHARS;

  const rate =
    typeof options?.rate === 'number' && options.rate >= 0.5 && options.rate <= 2 ? options.rate : 1;

  const chunks = splitTextIntoTtsChunks(plain, chunkCap)
    .map((x) => x.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    onComplete?.();
    return;
  }
  const live = resolveVoiceFromLiveList(pick, liveVoices);
  /** @type {SpeechSynthesisUtterance[]} */
  const stableUtterances = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const u = new SpeechSynthesisUtterance(chunks[ci]);
    const v = live ?? pick;
    if (v) {
      u.voice = v;
      u.lang = v.lang || lang;
    } else {
      u.lang = lang;
    }
    u.rate = rate;
    const isLast = ci === chunks.length - 1;
    if (isLast) {
      u.onend = () => onComplete?.();
      u.onerror = () => onComplete?.();
    }
    stableUtterances.push(u);
  }
  speakSpeechUtterances(stableUtterances);
}

const DEFAULT_VOICE_PREVIEW_TEXT =
  "This is a short sample of how this voice will sound as your interviewer during practice.";

/**
 * Speak a short sample with a specific browser TTS voice (resolves to the live `getVoices()` instance).
 *
 * @param {SpeechSynthesisVoice | null | undefined} voice
 * @param {SpeechSynthesisVoice[]} voicesList
 * @param {{ text?: string; rate?: number; lang?: string; onEnd?: () => void }} [options]
 */
export function previewBrowserTtsVoice(voice, voicesList, options) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !voice) {
    options?.onEnd?.();
    return;
  }
  const text =
    typeof options?.text === 'string' && options.text.trim() !== '' ? options.text.trim() : DEFAULT_VOICE_PREVIEW_TEXT;
  const rate = typeof options?.rate === 'number' && options.rate >= 0.5 && options.rate <= 2 ? options.rate : 1;
  const lang = typeof options?.lang === 'string' && options.lang.trim() !== '' ? options.lang.trim() : 'en-US';

  cancelSpeechSynthesis();

  const liveVoices = voicesList?.length ? voicesList : getLiveSpeechVoices();
  const live = resolveVoiceFromLiveList(voice, liveVoices);
  const u = new SpeechSynthesisUtterance(text);
  if (live) {
    u.voice = live;
    u.lang = live.lang || lang;
  } else {
    u.lang = lang;
  }
  u.rate = rate;
  const done = () => {
    options?.onEnd?.();
  };
  u.onend = done;
  u.onerror = done;
  speakSpeechUtterances(u);
}
