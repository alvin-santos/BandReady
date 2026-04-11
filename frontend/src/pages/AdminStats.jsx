import { useEffect, useState } from 'react';
import { Spinner, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { api } from '../api/client.js';
import { registerAdminCharts } from '../utils/adminChartRegister.js';
import { examAttemptsForChart, mergeTwoDailySeries } from '../utils/adminChartData.js';

registerAdminCharts();

const dualAxisLineOptions = {
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 2.05,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom' } },
  scales: {
    x: { ticks: { maxRotation: 45, minRotation: 0 } },
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
  aspectRatio: 1.2,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 } },
  },
};

const doughnutColors = [
  'rgba(225, 29, 72, 0.85)',
  'rgba(37, 99, 235, 0.85)',
  'rgba(5, 150, 105, 0.85)',
  'rgba(147, 51, 234, 0.85)',
  'rgba(217, 119, 6, 0.85)',
  'rgba(14, 165, 233, 0.75)',
  'rgba(100, 116, 139, 0.75)',
];

function truncatePath(p, max = 48) {
  if (!p || p.length <= max) {
    return p || '';
  }
  return `${p.slice(0, max - 1)}…`;
}

export default function AdminStats() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [exams, setExams] = useState(null);

  useEffect(() => {
    api.get('/admin/stats/exam-popularity').then((res) => setExams(res.data));
  }, []);

  useEffect(() => {
    setData(null);
    let cancelled = false;
    api.get('/admin/stats/charts', { params: { days } }).then((res) => {
      if (!cancelled) {
        setData(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (!data || !exams) {
    return (
      <div className="py-5 text-center">
        <Spinner />
      </div>
    );
  }

  const practice = mergeTwoDailySeries(data.attempts_per_day, data.users_per_day);
  const traffic = mergeTwoDailySeries(data.page_views_per_day ?? [], data.unique_visitors_per_day ?? []);

  const examsList = Array.isArray(exams) ? exams : [];
  const examsSorted = [...examsList].sort((a, b) => Number(b.attempts_count) - Number(a.attempts_count));
  const examTop = examsSorted.slice(0, 10);
  const examBarLabels = examTop.map((r) => r.name || r.code || 'Exam');
  const examBarValues = examTop.map((r) => Number(r.attempts_count) || 0);

  const { labels: doughnutLabels, data: doughnutValues } = examAttemptsForChart(examsList, 6);

  const pathRows = [...(data.top_paths ?? [])].slice(0, 12);
  const pathBarLabels = pathRows.map((r) => truncatePath(r.path));
  const pathBarValues = pathRows.map((r) => Number(r.c) || 0);

  const refRows = [...(data.top_referrers ?? [])].slice(0, 12);
  const refBarLabels = refRows.map((r) => truncatePath(r.referrer_label, 56));
  const refBarValues = refRows.map((r) => Number(r.c) || 0);

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h1 className="h3 fw-bold mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-graph-up-arrow text-br-rose" aria-hidden />
          Statistics
        </h1>
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted text-nowrap">Range</span>
          <ToggleButtonGroup
            type="radio"
            name="stats-days"
            value={days}
            onChange={(v) => v != null && setDays(v)}
          >
            {[7, 14, 30, 90].map((d) => (
              <ToggleButton key={d} id={`stats-days-${d}`} value={d} variant="outline-secondary" size="sm">
                {d}d
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
      </div>
      <p className="text-muted mb-4">
        Traffic charts use recorded page views (anonymous visitor id per browser) and the{' '}
        <strong>entry referrer</strong>: the URL of the page that linked the visitor into this site when they opened
        the tab (when the browser sends it). Direct opens and some privacy settings appear as “direct or unknown”.
        Practice charts use completed attempts and user registration dates. Exam breakdown uses all completed
        attempts (not limited to the range above).
      </p>

      <div className="br-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-calendar-week" aria-hidden />
          Practice &amp; sign-ups ({days} days)
        </h2>
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

      <div className="br-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-activity" aria-hidden />
          Site traffic ({days} days)
        </h2>
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

      <div className="row g-3 mb-4">
        <div className="col-lg-5">
          <div className="br-card p-4 h-100">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-pie-chart-fill" aria-hidden />
              Attempts by exam
            </h2>
            {doughnutLabels.length === 0 ? (
              <p className="text-muted small mb-0">No completed attempts yet.</p>
            ) : (
              <Doughnut
                data={{
                  labels: doughnutLabels,
                  datasets: [
                    {
                      data: doughnutValues,
                      backgroundColor: doughnutColors.slice(0, doughnutLabels.length),
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.9)',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  aspectRatio: 1.1,
                  plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Share of completed attempts' },
                  },
                }}
              />
            )}
          </div>
        </div>
        <div className="col-lg-7">
          <div className="br-card p-4 h-100">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-mortarboard" aria-hidden />
              Exam volume (ranked)
            </h2>
            {examBarLabels.length === 0 ? (
              <p className="text-muted small mb-0">No completed attempts yet.</p>
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
                    title: { display: true, text: 'Top 10 exams by completed attempts' },
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="br-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-signpost-2" aria-hidden />
          Top paths ({days} days)
        </h2>
        {pathBarLabels.length === 0 ? (
          <p className="text-muted small mb-0">No traffic in this range.</p>
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
                title: { display: true, text: 'Up to 12 routes by view count' },
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

      <div className="br-card p-4 mb-4">
        <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-box-arrow-in-right" aria-hidden />
          Traffic sources — entry referrer ({days} days)
        </h2>
        {refBarLabels.length === 0 ? (
          <p className="text-muted small mb-0">No referrer data in this range.</p>
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
                title: { display: true, text: 'Up to 12 referring URLs (or direct), by recorded page views' },
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
    </div>
  );
}
