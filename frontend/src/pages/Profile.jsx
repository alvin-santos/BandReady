import { useEffect, useState } from 'react';
import { Alert, Badge, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { api } from '../api/client.js';
import ProBadge from '../components/ProBadge.jsx';
import ReadinessCard from '../components/ReadinessCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function formatProExpiry(iso) {
  if (!iso) {
    return null;
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });
  } catch {
    return null;
  }
}

function formatMemberSince(iso) {
  if (!iso) {
    return null;
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return null;
  }
}

export default function Profile() {
  const { user, isSubscribed, isAdmin } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    api.get('/profile/stats').then((res) => setData(res.data));
  }, [user]);

  if (!user) {
    return (
      <Container className="py-5">
        <p className="d-flex align-items-center gap-2">
          <i className="bi bi-person-lock" aria-hidden />
          <Link to="/login">Log in</Link> to see your profile.
        </p>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  const attempts = data.recent_attempts || [];
  const labels = attempts.map((a) => a.completed_at?.slice(0, 10) || '').reverse();
  const scores = attempts.map((a) => a.score ?? 0).reverse();

  const chartData = {
    labels: labels.length ? labels : ['—'],
    datasets: [
      {
        label: 'Score %',
        data: scores.length ? scores : [0],
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        tension: 0.25,
      },
    ],
  };

  const proExpiryLabel = formatProExpiry(user.subscription_expires_at);
  const memberSinceLabel = formatMemberSince(user.created_at);
  const speakingLimit = user.speaking_attempts_limit;
  const speakingUsed = user.speaking_attempts_used ?? 0;
  const speakingUnlimited = speakingLimit == null || speakingLimit <= 0;

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-4 d-flex align-items-center flex-wrap gap-2">
        <i className="bi bi-person-badge text-br-rose" aria-hidden />
        <span>Profile</span>
        {isSubscribed && <ProBadge />}
      </h1>
      {user.speaking_ai_suspended && (
        <Alert variant="warning" className="d-flex gap-2 align-items-start mb-4">
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1" aria-hidden />
          <div>
            <strong>Speaking practice disabled</strong>
            {user.speaking_ai_suspended_at && (
              <div className="small text-muted mt-1">
                Since {new Date(user.speaking_ai_suspended_at).toLocaleString()}
              </div>
            )}
            <p className="mb-0 mt-2 small">
              {user.speaking_ai_suspension_notice ||
                'Speaking tests are not available on this account after inappropriate language was detected in speaking practice. Use Contact if you believe this is a mistake.'}
            </p>
          </div>
        </Alert>
      )}
      <ReadinessCard readiness={data.readiness} compact />
      <Row className="g-4">
        <Col md={6}>
          <div className="br-card p-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-person-vcard" aria-hidden />
              Account details
            </h2>
            <div className="d-flex align-items-start gap-3 mb-4 pb-3 border-bottom border-secondary border-opacity-25">
              <div
                className="rounded-circle bg-body-secondary d-flex align-items-center justify-content-center flex-shrink-0 text-br-rose fw-bold"
                style={{ width: 56, height: 56, fontSize: '1.25rem' }}
                aria-hidden
              >
                {String(user.name || '?')
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="h5 fw-bold mb-1 text-truncate">{user.name}</div>
                <div className="text-muted small text-break">{user.email}</div>
                <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                  {user.email_verified ? (
                    <Badge bg="success" className="bg-success bg-opacity-10 text-success border border-success border-opacity-25 fw-normal">
                      Email verified
                    </Badge>
                  ) : (
                    <Badge bg="warning" className="bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25 fw-normal">
                      Email not verified
                    </Badge>
                  )}
                  {isAdmin && (
                    <Badge bg="primary" className="bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 fw-normal">
                      Administrator
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <dl className="row small mb-0 gy-2">
              <dt className="col-sm-4 text-muted fw-normal mb-0">
                <i className="bi bi-hash me-1" aria-hidden />
                User ID
              </dt>
              <dd className="col-sm-8 mb-0 font-monospace">{user.id}</dd>
              {memberSinceLabel && (
                <>
                  <dt className="col-sm-4 text-muted fw-normal mb-0">
                    <i className="bi bi-calendar3 me-1" aria-hidden />
                    Member since
                  </dt>
                  <dd className="col-sm-8 mb-0">{memberSinceLabel}</dd>
                </>
              )}
              <dt className="col-sm-4 text-muted fw-normal mb-0">
                <i className="bi bi-shield-check me-1" aria-hidden />
                Account type
              </dt>
              <dd className="col-sm-8 mb-0">{isAdmin ? 'Administrator' : 'Learner'}</dd>
              <dt className="col-sm-4 text-muted fw-normal mb-0">
                <i className="bi bi-box-arrow-in-right me-1" aria-hidden />
                Sign-in
              </dt>
              <dd className="col-sm-8 mb-0">
                {user.google_linked ? 'Google and email on file' : 'Email and password'}
              </dd>
              <dt className="col-sm-4 text-muted fw-normal mb-0">
                <i className="bi bi-mic me-1" aria-hidden />
                Speaking starts
              </dt>
              <dd className="col-sm-8 mb-0">
                {speakingUnlimited ? (
                  <span className="text-success">Unlimited</span>
                ) : (
                  <span>
                    <span className="font-monospace fw-semibold">{speakingUsed}</span>
                    <span className="text-muted"> / </span>
                    <span className="font-monospace">{speakingLimit}</span>
                    <span className="text-muted small ms-1">(free tier)</span>
                  </span>
                )}
              </dd>
              <dt className="col-sm-4 text-muted fw-normal mb-0">
                <i className="bi bi-star-fill me-1" aria-hidden />
                Pro access
              </dt>
              <dd className="col-sm-8 mb-0">
                {isSubscribed ? (
                  <span className="d-inline-flex align-items-center gap-2 flex-wrap">
                    <ProBadge />
                    <span className="text-success fw-semibold">Active</span>
                    {proExpiryLabel && <span className="text-muted">through {proExpiryLabel}</span>}
                  </span>
                ) : (
                  <span className="text-muted">
                    None —{' '}
                    <Link to="/subscription" className="fw-semibold">
                      Get Pro
                    </Link>
                  </span>
                )}
              </dd>
            </dl>
            {!user.email_verified && (
              <p className="small text-muted border-top border-secondary border-opacity-25 pt-3 mt-3 mb-0">
                <Link to="/verify-email" className="fw-semibold">
                  Confirm your email
                </Link>{' '}
                to unlock dashboard, analytics, and purchases.
              </p>
            )}
          </div>
        </Col>
        <Col md={6} className="d-flex flex-column gap-3">
          <div className="br-card p-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-card-heading" aria-hidden />
              Practice summary
            </h2>
            <p className="mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-trophy text-muted" aria-hidden />
              <strong>Average score:</strong>{' '}
              {data.average_score != null ? `${data.average_score}%` : '—'}
            </p>
            <p className="mb-0 d-flex align-items-center gap-2">
              <i className="bi bi-check2-all text-muted" aria-hidden />
              <strong>Completed attempts:</strong> {data.completed_count ?? 0}
            </p>
          </div>
          <div className="br-card p-4 flex-grow-1">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-collection" aria-hidden />
              Attempts history
            </h2>
            <p className="text-muted small d-flex align-items-center gap-1">
              <i className="bi bi-check2-all" aria-hidden />
              {data.completed_count} completed
            </p>
            <div style={{ maxHeight: 280, overflow: 'auto' }}>
              {attempts.map((a) => (
                <div key={a.id} className="d-flex justify-content-between border-bottom py-2 small">
                  <span className="text-truncate me-2 d-flex align-items-center gap-2">
                    <i className="bi bi-journal-text text-muted flex-shrink-0" aria-hidden />
                    {a.test?.title}
                  </span>
                  <span className="text-nowrap fw-semibold">{a.score != null ? `${a.score}%` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col xs={12}>
          <div className="br-card p-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-activity" aria-hidden />
              Progress
            </h2>
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: { legend: { display: true } },
                scales: { y: { min: 0, max: 100 } },
              }}
            />
          </div>
        </Col>
      </Row>
    </Container>
  );
}
