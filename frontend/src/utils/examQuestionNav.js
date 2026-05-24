import { CELPIP_SECTION_TASKS } from '../data/celpipOfficialTasks.js';

/**
 * @param {Record<string, unknown> | null | undefined} q
 * @param {string | undefined} sectionName
 */
function celpipNavGroupKey(q, sectionName) {
  if (!q || typeof q !== 'object') {
    return '_ungrouped';
  }
  if (q.celpip_task_number != null && q.celpip_task_number !== '') {
    const n = Math.trunc(Number(q.celpip_task_number));
    if (Number.isFinite(n) && n >= 1) {
      return String(n);
    }
  }
  const sec = sectionName && CELPIP_SECTION_TASKS[sectionName];
  const lab = typeof q.celpip_task_label === 'string' ? q.celpip_task_label.trim() : '';
  if (sec && lab) {
    const lower = lab.toLowerCase();
    const hit = sec.find((t) => t.label.toLowerCase() === lower);
    if (hit) {
      return String(hit.id);
    }
  }
  return '_ungrouped';
}

function usesCelpipTaskTree(questions, sectionName) {
  const list = Array.isArray(questions) ? questions : [];
  return list.length > 0 && list.some((q) => celpipNavGroupKey(q, sectionName) !== '_ungrouped');
}

/**
 * @param {Record<string, unknown>[] | null | undefined} questions
 * @param {string | undefined} sectionName
 */
export function buildExamNavGroups(questions, sectionName) {
  const list = Array.isArray(questions) ? questions : [];
  const groups = new Map();
  list.forEach((q, index) => {
    const key = celpipNavGroupKey(q, sectionName);
    if (!groups.has(key)) {
      groups.set(key, { taskKey: key, indices: [] });
    }
    groups.get(key).indices.push(index);
  });
  for (const g of groups.values()) {
    g.indices.sort((a, b) => a - b);
  }
  const resolveCelpipGroupLabel = (taskKey, sampleQuestion) => {
    if (taskKey === '_ungrouped') {
      return 'Other';
    }
    const n = Number(taskKey);
    const sec = sectionName && CELPIP_SECTION_TASKS[sectionName];
    const official = Array.isArray(sec) ? sec.find((t) => t.id === n) : undefined;
    if (official) {
      return official.label;
    }
    const lab = sampleQuestion?.celpip_task_label;
    if (typeof lab === 'string' && lab.trim()) {
      return lab.trim();
    }
    return `Task ${taskKey}`;
  };
  for (const g of groups.values()) {
    const first = list[g.indices[0]];
    g.label = resolveCelpipGroupLabel(g.taskKey, first);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.taskKey === '_ungrouped') {
      return 1;
    }
    if (b.taskKey === '_ungrouped') {
      return -1;
    }
    const na = Number(a.taskKey);
    const nb = Number(b.taskKey);
    if (na !== nb) {
      return na - nb;
    }
    return Math.min(...a.indices) - Math.min(...b.indices);
  });
}

/**
 * First question in official CELPIP part order (Correspondence → …), not raw array index 0.
 * @param {Record<string, unknown>[]} questions
 * @param {string | undefined} sectionName
 */
export function getInitialQuestionIndex(questions, sectionName) {
  const list = Array.isArray(questions) ? questions : [];
  if (!list.length) {
    return 0;
  }
  if (!usesCelpipTaskTree(list, sectionName)) {
    return 0;
  }
  const groups = buildExamNavGroups(list, sectionName);
  return groups[0]?.indices[0] ?? 0;
}

/**
 * Next index: same CELPIP part first (Q1→Q2 within Correspondence), then first item of the next part.
 * @param {Record<string, unknown>[]} questions
 * @param {string | undefined} sectionName
 * @param {number} current
 */
export function getNextQuestionIndex(questions, sectionName, current) {
  const list = Array.isArray(questions) ? questions : [];
  if (!list.length || current >= list.length - 1) {
    return current;
  }
  if (!usesCelpipTaskTree(list, sectionName)) {
    return current + 1;
  }
  const groups = buildExamNavGroups(list, sectionName);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const pos = g.indices.indexOf(current);
    if (pos < 0) {
      continue;
    }
    if (pos < g.indices.length - 1) {
      return g.indices[pos + 1];
    }
    if (gi < groups.length - 1) {
      return groups[gi + 1].indices[0];
    }
    return current;
  }
  return current + 1;
}

/**
 * @param {Record<string, unknown>[]} questions
 * @param {string | undefined} sectionName
 * @param {number} current
 */
export function getPrevQuestionIndex(questions, sectionName, current) {
  const list = Array.isArray(questions) ? questions : [];
  if (!list.length || current <= 0) {
    return 0;
  }
  if (!usesCelpipTaskTree(list, sectionName)) {
    return current - 1;
  }
  const groups = buildExamNavGroups(list, sectionName);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const pos = g.indices.indexOf(current);
    if (pos < 0) {
      continue;
    }
    if (pos > 0) {
      return g.indices[pos - 1];
    }
    if (gi > 0) {
      const prev = groups[gi - 1];
      return prev.indices[prev.indices.length - 1];
    }
    return current;
  }
  return current - 1;
}
