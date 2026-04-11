import { useEffect, useState } from 'react';
import { Badge, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

const LOCATIONS = [
  { value: 'top_banner', label: 'Top banner (728×90 area)' },
  { value: 'sidebar', label: 'Sidebar (300×250 area)' },
  { value: 'between_sections', label: 'Between sections (responsive)' },
  { value: 'exam_rail_left', label: 'Exam — left rail (under question list)' },
  { value: 'exam_rail_right', label: 'Exam — right rail (under instructions)' },
  { value: 'resources_a', label: 'Resources page — slot A (above list)' },
  { value: 'resources_b', label: 'Resources page — slot B (below list)' },
  { value: 'rankings_a', label: 'Rankings — slot A (above filters)' },
  { value: 'rankings_b', label: 'Rankings — slot B (below table)' },
  { value: 'results_a', label: 'Results page — slot A' },
  { value: 'results_b', label: 'Results page — slot B' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'forum_leaderboard', label: 'Forum — leaderboard (728×90)' },
  { value: 'forum_sidebar', label: 'Forum — thread sidebar (300×250)' },
  { value: 'forum_category_inline', label: 'Forum — board page inline (above thread list)' },
  { value: 'forum_thread_inline', label: 'Forum — thread inline (above quick reply)' },
];

const emptyForm = {
  title: '',
  location: 'top_banner',
  script: '',
  image: '',
  link: '',
  active: true,
};

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  async function load() {
    const res = await api.get('/admin/ads');
    setAds(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShow(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      title: row.title,
      location: row.location,
      script: row.script ?? '',
      image: row.image ?? '',
      link: row.link ?? '',
      active: !!row.active,
    });
    setShow(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      title: form.title,
      location: form.location,
      script: form.script || null,
      image: form.image || null,
      link: form.link || null,
      active: form.active,
    };
    if (editId) {
      await api.put(`/admin/ads/${editId}`, payload);
    } else {
      await api.post('/admin/ads', payload);
    }
    setShow(false);
    load();
  }

  async function remove(id) {
    if (!window.confirm('Delete this advertisement?')) {
      return;
    }
    await api.delete(`/admin/ads/${id}`);
    load();
  }

  async function toggle(id, active) {
    await api.put(`/admin/ads/${id}`, { active });
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
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h3 fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-badge-ad-fill text-br-rose" aria-hidden />
            Advertisements
          </h1>
          <p className="text-muted small mb-0">
            Control what appears in each slot. Use <strong>Image URL</strong> + <strong>Link</strong> for simple banners,
            or paste ad network <strong>HTML/JS</strong> into Script (shown when set).
          </p>
        </div>
        <Button className="d-inline-flex align-items-center gap-1" onClick={openCreate}>
          <i className="bi bi-plus-lg" aria-hidden />
          New ad
        </Button>
      </div>

      <div className="table-responsive br-card p-3 mb-4">
        <Table hover size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Title</th>
              <th>Location</th>
              <th>Link</th>
              <th>Clicks</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.id}>
                <td className="fw-medium">{a.title}</td>
                <td>
                  <code className="small">{a.location}</code>
                </td>
                <td className="small text-truncate" style={{ maxWidth: 160 }}>
                  {a.link ? (
                    <a href={a.link} target="_blank" rel="noreferrer">
                      {a.link}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{a.clicks}</td>
                <td>
                  {a.active ? (
                    <Badge bg="success">Active</Badge>
                  ) : (
                    <Badge bg="secondary">Off</Badge>
                  )}
                </td>
                <td className="text-end text-nowrap">
                  <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(a)}>
                    <i className="bi bi-pencil" aria-hidden />
                  </Button>
                  <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => toggle(a.id, !a.active)}>
                    {a.active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => remove(a.id)}>
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
          <Modal.Title>{editId ? 'Edit advertisement' : 'New advertisement'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={save}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Title (internal label)</Form.Label>
              <Form.Control
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Placement</Form.Label>
              <Form.Select
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              >
                {LOCATIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                The frontend loads ads by location key; only one active creative per campaign is typical—use title to
                distinguish versions.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Click-through URL</Form.Label>
              <Form.Control
                type="url"
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://…"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Image URL (optional)</Form.Label>
              <Form.Control
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="https://…/banner.png"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Custom HTML / script (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                value={form.script}
                onChange={(e) => setForm((f) => ({ ...f, script: e.target.value }))}
                placeholder="Paste third-party ad tag or custom markup. If set, it replaces the image/link card in AdSlot."
                className="font-monospace small"
                spellCheck={false}
              />
            </Form.Group>
            <Form.Check
              type="switch"
              id="ad-active-modal"
              label="Active (shown in app when matching location)"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button type="submit" className="d-inline-flex align-items-center gap-1">
              <i className="bi bi-save" aria-hidden />
              Save
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
