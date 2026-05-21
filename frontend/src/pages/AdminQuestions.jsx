import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { api } from '../api/client.js';
import { spokenPlainTextFromScript } from '../utils/ttsDialogue.js';
import { getLiveSpeechVoices } from '../utils/ttsSpeechSynthesis.js';
import { speakDialogueScript } from '../utils/ttsSpeak.js';
import { getTtsDisabledVoiceKeysSet } from '../utils/ttsVoiceSettingsCache.js';
import { resolveMediaUrl } from '../utils/mediaUrl.js';

function resolveAudioPreviewUrl(url) {
  return resolveMediaUrl(url);
}

const TYPES = [
  'multiple_choice',
  'checkbox_multi',
  'fill_blank',
  'true_false',
  'essay',
  'speaking_prompt',
];

const defaultForm = {
  test_id: '',
  type: 'multiple_choice',
  question_text: '',
  passage_text: '',
  show_passage_on_test: true,
  audio_url: '',
  audio_script: '',
  image_url: '',
  speaking_celpip_mode: 'describe',
  speaking_ielts_mode: 'none',
  speaking_image_prompt: '',
  options_json: '{\n  "A": "Option A",\n  "B": "Option B",\n  "C": "Option C",\n  "D": "Option D"\n}',
  correct_answer: 'A',
  explanation: '',
  order: 1,
};

