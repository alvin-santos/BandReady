/**
 * Browser TTS helpers: dialogue lines like "Customer: Hello" are split into
 * spoken segments; role labels are stripped everywhere in spoken text (not only at
 * script start). Voices are limited to neutral exam-style
 * English (US/UK/AU/CA/NZ/IE), not child/novelty or South Asian English engines.
 */

/** Label before ":" must be at least 2 chars (avoids "A: Paris" MCQ lines). */
const SPEAKER_LINE =
  /^\s*([A-Za-z\u00C0-\u017F][A-Za-z\u00C0-\u017F0-9\s'.-]{1,58})[:：]\s*(.+)$/;

/**
 * Join role labels split across two lines (e.g. model output `Store\nClerk: Hi`) so TTS sees one speaker line.
 * Without this, "Store" is appended to the previous speaker's text and "Clerk" starts late after a long first utterance.
 *
 * @param {string} body
 * @returns {string}
 */
function mergeSplitSpeakerLabelLines(body) {
  const rawLines = body.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      continue;
    }
    if (i + 1 < rawLines.length) {
      const next = rawLines[i + 1].trim();
      if (next) {
        const combined = `${line} ${next}`.trim();
        const looksRoleFragment =
          !line.includes(':') &&
          next.includes(':') &&
          line.length <= 48 &&
          /^[A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'.-]+(?:\s+[A-Z\u00C0-\u017F][a-zA-Z\u00C0-\u017F'.-]+){0,2}$/.test(line);
        const badLead =
          /^(Yes|No|Oh|Hi|Hey|Um|Er|Ah|Ok|Okay|So|Well|Then|When|What|Why|How|Here|There|Thank|Please|Later|This|That)\b/i.test(
            line
          );
        if (looksRoleFragment && !badLead && SPEAKER_LINE.test(combined)) {
          out.push(combined);
          i += 1;
          continue;
        }
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Common dialogue labels (listening scripts). Stripped when followed by : or fullwidth ：.
 * Keep explicit list so we do not eat stems like "Question 3: What…".
 */
const DIALOGUE_ROLE_ALTERNATION = [
  'Customer',
  'Client',
  'Resident',
  'Project Manager',
  'Agent',
  'Sales Agent',
  'Sales Representative',
  'Sales Manager',
  'Sales Consultant',
  'Sales Engineer',
  'Sales Analyst',
  'Sales Director',
  'Receptionist',
  'Contractor',
  'Manager',
  'Homeowner',
  'Landlord',
  'Tenant',
  'Property Manager',
  'Real Estate Agent',
  'Realtor',
  'Real Estate Broker',
  'Real Estate Consultant',
  'Real Estate Lawyer',
  'Real Estate Appraiser',
  'Clerk',
  'Cashier',
  'Speaker',
  'Announcer',
  'Reporter',
  'Journalist',
  'News Anchor',
  'News Reporter',
  'News Anchor',
  'Presenter',
  'Host',
  'Co-?host',
  'Caller',
  'Callee',
  'Patient',
  'Doctor',
  'Surgeon',
  'Cardiologist',
  'Dermatologist',
  'Endocrinologist',
  'Gastroenterologist',
  'Hematologist',
  'Neurologist',
  'Oncologist',
  'Ophthalmologist',
  'Orthopedist',
  'Pediatrician',
  'Psychiatrist',
  'Pulmonologist',
  'Rheumatologist',
  'Urologist',
  'Vascular Surgeon',
  'General Practitioner',
  'Family Physician',
  'Internal Medicine Specialist',
  'Pediatrician',
  'Adolescent Medicine Specialist',
  'Obstetrician',
  'Gynecologist',
  'Obstetrician',
  'Gynecologist',
  'Obstetrician',
  'Nurse',
  'Pharmacist',
  'Dentist',
  'Manager',
  'Assistant',
  'Supervisor',
  'Officer',
  'Police Officer',
  'Student',
  'Student',
  'Teacher',
  'Principal',
  'Librarian',
  'Tourist',
  'Tour Guide',
  'Local',
  'Employee',
  'Passenger',
  'Agent\\s*Smith',
].join('|');

/** Leading role + colon only (fast path). */
const DIALOGUE_ROLE_PREFIX = new RegExp(
  '^\\s*(?:' + DIALOGUE_ROLE_ALTERNATION + ')\\s*[:：]\\s*',
  'i'
);



/**
 * Role + colon after start-of-string, newline, or whitespace — strips every utterance chunk, not just script start.
 * Repeat application catches "Customer: … Agent: …" in one string.
 */
const DIALOGUE_ROLE_AFTER_BREAK = new RegExp(
  '(?:^|[\\s\\u00A0]+)(?:' + DIALOGUE_ROLE_ALTERNATION + ')\\s*[:：]\\s*',
  'gi'
);

/**
 * @param {string | null} initialSpeaker lowercased label or null
 * @param {string} text raw text (may include " Agent: …" turns)
 * @returns {DialogueSegment[]}
 */
function expandOneSegmentByInlineRoles(initialSpeaker, text) {
  const t = String(text || '').trim();
  if (!t) {
    return [];
  }
  const re = new RegExp('\\s+(' + DIALOGUE_ROLE_ALTERNATION + ')\\s*[:：]\\s*', 'gi');
  const matches = [...t.matchAll(re)];
  if (matches.length === 0) {
    return [{ speaker: initialSpeaker, text: t }];
  }
  /** @type {DialogueSegment[]} */
  const parts = [];
  let pos = 0;
  let speaker = initialSpeaker;
  for (let i = 0; i <= matches.length; i++) {
    const end = i < matches.length ? Number(matches[i].index) : t.length;
    const chunk = t.slice(pos, end).trim();
    if (chunk) {
      parts.push({ speaker, text: chunk });
    }
    if (i < matches.length) {
      const m = matches[i];
      speaker = m[1].trim().replace(/\s+/g, ' ').toLowerCase();
      pos = Number(m.index) + m[0].length;
    }
  }
  return parts.length > 0 ? parts : [{ speaker: initialSpeaker, text: t }];
}

/**
 * Break merged lines into per-role segments so each role can use a different TTS voice.
 * @param {DialogueSegment[]} segments
 * @returns {DialogueSegment[]}
 */
function expandSegmentsWithInlineRoleBoundaries(segments) {
  /** @type {DialogueSegment[]} */
  const result = [];
  for (const seg of segments) {
    const raw = seg.text?.trim();
    if (!raw) {
      continue;
    }
    if (seg.speaker) {
      result.push(...expandOneSegmentByInlineRoles(seg.speaker, raw));
    } else {
      const lead = raw.match(new RegExp('^(' + DIALOGUE_ROLE_ALTERNATION + ')\\s*[:：]\\s*', 'i'));
      if (lead) {
        const sp = lead[1].trim().replace(/\s+/g, ' ').toLowerCase();
        const rest = raw.slice(lead[0].length).trim();
        result.push(...expandOneSegmentByInlineRoles(sp, rest));
      } else {
        result.push(seg);
      }
    }
  }
  return result;
}

/**
 * Remove all dialogue role labels from text that will be spoken (anywhere in the string).
 * @param {string} text
 * @returns {string}
 */
function stripAllDialogueRoleLabelsFromSpokenText(text) {
  let t = String(text || '')
    .replace(/\uFF1A/g, ':')
    .trim();
  let prev;
  do {
    prev = t;
    t = t.replace(DIALOGUE_ROLE_AFTER_BREAK, ' ');
    t = t.replace(DIALOGUE_ROLE_PREFIX, '');
    t = t.replace(/\s+/g, ' ').trim();
  } while (t !== prev);
  return t;
}

/**
 * Chromium/Edge speech often inserts a very long pause (or appears stuck) after `!` or `..` inside one utterance.
 * Light-touch fixes for **spoken** text only — keeps meaning, shortens unnatural silences.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeSpeechFragmentForBrowserTts(text) {
  let s = String(text || '').trim();
  if (!s) {
    return '';
  }
  s = s.replace(/\uFF1A/g, ':');
  // Trailing ellipses / repeated periods from scripts → single period (avoids odd engine timing)
  s = s.replace(/\.{2,}/g, '.');
  // Mid-sentence `!` then more speech → comma (much shorter pause than exclamation in many engines)
  s = s.replace(/!\s+(?=\S)/g, ', ');
  // Same for `?` when clearly continuing ("Really? I think…")
  s = s.replace(/\?\s+(?=[A-Za-z])/g, ', ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Heuristic: engine voice names often include these tokens (not exhaustive). */
const FEMALE_HINT =
  /\b(female|woman|zira|samantha|karen|susan|victoria|moira|fiona|serena|aria|jenny|linda|hazel|sonia|martha|katya|polly|joanna|amy|emma|olivia|ivy|megan|abbi|libby|hollie|natasha|tessa|siri|flo)\b/i;
const MALE_HINT =
  /\b(male|man|guy|david|mark|fred|daniel|james|richard|george|oliver|thomas|arthur|tony|ted|brian|ryan|alex\s|steven|john\s|paul\s|matt\s|jorge|diego|carlos)\b/i;

/**
 * Trim and strip a single leading "Narrator:" prefix (legacy scripts).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function preprocessScript(raw) {
  let body = String(raw ?? '')
    .trim()
    .replace(/\uFF1A/g, ':')
    .replace(/^\s*narrator\s*:\s*/i, '')
    .trim();
  body = mergeSplitSpeakerLabelLines(body);
  return body;
}

/**
 * True when the script uses dialogue labels with a colon (per line or inline), not plain narration only.
 * @param {string} body preprocessed script body
 */
export function scriptHasDialogueMarkup(body) {
  const text = String(body ?? '').trim();
  if (!text) {
    return false;
  }
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (SPEAKER_LINE.test(trimmed)) {
      return true;
    }
  }
  const inlineRole = new RegExp('(?:' + DIALOGUE_ROLE_ALTERNATION + ')\\s*[:：]\\s*\\S', 'i');
  return inlineRole.test(text);
}

