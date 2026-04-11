import { useEffect, useState } from 'react';
import { Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

const emptyForm = {
  title: '',
  slug: '',
  description: '',
  requires_pro: false,
  sort_order: 0,
  is_active: true,
  body_text: '',
  download_filename: 'guide.txt',
  mime_type: 'text/plain',
};

export default function AdminDownloads() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    return api
      .get('/admin/downloadables')
      .then((res) => setRows(res.data || []))
      .catch(() => setErr('Could not load downloadables.'));
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShow(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      title: row.title,
      slug: row.slug,
      description: row.description ?? '',
      requires_pro: !!row.requires_pro,
      sort_order: row.sort_order ?? 0,
      is_active: !!row.is_active,
      body_text: row.body_text ?? '',
      download_filename: row.download_filename ?? 'guide.txt',
      mime_type: row.mime_type ?? 'text/plain',
    });
    setShow(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = { ...form };
      if (!payload.slug?.trim()) {
        delete payload.slug;
      }
      if (editId) {
        await api.put(`/admin/downloadables/${editId}`, payload);
      } else {
        await api.post('/admin/downloadables', payload);
      }
      setShow(false);
      load();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this resource?')) {
      return;
    }
    try {
      await api.delete(`/admin/downloadables/${id}`);
      load();
    } catch {
      setErr('Delete failed.');
    }
  }

  if (loading && rows.length === 0 && !err) {
    return (
      <div className="py-5 text-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-file-earmark-arrow-down text-br-rose" aria-hidden />
          Downloadable resources
        </h1>
        <Button onClick={openNew} className="d-inline-flex align-items-center gap-1">
          <i className="bi bi-plus-lg" aria-hidden />
          Add resource
        </Button>
      </div>
      <p className="text-muted small mb-3">
        Content is served as downloads (text/plain by default). Pro-only items require an active subscription on the public
        resources page.
      </p>
      {err && (
        <p className="text-danger small mb-3" role="alert">
          {err}
        </p>
      )}

      <div className="br-card p-0 overflow-hidden">
        <Table responsive hover className="mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Pro</th>
              <th>Order</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="fw-semibold">{r.title}</td>
                <td>
                  <code className="small">{r.slug}</code>
                </td>
                <td>{r.requires_pro ? 'Yes' : 'No'}</td>
                <td>{r.sort_order}</td>
                <td>{r.is_active ? 'Yes' : 'No'}</td>
                <td className="text-end">
                  <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(r)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => remove(r.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal show={show} onHide={() => !saving && setShow(false)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>{editId ? 'Edit resource' : 'New resource'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={save}>
          <Modal.Body>
            <Form.Group className="mb-2">
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Slug (optional, auto if empty)</Form.Label>
              <Form.Control
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="my-guide"
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Form.Group>
            <div className="d-flex flex-wrap gap-3 mb-2">
              <Form.Check
                type="switch"
                id="req-pro"
                checked={form.requires_pro}
                onChange={(e) => setForm((f) => ({ ...f, requires_pro: e.target.checked }))}
                label="Requires Pro"
              />
              <Form.Check
                type="switch"
                id="active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                label="Active"
              />
            </div>
            <Form.Group className="mb-2">
              <Form.Label>Sort order</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>Download filename</Form.Label>
              <Form.Control
                value={form.download_filename}
                onChange={(e) => setForm((f) => ({ ...f, download_filename: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label>MIME type</Form.Label>
              <Form.Control
                value={form.mime_type}
                onChange={(e) => setForm((f) => ({ ...f, mime_type: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-0">
              <Form.Label>File body (plain text)</Form.Label>
              <Form.Control
                as="textarea"
                rows={12}
                value={form.body_text}
                onChange={(e) => setForm((f) => ({ ...f, body_text: e.target.value }))}
                className="font-monospace small"
                required
                spellCheck={false}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShow(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner animation="border" size="sm" /> : 'Save'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
