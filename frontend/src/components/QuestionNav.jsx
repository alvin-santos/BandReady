import { Button } from 'react-bootstrap';
import { buildExamNavGroups } from '../utils/examQuestionNav.js';

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
  const groups = list.length > 0 ? buildExamNavGroups(list, sectionName) : [];
  const useTree = groups.some((g) => g.taskKey !== '_ungrouped');

  /**
   * @param {number} i Global question index in this attempt (0-based).
   * @param {number | null} displayLabel Button text (per-part 1, 2, 3… in CELPIP tree; else global).
   * @param {string | null} partHint CELPIP part name for tooltip.
   */
  const renderBtn = (i, displayLabel = null, partHint = null) => {
    const globalNum = i + 1;
    const label = displayLabel != null ? displayLabel : globalNum;
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
          partHint
            ? `${partHint}, item ${label} (overall ${globalNum} of ${total})`
            : i < minSelectableIndex
              ? 'Earlier questions are locked in forward-only mode'
              : selectionDisabled
                ? 'Wait until the listening clip finishes or is stopped'
                : `Question ${globalNum} of ${total}`
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

  return (
    <div className="br-question-nav-tree">
      {groups.map((g) => (
        <div key={g.taskKey} className="br-question-nav-group mb-3">
          <div className="br-question-nav-group-label">{g.label}</div>
          <div className="d-flex flex-wrap gap-2">
            {g.indices.map((i, posInGroup) => renderBtn(i, posInGroup + 1, g.label))}
          </div>
        </div>
      ))}
    </div>
  );
}
