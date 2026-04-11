/** Prep marker sent to the API after Part 2 note-taking (must match IeltsAiSpeakingInterview). */
export const IELTS_AI_PREP_MARKER = '[PREPARATION_TIME_COMPLETE]';

/**
 * Human-readable phase for the IELTS AI interview UI.
 * @param {{ part?: number, awaiting?: string|null, prepLeft?: number|null, interviewComplete?: boolean, hasStarted?: boolean }} s
 */
export function getInterviewProgressLabel(s) {
  const { part = 1, awaiting, prepLeft, interviewComplete, hasStarted } = s;
  if (interviewComplete) {
    return { key: 'done', short: 'Complete', full: 'Interview complete' };
  }
  if (!hasStarted) {
    return { key: 'ready', short: 'Ready', full: 'Ready to begin' };
  }
  if (awaiting === 'silent_prep' || (prepLeft != null && prepLeft > 0)) {
    return { key: 'p2prep', short: 'Part 2 prep', full: 'Part 2 — preparation' };
  }
  if (awaiting === 'candidate_long') {
    return { key: 'p2long', short: 'Part 2 long', full: 'Part 2 — long turn' };
  }
  if (typeof part === 'number' && part >= 3) {
    return { key: 'p3', short: 'Part 3', full: 'Part 3 — discussion' };
  }
  return { key: 'p1', short: 'Part 1', full: 'Part 1 — short answers' };
}

/**
 * @param {Array<{ role: string, text: string }>} exchanges
 * @param {number} speakingMs cumulative active recording time
 */
export function computeInterviewSessionStats(exchanges, speakingMs) {
  const candidates = (exchanges || []).filter(
    (e) => e && e.role === 'candidate' && typeof e.text === 'string' && e.text.trim() !== IELTS_AI_PREP_MARKER
  );
  const turns = candidates.length;
  const words = candidates.reduce((sum, e) => {
    const n = e.text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    return sum + n;
  }, 0);
  const sec = Math.round(speakingMs / 1000);
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  const speakingLabel = `${mm}:${String(ss).padStart(2, '0')}`;
  return { turns, words, speakingMs, speakingLabel };
}
