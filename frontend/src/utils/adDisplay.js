/**
 * Whether a public /ads row has real creative content (image or embed script).
 * Link-only rows (e.g. seeded placeholders) are not shown — AdSlot uses the open-for-advertising pitch instead.
 * @param {Record<string, unknown> | null | undefined} ad
 */
export function isDisplayableAd(ad) {
  if (!ad || typeof ad !== 'object') {
    return false;
  }
  if (ad.active === false || ad.active === 0 || ad.active === '0') {
    return false;
  }
  const script = typeof ad.script === 'string' ? ad.script.trim() : '';
  const image = typeof ad.image === 'string' ? ad.image.trim() : '';
  return !!(script || image);
}
