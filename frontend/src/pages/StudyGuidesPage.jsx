import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function StudyGuidesPage() {
  return (
    <div className="br-gradient-hero">
      <Container className="py-4 py-md-5" style={{ maxWidth: '46rem' }}>
        <p className="text-uppercase small fw-semibold text-br-rose mb-2 d-flex align-items-center gap-2">
          <i className="bi bi-journal-richtext" aria-hidden />
          Study guides
        </p>
        <h1 className="h2 fw-bold mb-3">CELPIP &amp; IELTS prep guides</h1>
        <p className="lead text-muted mb-4">
          Practical guidance for learners using BandReady—or any serious prep routine. These guides focus on habits,
          pacing, and realistic expectations. They are independent study tips, not official instructions from test
          providers.
        </p>

        <article className="mb-4">
          <h2 className="h5 fw-bold mb-2">Choosing between CELPIP-General and IELTS General Training</h2>
          <p className="text-body-secondary mb-2">
            Both exams measure everyday English, but the <strong>format and rhythm</strong> differ. CELPIP is fully
            computer-delivered in one sitting at a test centre, with integrated listening/speaking tasks and Canadian
            English accents in many items. IELTS General Training is offered on paper or computer depending on location,
            includes a live or video speaking interview component in most setups, and uses international accents in
            listening material.
          </p>
          <p className="text-body-secondary mb-2">
            Use this decision checklist: (1) Confirm which test your institution or immigration pathway accepts. (2)
            Prefer the speaking format you can rehearse consistently—structured computer prompts versus a conversational
            interview. (3) Compare preparation fit: if you struggle with fast screen-based multitasking, experiment with
            timed browser practice similar to BandReady’s layouts before locking in a test date.
          </p>
          <p className="text-body-secondary mb-0">
            BandReady hosts <strong>exam-style practice</strong>; your registration, fees, and rules always come from the
            official websites for Paragon Testing Enterprises (CELPIP) or British Council / IDP / Cambridge (IELTS).
          </p>
        </article>

        <article className="mb-4">
          <h2 className="h5 fw-bold mb-2">Why timed practice matters more than “hours studied”</h2>
          <p className="text-body-secondary mb-2">
            Many learners track volume—pages read, videos watched—without tracking <strong>performance under constraint</strong>.
            Exams reward accuracy <em>within</em> limits: word counts, recording windows, and advancing passages you cannot
            re-read indefinitely. Short, repeated timed blocks train attention switching and error recovery, which long
            passive sessions rarely develop.
          </p>
          <p className="text-body-secondary mb-0">
            A practical weekly shape is three shorter timed sessions (45–60 minutes) plus one longer mock-style block when
            you are rested. After each session, write one improvement target—not ten—for the next attempt.
          </p>
        </article>

        <article className="mb-4">
          <h2 className="h5 fw-bold mb-2">Building a sustainable weekly rhythm</h2>
          <p className="text-body-secondary mb-2">
            Sustainable prep alternates skills so fatigue does not collapse quality. One reliable pattern for General-level
            exams:
          </p>
          <ul className="text-body-secondary ps-3 mb-2">
            <li className="mb-2">
              <strong>Listening / reading days</strong> emphasize extraction: main ideas, attitude, and specific detail
              under time pressure—not translation line by line.
            </li>
            <li className="mb-2">
              <strong>Writing days</strong> pair one full task attempt with a focused rewrite of a single paragraph for
              clarity and cohesion.
            </li>
            <li className="mb-2">
              <strong>Speaking days</strong> include repetition of the same prompt until timing feels stable, then swap the
              prompt to avoid memorized monologues.
            </li>
            <li className="mb-0">
              <strong>Review days</strong> revisit mistakes and patterns rather than introducing entirely new content.
            </li>
          </ul>
          <p className="text-body-secondary mb-0">
            BandReady’s study plan tools map tasks onto a calendar when you provide a target date—use them as a scaffold,
            then adjust based on your real energy and error patterns.
          </p>
        </article>

        <article className="mb-4">
          <h2 className="h5 fw-bold mb-2">Using AI feedback responsibly</h2>
          <p className="text-body-secondary mb-0">
            When AI writing or speaking feedback is available, treat suggestions as <strong>revision prompts</strong>.
            Ask whether each suggestion improves clarity for a human reader or merely swaps vocabulary. Cross-check
            constraints from the task prompt (word limits, audience, required points). See also{' '}
            <Link to="/content-standards" className="fw-semibold text-decoration-none">
              content standards
            </Link>{' '}
            for how we position automated outputs.
          </p>
        </article>

        <article className="mb-0">
          <h2 className="h5 fw-bold mb-2">Related pages</h2>
          <p className="text-body-secondary mb-0">
            <Link to="/how-it-works" className="fw-semibold text-decoration-none">
              How BandReady works
            </Link>
            {' · '}
            <Link to="/practice-disclaimer" className="fw-semibold text-decoration-none">
              Practice disclaimer
            </Link>
            {' · '}
            <Link to="/blog" className="fw-semibold text-decoration-none">
              Blog
            </Link>
          </p>
        </article>
      </Container>
    </div>
  );
}
