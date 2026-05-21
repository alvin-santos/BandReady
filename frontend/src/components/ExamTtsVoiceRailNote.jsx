import { Link } from 'react-router-dom';

/**
 * Short explainer for browser-based listening TTS in the exam right rail.
 * @param {{ user: { email_verified?: boolean } | null }} props
 */
export default function ExamTtsVoiceRailNote({ user }) {
  const verified = Boolean(user?.email_verified);
  const signedIn = Boolean(user);

  return (
    <div className="br-card p-3 mt-3 mb-3 small border border-secondary border-opacity-25">
      <div className="fw-semibold mb-2 d-flex align-items-center gap-2 text-body-secondary">
        <i className="bi bi-mic" aria-hidden />
        Listening voices
      </div>
      <p className="text-muted mb-2 mb-md-3">
        When a clip uses <strong>browser playback</strong>, the sound comes from your device&apos;s built-in text-to-speech.
        Available voices and quality depend on your <strong>browser and operating system</strong>, not BandReady&apos;s servers.
      </p>
      {verified ? (
        <p className="text-muted mb-0">
          You can turn off voices you dislike (this device&apos;s list) on the{' '}
          <Link to="/settings/tts-voices" className="text-decoration-none">
            TTS voices
          </Link>{' '}
          settings page.
        </p>
      ) : signedIn ? (
        <p className="text-muted mb-0">
          <Link to="/verify-email" className="text-decoration-none">
            Verify your email
          </Link>{' '}
          to save your own voice preferences for listening practice.
        </p>
      ) : (
        <p className="text-muted mb-0">
          <Link to="/login" className="text-decoration-none">
            Sign in
          </Link>{' '}
          (with a verified email) to save your own voice preferences for listening practice.
        </p>
      )}
    </div>
  );
}
