/**
 * Laravel stores public uploads under `storage/app/public` (URL path `/storage/...`).
 * In Vite dev, the SPA runs on :5173 while files are on the API host — relative `/storage`
 * URLs must not use `window.location` alone or images 404.
 */

export function getBackendPublicOrigin() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw != null && String(raw).trim() !== '') {
    try {
      return new URL(String(raw).trim()).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/**
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const t = url.trim();
  if (!t) {
    return null;
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  if (t.startsWith('/')) {
    const origin = getBackendPublicOrigin();
    return `${origin}${t}`;
  }
  return t;
}
