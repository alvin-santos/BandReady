import { useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api, downloadResourceFile } from '../api/client.js';
import AdSlot from '../components/AdSlot.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { pickAdFromResponse } from '../utils/pickAdFromResponse.js';

export default function Resources() {
  const { user, isSubscribed, isAdmin, loading: authLoading } = useAuth();
  const [adA, setAdA] = useState(null);
  const [adB, setAdB] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dlErr, setDlErr] = useState('');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/resources')
      .then((res) => {
        if (!cancelled) {
          setList(res.data?.resources || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load resources.');
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

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (isSubscribed && !isAdmin) {
      setAdA(null);
      setAdB(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [ra, rb] = await Promise.all([
          api.get('/ads', { params: { location: 'resources_a' } }),
          api.get('/ads', { params: { location: 'resources_b' } }),
        ]);
        if (cancelled) {
          return;
        }
        setAdA(pickAdFromResponse(ra));
        setAdB(pickAdFromResponse(rb));
      } catch {
        if (!cancelled) {
          setAdA(null);
          setAdB(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSubscribed, isAdmin, authLoading]);

  async function handleDownload(slug, title) {
    setDlErr('');
    setDownloading(slug);
    try {
      await downloadResourceFile(slug, `${slug}.txt`);
    } catch (e) {
      const msg = e.response?.status === 403 ? 'Pro required for this file.' : e.response?.data?.message || 'Download failed.';
      setDlErr(msg);
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  return (
    <Container className="py-4 py-md-5">
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-file-earmark-arrow-down text-br-rose" aria-hidden />
        Downloads &amp; guides
      </h1>
      <p className="text-muted mb-4">
        Printable-style text guides. <strong>Free</strong> items are available to every signed-in account;{' '}
        <strong>Pro</strong> adds writing planners and deeper checklists. Files are plain text for easy printing.
      </p>

      {!user && (
        <Alert variant="light" className="border mb-4">
          <Link to="/login">Log in</Link> to download. Some items require <Link to="/subscription">BandReady Pro</Link>.
        </Alert>
      )}

      {user && !isSubscribed && (
        <Alert variant="light" className="border mb-4">
          You are on a free account — Pro-labelled items stay locked until you subscribe.{' '}
          <Link to="/subscription">View Pro</Link>
        </Alert>
      )}

      {err && (
        <Alert variant="danger" className="mb-4">
          {err}
        </Alert>
      )}
      {dlErr && (
        <Alert variant="warning" className="mb-4" onClose={() => setDlErr('')} dismissible>
          {dlErr}
        </Alert>
      )}

      <AdSlot location="resources_a" ad={adA} />

      <Row className="g-4">
        {list.map((r) => (
          <Col md={6} lg={4} key={r.id}>
            <div className="br-card p-4 h-100 d-flex flex-column">
              <div className="d-flex flex-wrap gap-2 mb-2">
                {r.requires_pro ? (
                  <span className="badge bg-warning text-dark">Pro</span>
                ) : (
                  <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">
                    Free
                  </span>
                )}
                {r.locked && <span className="badge bg-secondary">Locked</span>}
              </div>
              <h2 className="h5 fw-bold">{r.title}</h2>
              <p className="small text-muted flex-grow-1">{r.description}</p>
              {user && r.can_download ? (
                <Button
                  size="sm"
                  className="d-inline-flex align-items-center gap-2 mt-auto"
                  disabled={downloading === r.slug}
                  onClick={() => handleDownload(r.slug, r.title)}
                >
                  {downloading === r.slug ? (
                    <>
                      <Spinner animation="border" size="sm" />
                      Downloading…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-download" aria-hidden />
                      Download
                    </>
                  )}
                </Button>
              ) : (
                <div className="mt-auto d-flex flex-wrap gap-2">
                  {!user && (
                    <Button as={Link} to="/login" size="sm" variant="primary">
                      Log in to download
                    </Button>
                  )}
                  {user && r.locked && (
                    <Button as={Link} to="/subscription" size="sm" variant="warning">
                      Unlock with Pro
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Col>
        ))}
      </Row>

      <AdSlot location="resources_b" ad={adB} />

      {list.length === 0 && !err && (
        <p className="text-muted">No resources published yet.</p>
      )}
    </Container>
  );
}
