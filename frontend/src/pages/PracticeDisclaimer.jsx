import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function PracticeDisclaimer() {
  return (
    <Container className="py-4 py-lg-5" style={{ maxWidth: '42rem' }}>
      <h1 className="h2 fw-bold mb-3 d-flex align-items-center gap-2">
        <i className="bi bi-shield-exclamation text-br-rose" aria-hidden />
        Practice disclaimer
      </h1>
      <p className="lead text-muted mb-4">
        Please read this page in full. It explains how practice on BandReady relates to the official IELTS and CELPIP
        programs.
      </p>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">What BandReady is</h2>
        <p className="text-body-secondary mb-0">
          BandReady is an <strong>independent</strong> preparation product. It is <strong>not</strong> affiliated with,
          endorsed by, or connected to IELTS (including IDP, British Council, or Cambridge), CELPIP (including Paragon
          Testing Enterprises), or any official test centre. Names such as “IELTS” and “CELPIP” refer to the{' '}
          <em>style</em> of skills and tasks your team configures in the app—they do not mean you are taking an official
          examination here.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">Format, pacing, and arrangement of questions</h2>
        <p className="text-body-secondary mb-2">
          The <strong>format, pacing, and arrangement</strong> of questions you see on this site are{' '}
          <strong>not guaranteed to match</strong> the official test on exam day. That includes:
        </p>
        <ul className="text-body-secondary mb-0">
          <li className="mb-2">
            <strong>Screen layout and navigation</strong> — number of questions per screen, timers, optional strict mode,
            forward-only mode, and how sections are split can differ from the paper- or computer-delivered official
            interface.
          </li>
          <li className="mb-2">
            <strong>Question order and sampling</strong> — banks, caps (e.g. “questions to show”), and randomisation are
            controlled by your programme’s content, not by the official test design.
          </li>
          <li className="mb-2">
            <strong>Listening and reading stimuli</strong> — audio may be uploaded clips or browser text-to-speech;
            passages are practice material. Delivery and difficulty are not the same as in an official session.
          </li>
          <li>
            <strong>Writing tasks</strong> — prompts are practice-only; word limits and timing are configured for learning,
            not to replicate every official rule change.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">AI speaking interviews (IELTS-style practice)</h2>
        <p className="text-body-secondary mb-2">
          Where the site offers an <strong>AI-driven speaking interview</strong>, that experience is fundamentally
          different from the real IELTS Speaking test:
        </p>
        <ul className="text-body-secondary mb-0">
          <li className="mb-2">
            You interact with <strong>generated examiner dialogue</strong>, browser speech, and{' '}
            <strong>automatic transcription</strong> of your voice—not a certified human examiner in a controlled test
            room.
          </li>
          <li className="mb-2">
            <strong>Parts 1–3 flow, wording, and timing</strong> are guided by software and model output; they may not
            mirror current official scripts, timing cards, or follow-up rules.
          </li>
          <li>
            <strong>Scores and feedback</strong> (including any “band” style labels) are indicative practice tools—not
            official results and not a prediction of your result with a human examiner.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">Scores and results</h2>
        <p className="text-body-secondary mb-0">
          Automated or AI-assisted scores on this site are <strong>approximate</strong> and for motivation and study
          planning only. They do not replace official results, professional tutoring, or your own judgement. Always check
          the latest official IELTS and CELPIP information when booking or preparing for a real test.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-bold text-body mb-2">What you should do</h2>
        <p className="text-body-secondary mb-0">
          Use BandReady to build skills, fluency, and familiarity with timed practice. For <strong>test-day rules</strong>,{' '}
          <strong>eligibility</strong>, <strong>formats</strong>, and <strong>results</strong>, rely on the official websites
          and your test centre—not on this app alone.
        </p>
      </section>

      <p className="small text-muted border-top pt-3 mb-0">
        <Link to="/exam/start" className="fw-semibold">
          Back to exam selection
        </Link>
        {' · '}
        <Link to="/" className="fw-semibold">
          Home
        </Link>
      </p>
    </Container>
  );
}
