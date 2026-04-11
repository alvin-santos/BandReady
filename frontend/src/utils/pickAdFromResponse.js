/**
 * Laravel GET /ads returns a JSON array of ad rows. Normalizes axios response shapes.
 * @param {{ data?: unknown }} res
 * @returns {object|null}
 */
export function pickAdFromResponse(res) {
  const raw = res?.data;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray(raw.data) ? raw.data : [];
  if (!list.length) {
    return null;
  }
  const active = list.find((a) => a && a.active !== false && a.active !== 0);
  return active || list[0] || null;
}
