import { Col, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function buildCards(user) {
  return [
    {
      icon: 'bi-layers-fill',
      title: 'Full mock exams',
      text: 'Timed IELTS- and CELPIP-style runs—autosave, resume, and exam-style section flow.',
      to: '/exam/start',
      linkLabel: 'Start practice',
    },
    {
      icon: 'bi-volume-up-fill',
      title: 'Listening & reading',
      text: 'Listening with audio, long-form reading, plus writing and speaking flows from published tests.',
      to: '/exam/start',
      linkLabel: 'Choose a test',
    },
    {
      icon: 'bi-stars',
      title: 'AI feedback & Pro',
      text: 'Optional AI feedback on eligible writing and speaking, unlimited Speaking on Pro, and gated resources.',
      to: '/subscription',
      linkLabel: 'View Pro',
    },
    {
      icon: 'bi-people-fill',
      title: 'Forum & rankings',
      text: 'Discuss prep with other learners and compare practice metrics on the leaderboard.',
      to: '/forum',
      linkLabel: 'Open forum',
    },
    {
      icon: 'bi-speedometer2',
      title: 'Dashboard & analytics',
      text: 'History, trends, and a mistakes hub to target weak spots between attempts.',
      to: user ? '/dashboard' : '/register',
      linkLabel: user ? 'Open dashboard' : 'Create free account',
    },
    {
      icon: 'bi-file-earmark-arrow-down-fill',
      title: 'Resources',
      text: 'Guides and downloads for offline study alongside online attempts.',
      to: '/resources',
      linkLabel: 'Browse resources',
    },
  ];
}

export default function HomeFloatingFeatureCards() {
  const { user } = useAuth();
  const cards = buildCards(user);

  return (
    <section
      className="br-home-float-features br-home-float-features--tight py-2 py-lg-3 mb-1 position-relative"
      aria-labelledby="br-home-float-features-title"
    >
      <div className="br-home-float-features-deco" aria-hidden />
      <h2 id="br-home-float-features-title" className="h6 fw-bold text-center mb-0 position-relative">
        Built for serious <span className="text-br-rose">prep</span>
      </h2>
      <p className="text-muted text-center small mx-auto mb-2 position-relative" style={{ maxWidth: '32rem' }}>
        Everything in one place—pick a path and go.
      </p>
      <Row className="g-2 justify-content-center position-relative">
        {cards.map((c, i) => (
          <Col key={c.title} xs={12} sm={6} lg={4}>
            <div
              className={`br-float-feature-card br-card p-3 br-float-feature-card--compact br-float-feature-card--has-bg-icon br-float-feature-card--tint-${i % 6} h-100 d-flex flex-column position-relative overflow-hidden`}
              style={{ animationDelay: `${i * 0.28}s` }}
            >
              <i className={`bi ${c.icon} br-float-feature-card-bg-icon`} aria-hidden />
              <div className="br-float-feature-card-inner flex-grow-1 d-flex flex-column text-start position-relative">
                <h3 className="small fw-bold mb-0 text-body">{c.title}</h3>
                <p className="small text-muted mb-1 flex-grow-1 lh-sm br-home-float-card-text">{c.text}</p>
                <Link
                  to={c.to}
                  className="small fw-semibold text-br-rose text-decoration-none d-inline-flex align-items-center gap-1 mt-auto"
                >
                  {c.linkLabel}
                  <i className="bi bi-arrow-right" aria-hidden />
                </Link>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </section>
  );
}
