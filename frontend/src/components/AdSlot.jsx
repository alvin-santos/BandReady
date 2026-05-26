import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { AD_SLOT_SPECS } from '../constants/adPlacements.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isDisplayableAd } from '../utils/adDisplay.js';

/**
 * @param {object} props
 * @param {string} props.location
 * @param {{ minHeight: number; maxWidth: number | string; label: string }} props.spec
 * @param {boolean} props.isForum
 */
function OpenForAdvertisingPitch({ location, spec, isForum }) {
  const to = `/advertise?placement=${encodeURIComponent(location)}`;
  const phStyle = isForum
    ? { minHeight: spec.minHeight, maxWidth: spec.maxWidth, margin: '0 auto' }
    : {
        minHeight: spec.minHeight,
        maxWidth: spec.maxWidth,
        margin: '0 auto',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.04))',
        border: '1px dashed rgba(37,99,235,0.3)',
        borderRadius: 12,
      };

  return (
    <Link
      to={to}
      className={`text-decoration-none text-reset d-block h-100 br-ad-slot-ph br-ad-slot-ph--open${isForum ? ' br-ad-slot-ph--forum' : ''}`}
      aria-label="Open for advertising — submit an ad proposal"
    >
      <div
        className="d-flex flex-column justify-content-center align-items-center text-center p-3 h-100"
        style={phStyle}
      >
        <i className="bi bi-badge-ad fs-4 text-br-rose mb-2" aria-hidden />
        <div className="fw-semibold text-body small">Open for advertising</div>
        <div className="small text-muted mt-1">Click here to post your ad</div>
        <div className="small br-ad-slot-ph__meta mt-2">{spec.label}</div>
      </div>
    </Link>
  );
}

/**
 * @param {object} props
 * @param {string} props.location - key from SIZES
 * @param {object} [props.ad] - optional ad from API
 * @param {'default' | 'forum'} [props.surface] - forum pages use flatter slots matching the board UI
 */
export default function AdSlot({ location, ad, surface = 'default' }) {
  const { isSubscribed, isAdmin } = useAuth();
  const spec = AD_SLOT_SPECS[location] || { minHeight: 100, maxWidth: '100%', label: 'Ad' };
  const isForum = surface === 'forum';
  const wrapClass = `ad-slot mb-3${isForum ? ' ad-slot--forum' : ''}`;

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

  if (!isDisplayableAd(ad)) {
    return (
      <div className={wrapClass}>
        <OpenForAdvertisingPitch location={location} spec={spec} isForum={isForum} />
      </div>
    );
  }

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
