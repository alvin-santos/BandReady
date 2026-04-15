import { Button } from 'react-bootstrap';
import { CELPIP_SECTION_TASKS } from '../data/celpipOfficialTasks.js';

/**
 * Same bucket as backend {@see CelpipTestQuestionLimits::effectiveCelpipTaskGroupKey} — task id string or `_ungrouped`.
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

/**
 * @param {string | undefined} sectionName
 * @param {string} taskKey
 * @param {Record<string, unknown> | undefined} sampleQuestion
 */
function resolveCelpipGroupLabel(sectionName, taskKey, sampleQuestion) {
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
}

/**
 * @param {Record<string, unknown>[] | null | undefined} questions
 * @param {string | undefined} sectionName
 */
function buildNavGroups(questions, sectionName) {
  const groups = new Map();
  questions.forEach((q, index) => {
    const key = celpipNavGroupKey(q, sectionName);
    if (!groups.has(key)) {
      groups.set(key, { taskKey: key, indices: [] });
    }
    groups.get(key).indices.push(index);
  });
  for (const g of groups.values()) {
    const first = questions[g.indices[0]];
    g.label = resolveCelpipGroupLabel(sectionName, g.taskKey, first);
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
    const minA = Math.min(...a.indices);
    const minB = Math.min(...b.indices);
    return minA - minB;
  });
}

export default function QuestionNav({
  total,
  current,
  onSelect,
  answeredSet,
  minSelectableIndex = 0,
  selectionDisabled = false,
  questions = null,
  /** Matches test section name (e.g. `Listening`) for official CELPIP task titles. */
  sectionName = '',
}) {
  const list = Array.isArray(questions) ? questions : [];
  const useTree =
    list.length > 0 && list.some((q) => celpipNavGroupKey(q, sectionName) !== '_ungrouped');

  /**
   * @param {number} i Global question index in this attempt (0-based).
   * @param {number | null} displayNumber Label inside the button; defaults to global 1-based (i + 1).
   */
  const renderBtn = (i, displayNumber = null) => {
    const globalNum = i + 1;
    const label = displayNumber != null ? displayNumber : globalNum;
    const locked = i < minSelectableIndex || selectionDisabled;
    const cls = ['br-nav-grid-btn position-relative'];
    if (i === current) {
      cls.push('active');
    }
    if (answeredSet?.has(globalNum)) {
      cls.push('answered');
    }
    if (locked) {
      cls.push('opacity-50');
    }
    return (
      <Button
        key={`q-${i}`}
        variant="light"
        className={cls.join(' ')}
        disabled={locked}
        title={
          i < minSelectableIndex
            ? 'Earlier questions are locked in forward-only mode'
            : selectionDisabled
              ? 'Wait until the listening clip finishes or is stopped'
              : undefined
        }
        onClick={() => {
          if (!locked) {
            onSelect(i);
          }
        }}
      >
        {label}
      </Button>
    );
  };

  if (!useTree) {
    return (
      <div className="d-flex flex-wrap gap-2">
        {Array.from({ length: total }, (_, i) => renderBtn(i))}
      </div>
    );
  }

  const groups = buildNavGroups(list, sectionName);
  return (
    <div className="br-question-nav-tree">
      {groups.map((g) => (
        <div key={g.taskKey} className="br-question-nav-group mb-3">
          <div className="br-question-nav-group-label">{g.label}</div>
          <div className="d-flex flex-wrap gap-2">
            {g.indices.map((i, posInGroup) => renderBtn(i, posInGroup + 1))}
          </div>
        </div>
      ))}
    </div>
  );
}
