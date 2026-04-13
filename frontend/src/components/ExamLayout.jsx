import { Col, Container, ProgressBar, Row } from 'react-bootstrap';
import ExamTimer from './ExamTimer.jsx';
import QuestionNav from './QuestionNav.jsx';

export default function ExamLayout({
  title,
  sectionName,
  timerSeconds,
  startedAt,
  onTimerExpire,
  totalQuestions,
  currentIndex,
  onSelectQuestion,
  answeredNumbers,
  children,
  onPrev,
  onNext,
  onSubmit,
  progress,
  instructions,
  fullscreen,
  strictMode = false,
  forwardOnly = false,
  minSelectableIndex = 0,
  prevDisabled = false,
  navigationLocked = false,
  paused = false,
  onTogglePause,
  leftRailExtra = null,
  rightRailExtra = null,
  questionNavQuestions = null,
}) {
  const answeredSet = answeredNumbers || new Set();
  const canPause = typeof onTogglePause === 'function' && !strictMode;
  const isLastQuestion = totalQuestions > 0 && currentIndex >= totalQuestions - 1;

  return (
    <div className={`exam-fullscreen ${fullscreen ? 'br-exam-shell' : ''}`}>
      <div className="br-exam-topbar py-2 px-3">
        <Container fluid className="px-2 px-sm-3">
          <Row className="align-items-center g-2">
            <Col xs={12} sm={6} lg={4}>
              <div className="small text-muted d-flex align-items-center gap-1">
                <i className="bi bi-journal-text" aria-hidden />
                Exam
              </div>
              <div className="fw-bold text-truncate">{title}</div>
              {strictMode && (
                <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 small mt-1">
                  Strict — no pause
                </span>
              )}
              {forwardOnly && (
                <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 small mt-1 ms-1">
                  Forward-only
                </span>
              )}
            </Col>
            <Col xs={6} sm={3} lg={2}>
              <div className="small text-muted d-flex align-items-center gap-1">
                <i className="bi bi-bookmark" aria-hidden />
                Section
              </div>
              <div className="fw-semibold text-truncate">{sectionName}</div>
            </Col>
            <Col xs={12} sm={3} lg={4} className="text-start text-lg-center">
              <div className="small text-muted d-flex align-items-center justify-content-lg-center gap-1">
                <i className="bi bi-clock-history" aria-hidden />
                Time remaining
              </div>
              <div className="d-flex flex-wrap align-items-center justify-content-lg-center gap-2">
                <ExamTimer
                  secondsTotal={timerSeconds}
                  startedAt={startedAt}
                  onExpire={onTimerExpire}
                  paused={paused}
                  large
                />
                {canPause && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                    onClick={onTogglePause}
                  >
                    <i className={paused ? 'bi bi-play-fill' : 'bi bi-pause-fill'} aria-hidden />
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                )}
              </div>
            </Col>
            <Col xs={12} lg={2} className="text-lg-end">
              <button
                type="button"
                className={`btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2 br-exam-submit-btn${
                  isLastQuestion ? ' br-exam-submit-last' : ''
                }`}
                onClick={onSubmit}
              >
                <i className="bi bi-send-check-fill" aria-hidden />
                Submit
              </button>
              {isLastQuestion && (
                <div className="small text-muted mt-1 d-none d-lg-block text-lg-end" role="status">
                  Last question — finish with Submit
                </div>
              )}
            </Col>
          </Row>
          <ProgressBar
            now={progress}
            className="mt-2"
            style={{ height: 6, borderRadius: 6 }}
            variant="primary"
          />
        </Container>
      </div>

      <Container fluid className="py-3 px-2 px-sm-3">
        <Row className="g-3">
          <Col xs={12} lg={3} className="order-2 order-lg-1">
            <div className="br-card p-3 mb-3">
              <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-grid-3x3-gap" aria-hidden />
                Questions
              </div>
              <QuestionNav
                total={totalQuestions}
                current={currentIndex}
                onSelect={onSelectQuestion}
                answeredSet={answeredSet}
                minSelectableIndex={forwardOnly ? minSelectableIndex : 0}
                selectionDisabled={navigationLocked}
                questions={questionNavQuestions}
              />
            </div>
            {leftRailExtra ? <div className="br-exam-rail-ad-stack">{leftRailExtra}</div> : null}
          </Col>
          <Col xs={12} lg={6} className="order-1 order-lg-2">
            <div className="br-card p-3 p-md-4">{children}</div>
            {isLastQuestion && (
              <div
                className="alert py-2 px-3 mt-3 mb-0 d-flex align-items-start gap-2 br-exam-last-hint"
                role="status"
                aria-live="polite"
              >
                <i className="bi bi-send-check-fill flex-shrink-0 mt-1" aria-hidden />
                <span className="small mb-0">
                  <strong>Last question.</strong> There is no next item — use <strong>Submit</strong> in the bar
                  above when you are ready to finish this section.
                </span>
              </div>
            )}
            <div className="d-flex justify-content-between mt-3 gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary d-inline-flex align-items-center gap-2 flex-grow-1 flex-sm-grow-0 br-exam-nav-btn"
                disabled={prevDisabled || navigationLocked}
                title={
                  navigationLocked
                    ? 'Wait until the listening clip finishes or is stopped'
                    : prevDisabled
                      ? 'Earlier questions are locked in forward-only mode'
                      : undefined
                }
                onClick={onPrev}
              >
                <i className="bi bi-chevron-left" aria-hidden />
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-primary d-inline-flex align-items-center gap-2 flex-grow-1 flex-sm-grow-0 br-exam-nav-btn"
                disabled={isLastQuestion || navigationLocked}
                title={
                  navigationLocked
                    ? 'Wait until the listening clip finishes or is stopped'
                    : isLastQuestion
                      ? 'No further questions — use Submit in the header when you are finished'
                      : undefined
                }
                onClick={onNext}
              >
                Next
                <i className="bi bi-chevron-right" aria-hidden />
              </button>
            </div>
          </Col>
          <Col xs={12} lg={3} className="order-3">
            <div className="br-card p-3">
              <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
                <i className="bi bi-info-circle" aria-hidden />
                Instructions
              </div>
              <p className="small text-muted mb-0">{instructions}</p>
            </div>
            {rightRailExtra ? <div className="br-exam-rail-ad-stack">{rightRailExtra}</div> : null}
          </Col>
        </Row>
      </Container>
    </div>
  );
}
