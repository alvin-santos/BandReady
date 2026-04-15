/**
 * Parses AI plan text into day blocks and optional final section.
 * @param {string} text
 * @returns {{ days: Array<{ day: number, tasks: string[], tip: string }>, finalSection: string | null }}
 */
export function parseStudyPlanText(text) {
  if (!text || typeof text !== 'string') {
    return { days: [], finalSection: null };
  }
  const lines = text.split(/\r?\n/);
  /** @type {Array<{ day: number, tasks: string[], tip: string }>} */
  const days = [];
  let finalSection = null;
  /** @type {{ day: number, tasks: string[], tip: string } | null} */
  let current = null;
  let inFinal = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!inFinal && /^final\s+section\s*:/i.test(trimmed)) {
      inFinal = true;
      current = null;
      finalSection = '';
      continue;
    }
    if (inFinal) {
      finalSection += (finalSection ? '\n' : '') + line;
      continue;
    }
    const dayMatch = trimmed.match(/^day\s+(\d+)\s*:?\s*$/i);
    if (dayMatch) {
      current = { day: parseInt(dayMatch[1], 10), tasks: [], tip: '' };
      days.push(current);
      continue;
    }
    if (!current) continue;
    if (/^\*\s+/.test(trimmed)) {
      current.tasks.push(trimmed.replace(/^\*\s+/, '').trim());
      continue;
    }
    if (/^Tip:\s*/i.test(trimmed)) {
      current.tip = trimmed.replace(/^Tip:\s*/i, '').trim();
    }
  }

  const byDay = new Map();
  for (const d of days) {
    byDay.set(d.day, d);
  }
  const merged = [...byDay.values()].sort((a, b) => a.day - b.day);

  return {
    days: merged,
    finalSection: finalSection && finalSection.trim() ? finalSection.trim() : null,
  };
}
