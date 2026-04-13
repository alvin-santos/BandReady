import { useLocation } from 'react-router-dom';

/** Positions are within the bottom band (see `.br-floating-bg` in index.css). */
const FLOATING_ICONS = [
  { cls: 'bi-book', left: '4%', top: '18%' },
  { cls: 'bi-pen', left: '18%', top: '62%' },
  { cls: 'bi-volume-up', left: '28%', top: '8%' },
  { cls: 'bi-mic', left: '44%', top: '48%' },
  { cls: 'bi-journal-text', left: '58%', top: '22%' },
  { cls: 'bi-mortarboard', left: '72%', top: '55%' },
  { cls: 'bi-trophy', left: '86%', top: '12%' },
  { cls: 'bi-graph-up', left: '92%', top: '72%' },
  { cls: 'bi-clock', left: '12%', top: '85%' },
  { cls: 'bi-check2-circle', left: '78%', top: '88%' },
];

export default function FloatingBgIcons() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/exam/run')) {
    return null;
  }

  return (
    <div className="br-floating-bg" aria-hidden>
      {FLOATING_ICONS.map((row, i) => (
        <i
          key={`${row.cls}-${i}`}
          className={`bi ${row.cls} br-floating-bg-icon`}
          style={{
            left: row.left,
            top: row.top,
            animationDelay: `${-i * 2.1}s`,
          }}
        />
      ))}
    </div>
  );
}
