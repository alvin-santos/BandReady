import { useEffect, useState } from 'react';
import { Col, Container, Row, Spinner } from 'react-bootstrap';
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
import ReadinessCard from '../components/ReadinessCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Profile() {
  const { user, isSubscribed } = useAuth();
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

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-4 d-flex align-items-center gap-2">
        <i className="bi bi-person-badge text-br-rose" aria-hidden />
        Profile
      </h1>
      <ReadinessCard readiness={data.readiness} compact />
      <Row className="g-4">
        <Col md={6}>
          <div className="br-card p-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-card-heading" aria-hidden />
              Overview
            </h2>
            <p className="mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-person text-muted" aria-hidden />
              <strong>Name:</strong> {user.name}
            </p>
            <p className="mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-envelope text-muted" aria-hidden />
              <strong>Email:</strong> {user.email}
            </p>
            <p className="mb-1 d-flex align-items-center gap-2">
              <i className="bi bi-trophy text-muted" aria-hidden />
              <strong>Average score:</strong>{' '}
              {data.average_score != null ? `${data.average_score}%` : '—'}
            </p>
            <p className="mb-0 d-flex align-items-center gap-2 flex-wrap">
              <i className="bi bi-star-fill text-muted" aria-hidden />
              <strong>Pro access:</strong>{' '}
              {isSubscribed ? (
                <span className="text-success">Active</span>
              ) : (
                <span className="text-muted">
                  None —{' '}
                  <Link to="/subscription" className="fw-semibold">
                    One-time Pro
                  </Link>
                </span>
              )}
            </p>
          </div>
        </Col>
        <Col md={6}>
          <div className="br-card p-4">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-collection" aria-hidden />
              Attempts history
            </h2>
            <p className="text-muted small d-flex align-items-center gap-1">
              <i className="bi bi-check2-all" aria-hidden />
              {data.completed_count} completed
            </p>
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
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