/**
 * @typedef {{ speaker: string | null, text: string }} DialogueSegment
 * @param {string} body preprocessed script (see {@link preprocessScript})
 * @returns {DialogueSegment[]}
 */
function parseDialogueUtterancesFromBody(body) {
  if (!body) {
    return [];
  }
  const lines = body.split(/\r?\n/);
  /** @type {DialogueSegment[]} */
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const m = trimmed.match(SPEAKER_LINE);
    if (m) {
      const label = m[1].trim().replace(/\s+/g, ' ');
      const content = m[2].trim();
      if (!content) {
        continue;
      }
      out.push({ speaker: label.toLowerCase(), text: content });
    } else if (out.length > 0) {
      if (trimmed) {
        out[out.length - 1].text += ` ${trimmed}`;
      }
    } else {
      if (trimmed) {
        out.push({ speaker: null, text: trimmed });
      }
    }
  }
  const expanded = expandSegmentsWithInlineRoleBoundaries(out);
  return expanded
    .map((s) => ({
      speaker: s.speaker,
      text: normalizeSpeechFragmentForBrowserTts(stripAllDialogueRoleLabelsFromSpokenText(s.text)),
    }))
    .filter((s) => s.text.trim().length > 0);
}

/**
 * @param {string} script
 * @returns {DialogueSegment[]}
 */
