import { Button } from 'react-bootstrap';
import { INTRO_MESSAGE, useBandieTutor } from '../context/BandieTutorContext.jsx';
import './BandieTutor.css';

export default function BandieTutor() {
  const {
    hideChrome,
    dismissed,
    tempHidden,
    examAutoMinimized,
    bubbleOpen,
    message,
    toggleBubble,
    minimizeBubble,
    hideBandie,
    nextTip,
    tempHideBandie,
    showBandieFromChip,
  } = useBandieTutor();

  if (hideChrome || dismissed) {
    return null;
  }

  if (tempHidden || examAutoMinimized) {
    return (
      <div className="br-bandie-root" aria-live="polite">
        <button
          type="button"
          className="br-bandie-restore-chip"
          onClick={showBandieFromChip}
          aria-label="Show Bandie again"
          title="Show Bandie"
        >
          <img src="/bandie.png" alt="" className="br-bandie-restore-thumb" decoding="async" />
          <span className="br-bandie-restore-label">Show Bandie</span>
        </button>
      </div>
    );
  }

  return (
    <div className="br-bandie-root" aria-live="polite">
      <div className={`br-bandie-bubble-wrap${bubbleOpen ? ' br-bandie-bubble-wrap--open' : ''}`}>
        <div
          className="br-bandie-bubble"
          role="dialog"
          aria-label="Bandie tips"
          aria-hidden={!bubbleOpen}
        >
          <div className="br-bandie-bubble-head">
            <span className="br-bandie-name">Bandie</span>
            <div className="br-bandie-actions">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-secondary p-0"
                title="Minimize to avatar"
                aria-label="Minimize to avatar"
                onClick={minimizeBubble}
              >
                <i className="bi bi-x-lg" aria-hidden />
              </Button>
            </div>
          </div>
          <p className="br-bandie-message">{message}</p>
          <div className="br-bandie-tip-nav">
            <Button
              type="button"
              variant="outline-primary"
              size="sm"
              className="br-bandie-next-tip-btn w-100 d-inline-flex align-items-center justify-content-center gap-1"
              onClick={nextTip}
              aria-label={message === INTRO_MESSAGE ? 'Skip introduction and show first tip' : 'Show next tip'}
            >
              <i className="bi bi-arrow-right-circle" aria-hidden />
              {message === INTRO_MESSAGE ? 'Skip to tips' : 'Next tip'}
            </Button>
          </div>
          <button type="button" className="br-bandie-dismiss-link" onClick={hideBandie}>
            Don&apos;t show Bandie again
          </button>
        </div>
      </div>
      <div className="br-bandie-avatar-wrap">
        <button
          type="button"
          className="br-bandie-avatar-btn"
          onClick={toggleBubble}
          aria-expanded={bubbleOpen}
          aria-label={bubbleOpen ? 'Hide Bandie tips' : 'Show Bandie tips'}
        >
          <img src="/bandie.png" alt="" decoding="async" />
        </button>
        <button
          type="button"
          className="br-bandie-image-temp-hide-zone"
          onClick={(e) => {
            e.preventDefault();
            tempHideBandie();
          }}
          aria-label="Hide Bandie temporarily"
          title="Tap here on Bandie to hide temporarily"
        />
      </div>
    </div>
  );
}
