/**
 * Normalizes IELTS examiner lines before browser TTS (matches backend sanitization).
 * Slashes in "Good morning/afternoon" are read aloud; "My name is the examiner" sounds broken.
 */
export function sanitizeExaminerMessageForTts(text) {
  let s = String(text ?? '').trim();
  if (!s) {
    return s;
  }
  s = s.replace(/\bgood\s+morning\s*\/\s*afternoon\b/gi, 'Good morning');
  s = s.replace(/\bgood\s+afternoon\s*\/\s*morning\b/gi, 'Good afternoon');
  s = s.replace(/\bmy\s+name\s+is\s*,?\s*the\s+examiner\b\.?/gi, 'I am your examiner for this practice test');
  s = s.replace(/\bmy\s+name\s+is\s+examiner\b\.?/gi, 'I am your examiner for this practice test');
  return s.trim();
}
