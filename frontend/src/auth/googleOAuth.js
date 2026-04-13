/**
 * URL to start Google OAuth (Laravel web route, not under /api).
 * Uses VITE_API_URL origin when set; otherwise same-origin `/auth/google` (Vite dev proxy).
 */
export function googleOAuthStartUrl() {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (raw) {
    let base = raw.replace(/\/$/, '');
    if (base.endsWith('/api')) {
      base = base.slice(0, -4);
    }
    return `${base}/auth/google`;
  }
  return '/auth/google';
}
