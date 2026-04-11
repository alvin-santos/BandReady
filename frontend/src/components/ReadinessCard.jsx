import { Link } from 'react-router-dom';
import { ProgressBar } from 'react-bootstrap';

function progressVariant(score) {
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

export default function ReadinessCard({ readiness, compact = false }) {
  if (!readiness) {
    return null;
  }

  const score = readiness.overall_score;
  const hasScore = score != null;

  return (
    <div className={`br-card mb-4 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="h5 fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-bullseye text-br-rose" aria-hidden />
            Exam readiness
          </h2>
          <p className="small text-muted mb-0">
            Based on completed practice across your exam programs (approximate; not a prediction of official results).
          </p>
        </div>
        {hasScore && (
          <div className="text-md-end">
            <div className={`display-6 fw-bold text-${progressVariant(score)}`}>{score}%</div>
            <div className="badge badge-br-rose">
              {readiness.label}
            </div>
          </div>
        )}
      </div>

      {!hasScore && (
        <p className="text-muted mb-3 mb-md-0 d-flex align-items-start gap-2">
          <i className="bi bi-info-circle mt-1" aria-hidden />
          <span>{readiness.summary}</span>
        </p>
      )}

      {hasScore && (
        <>
          <ProgressBar
            now={Math.min(100, Math.max(0, score))}
            variant={progressVariant(score)}
            className="mb-3"
            style={{ height: 10, borderRadius: 8 }}
            aria-label="Overall readiness"
          />
          {readiness.readiness_band?.explanation && (
            <div className="border-start border-3 border-br-rose border-opacity-25 ps-3 mb-3">
              <div className="small fw-semibold text-body mb-1 d-flex align-items-center gap-2">
                <i className="bi bi-signpost-2 text-br-rose" aria-hidden />
                What {readiness.readiness_band.label} means here
              </div>
              <p className="small text-muted mb-0">{readiness.readiness_band.explanation}</p>
            </div>
          )}
          <p className="small text-muted mb-3">{readiness.summary}</p>
          <div className="small text-muted mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-layers" aria-hidden />
            Program coverage: {readiness.exams_covered}/{readiness.exams_total} ({readiness.coverage_percent}%)
          </div>

          {!compact && readiness.section_readiness?.length > 0 && (
            <div className="mb-3">
              <h3 className="h6 fw-bold mb-1 d-flex align-items-center gap-2">
                <i className="bi bi-grid-3x3-gap text-br-rose" aria-hidden />
                Readiness by section
              </h3>
              <p className="small text-muted mb-2 mb-md-3">
                For each skill (Listening, Reading, …), we use the same rule as overall: average your scores within each exam
                program, then average those programs so every program counts equally.
              </p>
              <ul className="list-unstyled mb-0">
                {readiness.section_readiness.map((s, idx) => (
                  <li
                    key={s.section_name}
                    className={`py-3 ${idx > 0 ? 'border-top border-opacity-10' : ''}`}
                  >
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                      <span className="fw-semibold">{s.section_name}</span>
                      <span className="d-flex align-items-center gap-2 flex-wrap">
                        <span className={`fw-bold text-${progressVariant(s.overall_score)}`}>{s.overall_score}%</span>
                        <span className="badge badge-br-rose">{s.label}</span>
                      </span>
                    </div>
                    <ProgressBar
                      now={Math.min(100, Math.max(0, s.overall_score))}
                      variant={progressVariant(s.overall_score)}
                      style={{ height: 8, borderRadius: 8 }}
                      className="mb-2"
                      aria-label={`${s.section_name} readiness`}
                    />
                    <div className="small text-muted d-flex flex-wrap justify-content-between gap-2">
                      <span>
                        Band: <strong className="text-body">{s.readiness_band?.label}</strong>
                        {s.readiness_band?.explanation && (
                          <span className="d-none d-md-inline"> — {s.readiness_band.explanation}</span>
                        )}
                      </span>
                      <span className="text-nowrap">
                        {s.exams_covered} program{s.exams_covered === 1 ? '' : 's'} · {s.attempts_count} attempt
                        {s.attempts_count === 1 ? '' : 's'}
                      </span>
                    </div>
                    {s.readiness_band?.explanation && (
                      <p className="small text-muted mb-0 mt-2 d-md-none">{s.readiness_band.explanation}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {readiness.per_exam?.length > 0 && (
            <ul className="list-unstyled mb-0">
              {readiness.per_exam.map((e) => (
                <li key={e.exam_code} className="d-flex justify-content-between align-items-center py-2 border-top border-opacity-10">
                  <span className="me-2">{e.exam_name}</span>
                  <span className="fw-semibold text-nowrap">
                    {e.avg_score}%
                    <span className="text-muted fw-normal small ms-1">({e.attempts_count} attempt{e.attempts_count === 1 ? '' : 's'})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {!compact && (
        <div className="mt-3 pt-3 border-top border-opacity-10">
          <Link to="/exam/start" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1">
            <i className="bi bi-plus-lg" aria-hidden />
            Add more practice
          </Link>
        </div>
      )}
    </div>
  );
}
