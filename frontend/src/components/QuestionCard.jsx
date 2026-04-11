import { Form, InputGroup } from 'react-bootstrap';
import AdminQuestionKeyPanel from './AdminQuestionKeyPanel.jsx';
import IeltsAiSpeakingInterview from './IeltsAiSpeakingInterview.jsx';
import SpeakingRecorder from './SpeakingRecorder.jsx';
import { isIeltsAiSpeakingQuestion } from '../utils/ieltsAiSpeaking.js';

export default function QuestionCard({
  question,
  value,
  onChange,
  essayMaxChars = 4000,
  attemptId,
  speakingMaxSeconds = 180,
  speakingConversationMaxChars = 16000,
  showAdminKey = false,
}) {
  const t = question.type;

  const opts = question.options_json || {};
  const adminKey = <AdminQuestionKeyPanel question={question} show={showAdminKey} />;

  if (t === 'multiple_choice') {
    return (
      <div>
        {adminKey}
        <p className="fw-semibold mb-3">{question.question_text}</p>
        <Form>
          {Object.entries(opts).map(([k, label]) => (
            <Form.Check
              key={k}
              className="mb-2"
              type="radio"
              name={`q-${question.id}`}
              id={`q-${question.id}-${k}`}
              label={`${k}. ${label}`}
              checked={value === k}
              onChange={() => onChange(k)}
            />
          ))}
        </Form>
      </div>
    );
  }

  if (t === 'checkbox_multi') {
    const selected = (() => {
      try {
        return new Set(JSON.parse(value || '[]'));
      } catch {
        return new Set();
      }
    })();
    const toggle = (k) => {
      const next = new Set(selected);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      onChange(JSON.stringify([...next].sort()));
    };
    return (
      <div>
        {adminKey}
        <p className="fw-semibold mb-3">{question.question_text}</p>
        <Form>
          {Object.entries(opts).map(([k, label]) => (
            <Form.Check
              key={k}
              className="mb-2"
              type="checkbox"
              id={`q-${question.id}-${k}`}
              label={`${k}. ${label}`}
              checked={selected.has(k)}
              onChange={() => toggle(k)}
            />
          ))}
        </Form>
      </div>
    );
  }

  if (t === 'true_false') {
    return (
      <div>
        {adminKey}
        <p className="fw-semibold mb-3">{question.question_text}</p>
        <Form>
          {['true', 'false'].map((k) => (
            <Form.Check
              key={k}
              className="mb-2"
              type="radio"
              name={`q-${question.id}`}
              id={`q-${question.id}-${k}`}
              label={k === 'true' ? 'True' : 'False'}
              checked={value === k}
              onChange={() => onChange(k)}
            />
          ))}
        </Form>
      </div>
    );
  }

  if (t === 'fill_blank') {
    return (
      <div>
        {adminKey}
        <p className="fw-semibold mb-3">{question.question_text}</p>
        <Form.Control
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer"
        />
      </div>
    );
  }

  if (t === 'speaking_prompt' && attemptId != null && question.id != null && isIeltsAiSpeakingQuestion(question)) {
    return (
      <IeltsAiSpeakingInterview
        key={`ielts-ai-${question.id}`}
        question={question}
        value={value}
        onChange={onChange}
        attemptId={attemptId}
        questionId={question.id}
        speakingMaxSeconds={speakingMaxSeconds}
        speakingConversationMaxChars={speakingConversationMaxChars}
        showAdminKey={showAdminKey}
      />
    );
  }

  if (t === 'speaking_prompt' && attemptId != null && question.id != null) {
    return (
      <SpeakingRecorder
        question={question}
        value={value}
        onChange={onChange}
        attemptId={attemptId}
        questionId={question.id}
        maxSeconds={speakingMaxSeconds}
        showAdminKey={showAdminKey}
      />
    );
  }

  if (t === 'essay') {
    const max = essayMaxChars;
    const raw = value || '';
    const len = [...raw].length;
    return (
      <div>
        {adminKey}
        <p className="fw-semibold mb-3">{question.question_text}</p>
        <Form.Control
          as="textarea"
          rows={12}
          value={raw}
          maxLength={max}
          onChange={(e) => {
            let v = e.target.value;
            if ([...v].length > max) {
              v = [...v].slice(0, max).join('');
            }
            onChange(v);
          }}
          placeholder="Write your response here."
        />
        <div className="small text-muted mt-2 d-flex flex-wrap justify-content-between gap-2">
          <span>
            After submit, results explain each score (Overall, Relevance, Task, Language, indicative band). Pro: AI feedback —
            approximate, not an official mark.
          </span>
          <span className={len >= max ? 'text-warning fw-semibold' : ''} aria-live="polite">
            {len} / {max}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {adminKey}
      <p className="fw-semibold mb-2">{question.question_text}</p>
      <InputGroup>
        <Form.Control
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </InputGroup>
    </div>
  );
}
