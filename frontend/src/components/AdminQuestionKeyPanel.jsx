import { Alert } from 'react-bootstrap';

function formatAuthoringValue(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value) || (typeof value === 'object' && value.constructor === Object)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value).trim();
    }
  }
  return String(value).trim();
}

/** Plain options map: { A: "…", B: "…" } (ignores nested keys like ielts_speaking). */
function optionLabelsMap(optionsJson) {
  if (!optionsJson || typeof optionsJson !== 'object' || Array.isArray(optionsJson)) {
    return null;
  }
  const out = {};
  for (const [k, v] of Object.entries(optionsJson)) {
    if (typeof v === 'string' && /^[A-Za-z]$/.test(k)) {
      out[k.toUpperCase()] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

function resolvedCorrectAnswerLines(question, caStr) {
  if (!caStr) {
    return [];
  }
  const type = question?.type;
  const opts = optionLabelsMap(question?.options_json);

  if (type === 'multiple_choice' && opts) {
    const letter = caStr.trim().charAt(0).toUpperCase();
    const label = opts[letter];
    if (label) {
      return [`${letter} — ${label}`];
    }
  }

  if (type === 'true_false') {
    const t = caStr.trim().toLowerCase();
    if (t === 'true' || t === 'false') {
      return [t === 'true' ? 'True' : 'False'];
    }
  }

  if (type === 'checkbox_multi' && opts) {
    try {
      const keys = JSON.parse(caStr);
      if (!Array.isArray(keys)) {
        return [caStr];
      }
      return keys.map((k) => {
        const L = String(k).trim().toUpperCase();
        const label = opts[L];
        return label ? `${L} — ${label}` : L;
      });
    } catch {
      return [caStr];
    }
  }

  return [caStr];
}

/**
 * Shows stored correct answer and explanation for administrators during an exam run.
 * @param {{ question: Record<string, unknown>, show: boolean, className?: string }} props
 */
export default function AdminQuestionKeyPanel({ question, show, className = 'mb-3' }) {
  if (!show) {
    return null;
  }
  const ca = question?.correct_answer ?? question?.correctAnswer;
  const ex = question?.explanation;
  const caStr = formatAuthoringValue(ca);
  const exStr = formatAuthoringValue(ex);
  const hasKey = caStr.length > 0;
  const hasExp = exStr.length > 0;
  const answerLines = hasKey ? resolvedCorrectAnswerLines(question, caStr) : [];

  return (
    <Alert variant="warning" className={`small py-2 border border-warning border-opacity-50 ${className}`}>
      <div className="fw-semibold text-body mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-shield-lock text-warning" aria-hidden />
        Admin — answer key & explanation
      </div>
      {!hasKey && !hasExp ? (
        <p className="text-muted mb-0 small">No correct answer or explanation is stored for this item.</p>
      ) : (
        <>
          <div className={hasExp ? 'mb-3' : 'mb-0'}>
            <div className="text-uppercase small text-muted fw-semibold mb-1">Correct answer</div>
            {hasKey ? (
              <div className="font-monospace small text-break bg-body-secondary bg-opacity-50 rounded px-2 py-2 border">
                {answerLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            ) : (
              <p className="text-muted mb-0 small fst-italic">No value in questions.correct_answer for this item.</p>
            )}
          </div>
          {hasExp ? (
            <div className="mb-0">
              <div className="text-uppercase small text-muted fw-semibold mb-1">Explanation</div>
              <div className="small text-break" style={{ whiteSpace: 'pre-wrap' }}>
                {exStr}
              </div>
            </div>
          ) : null}
        </>
      )}
    </Alert>
  );
}
