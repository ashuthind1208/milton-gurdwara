import { useQuery } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import StatsCard from '../../components/cards/StatsCard';
import Card from '../../components/ui/Card';
import analyticsService from '../../services/analyticsService';
import { formatCurrency } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const AdminDashboardPage = () => {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: () => analyticsService.getMetrics().then((res) => res.data) });
  const { data: trend = [] } = useQuery({ queryKey: ['trend'], queryFn: () => analyticsService.getTrend().then((res) => res.data) });

  const chartData = {
    labels: trend.map((item) => item.name),
    datasets: [
      {
        label: 'Visitors',
        data: trend.map((item) => item.visitors),
        backgroundColor: '#0B4EA2'
      },
      {
        label: 'Donations',
        data: trend.map((item) => item.donations),
        backgroundColor: '#F4A300'
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">Tuesday, July 7, 2026</p>
        <h1 className="font-heading text-3xl font-bold">My Dashboard</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatsCard label="Visitors Today" value={metrics?.visitorsToday || 0} />
        <StatsCard label="Donations" value={formatCurrency(metrics?.donationAmount)} tone="text-brand-green" />
        <StatsCard label="Event Registrations" value={metrics?.eventRegistrations || 0} />
        <StatsCard label="Volunteers" value={metrics?.volunteers || 0} />
        <StatsCard label="Bounce Rate" value={`${metrics?.bounceRate || 0}%`} />
        <StatsCard label="Avg Session" value={metrics?.avgSession || '-'} />
      </div>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Weekly Trend</h2>
        <div className="mt-4 h-[320px]"><Bar data={chartData} options={{ maintainAspectRatio: false }} /></div>
      </Card>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Recent Activity</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p className="text-xs uppercase text-slate-500">On Track</p>
            <p className="mt-1 text-2xl font-semibold text-brand-green">9</p>
            <p className="text-sm">Projects healthy</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p className="text-xs uppercase text-slate-500">Needs Attention</p>
            <p className="mt-1 text-2xl font-semibold text-brand-error">3</p>
            <p className="text-sm">Pending approvals</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40">
            <p className="text-xs uppercase text-slate-500">Burn Rate</p>
            <p className="mt-1 text-2xl font-semibold text-brand-blue">$420</p>
            <p className="text-sm">Average per day</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
