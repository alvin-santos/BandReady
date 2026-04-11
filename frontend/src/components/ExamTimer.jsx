import { useEffect, useRef, useState } from 'react';

export default function ExamTimer({
  secondsTotal,
  startedAt,
  onExpire,
  paused = false,
  large = false,
}) {
  const start = startedAt ? new Date(startedAt).getTime() : Date.now();
  const [left, setLeft] = useState(secondsTotal);
  const pauseStartedRef = useRef(null);
  const pausedMsRef = useRef(0);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    pausedMsRef.current = 0;
    pauseStartedRef.current = null;
  }, [startedAt, secondsTotal]);

  useEffect(() => {
    if (paused) {
      if (!pauseStartedRef.current) {
        pauseStartedRef.current = Date.now();
      }
    } else if (pauseStartedRef.current) {
      pausedMsRef.current += Date.now() - pauseStartedRef.current;
      pauseStartedRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    const tick = () => {
      if (paused && !pauseStartedRef.current) {
        pauseStartedRef.current = Date.now();
      }
      let extraPause = 0;
      if (paused && pauseStartedRef.current) {
        extraPause = Date.now() - pauseStartedRef.current;
      }
      const pausedTotal = pausedMsRef.current + extraPause;
      const elapsed = Math.floor((Date.now() - start - pausedTotal) / 1000);
      const remain = Math.max(0, secondsTotal - elapsed);
      setLeft(remain);
      if (!paused && remain <= 0) {
        expireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [secondsTotal, start, paused]);

  const m = Math.floor(left / 60);
  const s = left % 60;
  const warn = left <= 300 && !paused;

  return (
    <span
      className={`font-monospace fw-bold d-inline-flex align-items-center gap-1 ${large ? 'br-exam-clock-lg' : ''}`}
      style={{
        color: paused ? 'var(--br-muted)' : warn ? 'var(--br-danger)' : 'var(--br-text)',
        fontFamily: 'var(--br-mono)',
      }}
    >
      <i
        className={`bi ${paused ? 'bi-pause-circle-fill' : warn ? 'bi-exclamation-triangle-fill' : 'bi-stopwatch'}`}
        aria-hidden
      />
      {paused ? 'PAUSED ' : ''}
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}
