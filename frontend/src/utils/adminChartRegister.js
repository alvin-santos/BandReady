import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

let registered = false;

/** Register Chart.js components once for admin dashboards (Line, Bar, Doughnut, area fill). */
export function registerAdminCharts() {
  if (registered) {
    return;
  }
  registered = true;
  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
  );
}
