import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, ProgressBar } from 'react-bootstrap';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function blockNudgePath(pathname) {
  return (
    pathname.startsWith('/exam/run') ||
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-email'
  );
}

function progressVariant(score) {
  if (score == null) {
    return 'secondary';
  }
  if (score >= 80) {
    return 'success';
  }
  if (score >= 65) {
    return 'primary';
  }
  if (score >= 40) {
    return 'warning';
  }
  return 'danger';
}

function pickEncouragement(readiness, weakSections, completedCount) {
  const pool = [];

  if (weakSections?.length) {
    const w = weakSections[0];
    pool.push(
      `Your ${w.section_name} average in ${w.exam_name} has room to grow — one more timed set could help.`
    );
  }

  if (readiness?.overall_score != null) {
    pool.push(
      `Overall readiness: ${Math.round(readiness.overall_score)}% (${readiness.label}). Another practice run keeps momentum.`
    );
  }

  if (readiness && readiness.exams_total > 0 && readiness.exams_covered < readiness.exams_total) {
    pool.push(
      `Coverage: ${readiness.exams_covered}/${readiness.exams_total} exam programs — try another program for a fuller picture.`
    );
  }

  if (completedCount === 0) {
    pool.push('Complete your first scored practice to unlock a readiness snapshot.');
  }

  pool.push('Short sessions count — even one section today builds exam-day stamina.');
  pool.push('Consistency beats cramming: add another attempt when you have 20–30 minutes.');
  pool.push('Simulate test conditions again — pacing is half the battle.');

  return pool[randomBetween(0, pool.length - 1)];
}

export default function PracticeNudge() {
  const { user } = useAuth();
  const location = useLocation();
  const userRef = useRef(user);
  userRef.current = user;
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const [open, setOpen] = useState(false);
  const [dash, setDash] = useState(null);
  const [blurb, setBlurb] = useState('');

  const showTimerRef = useRef(null);
  const nextTimerRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (nextTimerRef.current) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
  }, []);

  const scheduleNextShow = useCallback(
    (delayMs) => {
      if (nextTimerRef.current) {
        clearTimeout(nextTimerRef.current);
      }
      nextTimerRef.current = setTimeout(() => {
        nextTimerRef.current = null;
        if (!userRef.current || blockNudgePath(pathRef.current)) {
          return;
        }
        api
          .get('/dashboard')
          .then((res) => {
            setDash(res.data);
            setBlurb(
              pickEncouragement(res.data?.readiness, res.data?.weak_sections, res.data?.completed_count ?? 0)
            );
            if (!blockNudgePath(pathRef.current)) {
              setOpen(true);
            }
          })
          .catch(() => {});
      }, delayMs);
    },
    []
  );

  useEffect(() => {
    if (blockNudgePath(location.pathname)) {
      setOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    clearTimers();
    if (!user) {
      setDash(null);
      setOpen(false);
      return;
    }

    const delay = randomBetween(35000, 95000);
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      if (!userRef.current || blockNudgePath(pathRef.current)) {
        return;
      }
      api
        .get('/dashboard')
        .then((res) => {
          const data = res.data;
          setDash(data);
          setBlurb(
            pickEncouragement(data?.readiness, data?.weak_sections, data?.completed_count ?? 0)
          );
          if (!blockNudgePath(pathRef.current)) {
            setOpen(true);
          }
        })
        .catch(() => {});
    }, delay);

    return () => {
      clearTimers();
    };
  }, [user, clearTimers]);

  const dismiss = () => {
    setOpen(false);
    scheduleNextShow(randomBetween(8 * 60 * 1000, 18 * 60 * 1000));
  };

  if (!user || !open || blockNudgePath(location.pathname)) {
    return null;
  }

  const readiness = dash?.readiness;
  const score = readiness?.overall_score;
  const hasScore = score != null;
  const completed = dash?.completed_count ?? 0;

  return (
    <div
      className="br-practice-nudge shadow-lg"
      role="dialog"
      aria-labelledby="br-nudge-title"
      aria-live="polite"
    >
      <button
        type="button"
        className="br-practice-nudge-close btn btn-sm btn-link text-muted p-0"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <i className="bi bi-x-lg" aria-hidden />
      </button>
      <div className="d-flex align-items-start gap-2 mb-2">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 br-practice-nudge-icon"
          aria-hidden
        >
          <i className="bi bi-graph-up-arrow" />
        </div>
        <div>
          <h2 id="br-nudge-title" className="h6 fw-bold mb-1">
            Keep building readiness
          </h2>
          <p className="small text-muted mb-0">{blurb}</p>
        </div>
      </div>

      {hasScore && (
        <div className="mb-2">
          <div className="d-flex justify-content-between align-items-baseline small mb-1">
            <span className="text-muted">Overall</span>
            <span className={`fw-bold text-${progressVariant(score)}`}>{Math.round(score)}%</span>
          </div>
          <ProgressBar
            now={Math.min(100, Math.max(0, score))}
            variant={progressVariant(score)}
            style={{ height: 8, borderRadius: 6 }}
            aria-label="Readiness score"
          />
          {readiness?.label && (
            <div className="small text-muted mt-1">
              {readiness.label}
              {readiness.coverage_percent != null && (
                <span className="ms-1">· {readiness.coverage_percent}% program coverage</span>
              )}
            </div>
          )}
        </div>
      )}

      {!hasScore && readiness?.summary && (
        <p className="small text-muted mb-2 mb-md-3">{readiness.summary}</p>
      )}

      <div className="d-flex flex-wrap gap-2 align-items-center pt-1 border-top border-opacity-10 mt-2">
        <Button as={Link} to="/exam/start" size="sm" className="d-inline-flex align-items-center gap-1" onClick={dismiss}>
          <i className="bi bi-play-fill" aria-hidden />
          Take a test
        </Button>
        <Link to="/dashboard" className="small text-decoration-none" onClick={dismiss}>
          Dashboard
        </Link>
        {completed > 0 && (
          <span className="small text-muted ms-auto">{completed} completed</span>
        )}
      </div>
    </div>
  );
}
