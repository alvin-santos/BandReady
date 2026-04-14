import { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

function taskLabel(row) {
  if (row.celpip_task_number == null && (row.celpip_task_label == null || row.celpip_task_label === '')) {
    return '— (no task metadata)';
  }
  const num = row.celpip_task_number != null ? `Task ${row.celpip_task_number}` : '';
  const lab = row.celpip_task_label ? String(row.celpip_task_label) : '';
  return [num, lab].filter(Boolean).join(' — ');
}

export default function AdminQuestionBank() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/admin/question-bank-stats')
      .then((res) => setData(res.data))
      .catch(() => setErr('Could not load question bank stats.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-5 text-center">
        <Spinner />
      </div>
    );
  }

  if (err || !data) {
    return <Alert variant="danger">{err || 'No data.'}</Alert>;
  }

  const { totals, by_task: byTask, by_test: byTest, by_exam: byExam } = data;

  return (
    <div>
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-collection text-br-rose" aria-hidden />
        Question bank
      </h1>
      <p className="text-muted mb-4">
        Counts of imported questions grouped by CELPIP-style task (when metadata exists), by test, and by exam.
      </p>

      <Row className="g-3 mb-4">
        <Col xs={12} sm={4}>
          <Card body className="h-100">
            <div className="small text-muted text-uppercase fw-semibold">Questions</div>
            <div className="h4 mb-0 tabular-nums">{totals.questions}</div>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card body className="h-100">
            <div className="small text-muted text-uppercase fw-semibold">Tests</div>
            <div className="h4 mb-0 tabular-nums">{totals.tests}</div>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card body className="h-100">
            <div className="small text-muted text-uppercase fw-semibold">Exams</div>
            <div className="h4 mb-0 tabular-nums">{totals.exams}</div>
          </Card>
        </Col>
      </Row>

      <div className="br-card p-3 p-md-4 mb-4">
        <h2 className="h6 fw-bold mb-3">By section &amp; task</h2>
        <div className="table-responsive">
          <Table hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Section</th>
                <th>Task</th>
                <th className="text-end">Questions</th>
              </tr>
            </thead>
            <tbody>
              {byTask.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted">
                    No questions in the database.
                  </td>
                </tr>
              ) : (
                byTask.map((row, i) => (
                  <tr key={`${row.section_name}-${row.celpip_task_number}-${row.celpip_task_label}-${i}`}>
                    <td>{row.section_name}</td>
                    <td>{taskLabel(row)}</td>
                    <td className="text-end tabular-nums">{row.question_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="br-card p-3 p-md-4 mb-4">
        <h2 className="h6 fw-bold mb-3">By test</h2>
        <div className="table-responsive">
          <Table hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Section</th>
                <th>Test</th>
                <th className="text-end">Questions</th>
              </tr>
            </thead>
            <tbody>
              {byTest.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">
                    No tests.
                  </td>
                </tr>
              ) : (
                byTest.map((row) => (
                  <tr key={row.test_id}>
                    <td>
                      <span className="text-muted small me-1">{row.exam_code}</span>
                      {row.exam_name}
                    </td>
                    <td>{row.section_name}</td>
                    <td>{row.test_title}</td>
                    <td className="text-end tabular-nums">{row.question_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <div className="br-card p-3 p-md-4">
        <h2 className="h6 fw-bold mb-3">By exam</h2>
        <div className="table-responsive">
          <Table hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Exam</th>
                <th className="text-end">Tests</th>
                <th className="text-end">Questions</th>
              </tr>
            </thead>
            <tbody>
              {byExam.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted">
                    No exams.
                  </td>
                </tr>
              ) : (
                byExam.map((row) => (
                  <tr key={row.exam_id}>
                    <td>
                      <span className="text-muted small me-1">{row.exam_code}</span>
                      {row.exam_name}
                    </td>
                    <td className="text-end tabular-nums">{row.test_count}</td>
                    <td className="text-end tabular-nums">{row.question_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
