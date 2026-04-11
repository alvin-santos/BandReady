import { useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

export default function AdminSections() {
  const [exams, setExams] = useState([]);
  const [filterExam, setFilterExam] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    exam_id: '',
    name: '',
    duration_minutes: 60,
    sort_order: 0,
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    api.get('/admin/exams').then((res) => setExams(res.data));
  }, []);

  async function load() {
    const params = filterExam ? { exam_id: filterExam } : {};
    const { data } = await api.get('/admin/sections', { params });
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [filterExam]);

  function openCreate() {
    setEditId(null);
    setForm({
      exam_id: filterExam || (exams[0]?.id ?? ''),
      name: '',
      duration_minutes: 60,
      sort_order: 0,
    });
    setShow(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      exam_id: String(row.exam_id),
      name: row.name,
      duration_minutes: row.duration_minutes,
      sort_order: row.sort_order ?? 0,
    });
    setShow(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      ...form,
      exam_id: Number(form.exam_id),
      duration_minutes: Number(form.duration_minutes),
      sort_order: Number(form.sort_order) || 0,
    };
    if (editId) {
      await api.put(`/admin/sections/${editId}`, {
        name: payload.name,
        duration_minutes: payload.duration_minutes,
        sort_order: payload.sort_order,
      });
    } else {
      await api.post('/admin/sections', payload);
    }
    setShow(false);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this section?')) {
      return;
    }
    await api.delete(`/admin/sections/${id}`);
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
          <i className="bi bi-layout-three-columns text-br-rose" aria-hidden />
          Sections
        </h1>
        <Button className="d-inline-flex align-items-center gap-1" onClick={openCreate} disabled={!exams.length}>
          <i className="bi bi-plus-lg" aria-hidden />
          Add section
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
              <th>Exam</th>
              <th>Name</th>
              <th>Duration (min)</th>
              <th>Order</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.exam?.name ?? r.exam_id}</td>
                <td>{r.name}</td>
                <td>{r.duration_minutes}</td>
                <td>{r.sort_order}</td>
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

      <Modal show={show} onHide={() => setShow(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editId ? 'Edit section' : 'New section'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={save}>
          <Modal.Body>
            {!editId && (
              <Form.Group className="mb-3">
                <Form.Label>Exam</Form.Label>
                <Form.Select
                  value={form.exam_id}
                  onChange={(e) => setForm((f) => ({ ...f, exam_id: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Section name</Form.Label>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Reading, Listening, …"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Duration (minutes)</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={600}
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Sort order</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
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
