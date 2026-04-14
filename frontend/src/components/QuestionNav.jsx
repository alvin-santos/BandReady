import { Button } from 'react-bootstrap';

function hasCelpipTaskMeta(q) {
  if (!q || typeof q !== 'object') {
    return false;
  }
  if (q.celpip_task_number != null && q.celpip_task_number !== '') {
    return true;
  }
  const lab = q.celpip_task_label;
  return typeof lab === 'string' && lab.trim() !== '';
}

function buildNavGroups(questions) {
  const groups = new Map();
  questions.forEach((q, index) => {
    const meta = hasCelpipTaskMeta(q);
    const label = meta
      ? (typeof q.celpip_task_label === 'string' && q.celpip_task_label.trim() !== ''
          ? q.celpip_task_label.trim()
          : `Task ${q.celpip_task_number}`)
      : 'Other';
    const taskNum =
      meta && q.celpip_task_number != null && q.celpip_task_number !== ''
        ? Number(q.celpip_task_number)
        : 10000;
    const key = meta ? `${taskNum}::${label}` : '__other__';
    if (!groups.has(key)) {
      groups.set(key, { taskNum, label, indices: [] });
    }
    groups.get(key).indices.push(index);
  });
  return [...groups.values()].sort((a, b) => {
    const minA = Math.min(...a.indices);
    const minB = Math.min(...b.indices);
    if (minA !== minB) {
      return minA - minB;
    }
    if (a.taskNum !== b.taskNum) {
      return a.taskNum - b.taskNum;
    }
    return a.label.localeCompare(b.label);
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
}) {
  const useTree =
    Array.isArray(questions) &&
    questions.length > 0 &&
    questions.some((q) => hasCelpipTaskMeta(q));

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

  const groups = buildNavGroups(questions);
  return (
    <div className="br-question-nav-tree">
      {groups.map((g) => (
        <div key={`${g.taskNum}-${g.label}`} className="br-question-nav-group mb-3">
          <div className="br-question-nav-group-label">{g.label}</div>
          <div className="d-flex flex-wrap gap-2">
            {g.indices.map((i, posInGroup) => renderBtn(i, posInGroup + 1))}
          </div>
        </div>
      ))}
    </div>
  );
}
