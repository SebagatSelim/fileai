import { Doughnut } from 'react-chartjs-2';
import './chartSetup';
import { categoryColor } from '../../utils/labels';
import { formatNumber } from '../../utils/format';

/** Documents per category (GET /api/dashboard/stats -> by_category). */
export default function CategoryDoughnut({ data = [] }) {
  const total = data.reduce((sum, d) => sum + (d.count || 0), 0);
  const chartData = {
    labels: data.map((d) => d.category || 'Uncategorised'),
    datasets: [
      {
        data: data.map((d) => d.count || 0),
        backgroundColor: data.map((d) => categoryColor(d.category || 'Uncategorised')),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#0b2233', padding: 10, cornerRadius: 8 },
    },
  };
  return (
    <div className="fa-doughnut position-relative" style={{ height: 190 }}>
      <Doughnut data={chartData} options={options} role="img" aria-label="Doughnut chart of documents by category" />
      <div className="fa-doughnut-center" aria-hidden="true">
        <div className="fa-doughnut-value">{formatNumber(total)}</div>
        <div className="fa-doughnut-label">documents</div>
      </div>
    </div>
  );
}
