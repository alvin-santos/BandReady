import { Button } from 'react-bootstrap';

export default function QuestionNav({
  total,
  current,
  onSelect,
  answeredSet,
  minSelectableIndex = 0,
  selectionDisabled = false,
}) {
  const items = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="d-flex flex-wrap gap-2">
      {items.map((i) => {
        const n = i + 1;
        const locked = i < minSelectableIndex || selectionDisabled;
        const cls = ['br-nav-grid-btn position-relative'];
        if (i === current) {
          cls.push('active');
        }
        if (answeredSet?.has(n)) {
          cls.push('answered');
        }
        if (locked) {
          cls.push('opacity-50');
        }
        return (
          <Button
            key={n}
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
            {n}
          </Button>
        );
      })}
    </div>
  );
}
