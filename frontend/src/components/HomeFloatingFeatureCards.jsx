import { Col, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function buildCards(user) {
  return [
    {
      icon: 'bi-layers-fill',
      title: 'Full mock exams',
      text: 'Timed IELTS- and CELPIP-style runs with autosave, resume, and section layouts that feel like test day.',
      to: '/exam/start',
      linkLabel: 'Start practice',
    },
    {
      icon: 'bi-volume-up-fill',
      title: 'Listening & reading',
      text: 'Audio-driven listening and long-form reading where your team has published content—plus writing and speaking flows.',
      to: '/exam/start',
      linkLabel: 'Choose a test',
    },
    {
      icon: 'bi-stars',
      title: 'AI feedback & Pro',
      text: 'Optional AI-assisted feedback on eligible writing and speaking, unlimited Speaking on Pro, and gated resources.',
      to: '/subscription',
      linkLabel: 'View Pro',
    },
    {
      icon: 'bi-people-fill',
      title: 'Forum & rankings',
      text: 'Discuss prep with other learners and see how practice metrics compare on the leaderboard.',
      to: '/forum',
      linkLabel: 'Open forum',
    },
    {
      icon: 'bi-speedometer2',
      title: 'Dashboard & analytics',
      text: 'Signed-in learners get history, trends, and a mistakes hub to target weak spots between attempts.',
      to: user ? '/dashboard' : '/register',
      linkLabel: user ? 'Open dashboard' : 'Create free account',
    },
    {
      icon: 'bi-file-earmark-arrow-down-fill',
      title: 'Resources',
      text: 'Downloadable guides and files to support offline study alongside your online attempts.',
      to: '/resources',
      linkLabel: 'Browse resources',
    },
  ];
}

export default function HomeFloatingFeatureCards() {
  const { user } = useAuth();
  const cards = buildCards(user);

  return (
    <section className="br-home-float-features py-3 py-lg-4 mb-2 position-relative" aria-labelledby="br-home-float-features-title">
      <div className="br-home-float-features-deco" aria-hidden />
      <h2 id="br-home-float-features-title" className="h5 fw-bold text-center mb-1 position-relative">
        Built for serious <span className="text-br-rose">prep</span>
      </h2>
      <p className="text-muted text-center small mx-auto mb-3 position-relative" style={{ maxWidth: '34rem' }}>
        Everything you need in one place—pick what matters to you and dive in.
      </p>
      <Row className="g-3 justify-content-center position-relative">
        {cards.map((c, i) => (
          <Col key={c.title} xs={12} sm={6} lg={4}>
            <div
              className={`br-float-feature-card br-card br-float-feature-card--compact br-float-feature-card--tint-${i % 6} h-100 d-flex flex-column`}
              style={{ animationDelay: `${i * 0.35}s` }}
            >
              <div className="br-float-feature-icon-wrap mb-2" aria-hidden>
                <i className={`bi ${c.icon} br-float-feature-icon`} />
              </div>
              <h3 className="h6 fw-bold mb-1">{c.title}</h3>
              <p className="small text-muted mb-2 flex-grow-1 lh-sm">{c.text}</p>
              <Link
                to={c.to}
                className="small fw-semibold text-br-rose text-decoration-none d-inline-flex align-items-center gap-1 mt-auto"
              >
                {c.linkLabel}
                <i className="bi bi-arrow-right" aria-hidden />
              </Link>
            </div>
          </Col>
        ))}
      </Row>
    </section>
  );
}
