/**
 * URL to start Google OAuth (Laravel web route, not under /api).
 * Uses /oauth/google (not /auth/google) so the SPA route /auth/google is free for the token callback.
 * With VITE_API_URL: hits the API host. Without: same-origin /oauth/google (Vite proxy → Laravel).
 */
export function googleOAuthStartUrl() {
  const path = '/oauth/google';
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (raw) {
    let base = raw.replace(/\/$/, '');
    if (base.endsWith('/api')) {
      base = base.slice(0, -4);
    }
    return `${base}${path}`;
  }
  return path;
}
