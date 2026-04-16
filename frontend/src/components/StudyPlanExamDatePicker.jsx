import { useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { Form } from 'react-bootstrap';

import 'react-datepicker/dist/react-datepicker.css';

function getExamPickerBounds(maxDays) {
  const min = new Date();
  min.setDate(min.getDate() + 1);
  min.setHours(0, 0, 0, 0);
  const max = new Date();
  max.setHours(0, 0, 0, 0);
  const n = typeof maxDays === 'number' && maxDays > 0 ? maxDays : 30;
  max.setDate(max.getDate() + n);
  return { min, max };
}

function parseISOToLocalDate(iso) {
  if (!iso || typeof iso !== 'string') {
    return null;
  }
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) {
    return null;
  }
  return new Date(y, m - 1, d);
}

function toISOFromLocalDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * @param {{
 *   id?: string;
 *   value: string;
 *   onChange: (iso: string) => void;
 *   maxExamDays: number;
 *   disabled?: boolean;
 *   required?: boolean;
 *   showProUpgradeHint?: boolean;
 * }} props
 */
export default function StudyPlanExamDatePicker({
  id,
  value,
  onChange,
  maxExamDays,
  disabled = false,
  required = false,
  showProUpgradeHint = false,
}) {
  const { min, max } = useMemo(() => getExamPickerBounds(maxExamDays), [maxExamDays]);
  const selected = parseISOToLocalDate(value);
  const maxLabel = useMemo(() => max.toLocaleDateString(undefined, { dateStyle: 'medium' }), [max]);
  const noteId = id ? `${id}-limit-note` : 'study-plan-exam-limit-note';

  return (
    <>
      <div className="br-study-plan-datepicker-wrap">
        <DatePicker
          id={id}
          selected={selected}
          onChange={(date) => onChange(date ? toISOFromLocalDate(date) : '')}
          minDate={min}
          maxDate={max}
          dateFormat="MMM d, yyyy"
          className="form-control"
          wrapperClassName="w-100"
          calendarClassName="br-react-datepicker-calendar"
          popperClassName="br-react-datepicker-popper"
          withPortal
          disabled={disabled}
          required={required}
          placeholderText="Pick exam date"
          showPopperArrow={false}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          ariaDescribedBy={noteId}
        />
      </div>
      <Form.Text id={noteId} className="text-muted d-block mt-2">
        You can select any exam date from <span className="text-body">tomorrow</span> through{' '}
        <span className="text-body">{maxExamDays} calendar days</span> from today (latest:{' '}
        <span className="text-body">{maxLabel}</span>).
        {showProUpgradeHint ? (
          <>
            {' '}
            <span className="text-body">BandReady Pro</span> allows a longer window.
          </>
        ) : null}
      </Form.Text>
    </>
  );
}
