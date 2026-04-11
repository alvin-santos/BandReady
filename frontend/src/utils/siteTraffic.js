import { api } from '../api/client.js';

const STORAGE_KEY = 'br_visitor_id';
/** Captured once per tab: external URL that linked to this app (empty if direct / bookmark / stripped). */
const ENTRY_REFERRER_KEY = 'br_entry_referrer';

/**
 * The referring page when the user first opened this site in the tab (same as the browser's initial
 * `document.referrer` for that load). Stored in sessionStorage so every analytics ping carries the same
 * "how they arrived" value; it does not change on in-app SPA navigations.
 */
export function getCapturedEntryReferrer() {
  if (typeof document === 'undefined' || typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const existing = sessionStorage.getItem(ENTRY_REFERRER_KEY);
    if (existing !== null) {
      const s = String(existing).trim();
      return s === '' ? null : s.slice(0, 1024);
    }
    const fromDoc = String(document.referrer || '').trim();
    sessionStorage.setItem(ENTRY_REFERRER_KEY, fromDoc);
    return fromDoc === '' ? null : fromDoc.slice(0, 1024);
  } catch {
    const fromDoc = String(document.referrer || '').trim();
    return fromDoc === '' ? null : fromDoc.slice(0, 1024);
  }
}

export function getOrCreateVisitorId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Records a SPA page view for admin traffic analytics (anonymous visitor id + optional auth).
 */
export function recordSiteVisit(path) {
  const visitor_id = getOrCreateVisitorId();
  const ref = getCapturedEntryReferrer();
  return api
    .post('/site-traffic/visit', {
      visitor_id,
      path: String(path).slice(0, 512),
      referrer: ref || undefined,
    })
    .catch(() => {});
}
