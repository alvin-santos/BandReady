import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Container, Row, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const SECTION_LINE = {
  listening: { border: 'rgb(37, 99, 235)', background: 'rgba(37, 99, 235, 0.08)' },
  reading: { border: 'rgb(5, 150, 105)', background: 'rgba(5, 150, 105, 0.08)' },
  writing: { border: 'rgb(217, 119, 6)', background: 'rgba(217, 119, 6, 0.08)' },
  speaking: { border: 'rgb(219, 39, 119)', background: 'rgba(219, 39, 119, 0.08)' },
  other: { border: 'rgb(100, 116, 139)', background: 'rgba(100, 116, 139, 0.08)' },
};

function shortDate(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Analytics() {
  const { user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/analytics');
        if (!cancelled) {
          setPayload(res.data);
        }
      } catch {
        if (!cancelled) {
          setErr('Could not load analytics.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const chartLabels = useMemo(() => {
    if (!payload?.charts?.labels?.length) {
      return [];
    }
    return payload.charts.labels.map(shortDate);
  }, [payload]);

  const sectionLineDatasets = useMemo(() => {
    const raw = payload?.charts?.section_avg_by_day;
    if (!raw || typeof raw !== 'object') {
      return [];
    }
    return Object.entries(raw)
      .filter(([, values]) => Array.isArray(values) && values.some((v) => v != null))
      .map(([key, values]) => {
        const colors = SECTION_LINE[key] || SECTION_LINE.other;
        const label =
          key === 'listening'
            ? 'Listening'
            : key === 'reading'
              ? 'Reading'
              : key === 'writing'
                ? 'Writing'
                : key === 'speaking'
                  ? 'Speaking'
                  : 'Other';
        return {
          label,
          data: values,
          borderColor: colors.border,
          backgroundColor: colors.background,
          tension: 0.25,
          spanGaps: true,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5,
        };
      });
  }, [payload]);

  const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: {
        beginAtZero: false,
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { precision: 0 },
      },
    },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          title(items) {
            const i = items[0]?.dataIndex;
            const iso = payload?.charts?.labels?.[i];
            return iso || '';
          },
        },
      },
    },
  };

  if (!user) {
    return (
      <Container className="py-5">
        <p className="d-flex align-items-center gap-2">
          <i className="bi bi-lock" aria-hidden />
          Please <Link to="/login">log in</Link> to view analytics.
        </p>
      </Container>
    );
  }

  if (!payload && !err) {
    return (
      <Container className="py-5 text-center">
        <Spinner />
      </Container>
    );
  }

  const summary = payload?.summary;
  const hasAttempts = (summary?.completed_attempts ?? 0) > 0;

  return (
    <Container className="py-4">
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-graph-up-arrow text-br-rose" aria-hidden />
        Analytics
      </h1>
      <p className="text-secondary mb-4">
        Track practice volume and score trends by day and by skill. Averages use completed attempts only.
      </p>

      {err && (
        <p className="text-danger d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon-fill" aria-hidden />
          {err}
        </p>
      )}

      {payload && !err && (
        <>
          <Row className="g-3 mb-4">
            <Col md={4}>
              <Card className="br-card border-0 h-100">
                <Card.Body>
                  <div className="text-secondary small text-uppercase fw-semibold mb-1">Completed tests</div>
                  <div className="h3 fw-bold mb-0">{summary?.completed_attempts ?? 0}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="br-card border-0 h-100">
                <Card.Body>
                  <div className="text-secondary small text-uppercase fw-semibold mb-1">Answers recorded</div>
                  <div className="h3 fw-bold mb-0">{summary?.answers_recorded ?? 0}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="br-card border-0 h-100">
                <Card.Body>
                  <div className="text-secondary small text-uppercase fw-semibold mb-1">Activity range</div>
                  <div className="fw-bold mb-0">
                    {summary?.first_activity && summary?.last_activity ? (
                      <>
                        {shortDate(summary.first_activity)} — {shortDate(summary.last_activity)}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {!hasAttempts && (
            <div className="br-card p-4 mb-4">
              <p className="mb-2">
                Finish at least one scored practice test to see day-by-day charts. Your answer count still reflects any
                completed attempts.
              </p>
              <Link to="/exam/start" className="btn btn-primary">
                Start practice
              </Link>
            </div>
          )}

          {hasAttempts && chartLabels.length > 0 && (
            <>
              <div className="br-card p-4 mb-4" style={{ minHeight: 320 }}>
                <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-activity" aria-hidden />
                  Overall score by day
                </h2>
                <div style={{ height: 260 }}>
                  <Line
                    data={{
                      labels: chartLabels,
                      datasets: [
                        {
                          label: 'Average score',
                          data: payload.charts.overall_avg_by_day,
                          borderColor: 'rgb(190, 24, 93)',
                          backgroundColor: 'rgba(190, 24, 93, 0.12)',
                          fill: true,
                          tension: 0.25,
                          spanGaps: true,
                          pointRadius: 4,
                        },
                      ],
                    }}
                    options={commonChartOptions}
                  />
                </div>
              </div>

              <div className="br-card p-4 mb-4" style={{ minHeight: 320 }}>
                <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-bar-chart-steps" aria-hidden />
                  Tests per day
                </h2>
                <div style={{ height: 260 }}>
                  <Bar
                    data={{
                      labels: chartLabels,
                      datasets: [
                        {
                          label: 'Attempts',
                          data: payload.charts.attempts_by_day,
                          backgroundColor: 'rgba(37, 99, 235, 0.45)',
                          borderRadius: 4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: { precision: 0 },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {sectionLineDatasets.length > 0 && (
                <div className="br-card p-4 mb-4" style={{ minHeight: 360 }}>
                  <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-layers" aria-hidden />
                    Score by skill (daily average)
                  </h2>
                  <p className="small text-secondary mb-3">
                    When you complete multiple tests on the same day, we average scores within each skill for that day.
                  </p>
                  <div style={{ height: 280 }}>
                    <Line
                      data={{
                        labels: chartLabels,
                        datasets: sectionLineDatasets,
                      }}
                      options={commonChartOptions}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {payload.section_totals?.length > 0 && (
            <div className="br-card p-4 mb-4">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-grid-3x3-gap" aria-hidden />
                Totals by skill
              </h2>
              <Table responsive hover size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th className="text-end">Tests</th>
                    <th className="text-end">Answers</th>
                    <th className="text-end">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.section_totals.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td className="text-end">{row.attempts}</td>
                      <td className="text-end">{row.answers_recorded}</td>
                      <td className="text-end">{row.avg_score != null ? row.avg_score : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <p className="small text-secondary">
            <Link to="/dashboard">Back to dashboard</Link>
          </p>
        </>
      )}
    </Container>
  );
}
