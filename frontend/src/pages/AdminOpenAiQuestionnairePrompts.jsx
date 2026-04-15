import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { CELPIP_SECTION_TASKS } from '../data/celpipOfficialTasks.js';

const SECTIONS = ['Listening', 'Reading', 'Writing', 'Speaking'];

const emptyEdit = {
  body: '',
  exam_title: '',
  test_title: '',
  section: '',
  celpip_task_number: '',
};

function formatWhen(iso) {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

export default function AdminOpenAiQuestionnairePrompts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyEdit);
  const [saveBusy, setSaveBusy] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await api.get('/admin/openai-questionnaire/extra-prompts', { params: { limit: 500 } });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setErr(e.response?.data?.message || e.message || 'Failed to load prompts.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const celpipOptions = useMemo(() => {
    const sec = form.section;
    if (!sec || !SECTIONS.includes(sec)) {
      return [];
    }
    return CELPIP_SECTION_TASKS[sec] ?? [];
  }, [form.section]);

  function openCreate() {
    setEditId(null);
    setForm(emptyEdit);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      body: row.body ?? '',
      exam_title: row.exam_title ?? '',
      test_title: row.test_title ?? '',
      section: row.section && SECTIONS.includes(row.section) ? row.section : '',
      celpip_task_number:
        row.celpip_task_number != null && Number.isFinite(Number(row.celpip_task_number))
          ? String(Math.trunc(Number(row.celpip_task_number)))
          : '',
    });
    setModalOpen(true);
  }

  function openView(row) {
    setViewRow(row);
  }

  async function saveModal(e) {
    e.preventDefault();
    const body = form.body.trim();
    if (!body) {
      setErr('Prompt text cannot be empty.');
      return;
    }
    setSaveBusy(true);
    setErr('');
    const et = form.exam_title.trim();
    const tt = form.test_title.trim();
    const sec = form.section && SECTIONS.includes(form.section) ? form.section : null;
    const tn = Number.parseInt(String(form.celpip_task_number), 10);
    const taskNum = sec && !Number.isNaN(tn) && tn >= 1 ? tn : null;
    const taskLabel =
      taskNum != null ? celpipOptions.find((t) => t.id === taskNum)?.label ?? null : null;

    const payload = { body };
    if (editId == null) {
      if (et) {
        payload.exam_title = et;
      }
      if (tt) {
        payload.test_title = tt;
      }
      if (sec) {
        payload.section = sec;
      }
      if (taskNum != null) {
        payload.celpip_task_number = taskNum;
      }
      if (taskLabel) {
        payload.celpip_task_label = taskLabel;
      }
    } else {
      payload.exam_title = et || null;
      payload.test_title = tt || null;
      payload.section = sec;
      payload.celpip_task_number = taskNum;
      payload.celpip_task_label = taskLabel;
    }
    try {
      if (editId == null) {
        await api.post('/admin/openai-questionnaire/extra-prompts', payload);
      } else {
        await api.put(`/admin/openai-questionnaire/extra-prompts/${editId}`, payload);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      const d = e.response?.data;
      let msg = d?.message || e.message || 'Save failed';
      if (d?.errors && typeof d.errors === 'object') {
        const flat = Object.values(d.errors)
          .flat()
          .filter(Boolean)
          .join(' ');
        if (flat) {
          msg = flat;
        }
      }
      setErr(msg);
    } finally {
      setSaveBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm(`Delete saved prompt #${id}? This cannot be undone.`)) {
      return;
    }
    setErr('');
    try {
      await api.delete(`/admin/openai-questionnaire/extra-prompts/${id}`);
      setViewRow((r) => (r && r.id === id ? null : r));
      await load();
    } catch (e) {
      setErr(e.response?.data?.message || e.message || 'Delete failed.');
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-journal-text text-br-rose" aria-hidden />
          Saved questionnaire prompts
        </h1>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" aria-hidden />
            New prompt
          </Button>
          <Button variant="outline-secondary" size="sm" type="button" disabled={loading} onClick={() => void load()}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden />
            Refresh
          </Button>
          <Link to="/admin/openai-questionnaire" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-robot me-1" aria-hidden />
            AI generate
          </Link>
        </div>
      </div>
      <p className="text-muted small mb-3">
        Extra instructions stored for <code className="text-body">--prompt</code>. Editing text updates the dedupe hash;
        you cannot save the same wording as another row.
      </p>

      {err && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted small">
          <Spinner animation="border" size="sm" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted small mb-0">No saved prompts yet. Add one here or save from the AI generate page.</p>
      ) : (
        <div className="br-card p-0 overflow-auto">
          <Table hover responsive className="mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th className="text-nowrap">#</th>
                <th>Exam</th>
                <th>Section</th>
                <th>CELPIP task</th>
                <th>Preview</th>
                <th className="text-nowrap">Updated</th>
                <th className="text-end text-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="text-muted">{row.id}</td>
                  <td>{row.exam_title || <span className="text-muted">—</span>}</td>
                  <td>{row.section || <span className="text-muted">All</span>}</td>
                  <td>
                    {row.celpip_task_number != null ? (
                      <>
                        <span className="text-muted">T{row.celpip_task_number}</span>
                        {row.celpip_task_label ? (
                          <>
                            <br />
                            <span className="text-body">{row.celpip_task_label}</span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: '280px' }} className="text-break">
                    {row.preview || '(empty)'}
                  </td>
                  <td className="text-nowrap text-muted">{formatWhen(row.updated_at)}</td>
                  <td className="text-end text-nowrap">
                    <Button variant="outline-primary" size="sm" className="me-1" onClick={() => openView(row)}>
                      View
                    </Button>
                    <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={() => void remove(row.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal show={viewRow != null} onHide={() => setViewRow(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Saved prompt #{viewRow?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewRow && (
            <>
              <dl className="row small mb-3">
                <dt className="col-sm-3">Exam</dt>
                <dd className="col-sm-9">{viewRow.exam_title || '—'}</dd>
                <dt className="col-sm-3">Test title</dt>
                <dd className="col-sm-9">{viewRow.test_title || '—'}</dd>
                <dt className="col-sm-3">Section</dt>
                <dd className="col-sm-9">{viewRow.section || 'All sections'}</dd>
                <dt className="col-sm-3">CELPIP task</dt>
                <dd className="col-sm-9">
                  {viewRow.celpip_task_number != null
                    ? `Task ${viewRow.celpip_task_number}${viewRow.celpip_task_label ? ` — ${viewRow.celpip_task_label}` : ''}`
                    : '—'}
                </dd>
                <dt className="col-sm-3">Updated</dt>
                <dd className="col-sm-9">{formatWhen(viewRow.updated_at)}</dd>
              </dl>
              <div className="small fw-semibold mb-1">Full text</div>
              <pre className="br-admin-terminal small mb-0 p-3" style={{ whiteSpace: 'pre-wrap', maxHeight: '50vh', overflow: 'auto' }}>
                {viewRow.body}
              </pre>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
          {viewRow && (
            <Button
              variant="primary"
              onClick={() => {
                openEdit(viewRow);
                setViewRow(null);
              }}
            >
              Edit this prompt
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      <Modal show={modalOpen} onHide={() => !saveBusy && setModalOpen(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editId == null ? 'New saved prompt' : `Edit prompt #${editId}`}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={(e) => void saveModal(e)}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Prompt text</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                required
                className="font-monospace small"
              />
            </Form.Group>
            <Row className="g-2 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">Exam title</Form.Label>
                  <Form.Control
                    value={form.exam_title}
                    onChange={(e) => setForm((f) => ({ ...f, exam_title: e.target.value }))}
                    placeholder="Optional"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">Test title</Form.Label>
                  <Form.Control
                    value={form.test_title}
                    onChange={(e) => setForm((f) => ({ ...f, test_title: e.target.value }))}
                    placeholder="Optional"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row className="g-2 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">Section scope</Form.Label>
                  <Form.Select
                    value={form.section}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({
                        ...f,
                        section: v,
                        celpip_task_number: '',
                      }));
                    }}
                  >
                    <option value="">All sections (no filter)</option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">CELPIP task (optional)</Form.Label>
                  <Form.Select
                    value={form.celpip_task_number}
                    onChange={(e) => setForm((f) => ({ ...f, celpip_task_number: e.target.value }))}
                    disabled={!form.section || celpipOptions.length === 0}
                  >
                    <option value="">No single task</option>
                    {celpipOptions.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        Task {t.id} — {t.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" type="button" disabled={saveBusy} onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saveBusy}>
              {saveBusy ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