export function parseDialogueUtterances(script) {
  return parseDialogueUtterancesFromBody(preprocessScript(script));
}

/**
 * Plain narration (no `Speaker:` lines) is read as one clip; dialogue scripts use role voices.
 * @param {string} script
 * @returns {DialogueSegment[]}
 */
export function parseScriptForTts(script) {
  const body = preprocessScript(script);
  if (!body) {
    return [];
  }
  if (!scriptHasDialogueMarkup(body)) {
    const stripped = body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^narrator$/i.test(l))
      .join(' ')
      .trim();
    const text = normalizeSpeechFragmentForBrowserTts(stripped);
    return text ? [{ speaker: null, text }] : [];
  }
  return parseDialogueUtterancesFromBody(body);
}

/**
 * All spoken words only (no role names), for single-voice fallback and empty checks.
 * @param {string} script
 * @returns {string}
 */
export function spokenPlainTextFromScript(script) {
  return parseScriptForTts(script)
    .map((s) => s.text)
    .join(' ')
    .trim();
}

/**
 * Insert line breaks before each inline speaker label so one role per line (admin UI / previews).
 * Uses the same role names as dialogue parsing. Does not change the string passed to TTS unless you replace the source.
 *
 * @param {string | null | undefined} script
 * @returns {string}
 */
