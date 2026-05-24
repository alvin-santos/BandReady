import { isDisplayableAd } from './adDisplay.js';

/**
 * Laravel GET /ads returns a JSON array of ad rows (public API: active only).
 * @param {{ data?: unknown }} res
 * @returns {object|null}
 */
export function pickAdFromResponse(res) {
  const raw = res?.data;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray(raw.data) ? raw.data : [];
  return list.find((a) => isDisplayableAd(a)) || null;
}
