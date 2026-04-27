import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { absoluteUrl, getSiteOrigin } from '../seo/siteOrigin.js';

export default function BlogIndexPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    api
      .get('/posts', { params: { published: true } })
      .then((res) => {
        const list = res.data?.posts;
        if (!cancelled) {
          setPosts(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load blog posts. Please try again.');
          setPosts([]);
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

  const items = useMemo(() => {
    return posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      date: p.created_at ? String(p.created_at).slice(0, 10) : '',
    }));
  }, [posts]);

  return (
    <div className="br-gradient-hero">
      <Helmet prioritizeSeoTags>
        <title>Blog — CELPIP &amp; IELTS preparation guides | BandReady</title>
        <meta
          name="description"
          content="BandReady blog: CELPIP and IELTS preparation guides, study plans, speaking strategies, writing improvement checklists, and exam-ready practice routines."
        />
        <meta
          name="keywords"
          content="BandReady, CELPIP, IELTS, study plan, speaking strategy, writing evaluation, exam preparation, CLB 7"
        />
        <link rel="canonical" href={absoluteUrl('/blog')} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="BandReady" />
        <meta property="og:title" content="Blog — CELPIP & IELTS preparation guides | BandReady" />
        <meta
          property="og:description"
          content="BandReady blog: CELPIP and IELTS preparation guides, study plans, speaking strategies, and writing improvement routines."
        />
        <meta property="og:url" content={absoluteUrl('/blog')} />
        <meta
          property="og:image"
          content={(getSiteOrigin() ? `${getSiteOrigin()}/bandready-mark.png` : '/bandready-mark.png')}
        />
      </Helmet>
      <Container className="py-4 py-md-5">
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-journal-text" aria-hidden />
          Blog
        </p>
        <h1 className="h2 fw-bold mb-3">
          BandReady <span className="text-br-rose">Blog</span>
        </h1>
        <p className="lead text-muted mb-4" style={{ maxWidth: '46rem' }}>
          Practical, exam-focused guides for CELPIP and IELTS preparation—planning, practice loops, speaking structure,
          writing improvement, and how to study with a timer.
        </p>

        {err && (
          <Alert variant="danger" className="border-0">
            {err}
          </Alert>
        )}
        {loading && (
          <div className="py-5 text-center text-muted">
            <Spinner animation="border" size="sm" className="me-2" aria-hidden />
            Loading posts…
          </div>
        )}

        {!loading && !err && (
          <Row className="g-4">
          {items.map((p) => (
            <Col key={p.slug} md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100 br-card">
                <Card.Body className="p-4 d-flex flex-column">
                  <div className="d-flex flex-wrap align-items-center gap-2 small text-muted mb-2">
                    <span className="d-inline-flex align-items-center gap-1">
                      <i className="bi bi-calendar3" aria-hidden />
                      {p.date || '—'}
                    </span>
                  </div>
                  <h2 className="h5 fw-bold mb-2">{p.title}</h2>
                  <p className="text-muted small mb-3">{p.excerpt || ''}</p>
                  <div className="mt-auto d-flex justify-content-between align-items-center">
                    <Link to={`/blog/${p.slug}`} className="fw-semibold text-decoration-none text-br-rose">
                      Read more
                      <i className="bi bi-arrow-right ms-1" aria-hidden />
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
        )}

        <div className="br-card p-4 mt-4">
          <h2 className="h5 fw-bold mb-2 d-flex align-items-center gap-2">
            <i className="bi bi-compass text-br-rose" aria-hidden />
            Want a structured plan?
          </h2>
          <p className="text-muted mb-0">
            If you already know your exam date, jump to the study plan flow and let BandReady turn your remaining days
            into a practical schedule.
            {' '}
            <Link to="/study-plan" className="fw-semibold text-decoration-none">
              Open study plan
            </Link>
            .
          </p>
        </div>
      </Container>
    </div>
  );
}

