/**
 * Maps axios/API errors from speaking / IELTS-AI endpoints to learner-safe copy (no cURL, URLs, stack traces).
 * @param {unknown} err
 * @returns {{ message: string, canRetry: boolean }}
 */
export function friendlySpeakingServiceError(err) {
  const e = err && typeof err === 'object' ? /** @type {Record<string, unknown>} */ (err) : {};
  const response = /** @type {{ status?: number, data?: Record<string, unknown> }|undefined} */ (e.response);
  const status = typeof response?.status === 'number' ? response.status : 0;
  const data = response?.data && typeof response.data === 'object' ? response.data : null;
  const dataMsg = data && typeof data.message === 'string' ? data.message : '';
  const firstErr =
    data && Array.isArray(data.errors) && data.errors.length > 0 && typeof data.errors[0] === 'string'
      ? data.errors[0]
      : '';
  const rawMsg = dataMsg || firstErr || (typeof e.message === 'string' ? e.message : '');
  const msg = String(rawMsg);
  const code = typeof e.code === 'string' ? e.code : '';

  const technical =
    /curl|libcurl|openai\.com|chat\/completions|connection refused|getaddrinfo|resolving timed|operation timed|ECONNRESET|socket hang up|ssl|certificate/i.test(
      msg
    );

  if (!response || code === 'ERR_NETWORK' || code === 'ECONNABORTED') {
    return {
      message: 'We could not reach the server. Check your internet connection and try again.',
      canRetry: true,
    };
  }

  if (status === 408 || status === 504 || /timeout|timed out/i.test(msg) || technical) {
    return {
      message: 'The examiner service took too long to respond or could not be reached. Please try again in a moment.',
      canRetry: true,
    };
  }

  if (status >= 500) {
    return {
      message: 'The examiner service is temporarily unavailable. Please try again shortly.',
      canRetry: true,
    };
  }

  if (status === 401 || status === 403) {
    return {
      message: 'Your session may have expired. Refresh the page or sign in again.',
      canRetry: false,
    };
  }

  if (status === 429) {
    return {
      message: 'Too many requests right now. Please wait a moment and try again.',
      canRetry: true,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      message: 'We could not complete this step. Please try again.',
      canRetry: true,
    };
  }

  return {
    message: 'Something went wrong. Please try again.',
    canRetry: true,
  };
}
