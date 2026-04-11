/**
 * Canonical site origin for meta tags (Open Graph, Twitter, JSON-LD).
 * Set VITE_SITE_URL in production (e.g. https://bandready.example) so previews work when the app is opened from file or SSR-less crawlers rely on env.
 * Falls back to window.location.origin in the browser.
 */
export function getSiteOrigin() {
  const env = import.meta.env.VITE_SITE_URL;
  if (typeof env === 'string' && env.trim() !== '') {
    return env.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function absoluteUrl(pathname) {
  const origin = getSiteOrigin();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!origin) {
    return path;
  }
  return `${origin}${path}`;
}
