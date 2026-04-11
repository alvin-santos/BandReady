import { useEffect, useState } from 'react';
import { Button, Col, Container, Form, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { pickAd } from '../utils/pickAd.js';

function formatThreadDate(iso) {
  if (!iso) {
    return '—';
  }
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ForumCategory() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { user, isSubscribed } = useAuth();
  const verified = !!user?.email_verified;
  const [payload, setPayload] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState('');
  const [leaderboardAd, setLeaderboardAd] = useState(null);
  const [categoryInlineAd, setCategoryInlineAd] = useState(null);
  const [sidebarAd, setSidebarAd] = useState(null);

  useEffect(() => {
    if (isSubscribed) {
      setLeaderboardAd(null);
      setCategoryInlineAd(null);
      setSidebarAd(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get('/ads', { params: { location: 'forum_leaderboard' } }),
      api.get('/ads', { params: { location: 'forum_category_inline' } }),
      api.get('/ads', { params: { location: 'forum_sidebar' } }),
    ]).then(([lb, inline, side]) => {
      if (!cancelled) {
        setLeaderboardAd(pickAd(lb.data));
        setCategoryInlineAd(pickAd(inline.data));
        setSidebarAd(pickAd(side.data));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSubscribed]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/forum/categories/${categoryId}/threads`, { params: { page } })
      .then((res) => {
        if (!cancelled) {
          setPayload(res.data);
          setErr('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load threads.');
          setPayload(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, page]);

  async function createThread(e) {
    e.preventDefault();
    setPostErr('');
    setPosting(true);
    try {
      const { data } = await api.post(`/forum/categories/${categoryId}/threads`, { title, body });
      setTitle('');
      setBody('');
      navigate(`/forum/thread/${data.id}`);
    } catch (ex) {
      const msg = ex.response?.data?.message;
      const errors = ex.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        setPostErr(Object.values(errors).flat().join(' '));
      } else {
        setPostErr(msg || 'Could not create thread.');
      }
    } finally {
      setPosting(false);
    }
  }

  if (loading && !payload) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  const cat = payload?.category;
  const pag = payload?.threads;
  const rows = pag?.data ?? [];
  const lastPage = pag?.last_page ?? 1;

  return (
    <Container className="py-4 br-forum">
      <Row className="g-3 g-lg-4">
        <Col lg={8}>
          <nav className="br-forum-breadcrumb" aria-label="Breadcrumb">
            <Link to="/forum">Community forum</Link>
            <span className="mx-1">›</span>
            <span className="text-body">{cat?.name ?? 'Topic'}</span>
          </nav>

          <AdSlot location="forum_leaderboard" ad={leaderboardAd} surface="forum" />

          <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
            <h1 className="h3 fw-bold mb-0">{cat?.name ?? 'Topic'}</h1>
          </div>
          {cat?.description && <p className="text-muted small mb-3">{cat.description}</p>}

          {verified ? (
            <div className="br-forum-compose">
              <div className="br-forum-compose__head">Post new topic</div>
              <div className="br-forum-compose__body">
                <Form onSubmit={createThread}>
                  <Form.Group className="mb-2">
                    <Form.Label className="small text-muted">Subject</Form.Label>
                    <Form.Control
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      maxLength={255}
                      placeholder="Thread title"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small text-muted">Message</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={5}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      required
                      minLength={3}
                      maxLength={12000}
                    />
                  </Form.Group>
                  {postErr && <p className="text-danger small mb-2">{postErr}</p>}
                  <Button type="submit" disabled={posting} className="d-inline-flex align-items-center gap-2">
                    {posting ? <Spinner animation="border" size="sm" /> : <i className="bi bi-send-fill" aria-hidden />}
                    Submit topic
                  </Button>
                </Form>
              </div>
            </div>
          ) : (
            <div className="br-forum-toolbar-note mb-3">
              <Link to="/login">Log in</Link> with a verified email to start a thread in this board.
            </div>
          )}

          <AdSlot location="forum_category_inline" ad={categoryInlineAd} surface="forum" />

          {err && <p className="text-danger small">{err}</p>}

          <div className="br-forum-board">
            <Table responsive striped hover borderless className="br-forum-table mb-0">
              <thead>
                <tr>
                  <th scope="col">Thread</th>
                  <th scope="col" className="br-forum-col-author d-none d-md-table-cell">
                    Started by
                  </th>
                  <th scope="col" className="br-forum-col-replies d-none d-md-table-cell">
                    Replies
                  </th>
                  <th scope="col" className="br-forum-col-date text-end">
                    Last activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted small py-4">
                      No threads yet — be the first to post.
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link to={`/forum/thread/${t.id}`} className="br-forum-thread-link">
                          {t.title}
                        </Link>
                        <div className="br-forum-sub mt-1 d-md-none">
                          {t.user?.name ?? 'Member'} · {t.replies_count ?? 0} repl
                          {(t.replies_count ?? 0) === 1 ? 'y' : 'ies'}
                        </div>
                      </td>
                      <td className="align-middle small text-muted d-none d-md-table-cell">
                        {t.user?.name ?? 'Member'}
                      </td>
                      <td className="text-center align-middle small text-muted d-none d-md-table-cell">
                        {t.replies_count ?? 0}
                      </td>
                      <td className="br-forum-col-date text-end align-middle">
                        {formatThreadDate(t.updated_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {lastPage > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <Pagination className="mb-0">
                <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
                <Pagination.Item active>{page}</Pagination.Item>
                <Pagination.Next disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} />
              </Pagination>
            </div>
          )}

          <div className="d-lg-none mt-3">
            <AdSlot location="forum_sidebar" ad={sidebarAd} surface="forum" />
          </div>
        </Col>

        <Col lg={4} className="d-none d-lg-block br-forum-layout__sidebar">
          <div className="br-forum-ad-sticky">
            <AdSlot location="forum_sidebar" ad={sidebarAd} surface="forum" />
          </div>
        </Col>
      </Row>
    </Container>
  );
}
