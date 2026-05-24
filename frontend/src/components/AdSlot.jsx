import { Card } from 'react-bootstrap';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isDisplayableAd } from '../utils/adDisplay.js';

const SIZES = {
  top_banner: { minHeight: 90, maxWidth: 728, label: '728 × 90' },
  sidebar: { minHeight: 250, maxWidth: 300, label: '300 × 250' },
  between_sections: { minHeight: 120, maxWidth: '100%', label: 'Responsive' },
  results_a: { minHeight: 200, maxWidth: '100%', label: 'Results slot' },
  results_b: { minHeight: 200, maxWidth: '100%', label: 'Results slot' },
  dashboard: { minHeight: 140, maxWidth: '100%', label: 'Dashboard' },
  /** Community forum — assign creatives in Admin → Advertisements */
  forum_leaderboard: { minHeight: 90, maxWidth: 728, label: 'Forum leaderboard 728 × 90' },
  forum_sidebar: { minHeight: 250, maxWidth: 300, label: 'Forum sidebar 300 × 250' },
  forum_category_inline: { minHeight: 100, maxWidth: '100%', label: 'Forum board — inline' },
  forum_thread_inline: { minHeight: 120, maxWidth: '100%', label: 'Forum thread — inline' },
  /** Exam runner — left column under question nav */
  exam_rail_left: { minHeight: 250, maxWidth: 300, label: 'Exam left rail 300 × 250' },
  /** Exam runner — right column under instructions */
  exam_rail_right: { minHeight: 250, maxWidth: 300, label: 'Exam right rail 300 × 250' },
  /** Downloads & guides page */
  resources_a: { minHeight: 120, maxWidth: '100%', label: 'Resources — top' },
  resources_b: { minHeight: 120, maxWidth: '100%', label: 'Resources — below list' },
  /** Public leaderboard */
  rankings_a: { minHeight: 120, maxWidth: '100%', label: 'Rankings — above filters' },
  rankings_b: { minHeight: 120, maxWidth: '100%', label: 'Rankings — below table' },
};

/**
 * @param {object} props
 * @param {string} props.location - key from SIZES
 * @param {object} [props.ad] - optional ad from API
 * @param {'default' | 'forum'} [props.surface] - forum pages use flatter slots matching the board UI
 */
export default function AdSlot({ location, ad, surface = 'default' }) {
  const { isSubscribed, isAdmin } = useAuth();
  const spec = SIZES[location] || { minHeight: 100, maxWidth: '100%', label: 'Ad' };

  /** Pro accounts never load third-party / house creatives; admins always see slots (e.g. to verify AdSense tags). */
  if (isSubscribed && !isAdmin) {
    const mw = spec.maxWidth === '100%' ? '100%' : spec.maxWidth;
    return (
      <div className={`ad-slot mb-3${surface === 'forum' ? ' ad-slot--forum' : ''}`}>
        <div
          className="rounded-2 px-3 py-2 small text-muted border bg-body-secondary bg-opacity-25"
          style={{ maxWidth: mw, margin: '0 auto' }}
        >
          <span className="d-inline-flex align-items-center gap-2">
            <i className="bi bi-stars text-br-rose" aria-hidden />
            Pro: sponsored slots stay off here.
          </span>
        </div>
      </div>
    );
  }

  /** Disabled in admin, missing slot, or no image/link/script — hide placeholder. */
  if (!isDisplayableAd(ad)) {
    return null;
  }
  const isForum = surface === 'forum';
  const wrapClass = `ad-slot mb-3${isForum ? ' ad-slot--forum' : ''}`;

  if (ad?.script) {
    return (
      <div className={wrapClass}>
        {isForum ? (
          <div className="br-forum-ad-embed border overflow-hidden">
            <div dangerouslySetInnerHTML={{ __html: ad.script }} />
          </div>
        ) : (
          <Card className="br-card border-0 overflow-hidden mb-0">
            <Card.Body className="p-0">
              <div dangerouslySetInnerHTML={{ __html: ad.script }} />
            </Card.Body>
          </Card>
        )}
      </div>
    );
  }

  const content = (
    <a
      href={ad?.link || '#'}
      className="text-decoration-none text-reset d-block h-100"
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!ad?.link) {
          e.preventDefault();
        }
        if (ad?.id) {
          api.post(`/ads/${ad.id}/click`).catch(() => {});
        }
      }}
    >
      <div
        className={`d-flex flex-column justify-content-center align-items-center text-center p-3 h-100 br-ad-slot-ph${isForum ? ' br-ad-slot-ph--forum' : ''}`}
        style={
          isForum
            ? {
                minHeight: spec.minHeight,
                maxWidth: spec.maxWidth,
                margin: '0 auto',
              }
            : {
                minHeight: spec.minHeight,
                maxWidth: spec.maxWidth,
                margin: '0 auto',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(99,102,241,0.06))',
                border: '1px dashed rgba(37,99,235,0.25)',
                borderRadius: 12,
              }
        }
      >
        {ad?.image ? (
          <img src={ad.image} alt="" className="img-fluid mb-2" style={{ maxHeight: 120 }} />
        ) : null}
        <div className="small text-muted">{ad?.title || 'Advertisement'}</div>
        <div className="small br-ad-slot-ph__meta">{spec.label}</div>
      </div>
    </a>
  );

  return <div className={wrapClass}>{content}</div>;
}
