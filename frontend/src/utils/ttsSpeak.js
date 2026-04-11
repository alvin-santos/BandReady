import {
  buildDialogueVoicePool,
  buildEnglishVoicePool,
  mapSpeakersToVoices,
  normalizeSpeechFragmentForBrowserTts,
  parseDialogueUtterances,
  spokenPlainTextFromScript,
  stableVoiceKey,
} from './ttsDialogue.js';

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
 * Browsers often ignore `utterance.voice` unless it is the same object instance as in `getVoices()`.
 * @param {SpeechSynthesisVoice | null | undefined} voice
 * @param {SpeechSynthesisVoice[]} voicesList
 */
function resolveVoiceFromLiveList(voice, voicesList) {
  if (!voice || !voicesList?.length) {
    return voice ?? null;
  }
  const key = stableVoiceKey(voice);
  return voicesList.find((v) => stableVoiceKey(v) === key) ?? voice;
}

/**
 * Speak script with dialogue-aware voices (randomized English pool; distinct voice per speaker when possible).
 * @param {string} script
 * @param {SpeechSynthesisVoice[]} voicesList
 * @param {string} lang fallback BCP-47 tag (e.g. en-US) when a voice has no lang
 * @param {() => void} onComplete
 * @param {Set<string>} [disabledVoiceKeys] admin blocklist (stableVoiceKey)
 * @param {{ current: boolean }} [cancelRef] set `current` to true to abort (e.g. user pressed Stop); prevents queued utterances from continuing after `speechSynthesis.cancel()`
 */
export function speakDialogueScript(script, voicesList, lang, onComplete, disabledVoiceKeys, cancelRef) {
  const plain = spokenPlainTextFromScript(script);
  const cancelled = cancelRef ?? { current: false };
  if (!plain || typeof window === 'undefined' || !window.speechSynthesis) {
    if (!cancelled.current) {
      onComplete?.();
    }
    return;
  }

  const segments = parseDialogueUtterances(script);
  const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
  const dialoguePool = buildDialogueVoicePool(voicesList, disabledVoiceKeys, 2);

  window.speechSynthesis.cancel();

  if (speakers.length >= 2 && dialoguePool.length >= 2) {
    const voiceMap = mapSpeakersToVoices(segments, voicesList, lang, disabledVoiceKeys, dialoguePool);
    /** Queue every utterance in one go — Chrome/Edge often insert huge gaps when chaining {@link SpeechSynthesisUtterance} via `onend` → `speak()` with different voices. */
    /** @type {SpeechSynthesisUtterance[]} */
    const utterances = [];
    for (let idx = 0; idx < segments.length; idx++) {
      const { speaker, text } = segments[idx];
      const mapped = speaker ? voiceMap.get(speaker) : voiceMap.get('__default__');
      const voice = resolveVoiceFromLiveList(mapped, voicesList);
      const chunks = splitTextIntoTtsChunks(text)
        .map((x) => x.trim())
        .filter(Boolean);
      for (let c = 0; c < chunks.length; c++) {
        const chunk = chunks[c];
        const u = new SpeechSynthesisUtterance(chunk);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang || lang;
        } else {
          u.lang = lang;
        }
        u.rate = 1;
        const isLast = idx === segments.length - 1 && c === chunks.length - 1;
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
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        /* ignore */
      }
      for (const u of utterances) {
        window.speechSynthesis.speak(u);
      }
    }
  } else {
    const enPool = buildEnglishVoicePool(voicesList, disabledVoiceKeys);
    let pick =
      enPool.length > 0 ? enPool[Math.floor(Math.random() * enPool.length)] : null;
    if (!pick && voicesList.length) {
      const allowed = voicesList.filter((v) => !disabledVoiceKeys?.has(stableVoiceKey(v)));
      if (allowed.length > 0) {
        pick = allowed[Math.floor(Math.random() * allowed.length)];
      }
    }
    const live = pick ? resolveVoiceFromLiveList(pick, voicesList) : null;
    const chunks = splitTextIntoTtsChunks(plain)
      .map((x) => x.trim())
      .filter(Boolean);
    if (chunks.length === 0) {
      if (!cancelled.current) {
        onComplete?.();
      }
      return;
    }
    /** @type {SpeechSynthesisUtterance[]} */
    const utterances = [];
    for (let ci = 0; ci < chunks.length; ci++) {
      const u = new SpeechSynthesisUtterance(chunks[ci]);
      if (live ?? pick) {
        const v = live ?? pick;
        u.voice = v;
        u.lang = v.lang || lang;
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
    if (!cancelled.current && utterances.length > 0) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        /* ignore */
      }
      for (const u of utterances) {
        window.speechSynthesis.speak(u);
      }
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
 * @param {{ chunkMaxChars?: number }} [options] smaller `chunkMaxChars` (e.g. 140) queues more short TTS utterances — helps weak connections / Chromium stalls.
 */
export function speakWithStableEnglishVoice(text, voicesList, lang, onComplete, disabledVoiceKeys, stableVoiceRef, options) {
  const plain = String(text ?? '').trim();
  if (!plain || typeof window === 'undefined' || !window.speechSynthesis) {
    onComplete?.();
    return;
  }

  window.speechSynthesis.cancel();

  let pick = stableVoiceRef.current;
  if (!pick) {
    const enPool = buildEnglishVoicePool(voicesList, disabledVoiceKeys);
    if (enPool.length > 0) {
      pick = enPool[Math.floor(Math.random() * enPool.length)];
    } else if (voicesList.length) {
      const allowed = voicesList.filter((v) => !disabledVoiceKeys?.has(stableVoiceKey(v)));
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

  const chunks = splitTextIntoTtsChunks(plain, chunkCap)
    .map((x) => x.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    onComplete?.();
    return;
  }
  const live = resolveVoiceFromLiveList(pick, voicesList);
  for (let ci = 0; ci < chunks.length; ci++) {
    const u = new SpeechSynthesisUtterance(chunks[ci]);
    const v = live ?? pick;
    if (v) {
      u.voice = v;
      u.lang = v.lang || lang;
    } else {
      u.lang = lang;
    }
    u.rate = 1;
    const isLast = ci === chunks.length - 1;
    if (isLast) {
      u.onend = () => onComplete?.();
      u.onerror = () => onComplete?.();
    }
    window.speechSynthesis.speak(u);
  }
}
