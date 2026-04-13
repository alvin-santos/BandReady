/**
 * BandReady Pro membership indicator (use where `isSubscribed` is true).
 *
 * @param {{ variant?: 'default' | 'nav'; className?: string }} props
 */
export default function ProBadge({ variant = 'default', className = '' }) {
  const nav = variant === 'nav';
  return (
    <span
      className={`br-pro-badge ${nav ? 'br-pro-badge--nav' : ''} ${className}`.trim()}
      title="BandReady Pro"
    >
      <i className="bi bi-star-fill" aria-hidden />
      {!nav && <span className="ms-1">Pro</span>}
      {nav && <span className="ms-1">PRO</span>}
    </span>
  );
}
