import { useEffect, useMemo, useState } from 'react';
import { Alert, Container, Spinner } from 'react-bootstrap';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { absoluteUrl, getSiteOrigin } from '../seo/siteOrigin.js';
import { api } from '../api/client.js';

function renderMarkdownish(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let list = null;

  function flushList() {
    if (list && list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="text-body-secondary ps-3 mb-3">
          {list.map((li) => (
            <li key={li} className="mb-1">
              {li}
            </li>
          ))}
        </ul>,
      );
    }
    list = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('- ')) {
      list = list || [];
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (!line.trim()) {
      out.push(<div key={`sp-${out.length}`} style={{ height: 10 }} />);
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(
        <h2 key={`h2-${out.length}`} className="h5 fw-bold text-body mt-3 mb-2">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(
        <h3 key={`h3-${out.length}`} className="h6 fw-bold text-body mt-3 mb-2">
          {line.slice(4)}
        </h3>,
      );
      continue;
    }
    out.push(
      <p key={`p-${out.length}`} className="text-body-secondary mb-2">
        {line}
      </p>,
    );
  }
  flushList();
  return out;
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    api
      .get(`/posts/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!cancelled) {
          setPost(res.data?.post || null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load this article.');
          setPost(null);
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
  }, [slug]);

  const seo = useMemo(() => {
    const title = post?.title ? `${post.title} — BandReady Blog` : 'BandReady Blog';
    const description =
      (post?.excerpt && String(post.excerpt).trim()) ||
      'BandReady blog article about CELPIP and IELTS preparation strategies, study plans, and practice routines.';
    const keywords = [
      'BandReady',
      'CELPIP',
      'IELTS',
      'English exam preparation',
      'speaking practice',
      'writing evaluation',
      'study plan',
    ].join(', ');
    const canonical = absoluteUrl(`/blog/${slug}`);
    const origin = getSiteOrigin();
    const ogImage = origin ? `${origin}/bandready-mark.png` : '/bandready-mark.png';
    const publishedTime = post?.created_at ? String(post.created_at) : null;
    const articleJsonLd = post?.title
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: String(post.title),
          description,
          mainEntityOfPage: canonical,
          url: canonical,
          image: [ogImage],
          datePublished: publishedTime || undefined,
          dateModified: post?.updated_at ? String(post.updated_at) : undefined,
          author: {
            '@type': 'Organization',
            name: 'BandReady',
          },
          publisher: {
            '@type': 'Organization',
            name: 'BandReady',
            logo: {
              '@type': 'ImageObject',
              url: ogImage,
            },
          },
        }
      : null;
    return { title, description, keywords, canonical, ogImage, articleJsonLd };
  }, [post, slug]);

  if (loading) {
    return (
      <Container className="py-4 py-lg-5" style={{ maxWidth: '46rem' }}>
        <div className="py-5 text-center text-muted">
          <Spinner animation="border" size="sm" className="me-2" aria-hidden />
          Loading article…
        </div>
      </Container>
    );
  }

  if (err) {
    return (
      <Container className="py-4 py-lg-5" style={{ maxWidth: '46rem' }}>
        <Alert variant="danger" className="border-0">
          {err}
        </Alert>
        <Link to="/blog" className="fw-semibold text-decoration-none">
          <i className="bi bi-arrow-left me-1" aria-hidden />
          Back to blog
        </Link>
      </Container>
    );
  }

  if (!post) {
    return (
      <Container className="py-4 py-lg-5" style={{ maxWidth: '46rem' }}>
        <h1 className="h3 fw-bold mb-2">Post not found</h1>
        <p className="text-muted mb-3">The article you requested doesn’t exist (or the link is outdated).</p>
        <Link to="/blog" className="fw-semibold text-decoration-none">
          <i className="bi bi-arrow-left me-1" aria-hidden />
          Back to blog
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-4 py-lg-5" style={{ maxWidth: '46rem' }}>
      <Helmet prioritizeSeoTags>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <link rel="canonical" href={seo.canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="BandReady" />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={seo.canonical} />
        <meta property="og:image" content={seo.ogImage} />
        {seo.articleJsonLd ? <script type="application/ld+json">{JSON.stringify(seo.articleJsonLd)}</script> : null}
      </Helmet>
      <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-journal-text" aria-hidden />
        Blog
      </p>
      <h1 className="h2 fw-bold mb-2">{post.title}</h1>
      <div className="d-flex flex-wrap align-items-center gap-2 small text-muted mb-4">
        <span className="d-inline-flex align-items-center gap-1">
          <i className="bi bi-calendar3" aria-hidden />
          {String(post.created_at || '').slice(0, 10) || '—'}
        </span>
      </div>

      <article className="br-card p-4">
        {renderMarkdownish(post.content)}
        <hr />
        <p className="small text-muted mb-0">
          BandReady is an independent practice platform. Learn more on{' '}
          <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
            the practice disclaimer
          </Link>
          .
        </p>
      </article>

      <p className="mt-3 mb-0">
        <Link to="/blog" className="fw-semibold text-decoration-none">
          <i className="bi bi-arrow-left me-1" aria-hidden />
          Back to blog
        </Link>
      </p>
    </Container>
  );
}

