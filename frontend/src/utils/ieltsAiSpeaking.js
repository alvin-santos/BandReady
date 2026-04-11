/** Normalize DB/API `options_json` (object, JSON string, or camelCase alias). */
function readOptionsJson(question) {
  const raw = question?.options_json ?? question?.optionsJson;
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw;
  }
  return null;
}

/** IELTS Speaking: OpenAI-driven mock interview (single question, Parts 1–3). */
export function isIeltsAiSpeakingQuestion(question) {
  const opts = readOptionsJson(question);
  const mode = opts?.ielts_speaking?.mode;
  if (typeof mode !== 'string') {
    return false;
  }
  return mode.trim().toLowerCase() === 'ai_conversation';
}

/**
 * Picture-style speaking (e.g. CELPIP describe-the-image): passage_text is often a scene summary
 * that duplicates the image — hide it on the exam UI so learners are not spoon-fed the answer.
 */
export function isSpeakingPictureTaskQuestion(question) {
  if (question?.type !== 'speaking_prompt') {
    return false;
  }
  if (isIeltsAiSpeakingQuestion(question)) {
    return false;
  }
  const opts = readOptionsJson(question);
  const sp = opts?.speaking;
  if (sp != null && typeof sp === 'object') {
    return true;
  }
  const img = question?.image_url ?? question?.imageUrl;
  return typeof img === 'string' && img.trim() !== '';
}

export function serializeIeltsAiTranscript(exchanges) {
  return JSON.stringify({ version: 1, exchanges });
}

export function parseIeltsAiTranscript(raw) {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  try {
    const j = JSON.parse(raw);
    if (j?.version === 1 && Array.isArray(j.exchanges)) {
      return j.exchanges.filter(
        (e) => e && typeof e === 'object' && (e.role === 'examiner' || e.role === 'candidate') && typeof e.text === 'string'
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function formatIeltsAiTranscriptForDisplay(raw) {
  const ex = parseIeltsAiTranscript(raw);
  if (ex.length === 0) {
    return raw || '';
  }
  return ex
    .map((e) => {
      const label = e.role === 'candidate' ? 'You' : 'Examiner';
      return `${label}: ${e.text}`;
    })
    .join('\n\n');
}
