import { useEffect, useState } from 'react';
import { Button, Container, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

const empty = { name: '', code: '', type: 'academic' };

export default function AdminExams() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  async function load() {
    const { data } = await api.get('/admin/exams');
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditId(null);
    setForm(empty);
    setShow(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({ name: row.name, code: row.code, type: row.type });
    setShow(true);
  }

  async function save(e) {
    e.preventDefault();
    if (editId) {
      await api.put(`/admin/exams/${editId}`, form);
    } else {
      await api.post('/admin/exams', form);
    }
    setShow(false);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this exam? Tests and data may be affected.')) {
      return;
    }
    await api.delete(`/admin/exams/${id}`);
    load();
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-mortarboard text-br-rose" aria-hidden />
          Exams
        </h1>
        <Button className="d-inline-flex align-items-center gap-1" onClick={openCreate}>
          <i className="bi bi-plus-lg" aria-hidden />
          Add exam
        </Button>
      </div>

      <div className="table-responsive br-card p-3">
        <Table hover size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Code</th>
              <th>Type</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>
                  <code>{r.code}</code>
                </td>
                <td>{r.type}</td>
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
          <Modal.Title>{editId ? 'Edit exam' : 'New exam'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={save}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Code (unique slug)</Form.Label>
              <Form.Control
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
                disabled={!!editId}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Type</Form.Label>
              <Form.Control
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="e.g. academic, general, ls"
                required
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
