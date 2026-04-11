import { api } from '../api/client.js';

let cachedSet = null;
let cachedAt = 0;
const TTL_MS = 90_000;

/**
 * Server blocklist of stableVoiceKey strings. Cached briefly to limit requests during an exam.
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
    const arr = Array.isArray(data.disabled_keys) ? data.disabled_keys : [];
    cachedSet = new Set(arr);
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
