import axios from 'axios';

/**
 * Resolves API base URL.
 * - If VITE_API_URL is unset: use relative `/api` (Vite dev server proxies to backend — see vite.config.js).
 * - If set to e.g. `http://127.0.0.1:8080`, `/api` is appended so requests go directly to Laravel (bypasses proxy).
 * - If set to `http://127.0.0.1:8080/api`, it is used as-is.
 */
function resolveApiBase() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw == null || String(raw).trim() === '') {
    return '/api';
  }
  let u = String(raw).trim().replace(/\/$/, '');
  if (!u.endsWith('/api')) {
    u += '/api';
  }
  return u;
}

const baseURL = resolveApiBase();

export const api = axios.create({
  baseURL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const guest = localStorage.getItem('guest_session');
  if (guest) {
    config.headers['X-Guest-Session'] = guest;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export function setGuestSession(uuid) {
  if (uuid) {
    localStorage.setItem('guest_session', uuid);
  } else {
    localStorage.removeItem('guest_session');
  }
}

export function clearGuestSession() {
  localStorage.removeItem('guest_session');
}

/**
 * Download a gated resource file (auth + optional Pro). Uses blob response.
 */
export async function downloadResourceFile(slug, fallbackFilename = 'download.txt') {
  const res = await api.get(`/resources/${encodeURIComponent(slug)}/download`, { responseType: 'blob' });
  const cd = res.headers['content-disposition'];
  let name = fallbackFilename;
  if (cd && /filename=/i.test(cd)) {
    const m = cd.match(/filename\*?=(?:UTF-8'')?("?)([^";\n]+)\1/i);
    if (m?.[2]) {
      name = decodeURIComponent(m[2].trim());
    }
  }
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
