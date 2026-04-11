/** First active ad, else first row — for public /ads responses */
export function pickAd(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list.find((a) => a.active) || list[0] || null;
}
