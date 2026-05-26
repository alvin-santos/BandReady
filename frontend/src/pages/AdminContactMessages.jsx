import { useEffect, useState } from 'react';
import { Badge, Button, Modal, Pagination, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';

const categoryLabel = (c) => {
  if (c === 'feedback') {
    return 'Feedback';
  }
  if (c === 'question') {
    return 'Question';
  }
  if (c === 'advertising') {
    return 'Advertising';
  }
  return 'Other';
};

export default function AdminContactMessages() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  async function load(p = page) {
    setLoading(true);
    try {
      const res = await api.get('/admin/contact-messages', { params: { page: p, per_page: 25 } });
      setPayload(res.data);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page);
  }, [page]);

  async function markRead(id) {
    await api.post(`/admin/contact-messages/${id}/read`);
    load(page);
    setDetail((d) => (d && d.id === id ? { ...d, read_at: new Date().toISOString() } : d));
  }

  async function markUnread(id) {
    await api.post(`/admin/contact-messages/${id}/unread`);
    load(page);
    setDetail((d) => (d && d.id === id ? { ...d, read_at: null } : d));
  }

  if (loading && !payload) {
    return (
      <div className="text-center py-5">
        <Spinner />
      </div>
    );
  }

  const rows = payload?.data ?? [];
  const lastPage = payload?.last_page ?? 1;

  return (
    <div>
      <h1 className="h3 fw-bold mb-4 d-flex align-items-center gap-2">
        <i className="bi bi-envelope-open text-br-rose" aria-hidden />
        Contact messages
      </h1>
      <p className="text-muted small mb-3">
        Messages sent from <strong>Contact</strong>, <strong>Advertise</strong>, and related public forms (guests and
        signed-in users).
      </p>

      {rows.length === 0 ? (
        <p className="text-muted">No messages yet.</p>
      ) : (
        <>
          <div className="table-responsive br-card">
            <Table hover size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>Topic</th>
                  <th>Account</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={!row.read_at ? 'table-light' : ''}>
                    <td className="text-nowrap small">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </td>
                    <td>
                      <div className="fw-semibold small">{row.name}</div>
                      <div className="text-muted small">{row.email}</div>
                    </td>
                    <td>
                      <Badge bg="secondary" className="fw-normal">
                        {categoryLabel(row.category)}
                      </Badge>
                    </td>
                    <td className="small">
                      {row.user_id ? (
                        <span title="User ID">#{row.user_id}</span>
                      ) : (
                        <span className="text-muted">Guest</span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      {!row.read_at && (
                        <Badge bg="warning" text="dark" className="me-1">
                          New
                        </Badge>
                      )}
                      <Button size="sm" variant="outline-primary" onClick={() => setDetail(row)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {lastPage > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination>
                <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
                <Pagination.Item active>{page}</Pagination.Item>
                <Pagination.Next disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} />
              </Pagination>
            </div>
          )}
        </>
      )}

      <Modal show={detail != null} onHide={() => setDetail(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="h6">
            Message #{detail?.id}{' '}
            {detail?.read_at ? (
              <Badge bg="secondary" className="ms-1 fw-normal">
                Read
              </Badge>
            ) : (
              <Badge bg="warning" text="dark" className="ms-1 fw-normal">
                Unread
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail && (
            <>
              <p className="small text-muted mb-2">
                {detail.created_at ? new Date(detail.created_at).toLocaleString() : ''} · {categoryLabel(detail.category)} ·{' '}
                {detail.ip_address || 'IP n/a'}
              </p>
              <p className="mb-1">
                <strong>{detail.name}</strong> &lt;{detail.email}&gt;
              </p>
              {detail.user && (
                <p className="small text-muted mb-3">
                  Linked user: {detail.user.name} ({detail.user.email}) · ID {detail.user_id}
                </p>
              )}
              {!detail.user && detail.user_id && (
                <p className="small text-muted mb-3">User ID: {detail.user_id}</p>
              )}
              <hr />
              <div className="small" style={{ whiteSpace: 'pre-wrap' }}>
                {detail.message}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          {detail && !detail.read_at && (
            <Button variant="primary" onClick={() => markRead(detail.id)}>
              Mark as read
            </Button>
          )}
          {detail && detail.read_at && (
            <Button variant="outline-secondary" onClick={() => markUnread(detail.id)}>
              Mark unread
            </Button>
          )}
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
