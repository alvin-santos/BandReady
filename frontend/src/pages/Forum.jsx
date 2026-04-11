import { useEffect, useState } from 'react';
import { Container, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { pickAd } from '../utils/pickAd.js';

export default function Forum() {
  const { isSubscribed } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [leaderboardAd, setLeaderboardAd] = useState(null);
  const [indexInlineAd, setIndexInlineAd] = useState(null);

  useEffect(() => {
    if (isSubscribed) {
      setLeaderboardAd(null);
      setIndexInlineAd(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get('/ads', { params: { location: 'forum_leaderboard' } }),
      api.get('/ads', { params: { location: 'forum_category_inline' } }),
    ]).then(([lb, inline]) => {
      if (!cancelled) {
        setLeaderboardAd(pickAd(lb.data));
        setIndexInlineAd(pickAd(inline.data));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSubscribed]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/forum/categories')
      .then((res) => {
        if (!cancelled) {
          setCategories(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load forum topics.');
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
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  return (
    <Container className="py-4 py-md-5 br-forum">
      <h1 className="h3 fw-bold mb-1 d-flex align-items-center gap-2">
        <i className="bi bi-chat-square-text text-br-rose" aria-hidden />
        Community forum
      </h1>
      <p className="text-muted mb-3 small">
        Browse boards by topic. Posting requires a verified account.
      </p>
      {err && <p className="text-danger small">{err}</p>}

      <AdSlot location="forum_leaderboard" ad={leaderboardAd} surface="forum" />

      <div className="br-forum-board">
        <Table responsive striped hover borderless className="br-forum-table mb-0">
          <thead>
            <tr>
              <th scope="col">Forum</th>
              <th scope="col" className="br-forum-col-narrow">
                Topics
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/forum/category/${c.id}`} className="text-decoration-none d-block">
                    <div className="br-forum-cat-title">{c.name}</div>
                    {c.description && <div className="br-forum-sub mt-1">{c.description}</div>}
                  </Link>
                </td>
                <td className="text-center align-middle text-muted small fw-semibold">
                  {c.threads_count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {categories.length === 0 && !err && <p className="text-muted small mt-3 mb-0">No topics yet.</p>}

      <div className="mt-3">
        <AdSlot location="forum_category_inline" ad={indexInlineAd} surface="forum" />
      </div>
    </Container>
  );
}
