import { useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

const modes = [
  { value: 'full', label: 'Full mock' },
  { value: 'quick', label: 'Quick practice' },
];

export default function AdminTests() {
  const [exams, setExams] = useState([]);
  const [sections, setSections] = useState([]);
  const [filterExam, setFilterExam] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    exam_id: '',
    section_id: '',
    title: '',
    difficulty: 'medium',
    is_full_mock: false,
    practice_mode: 'quick',
    duration_minutes: '',
    is_available: true,
    questions_to_show: '',
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    api.get('/admin/exams').then((res) => setExams(res.data));
  }, []);

  async function loadSections(examId) {
    if (!examId) {
      setSections([]);
      return;
    }
    const { data } = await api.get('/admin/sections', { params: { exam_id: examId } });
    setSections(data);
  }

  async function load() {
    const params = filterExam ? { exam_id: filterExam } : {};
    const { data } = await api.get('/admin/tests', { params });
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [filterExam]);

  async function openCreate() {
    setEditId(null);
    const eid = filterExam || (exams[0]?.id ? String(exams[0].id) : '');
    setForm({
      exam_id: eid,
      section_id: '',
      title: '',
      difficulty: 'medium',
      is_full_mock: false,
      practice_mode: 'quick',
      duration_minutes: '',
      is_available: true,
      questions_to_show: '',
    });
    setShow(true);
    if (eid) {
      await loadSections(eid);
    }
  }

  async function openEdit(row) {
    setEditId(row.id);
    await loadSections(String(row.exam_id));
    setForm({
      exam_id: String(row.exam_id),
      section_id: String(row.section_id),
      title: row.title,
      difficulty: row.difficulty || 'medium',
      is_full_mock: !!row.is_full_mock,
      practice_mode: row.practice_mode === 'section' ? 'quick' : row.practice_mode || 'quick',
      duration_minutes: row.duration_minutes ?? '',
      is_available: row.is_available !== false,
      questions_to_show: row.questions_to_show != null ? String(row.questions_to_show) : '',
    });
    setShow(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      exam_id: Number(form.exam_id),
      section_id: Number(form.section_id),
      title: form.title,
      difficulty: form.difficulty || null,
      is_full_mock: form.is_full_mock,
      practice_mode: form.practice_mode,
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      is_available: form.is_available,
      questions_to_show:
        form.questions_to_show === '' || form.questions_to_show == null
          ? null
          : Number(form.questions_to_show),
    };
    if (editId) {
      await api.put(`/admin/tests/${editId}`, payload);
    } else {
      await api.post('/admin/tests', payload);
    }
    setShow(false);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this test? All questions in this test will be removed.')) {
      return;
    }
    await api.delete(`/admin/tests/${id}`);
    load();
  }

  if (loading && !rows.length) {
    return (
      <div className="text-center py-5">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-journal-text text-br-rose" aria-hidden />
          Tests
        </h1>
        <Button className="d-inline-flex align-items-center gap-1" onClick={openCreate} disabled={!exams.length}>
          <i className="bi bi-plus-lg" aria-hidden />
          Add test
        </Button>
      </div>

      <Form.Group className="mb-3" style={{ maxWidth: 320 }}>
        <Form.Label>Filter by exam</Form.Label>
        <Form.Select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}>
          <option value="">All exams</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      <div className="table-responsive br-card p-3">
        <Table hover size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Title</th>
              <th>Exam</th>
              <th>Section</th>
              <th>Mode</th>
              <th>Duration</th>
              <th>Show Q</th>
              <th>Available</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small">{r.title}</td>
                <td>{r.exam?.name}</td>
                <td>{r.section?.name}</td>
                <td>
                  <code className="small">{r.practice_mode}</code>
                </td>
                <td>{r.duration_minutes ?? '—'}</td>
                <td className="small text-nowrap">
                  {r.questions_to_show != null && r.questions_to_show > 0 ? (
                    <>
                      {r.questions_to_show}
                      {typeof r.questions_count === 'number' ? (
                        <span className="text-muted"> / {r.questions_count} in bank</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted">All{r.questions_count != null ? ` (${r.questions_count})` : ''}</span>
                  )}
                </td>
                <td>{r.is_available === false ? 'No' : 'Yes'}</td>
                <td className="text-end">
                  <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(r)}>
                    <i className="bi bi-pencil" aria-hidden />
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => remove(r.id)}>
                    <i className="bi bi-trash" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal show={show} onHide={() => setShow(false)} centered size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>{editId ? 'Edit test' : 'New test'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={save}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Exam</Form.Label>
              <Form.Select
                value={form.exam_id}
                onChange={async (e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, exam_id: v, section_id: '' }));
                  await loadSections(v);
                }}
                required
                disabled={!!editId}
              >
                <option value="">Select…</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Section</Form.Label>
              <Form.Select
                value={form.section_id}
                onChange={(e) => setForm((f) => ({ ...f, section_id: e.target.value }))}
                required
                disabled={!sections.length}
              >
                <option value="">Select…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Difficulty</Form.Label>
              <Form.Select
                value={form.difficulty}
                onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Practice mode</Form.Label>
              <Form.Select
                value={form.practice_mode}
                onChange={(e) => setForm((f) => ({ ...f, practice_mode: e.target.value }))}
              >
                {modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="fullmock"
                label="Full mock (metadata)"
                checked={form.is_full_mock}
                onChange={(e) => setForm((f) => ({ ...f, is_full_mock: e.target.checked }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="available"
                label="Available to learners (uncheck for “coming soon”)"
                checked={form.is_available}
                onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Duration override (minutes, optional)</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={600}
                placeholder="Uses section default if empty"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Questions shown to learners</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={500}
                placeholder="Leave empty = show every question in this test"
                value={form.questions_to_show}
                onChange={(e) => setForm((f) => ({ ...f, questions_to_show: e.target.value }))}
              />
              <Form.Text className="text-muted">
                If set, each attempt randomly picks this many questions from the test (after shuffle). Scoring uses only
                those items. Changing this does not affect attempts already started.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
