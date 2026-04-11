import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { absoluteUrl, getSiteOrigin } from '../seo/siteOrigin.js';
import { getRouteMeta } from '../seo/routeMeta.js';

export default function RouteSeo() {
  const { pathname } = useLocation();
  const { title, description, noIndex } = getRouteMeta(pathname);
  const canonical = absoluteUrl(pathname);
  const origin = getSiteOrigin();
  const ogImage = origin ? `${origin}/favicon.svg` : '/favicon.svg';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BandReady',
    description,
    url: origin ? `${origin}/` : '/',
  };

  return (
    <Helmet prioritizeSeoTags htmlAttributes={{ lang: 'en' }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="BandReady" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
