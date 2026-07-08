import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import Card from '../../components/ui/Card';
import analyticsService from '../../services/analyticsService';

const AdminAnalyticsPage = () => {
  const { data: trend = [] } = useQuery({ queryKey: ['analytics-trend'], queryFn: () => analyticsService.getTrend().then((res) => res.data) });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Analytics and KPIs</h1>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Visitors and Donations Trend</h2>
        <div className="mt-4 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visitors" stroke="#0B4EA2" strokeWidth={2.5} />
              <Line type="monotone" dataKey="donations" stroke="#F4A300" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <p className="text-sm">Track: daily visitors, monthly visitors, returning visitors, donation frequency, event attendance, newsletter signups, popular pages, search keywords, and average session duration.</p>
        <button className="mt-3 rounded-lg bg-brand-blue px-4 py-2 text-white">Download CSV Report</button>
      </Card>
    </div>
  );
};

export default AdminAnalyticsPage;
