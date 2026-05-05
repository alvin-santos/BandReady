import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Container, Form, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';
import {
  classifyVoiceGender,
  isExamStyleEnglishVoice,
  stableVoiceKey,
} from '../utils/ttsDialogue.js';
import { clearTtsDisabledVoiceKeysCache } from '../utils/ttsVoiceSettingsCache.js';

const VOICE_PREVIEW_TEXT =
  'This is a short sample of how this voice sounds for listening practice on BandReady.';

/** @param {string | undefined} lang */
function isEnUsVoiceLang(lang) {
  if (!lang) return false;
  const n = String(lang).toLowerCase().replace(/_/g, '-');
  return n === 'en-us' || n.startsWith('en-us-');
}

/** @typedef {'site' | 'user'} TtsVoicesVariant */

/**
 * Site-wide blocklist (admin) or personal blocklist (signed-in user). Same browser voice list UI.
 * @param {{ variant: TtsVoicesVariant }} props
 */
export default function TtsVoicesSettingsPage({ variant }) {
  const [voices, setVoices] = useState([]);
  const [disabledKeys, setDisabledKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  /** stableVoiceKey of row currently previewing, or null */
  const [previewingKey, setPreviewingKey] = useState(null);
  const previewActiveKeyRef = useRef(null);

  const loadServer = useCallback(async () => {
    if (variant === 'site') {
      const { data } = await api.get('/admin/tts-voice-settings');
      const arr = Array.isArray(data.disabled_keys) ? data.disabled_keys : [];
      setDisabledKeys(new Set(arr));
    } else {
      const { data } = await api.get('/user/tts-voice-settings');
      const arr = Array.isArray(data.user_disabled_keys) ? data.user_disabled_keys : [];
      setDisabledKeys(new Set(arr));
    }
  }, [variant]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr('');
      try {
        await loadServer();
      } catch {
        if (!cancelled) {
          setErr(variant === 'site' ? 'Could not load voice settings.' : 'Could not load your voice preferences.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadServer, variant]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    const sync = () => setVoices(window.speechSynthesis.getVoices() ?? []);
    sync();
    window.speechSynthesis.addEventListener('voiceschanged', sync);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', sync);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      previewActiveKeyRef.current = null;
    };
  }, []);

  const stopVoicePreview = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    previewActiveKeyRef.current = null;
    setPreviewingKey(null);
  }, []);

  const toggleVoicePreview = useCallback(
    (voice, key) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return;
      }
      if (previewingKey === key) {
        stopVoicePreview();
        return;
      }
      window.speechSynthesis.cancel();
      previewActiveKeyRef.current = key;
      setPreviewingKey(key);
      const u = new SpeechSynthesisUtterance(VOICE_PREVIEW_TEXT);
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
      u.rate = 0.95;
      const done = () => {
        if (previewActiveKeyRef.current === key) {
          previewActiveKeyRef.current = null;
          setPreviewingKey(null);
        }
      };
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
    },
    [previewingKey, stopVoicePreview]
  );

  const rows = useMemo(() => {
    const list = voices.filter((v) => isEnUsVoiceLang(v.lang));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list.map((v) => {
      const key = stableVoiceKey(v);
      const gender = classifyVoiceGender(v);
      const exam = isExamStyleEnglishVoice(v);
      return { v, key, gender, exam };
    });
  }, [voices]);

  const toggleKey = (key, enabled) => {
    setDisabledKeys((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const disableNonExamStyle = () => {
    setDisabledKeys((prev) => {
      const next = new Set(prev);
      rows.forEach(({ key, exam }) => {
        if (!exam) {
          next.add(key);
        }
      });
      return next;
    });
  };

  const enableAll = () => setDisabledKeys(new Set());

  const toggleDisableAllListed = () => {
    if (!rows.length) return;
    const rowKeys = rows.map(({ key }) => key);
    setDisabledKeys((prev) => {
      const allListedDisabled = rowKeys.every((k) => prev.has(k));
      const next = new Set(prev);
      if (allListedDisabled) {
        rowKeys.forEach((k) => next.delete(k));
      } else {
        rowKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  async function save() {
    setSaving(true);
    setErr('');
    setOk('');
    try {
      if (variant === 'site') {
        await api.put('/admin/tts-voice-settings', {
          disabled_keys: [...disabledKeys],
        });
      } else {
        await api.put('/user/tts-voice-settings', {
          disabled_keys: [...disabledKeys],
        });
      }
      clearTtsDisabledVoiceKeysCache();
      setOk(
        variant === 'site'
          ? 'Saved. Listening TTS will skip disabled voices (may take up to ~90s for cached clients).'
          : 'Saved. Your choices apply on this account in addition to any site-wide blocklist.'
      );
    } catch (e) {
      setErr(e.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  const speechOk = typeof window !== 'undefined' && !!window.speechSynthesis;
  const isSite = variant === 'site';
  const allListedDisabled =
    rows.length > 0 && rows.every(({ key }) => disabledKeys.has(key));

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-mic text-br-rose" aria-hidden />
        {isSite ? 'TTS voices (listening) — site' : 'Listening voices (your account)'}
      </h1>
      <p className="text-muted small mb-3">
        Only <strong>en-US</strong> voices are listed here. Voices are detected in <strong>this browser only</strong>. Stable keys
        are stored on the server; each device matches keys against its own voice list. Turn <strong>off</strong> voices you do not
        want used for exam-style listening. Built-in filters (clear US/UK/AU/CA/NZ/IE, no child/novelty) still apply first;
        disabled keys remove more. Use <strong>Preview</strong> to hear each voice before you disable it.
      </p>
      {!isSite && (
        <p className="text-muted small mb-3">
          BandReady may also hide voices <strong>site-wide</strong> (admin). Your switches here add an extra layer for your
          account only.
        </p>
      )}

      {err && (
        <Alert variant="danger" className="py-2 small">
          {err}
        </Alert>
      )}
      {ok && (
        <Alert variant="success" className="py-2 small" dismissible onClose={() => setOk('')}>
          {ok}
        </Alert>
      )}

      {!speechOk && (
        <Alert variant="warning" className="small">
          This browser does not expose speech synthesis — open this page in Chrome or Edge to list voices.
        </Alert>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <Button type="button" variant="outline-primary" size="sm" onClick={enableAll} disabled={!rows.length}>
          Enable all listed
        </Button>
        <Button type="button" variant="outline-secondary" size="sm" onClick={disableNonExamStyle} disabled={!rows.length}>
          Disable non–exam-style only
        </Button>
        <Button type="button" variant="outline-dark" size="sm" onClick={toggleDisableAllListed} disabled={!rows.length}>
          {allListedDisabled ? 'Enable listed voices' : 'Disable all listed'}
        </Button>
        {previewingKey && (
          <Button type="button" variant="outline-danger" size="sm" onClick={stopVoicePreview}>
            <i className="bi bi-stop-circle me-1" aria-hidden />
            Stop preview
          </Button>
        )}
        <Button type="button" variant="primary" size="sm" onClick={save} disabled={saving || !speechOk}>
          {saving ? (
            <>
              <Spinner animation="border" size="sm" className="me-1" />
              Saving…
            </>
          ) : (
            <>
              <i className="bi bi-cloud-upload me-1" aria-hidden />
              {isSite ? 'Save site blocklist' : 'Save my preferences'}
            </>
          )}
        </Button>
      </div>

      <div className="table-responsive br-card p-3">
        <Table hover size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Use</th>
              <th>Preview</th>
              <th>Name</th>
              <th>Lang</th>
              <th>Gender (guess)</th>
              <th>Exam-style</th>
              <th className="d-none d-md-table-cell">Key</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, key, gender, exam }, idx) => {
              const enabled = !disabledKeys.has(key);
              const isPreviewing = previewingKey === key;
              return (
                <tr key={key}>
                  <td>
                    <Form.Check
                      type="switch"
                      id={`tts-voice-${variant}-${idx}`}
                      checked={enabled}
                      onChange={(e) => toggleKey(key, e.target.checked)}
                      aria-label={enabled ? 'Voice enabled' : 'Voice disabled'}
                    />
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant={isPreviewing ? 'outline-secondary' : 'outline-primary'}
                      size="sm"
                      className="d-inline-flex align-items-center gap-1 text-nowrap"
                      disabled={!speechOk}
                      onClick={() => toggleVoicePreview(v, key)}
                      aria-label={isPreviewing ? 'Stop preview' : 'Play voice preview'}
                    >
                      <i className={isPreviewing ? 'bi bi-stop-fill' : 'bi bi-play-fill'} aria-hidden />
                      {isPreviewing ? 'Stop' : 'Preview'}
                    </Button>
                  </td>
                  <td className="small">{v.name || '—'}</td>
                  <td>
                    <code className="small">{v.lang || '—'}</code>
                  </td>
                  <td className="small text-capitalize">{gender}</td>
                  <td>
                    {exam ? (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                        Yes
                      </span>
                    ) : (
                      <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25">
                        No
                      </span>
                    )}
                  </td>
                  <td className="d-none d-md-table-cell small font-monospace text-break" style={{ maxWidth: 280 }}>
                    {key.length > 120 ? `${key.slice(0, 118)}…` : key}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {!rows.length && speechOk && (
          <p className="text-muted small mb-0">
            {voices.length
              ? 'No en-US voices found in this browser — try another browser or system language pack.'
              : 'No voices yet — try refreshing or wait for the browser to load voices.'}
          </p>
        )}
      </div>
    </Container>
  );
}
