import { isDisplayableAd } from './adDisplay.js';

/** First displayable ad from a public /ads array. */
export function pickAd(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  return list.find((a) => isDisplayableAd(a)) || null;
}
