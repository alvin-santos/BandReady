import { useEffect, useState } from 'react';
import { Button, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { forumInitials } from '../utils/forumUi.js';
import { pickAd } from '../utils/pickAd.js';

function formatPostDate(iso) {
  if (!iso) {
    return '';
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function ForumPost({ postNumber, authorName, createdAt, body, isOp }) {
  const initials = forumInitials(authorName);
  return (
    <article className={`br-forum-post${isOp ? ' br-forum-post--op' : ''}`}>
      <div className="br-forum-post__bar">
        <span className="br-forum-post__num">#{postNumber}</span>
        <span className="text-muted">{formatPostDate(createdAt)}</span>
      </div>
      <div className="br-forum-post__inner">
        <div className="br-forum-usercol">
          <div className="br-forum-avatar" aria-hidden>
            {initials}
          </div>
          <div className="br-forum-username">{authorName}</div>
          <div className="br-forum-usermeta text-muted">Member</div>
        </div>
        <div className="br-forum-body">
          <div className="br-forum-body-text">{body}</div>
        </div>
      </div>
    </article>
  );
}

export default function ForumThread() {
  const { threadId } = useParams();
  const { user, isSubscribed } = useAuth();
  const verified = !!user?.email_verified;
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyErr, setReplyErr] = useState('');
  const [leaderboardAd, setLeaderboardAd] = useState(null);
  const [sidebarAd, setSidebarAd] = useState(null);
  const [threadInlineAd, setThreadInlineAd] = useState(null);

  useEffect(() => {
    if (isSubscribed) {
      setLeaderboardAd(null);
      setSidebarAd(null);
      setThreadInlineAd(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get('/ads', { params: { location: 'forum_leaderboard' } }),
      api.get('/ads', { params: { location: 'forum_sidebar' } }),
      api.get('/ads', { params: { location: 'forum_thread_inline' } }),
    ]).then(([lb, side, inline]) => {
      if (!cancelled) {
        setLeaderboardAd(pickAd(lb.data));
        setSidebarAd(pickAd(side.data));
        setThreadInlineAd(pickAd(inline.data));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSubscribed]);

  function load() {
    setLoading(true);
    api
      .get(`/forum/threads/${threadId}`)
      .then((res) => {
        setThread(res.data);
        setErr('');
      })
      .catch(() => setErr('Could not load this thread.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [threadId]);

  async function sendReply(e) {
    e.preventDefault();
    setReplyErr('');
    setReplying(true);
    try {
      await api.post(`/forum/threads/${threadId}/replies`, { body: replyBody });
      setReplyBody('');
      load();
    } catch (ex) {
      const msg = ex.response?.data?.message;
      const errors = ex.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        setReplyErr(Object.values(errors).flat().join(' '));
      } else {
        setReplyErr(msg || 'Could not post reply.');
      }
    } finally {
      setReplying(false);
    }
  }

  if (loading && !thread) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  if (err || !thread) {
    return (
      <Container className="py-4">
        <p className="text-danger">{err || 'Not found.'}</p>
        <Link to="/forum">Back to forum</Link>
      </Container>
    );
  }

  const replies = Array.isArray(thread.replies) ? thread.replies : [];
  const opName = thread.user?.name ?? 'Member';

  return (
    <Container className="py-4 br-forum">
      <Row className="g-3 g-lg-4">
        <Col lg={8}>
          <nav className="br-forum-breadcrumb" aria-label="Breadcrumb">
            <Link to="/forum">Community forum</Link>
            <span className="mx-1">›</span>
            <Link to={`/forum/category/${thread.forum_category_id}`}>{thread.category?.name ?? 'Topic'}</Link>
            <span className="mx-1">›</span>
            <span className="text-body text-truncate d-inline-block" style={{ maxWidth: '14rem', verticalAlign: 'bottom' }}>
              {thread.title}
            </span>
          </nav>

          <AdSlot location="forum_leaderboard" ad={leaderboardAd} surface="forum" />

          <h1 className="br-forum-thread-title">{thread.title}</h1>

          <ForumPost
            postNumber={1}
            authorName={opName}
            createdAt={thread.created_at}
            body={thread.body}
            isOp
          />

          {replies.length > 0 && (
            <h2 className="h6 fw-bold text-muted text-uppercase small letter-spacing mb-2 mt-4">
              Replies · {replies.length}
            </h2>
          )}
          {replies.map((r, i) => (
            <ForumPost
              key={r.id}
              postNumber={i + 2}
              authorName={r.user?.name ?? 'Member'}
              createdAt={r.created_at}
              body={r.body}
            />
          ))}

          <AdSlot location="forum_thread_inline" ad={threadInlineAd} surface="forum" />

          {verified ? (
            <div className="br-forum-reply-box">
              <div className="br-forum-compose__head">Quick reply</div>
              <div className="br-forum-compose__body">
                <Form onSubmit={sendReply}>
                  <Form.Group className="mb-3">
                    <Form.Control
                      as="textarea"
                      rows={5}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      required
                      minLength={1}
                      maxLength={12000}
                      placeholder="Write your reply…"
                    />
                  </Form.Group>
                  {replyErr && <p className="text-danger small mb-2">{replyErr}</p>}
                  <Button type="submit" disabled={replying} className="d-inline-flex align-items-center gap-2">
                    {replying ? <Spinner animation="border" size="sm" /> : <i className="bi bi-reply-fill" aria-hidden />}
                    Post reply
                  </Button>
                </Form>
              </div>
            </div>
          ) : (
            <div className="br-forum-toolbar-note mt-4">
              <Link to="/login">Log in</Link> with a verified email to reply to this thread.
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