export function formatAudioScriptForDisplay(script) {
  let t = String(script ?? '')
    .trim()
    .replace(/\r\n/g, '\n');
  if (!t) {
    return '';
  }
  const re = new RegExp('([^\\n])\\s+(?=(?:' + DIALOGUE_ROLE_ALTERNATION + ')\\s*[:：])', 'gi');
  t = t.replace(re, '$1\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * @param {SpeechSynthesisVoice} voice
 * @returns {'female' | 'male' | 'unknown'}
 */
export function classifyVoiceGender(voice) {
  const n = `${voice.name || ''} ${voice.voiceURI || ''}`;
  if (FEMALE_HINT.test(n)) {
    return 'female';
  }
  if (MALE_HINT.test(n)) {
    return 'male';
  }
  return 'unknown';
}

/** Stable id for blocklist (same browser = same key). */
export function stableVoiceKey(v) {
  return v.voiceURI || `${v.name}|${v.lang}`;
}

function filterVoiceBlocklist(voices, disabledKeys) {
  if (!disabledKeys || disabledKeys.size === 0) {
    return voices;
  }
  return voices.filter((v) => !disabledKeys.has(stableVoiceKey(v)));
}

/** US / UK / AU / CA / NZ / IE only — avoids en-IN, en-SG, etc. Plain `en` allowed (browser default). */
const ALLOWED_EN_REGION = new Set(['us', 'gb', 'uk', 'au', 'ca', 'nz', 'ie']);

function normalizeLangTag(lang) {
  return String(lang || '')
    .toLowerCase()
    .replace(/_/g, '-')
    .trim();
}

/**
 * @param {string} lang BCP-47
 */
export function isExamStyleEnglishLocale(lang) {
  const raw = normalizeLangTag(lang);
  if (!raw.startsWith('en')) {
    return false;
  }
  if (raw === 'en') {
    return true;
  }
  const sub = raw.slice(2);
  if (!sub.startsWith('-')) {
    return false;
  }
  const rest = sub.slice(1);
  const region = rest.split('-')[0];
  if (region === 'gb' || region === 'uk') {
    return true;
  }
  return ALLOWED_EN_REGION.has(region);
}

/** Child / novelty / mascot voices. */
const VOICE_NAME_EXCLUDE =
  /\b(child|children|kid|kids|baby|infant|toddler|chipmunk|whisper|zombie|alien|novelty|squeak|cartoon|mascot|storytime|bedtime|fairy|goblin|pirate\s*parrot)\b/i;

/** Indian / South Asian branded English engines (often not “neutral exam” English). */
const VOICE_NAME_INDIAN_OR_SA_EXCLUDE =
  /\b(india|indian|hindi|hindu|bengali|gujarati|tamil|telugu|telegu|malayalam|kannada|punjabi|urdu|sinhala|hinglish|desi|namaste|devanagari|bollywood|srilanka|srilankan|bangladesh|pakistan|nepal|en-in|english\s*\(?india\)?|\(india\)|india\s*english|bharat)\b/i;

/**
 * @param {SpeechSynthesisVoice} v
 */
export function isExamStyleEnglishVoice(v) {
  if (!isExamStyleEnglishLocale(v.lang)) {
    return false;
  }
  const blob = `${v.name || ''} ${v.voiceURI || ''}`;
  if (VOICE_NAME_EXCLUDE.test(blob) || VOICE_NAME_INDIAN_OR_SA_EXCLUDE.test(blob)) {
    return false;
  }
  return true;
}

/** If strict allowlist yields nothing, allow other `en-*` except these regions + name filters. */
const FALLBACK_BLOCKED_REGIONS = new Set(['in', 'bd', 'pk', 'lk', 'np', 'sg', 'ph', 'my', 'hk', 'id']);

function buildFallbackEnglishPool(allVoices) {
  const out = [];
  const seen = new Set();
  for (const v of allVoices) {
    const raw = normalizeLangTag(v.lang);
    if (!raw.startsWith('en')) {
      continue;
    }
    if (raw !== 'en' && raw.startsWith('en-')) {
      const region = raw.slice(3).split('-')[0];
      if (FALLBACK_BLOCKED_REGIONS.has(region)) {
        continue;
      }
    }
    const blob = `${v.name || ''} ${v.voiceURI || ''}`;
    if (VOICE_NAME_EXCLUDE.test(blob) || VOICE_NAME_INDIAN_OR_SA_EXCLUDE.test(blob)) {
      continue;
    }
    const key = stableVoiceKey(v);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * English voices for exam-style listening: prefer US/UK/AU/CA/NZ/IE; otherwise any en-* except
 * South Asian locales, still excluding child/novelty/Indian-branded names.
 * @param {SpeechSynthesisVoice[]} allVoices
 * @param {Set<string>} [disabledKeys] admin blocklist (stableVoiceKey)
 * @returns {SpeechSynthesisVoice[]}
 */
export function buildEnglishVoicePool(allVoices, disabledKeys) {
  const out = [];
  const seen = new Set();
  for (const v of allVoices) {
    if (!isExamStyleEnglishVoice(v)) {
      continue;
    }
    const key = stableVoiceKey(v);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(v);
  }
  let result = out.length > 0 ? out : buildFallbackEnglishPool(allVoices);
  return filterVoiceBlocklist(result, disabledKeys);
}

/**
 * Pool for multi-speaker dialogue: at least `minVoices` distinct English voices when possible.
 * Widens beyond strict exam-style if the device only exposes one such voice (common on Windows).
 *
 * @param {SpeechSynthesisVoice[]} allVoices
 * @param {Set<string>} [disabledKeys]
 * @param {number} [minVoices=2]
 * @returns {SpeechSynthesisVoice[]}
 */
export function buildDialogueVoicePool(allVoices, disabledKeys, minVoices = 2) {
  const base = buildEnglishVoicePool(allVoices, disabledKeys);
  if (base.length >= minVoices) {
    return base;
  }
  const seen = new Set(base.map((v) => stableVoiceKey(v)));
  const pool = [...base];
  const addFrom = (candidates) => {
    for (const v of candidates) {
      if (disabledKeys?.has(stableVoiceKey(v))) {
        continue;
      }
      const k = stableVoiceKey(v);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      pool.push(v);
      if (pool.length >= minVoices) {
        return;
      }
    }
  };
  addFrom(buildFallbackEnglishPool(allVoices));
  if (pool.length < minVoices) {
    for (const v of allVoices) {
      if (disabledKeys?.has(stableVoiceKey(v))) {
        continue;
      }
      if (!normalizeLangTag(v.lang).startsWith('en')) {
        continue;
      }
      const k = stableVoiceKey(v);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      pool.push(v);
      if (pool.length >= minVoices) {
        break;
      }
    }
  }
  return pool;
}

function shuffleVoices(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {SpeechSynthesisVoice[]} allVoices
 * @param {string} lang e.g. en-US
 * @param {number} wantCount
 * @returns {SpeechSynthesisVoice[]}
 */
export function pickDistinctVoices(allVoices, lang, wantCount, disabledKeys) {
  const pool = buildEnglishVoicePool(allVoices, disabledKeys);
  if (pool.length > 0) {
    return shuffleVoices(pool).slice(0, wantCount);
  }
  const primary = lang.split('-')[0].toLowerCase();
  const fallback = allVoices.filter((v) => {
    const l = (v.lang || '').toLowerCase();
    return l === primary || l.startsWith(`${primary}-`);
  });
  const base = fallback.length > 0 ? fallback : allVoices;
  const out = [];
  const seen = new Set();
  for (const v of base) {
    const key = stableVoiceKey(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
      if (out.length >= wantCount) {
        break;
      }
    }
  }
  return out;
}

/**
 * Map each dialogue role to a distinct voice when the pool allows it.
 * @param {DialogueSegment[]} segments
 * @param {SpeechSynthesisVoice[]} allVoices
 * @param {string} preferredLang fallback e.g. en-US
 * @param {Set<string>} [disabledKeys]
 * @param {SpeechSynthesisVoice[]} [poolOverride] from buildDialogueVoicePool (wider than exam-only)
 * @returns {Map<string, SpeechSynthesisVoice | null>}
 */
export function mapSpeakersToVoices(
  segments,
  allVoices,
  preferredLang = 'en-US',
  disabledKeys,
  poolOverride
) {
  const keys = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
  const map = new Map();
  const rawPool = poolOverride ?? buildEnglishVoicePool(allVoices, disabledKeys);
  const pool = shuffleVoices([...rawPool]);

  if (keys.length === 0) {
    map.set('__default__', pool[0] ?? null);
    return map;
  }

  if (pool.length === 0) {
    keys.forEach((k) => map.set(k, null));
    map.set('__default__', null);
    return map;
  }

  keys.forEach((k, i) => {
    map.set(k, pool[i % pool.length] ?? null);
  });
  map.set('__default__', map.get(keys[0]) ?? pool[0] ?? null);
  return map;
}