export default function AdminQuestions() {
  const [tests, setTests] = useState([]);
  const [filterTest, setFilterTest] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [importShow, setImportShow] = useState(false);
  const [importText, setImportText] = useState('');
  const [importReplace, setImportReplace] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState('');
  const [importOk, setImportOk] = useState('');
  const [speakingImageBusy, setSpeakingImageBusy] = useState(false);
  const [ttsPreviewPlaying, setTtsPreviewPlaying] = useState(false);
  const [ttsVoices, setTtsVoices] = useState(() =>
    typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []
  );
  const ttsVoicesRef = useRef(ttsVoices);
  ttsVoicesRef.current = ttsVoices;
  const ttsDisabledKeysRef = useRef(new Set());

  useEffect(() => {
    api.get('/admin/tests').then((res) => setTests(res.data));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    const load = () => {
      const list = getLiveSpeechVoices();
      setTtsVoices(list);
      ttsVoicesRef.current = list;
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(() => {
    void getTtsDisabledVoiceKeysSet().then((set) => {
      ttsDisabledKeysRef.current = set;
    });
  }, []);

  async function load() {
    if (!filterTest) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    const { data } = await api.get('/admin/questions', { params: { test_id: filterTest } });
    setQuestions(data);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [filterTest]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!show && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setTtsPreviewPlaying(false);
    }
  }, [show]);

  const previewTtsScript = useCallback(() => {
    const plain = spokenPlainTextFromScript(form.audio_script);
    if (!plain || typeof window === 'undefined') {
      return;
    }
    if (!window.speechSynthesis) {
      window.alert('Speech synthesis is not available in this browser.');
      return;
    }
    const liveVoices = getLiveSpeechVoices();
    if (liveVoices.length) {
      ttsVoicesRef.current = liveVoices;
    }
    window.speechSynthesis.cancel();
    setTtsPreviewPlaying(true);
    speakDialogueScript(
      form.audio_script,
      ttsVoicesRef.current,
      'en-US',
      () => setTtsPreviewPlaying(false),
      ttsDisabledKeysRef.current
    );
    void getTtsDisabledVoiceKeysSet().then((set) => {
      ttsDisabledKeysRef.current = set;
    });
  }, [form.audio_script]);

  const stopTtsPreview = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setTtsPreviewPlaying(false);
  }, []);

  function openCreate() {
    setEditId(null);
    setForm({
      ...defaultForm,
      test_id: filterTest,
      order: questions.length + 1,
    });
    setShow(true);
  }

  function openEdit(q) {
    setEditId(q.id);
    const sp = q.options_json?.speaking;
    const mode = sp?.celpip_mode;
    const ieltsAi = q.options_json?.ielts_speaking?.mode === 'ai_conversation';
    setForm({
      test_id: String(q.test_id),
      type: q.type,
      question_text: q.question_text,
      passage_text: q.passage_text ?? '',
      show_passage_on_test: q.show_passage_on_test !== false,
      audio_url: q.audio_url ?? '',
      audio_script: q.audio_script ?? '',
      image_url: q.image_url ?? '',
      speaking_ielts_mode: ieltsAi ? 'ai_conversation' : 'none',
      speaking_celpip_mode: mode === 'scenario' || mode === 'describe' || mode === 'predict' ? mode : 'none',
      speaking_image_prompt: sp?.image_generation_prompt ?? '',
      options_json: q.options_json ? JSON.stringify(q.options_json, null, 2) : '',
      correct_answer: String(q.correct_answer ?? ''),
      explanation: q.explanation ?? '',
      order: q.order ?? 1,
    });
    setShow(true);
  }

  async function save(e) {
    e.preventDefault();
    let optionsParsed = null;
    if (form.options_json?.trim()) {
      try {
        optionsParsed = JSON.parse(form.options_json);
      } catch {
        alert('Options JSON is invalid. Use valid JSON for multiple choice / checkbox options.');
        return;
      }
    }
    if (form.type === 'speaking_prompt') {
      const prev = optionsParsed && typeof optionsParsed === 'object' ? optionsParsed : {};
      const prevSpeaking = prev.speaking && typeof prev.speaking === 'object' ? prev.speaking : {};
      const mode = form.speaking_celpip_mode;
      const speaking = {
        ...prevSpeaking,
        ...(mode === 'scenario' || mode === 'describe' || mode === 'predict' ? { celpip_mode: mode } : {}),
        ...(form.speaking_image_prompt?.trim() ? { image_generation_prompt: form.speaking_image_prompt.trim() } : {}),
      };
      if (!(mode === 'scenario' || mode === 'describe' || mode === 'predict')) {
        delete speaking.celpip_mode;
      }
      if (!form.speaking_image_prompt?.trim()) {
        delete speaking.image_generation_prompt;
      }
      optionsParsed = { ...prev, speaking };
      if (form.speaking_ielts_mode === 'ai_conversation') {
        optionsParsed = { ...optionsParsed, ielts_speaking: { mode: 'ai_conversation' } };
      } else if (optionsParsed.ielts_speaking && typeof optionsParsed.ielts_speaking === 'object') {
        const rest = { ...optionsParsed.ielts_speaking };
        delete rest.mode;
        if (Object.keys(rest).length === 0) {
          delete optionsParsed.ielts_speaking;
        } else {
          optionsParsed.ielts_speaking = rest;
        }
      }
    } else if (optionsParsed && typeof optionsParsed === 'object' && optionsParsed.speaking) {
      const { speaking: _s, ...rest } = optionsParsed;
      optionsParsed = rest;
    }
    const payload = {
      test_id: Number(form.test_id),
      type: form.type,
      question_text: form.question_text,
      passage_text: form.passage_text || null,
      show_passage_on_test: Boolean(form.show_passage_on_test),
      audio_url: form.audio_url || null,
      audio_script: form.audio_script?.trim() ? form.audio_script : null,
      image_url: form.image_url?.trim() || null,
      options_json: optionsParsed,
      correct_answer: form.correct_answer,
      explanation: form.explanation || null,
      order: Number(form.order) || 0,
    };
    if (editId) {
      await api.put(`/admin/questions/${editId}`, {
        type: payload.type,
        question_text: payload.question_text,
        passage_text: payload.passage_text,
        show_passage_on_test: payload.show_passage_on_test,
        audio_url: payload.audio_url,
        audio_script: payload.audio_script,
        image_url: payload.image_url,
        options_json: payload.options_json,
        correct_answer: payload.correct_answer,
        explanation: payload.explanation,
        order: payload.order,
      });
    } else {
      await api.post('/admin/questions', payload);
    }
    setShow(false);
    load();
  }

  async function generateSpeakingImage() {
    if (!editId) {
      window.alert('Save the question first, then generate an image.');
      return;
    }
    const prompt = form.speaking_image_prompt?.trim();
    if (!prompt) {
      window.alert('Enter an image prompt (what should appear in the picture).');
      return;
    }
    setSpeakingImageBusy(true);
    try {
      const { data } = await api.post(`/admin/questions/${editId}/generate-speaking-image`, { prompt });
      const url = data.image_url;
      if (url) {
        setForm((f) => ({ ...f, image_url: url }));
      }
    } catch (ex) {
      const msg = ex.response?.data?.message || ex.message || 'Generation failed.';
      window.alert(msg);
    } finally {
      setSpeakingImageBusy(false);
    }
  }

  async function clearSpeakingImage() {
    if (!editId) {
      return;
    }
    if (!window.confirm('Remove the scene image from this question?')) {
      return;
    }
    setSpeakingImageBusy(true);
    try {
      await api.post(`/admin/questions/${editId}/clear-speaking-image`);
      setForm((f) => ({ ...f, image_url: '' }));
    } catch (ex) {
      window.alert(ex.response?.data?.message || ex.message || 'Could not clear image.');
    } finally {
      setSpeakingImageBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this question?')) {
      return;
    }
    await api.delete(`/admin/questions/${id}`);
    load();
  }

  function buildImportBody() {
    let parsed;
    try {
      parsed = JSON.parse(importText.trim() || '{}');
    } catch {
      throw new Error('Invalid JSON. Check commas and quotes.');
    }
    let questions;
    let passageText = null;
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed && Array.isArray(parsed.questions)) {
      questions = parsed.questions;
      if (typeof parsed.passage_text === 'string' && parsed.passage_text.trim()) {
        passageText = parsed.passage_text;
      }
    } else {
      throw new Error('JSON must be either a questions array, or an object with a "questions" array.');
    }
    if (questions.length < 1) {
      throw new Error('At least one question is required.');
    }
    const body = {
      test_id: Number(filterTest),
      replace_existing: importReplace,
      questions,
    };
    if (passageText) {
      body.passage_text = passageText;
    }
    return body;
  }

  async function runImport(e) {
    e.preventDefault();
    setImportErr('');
    setImportOk('');
    let body;
    try {
      body = buildImportBody();
    } catch (ex) {
      setImportErr(ex.message || 'Invalid JSON.');
      return;
    }
    setImportBusy(true);
    try {
      const { data } = await api.post('/admin/questions/import', body);
      setImportOk(data.message || `Imported ${data.imported} question(s).`);
      setImportText('');
      setImportShow(false);
      load();
    } catch (ex) {
      const msg = ex.response?.data?.message;
      const errs = ex.response?.data?.errors;
      const idx = ex.response?.data?.index;
      let detail = msg || 'Import failed.';
      if (errs && typeof errs === 'object') {
        const first = Object.entries(errs)[0];
        if (first) {
          detail += ` ${first[0]}: ${Array.isArray(first[1]) ? first[1].join(' ') : first[1]}`;
        }
      }
      if (idx != null) {
        detail += ` (index ${idx})`;
      }
      setImportErr(detail);
    } finally {
      setImportBusy(false);
    }
  }

  if (loading && filterTest && !questions.length) {
    return (
      <div className="text-center py-5">
        <Spinner />
      </div>
    );
  }

  const audioPreviewSrc = resolveAudioPreviewUrl(form.audio_url);

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-patch-question-fill text-br-rose" aria-hidden />
          Questions
        </h1>
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-primary"
            className="d-inline-flex align-items-center gap-1"
            onClick={() => {
              setImportErr('');
              setImportOk('');
              setImportShow(true);
            }}
            disabled={!filterTest}
          >
            <i className="bi bi-file-earmark-arrow-up" aria-hidden />
            Import JSON
          </Button>
          <Button
            className="d-inline-flex align-items-center gap-1"
            onClick={openCreate}
            disabled={!filterTest}
          >
            <i className="bi bi-plus-lg" aria-hidden />
            Add question
          </Button>
        </div>
      </div>

      {importOk && (
        <Alert variant="success" className="d-flex align-items-center gap-2" onClose={() => setImportOk('')} dismissible>
          <i className="bi bi-check-circle-fill" aria-hidden />
          {importOk}
        </Alert>
      )}

      <p className="text-muted small mb-3">
        Select a test to load and edit its questionnaire. Options for MCQ / checkbox are stored as JSON.
        Correct answer: letter (e.g. <code>B</code>), JSON array for checkbox (e.g. <code>[&quot;A&quot;,&quot;C&quot;]</code>), or
        text for fill-in / true_false. Use <strong>Import JSON</strong> to paste a ChatGPT array or{' '}
        <code>{`{ "passage_text": "...", "questions": [ ... ] }`}</code> — extra keys (e.g. <code>audio_script</code>) are
        ignored.
      </p>

      <Form.Group className="mb-4" style={{ maxWidth: 420 }}>
        <Form.Label>Test</Form.Label>
        <Form.Select value={filterTest} onChange={(e) => setFilterTest(e.target.value)}>
          <option value="">Select a test…</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} — {t.exam?.name}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {filterTest && (
        <div className="table-responsive br-card p-3">
          <Table hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Order</th>
                <th>Type</th>
                <th>Preview</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>{q.order}</td>
                  <td>
                    <code className="small">{q.type}</code>
                  </td>
                  <td className="small">{q.question_text.slice(0, 100)}{q.question_text.length > 100 ? '…' : ''}</td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(q)}>
                      <i className="bi bi-pencil" aria-hidden />
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => remove(q.id)}>
                      <i className="bi bi-trash" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!questions.length && (
            <p className="text-muted small mb-0">No questions yet. Add one above.</p>
          )}
        </div>
      )}

      <Modal show={show} onHide={() => setShow(false)} centered size="xl" className="br-modal-scroll">
        <Modal.Header closeButton>
          <Modal.Title>{editId ? 'Edit question' : 'New question'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={save}>
          <Modal.Body>
            {!editId && (
              <Form.Group className="mb-3">
                <Form.Label>Test</Form.Label>
                <Form.Select
                  value={form.test_id}
                  onChange={(e) => setForm((f) => ({ ...f, test_id: e.target.value }))}
                  required
                >
                  <option value="">Select…</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Question text</Form.Label>
              <Form.Control
                as="textarea"
                rows={form.type === 'speaking_prompt' ? 6 : 3}
                value={form.question_text}
                onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
                required
                placeholder={
                  form.type === 'speaking_prompt'
                    ? 'e.g. You are visiting another city and you notice something interesting on the street. You are on a phone call with your sister. Describe what you are looking at and what is happening.'
                    : undefined
                }
              />
              {form.type === 'speaking_prompt' && (
                <Form.Text className="text-muted">
                  Use a <strong>short scenario</strong> (a few sentences): set the situation, <strong>who</strong> the student is talking to, and what they should describe — not only a one-line command like “Describe the picture.”
                </Form.Text>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Passage / context (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={form.passage_text}
                onChange={(e) => setForm((f) => ({ ...f, passage_text: e.target.value }))}
              />
              <Form.Check
                className="mt-2"
                type="checkbox"
                id="admin-q-show-passage"
                label="Show passage on the practice test page"
                checked={form.show_passage_on_test}
                onChange={(e) => setForm((f) => ({ ...f, show_passage_on_test: e.target.checked }))}
              />
              <Form.Text className="text-muted">
                When unchecked, passage text is still saved (e.g. for listening instructions) but the large passage block
                is hidden during the exam.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Audio URL (optional)</Form.Label>
              <Form.Control
                value={form.audio_url}
                onChange={(e) => setForm((f) => ({ ...f, audio_url: e.target.value }))}
                placeholder="https://…"
              />
              <Form.Text className="text-muted">
                If set, the MP3 is used. Leave empty to use browser speech instead.
              </Form.Text>
              {audioPreviewSrc && (
                <div className="mt-2">
                  <div className="small text-muted mb-1">Preview</div>
                  <audio
                    className="w-100 br-audio-player"
                    controls
                    controlsList="nodownload"
                    src={audioPreviewSrc}
                  >
                    <a href={audioPreviewSrc}>Audio</a>
                  </audio>
                </div>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                <Form.Label className="mb-0">Audio script — browser TTS only (optional)</Form.Label>
                {spokenPlainTextFromScript(form.audio_script) && (
                  <Button
                    type="button"
                    variant={ttsPreviewPlaying ? 'outline-secondary' : 'outline-primary'}
                    size="sm"
                    className="d-inline-flex align-items-center gap-1"
                    onClick={ttsPreviewPlaying ? stopTtsPreview : previewTtsScript}
                    aria-label={ttsPreviewPlaying ? 'Stop TTS preview' : 'Play TTS preview'}
                  >
                    <i className={ttsPreviewPlaying ? 'bi bi-stop-fill' : 'bi bi-play-fill'} aria-hidden />
                    {ttsPreviewPlaying ? 'Stop preview' : 'Preview speech'}
                  </Button>
                )}
              </div>
              <Form.Control
                as="textarea"
                rows={5}
                value={form.audio_script}
                onChange={(e) => setForm((f) => ({ ...f, audio_script: e.target.value }))}
                className="font-monospace small"
                spellCheck
                placeholder="Full text read aloud; not shown to students. Use Passage / context for short on-screen instructions only."
              />
              <Form.Text className="text-muted">
                Shown only via the device speaker if <strong>Audio URL</strong> is empty. Students never see this text on
                screen.
              </Form.Text>
            </Form.Group>

            {form.type === 'speaking_prompt' && (
              <div className="border rounded p-3 mb-3 bg-body-secondary bg-opacity-25">
                <div className="fw-semibold small mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-mic" aria-hidden />
                  IELTS Speaking mode
                </div>
                <Form.Group className="mb-3">
                  <Form.Label>Interview type</Form.Label>
                  <Form.Select
                    value={form.speaking_ielts_mode}
                    onChange={(e) => setForm((f) => ({ ...f, speaking_ielts_mode: e.target.value }))}
                  >
                    <option value="none">Standard (one prompt + recording / optional TTS script)</option>
                    <option value="ai_conversation">IELTS AI mock interview (Parts 1–3, OpenAI examiner + your voice)</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    AI mode fits a <strong>single</strong> speaking item per test section. Leave <strong>Audio script</strong>{' '}
                    empty so the examiner is driven only by AI (browser TTS).
                  </Form.Text>
                </Form.Group>
              </div>
            )}

            {form.type === 'speaking_prompt' && (
              <div className="border rounded p-3 mb-3 bg-body-secondary bg-opacity-25">
                <div className="fw-semibold small mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-image text-br-rose" aria-hidden />
                  CELPIP-style picture speaking
                </div>
                <p className="small text-muted mb-3">
                  Use <strong>Passage / context</strong> for scenario instructions (e.g. “You are on the phone…”). Use{' '}
                  <strong>Question text</strong> for the line they respond to. Generate a scene with OpenAI, or paste a
                  hosted image URL.
                </p>
                <Form.Group className="mb-3">
                  <Form.Label>Picture task mode</Form.Label>
                  <Form.Select
                    value={form.speaking_celpip_mode}
                    onChange={(e) => setForm((f) => ({ ...f, speaking_celpip_mode: e.target.value }))}
                  >
                    <option value="describe">Describe what you see (neutral) — CELPIP Task 3</option>
                    <option value="scenario">Scenario (e.g. describe to a friend on the phone) — Task 3</option>
                    <option value="predict">Making predictions from the image — CELPIP Task 4</option>
                    <option value="none">No CELPIP-style hint (generic speaking)</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Image generation prompt (OpenAI)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={form.speaking_image_prompt}
                    onChange={(e) => setForm((f) => ({ ...f, speaking_image_prompt: e.target.value }))}
                    placeholder="e.g. A sunny kitchen with a person packing a lunch box, wide shot, no text"
                    spellCheck
                  />
                  <Form.Text className="text-muted">
                    Saved on the question. Used when you click Generate; also feeds AI speaking feedback as scene context.
                  </Form.Text>
                </Form.Group>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="d-inline-flex align-items-center gap-1"
                    disabled={speakingImageBusy || !editId}
                    onClick={generateSpeakingImage}
                  >
                    {speakingImageBusy ? (
                      <>
                        <Spinner animation="border" size="sm" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-stars" aria-hidden />
                        Generate image (OpenAI)
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-danger"
                    size="sm"
                    disabled={speakingImageBusy || !form.image_url}
                    onClick={clearSpeakingImage}
                  >
                    Remove image
                  </Button>
                </div>
                <Form.Group className="mb-0">
                  <Form.Label>Image URL (optional manual override)</Form.Label>
                  <Form.Control
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://… or leave empty until generated"
                  />
                  {resolveAudioPreviewUrl(form.image_url) && (
                    <div className="mt-2">
                      <div className="small text-muted mb-1">Preview</div>
                      <img
                        src={resolveAudioPreviewUrl(form.image_url)}
                        alt=""
                        className="img-fluid rounded border"
                        style={{ maxHeight: '220px' }}
                      />
                    </div>
                  )}
                </Form.Group>
              </div>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Options JSON (for MCQ / checkbox)</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={form.options_json}
                onChange={(e) => setForm((f) => ({ ...f, options_json: e.target.value }))}
                className="font-monospace small"
                spellCheck={false}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Correct answer</Form.Label>
              <Form.Control
                value={form.correct_answer}
                onChange={(e) => setForm((f) => ({ ...f, correct_answer: e.target.value }))}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Explanation (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Order</Form.Label>
              <Form.Control
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" onClick={() => setShow(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={importShow} onHide={() => !importBusy && setImportShow(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="bi bi-file-earmark-arrow-up text-br-rose" aria-hidden />
            Import questions from JSON
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={runImport}>
          <Modal.Body>
            <p className="small text-muted mb-2">
              Imports into the test selected above: <strong>{tests.find((t) => String(t.id) === filterTest)?.title || '—'}</strong>
            </p>
            <Form.Check
              type="checkbox"
              id="import-replace"
              className="mb-3"
              label="Replace all existing questions for this test before import"
              checked={importReplace}
              onChange={(e) => setImportReplace(e.target.checked)}
            />
            <Form.Group>
              <Form.Label>JSON</Form.Label>
              <Form.Control
                as="textarea"
                rows={14}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="font-monospace small"
                spellCheck={false}
                placeholder={`[\n  {\n    "type": "multiple_choice",\n    "question_text": "...",\n    "passage_text": "...",\n    "options_json": { "A": "...", "B": "...", "C": "...", "D": "..." },\n    "correct_answer": "B",\n    "explanation": "...",\n    "order": 1\n  }\n]`}
                required
              />
            </Form.Group>
            {importErr && (
              <Alert variant="danger" className="mt-3 mb-0 small">
                {importErr}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" disabled={importBusy} onClick={() => setImportShow(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={importBusy} className="d-inline-flex align-items-center gap-1">
              {importBusy ? (
                <>
                  <Spinner animation="border" size="sm" />
                  Importing…
                </>
              ) : (
                <>
                  <i className="bi bi-upload" aria-hidden />
                  Import
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
