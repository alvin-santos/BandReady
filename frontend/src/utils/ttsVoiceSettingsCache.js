import { api } from '../api/client.js';

let cachedSet = null;
let cachedAt = 0;
const TTL_MS = 90_000;

function mergeUniqueKeys(baseSet, extraArr) {
  const out = new Set(baseSet);
  if (Array.isArray(extraArr)) {
    for (const k of extraArr) {
      if (typeof k === 'string' && k) {
        out.add(k);
      }
    }
  }
  return out;
}

/**
 * Site blocklist plus optional signed-in user blocklist (stableVoiceKey strings). Cached briefly for exams.
 * @returns {Promise<Set<string>>}
 */
export async function getTtsDisabledVoiceKeysSet() {
  if (typeof window === 'undefined') {
    return new Set();
  }
  const now = Date.now();
  if (cachedSet && now - cachedAt < TTL_MS) {
    return cachedSet;
  }
  try {
    const { data } = await api.get('/tts-voice-settings');
    const site = Array.isArray(data.disabled_keys) ? data.disabled_keys : [];
    let merged = new Set(site);
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const { data: userData } = await api.get('/user/tts-voice-settings');
        merged = mergeUniqueKeys(merged, userData.user_disabled_keys);
      } catch {
        /* guest token, unverified, or network — site list only */
      }
    }
    cachedSet = merged;
    cachedAt = now;
    return cachedSet;
  } catch {
    return new Set();
  }
}

export function clearTtsDisabledVoiceKeysCache() {
  cachedSet = null;
  cachedAt = 0;
}
