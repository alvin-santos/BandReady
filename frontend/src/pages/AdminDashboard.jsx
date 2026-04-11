import { useEffect, useState } from 'react';
import { Col, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import { api } from '../api/client.js';
import { registerAdminCharts } from '../utils/adminChartRegister.js';
import { mergeTwoDailySeries } from '../utils/adminChartData.js';

registerAdminCharts();

const statIcons = {
  users: 'bi-people-fill',
  attempts: 'bi-graph-up-arrow',
  active: 'bi-lightning-charge-fill',
  score: 'bi-trophy-fill',
  ads: 'bi-cursor-fill',
  popular: 'bi-fire',
  views: 'bi-eye-fill',
  visitors: 'bi-person-badge',
  loggedIn: 'bi-person-check-fill',
};

const dualAxisLineOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 2.1,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom' } },
  scales: {
    x: { ticks: { maxRotation: 40, minRotation: 0 } },
    y: {
      type: 'linear',
      position: 'left',
      grid: { drawOnChartArea: true },
    },
    y1: {
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
    },
  },
};

const hBarOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 1.15,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } },
  },
};

function truncatePath(p, max = 44) {
  if (!p || p.length <= max) {
    return p || '';
  }
  return `${p.slice(0, max - 1)}…`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [examPop, setExamPop] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/stats/charts', { params: { days: 14 } }),
      api.get('/admin/stats/exam-popularity'),
    ])
      .then(([s, c, e]) => {
        setStats(s.data);
        setCharts(c.data);
        setExamPop(e.data);
      })
      .catch(() => setErr('Unable to load admin stats.'));
  }, []);

  if (err) {
    return (
      <div className="py-5">
        <p className="text-danger d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-octagon" aria-hidden />
          {err}
        </p>
        <Link to="/" className="d-inline-flex align-items-center gap-1">
          <i className="bi bi-house" aria-hidden />
          Home
        </Link>
      </div>
    );
  }

  if (!stats || !charts || !examPop) {
    return (
      <div className="py-5 text-center">
        <Spinner />
      </div>
    );
  }

  const tiles = [
    { key: 'users', label: 'Total users', value: stats.total_users, icon: statIcons.users },
    { key: 'attempts', label: 'Total attempts', value: stats.total_attempts, icon: statIcons.attempts },
    { key: 'active', label: 'Active (7d)', value: stats.active_users_7d, icon: statIcons.active },
    { key: 'score', label: 'Average score', value: stats.average_score ?? '—', icon: statIcons.score },
    { key: 'ads', label: 'Ad clicks', value: stats.ad_clicks, icon: statIcons.ads },
    {
      key: 'pageviews',
      label: 'Page views (all time)',
      value: stats.total_page_views ?? 0,
      icon: statIcons.views,
    },
    {
      key: 'pv7',
      label: 'Page views (7d)',
      value: stats.page_views_7d ?? 0,
      icon: statIcons.views,
    },
    {
      key: 'uv7',
      label: 'Unique visitors (7d)',
      value: stats.unique_visitors_7d ?? 0,
      icon: statIcons.visitors,
    },
    {
      key: 'uvisits',
      label: 'Users with visits (7d)',
      value: stats.logged_in_users_with_visits_7d ?? 0,
      icon: statIcons.loggedIn,
    },
  ];

  const practice = mergeTwoDailySeries(charts.attempts_per_day, charts.users_per_day);
  const traffic = mergeTwoDailySeries(charts.page_views_per_day ?? [], charts.unique_visitors_per_day ?? []);

  const examsSorted = [...(Array.isArray(examPop) ? examPop : [])].sort(
    (a, b) => Number(b.attempts_count) - Number(a.attempts_count),
  );
  const examTop = examsSorted.slice(0, 8);
  const examBarLabels = examTop.map((r) => r.name || r.code || 'Exam');
  const examBarValues = examTop.map((r) => Number(r.attempts_count) || 0);

  const pathRows = [...(charts.top_paths ?? [])].slice(0, 8);
  const pathBarLabels = pathRows.map((r) => truncatePath(r.path));
  const pathBarValues = pathRows.map((r) => Number(r.c) || 0);

  const refRows = [...(charts.top_referrers ?? [])].slice(0, 6);
  const refBarLabels = refRows.map((r) => truncatePath(r.referrer_label, 52));
  const refBarValues = refRows.map((r) => Number(r.c) || 0);

  return (
    <div>
      <h1 className="h3 fw-bold mb-2 d-flex align-items-center gap-2">
        <i className="bi bi-shield-lock-fill text-br-rose" aria-hidden />
        Admin dashboard
      </h1>
      <p className="text-muted mb-4">
        Traffic records page views, anonymous visitor ids, and the{' '}
        <strong>entry referrer</strong> (the page that linked to BandReady when the visitor opened the site in this
        tab, when the browser exposes it). Charts below use the last 14 days; open{' '}
        <Link to="/admin/stats" className="fw-semibold">
          Analytics
        </Link>{' '}
        for a longer range and more detail.
      </p>
      <Row className="g-3 mb-4">
        {tiles.map((t) => (
          <Col md={4} key={t.key}>
            <div className="br-card p-3 h-100">
              <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                <div className="small text-muted">{t.label}</div>
                <i className={`bi ${t.icon} text-br-rose opacity-75`} aria-hidden />
              </div>
              <div className="fs-3 fw-bold">{t.value}</div>
            </div>
          </Col>
        ))}
        <Col md={4}>
          <div className="br-card p-3 h-100">
            <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
              <div className="small text-muted">Most taken</div>
              <i className={`bi ${statIcons.popular} text-warning`} aria-hidden />
            </div>
            <div className="fw-semibold text-truncate">
              {stats.most_taken?.test?.title || '—'}
            </div>
            <div className="small text-muted">{stats.most_taken?.count ?? 0} attempts</div>
          </div>
        </Col>
      </Row>

      <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
        <i className="bi bi-bar-chart-line-fill text-br-rose" aria-hidden />
        Last 14 days — overview
      </h2>
      <Row className="g-3 mb-4">
        <Col lg={6}>
          <div className="br-card p-3 p-md-4 h-100">
            <div className="small text-muted text-uppercase fw-semibold mb-2">Practice &amp; sign-ups</div>
            <Line
              data={{
                labels: practice.labels,
                datasets: [
                  {
                    label: 'Completed attempts',
                    data: practice.a,
                    borderColor: 'rgb(37, 99, 235)',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    fill: true,
                    tension: 0.25,
                    yAxisID: 'y',
                  },
                  {
                    label: 'New users',
                    data: practice.b,
                    borderColor: 'rgb(5, 150, 105)',
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    fill: true,
                    tension: 0.25,
                    yAxisID: 'y1',
                  },
                ],
              }}
              options={{
                ...dualAxisLineOptions,
                plugins: {
                  ...dualAxisLineOptions.plugins,
                  title: { display: true, text: 'Attempts vs new registrations per day' },
                },
                scales: {
                  ...dualAxisLineOptions.scales,
                  y: { ...dualAxisLineOptions.scales.y, title: { display: true, text: 'Attempts' } },
                  y1: { ...dualAxisLineOptions.scales.y1, title: { display: true, text: 'New users' } },
                },
              }}
            />
          </div>
        </Col>
        <Col lg={6}>
          <div className="br-card p-3 p-md-4 h-100">
            <div className="small text-muted text-uppercase fw-semibold mb-2">Site traffic</div>
            <Line
              data={{
                labels: traffic.labels,
                datasets: [
                  {
                    label: 'Page views',
                    data: traffic.a,
                    borderColor: 'rgb(147, 51, 234)',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    fill: true,
                    tension: 0.25,
                    yAxisID: 'y',
                  },
                  {
                    label: 'Unique visitors',
                    data: traffic.b,
                    borderColor: 'rgb(217, 119, 6)',
                    backgroundColor: 'rgba(217, 119, 6, 0.08)',
                    fill: true,
                    tension: 0.25,
                    yAxisID: 'y1',
                  },
                ],
              }}
              options={{
                ...dualAxisLineOptions,
                plugins: {
                  ...dualAxisLineOptions.plugins,
                  title: { display: true, text: 'Page views vs distinct visitor ids per day' },
                },
                scales: {
                  ...dualAxisLineOptions.scales,
                  y: { ...dualAxisLineOptions.scales.y, title: { display: true, text: 'Page views' } },
                  y1: { ...dualAxisLineOptions.scales.y1, title: { display: true, text: 'Visitors' } },
                },
              }}
            />
          </div>
        </Col>
        <Col lg={6}>
          <div className="br-card p-3 p-md-4 h-100">
            <div className="small text-muted text-uppercase fw-semibold mb-2">Exams</div>
            {examBarLabels.length === 0 ? (
              <p className="text-muted small mb-0">No completed attempts yet — charts will populate as learners finish tests.</p>
            ) : (
              <Bar
                data={{
                  labels: examBarLabels,
                  datasets: [
                    {
                      label: 'Attempts',
                      data: examBarValues,
                      backgroundColor: 'rgba(225, 29, 72, 0.55)',
                    },
                  ],
                }}
                options={{
                  ...hBarOptions,
                  plugins: {
                    ...hBarOptions.plugins,
                    title: { display: true, text: 'Completed attempts by exam (top 8)' },
                  },
                }}
              />
            )}
          </div>
        </Col>
        <Col lg={6}>
          <div className="br-card p-3 p-md-4 h-100">
            <div className="small text-muted text-uppercase fw-semibold mb-2">Top routes</div>
            {pathBarLabels.length === 0 ? (
              <p className="text-muted small mb-0">No traffic recorded in this window yet.</p>
            ) : (
              <Bar
                data={{
                  labels: pathBarLabels,
                  datasets: [
                    {
                      label: 'Views',
                      data: pathBarValues,
                      backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    },
                  ],
                }}
                options={{
                  ...hBarOptions,
                  plugins: {
                    ...hBarOptions.plugins,
                    title: { display: true, text: 'Most viewed paths (top 8)' },
                    tooltip: {
                      callbacks: {
                        title: (items) => {
                          const i = items[0]?.dataIndex;
                          return i != null && pathRows[i] ? pathRows[i].path : '';
                        },
                      },
                    },
                  },
                }}
              />
            )}
          </div>
        </Col>
        <Col lg={12}>
          <div className="br-card p-3 p-md-4 h-100">
            <div className="small text-muted text-uppercase fw-semibold mb-2">Traffic sources (entry referrer)</div>
            {refBarLabels.length === 0 ? (
              <p className="text-muted small mb-0">No referrer data in this window yet.</p>
            ) : (
              <Bar
                data={{
                  labels: refBarLabels,
                  datasets: [
                    {
                      label: 'Page views',
                      data: refBarValues,
                      backgroundColor: 'rgba(13, 148, 136, 0.55)',
                    },
                  ],
                }}
                options={{
                  ...hBarOptions,
                  plugins: {
                    ...hBarOptions.plugins,
                    title: {
                      display: true,
                      text: 'Where visits came from (same referrer per tab session; direct if none)',
                    },
                    tooltip: {
                      callbacks: {
                        title: (items) => {
                          const i = items[0]?.dataIndex;
                          return i != null && refRows[i] ? refRows[i].referrer_label : '';
                        },
                      },
                    },
                  },
                }}
              />
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
