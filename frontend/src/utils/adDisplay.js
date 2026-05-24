/**
 * Whether a public /ads row should render in AdSlot (active + has creative content).
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
  const link = typeof ad.link === 'string' ? ad.link.trim() : '';
  return !!(script || image || link);
}
