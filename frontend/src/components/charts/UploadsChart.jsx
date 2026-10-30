import { Line } from 'react-chartjs-2';
import './chartSetup';
import { formatMonth } from '../../utils/format';

function areaGradient(context, rgb) {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return `rgba(${rgb}, 0.12)`;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, `rgba(${rgb}, 0.28)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  return gradient;
}

/** Uploaded vs AI-classified documents per month (GET /api/dashboard/stats -> uploads_by_month). */
export default function UploadsChart({ data = [] }) {
  // Short month labels; when the range spans years, mark the first month and each January ("Jan '26").
  const years = new Set(data.map((d) => String(d.month).slice(0, 4)));
  const labels = data.map((d, index) => {
    const label = formatMonth(d.month);
    const month = String(d.month).slice(5, 7);
    if (years.size > 1 && (index === 0 || month === '01')) return `${label} '${String(d.month).slice(2, 4)}`;
    return label;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Uploaded',
        data: data.map((d) => d.uploaded || 0),
        borderColor: '#0f766e',
        backgroundColor: (context) => areaGradient(context, '15, 118, 110'),
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0f766e',
      },
      {
        label: 'AI classified',
        data: data.map((d) => d.classified || 0),
        borderColor: '#06b6d4',
        backgroundColor: (context) => areaGradient(context, '6, 182, 212'),
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#06b6d4',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0b2233',
        padding: 10,
        cornerRadius: 8,
        titleFont: { weight: '600' },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        border: { display: false },
      },
    },
  };

  return (
    <div className="fa-chart" style={{ height: 280 }}>
      <Line data={chartData} options={options} aria-label="Line chart of uploads and AI classifications by month" role="img" />
    </div>
  );
}
