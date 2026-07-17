import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const RESOURCE = 'analytics_daily_metrics';

const dayLabel = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'Day';
  }
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const normalizeMetricRow = (row = {}) => ({
  id: row.id || row.metricDate || row.date || `metric-${Date.now()}`,
  metricDate: row.metricDate || row.date || new Date().toISOString().slice(0, 10),
  totalVisits: Number(row.totalVisits ?? row.total_visits ?? row.visitors ?? 0),
  uniqueVisitors: Number(row.uniqueVisitors ?? row.unique_visitors ?? 0),
  eventRegistrations: Number(row.eventRegistrations ?? row.event_registrations ?? 0),
  sevaRegistrations: Number(row.sevaRegistrations ?? row.seva_registrations ?? 0),
  donationsCount: Number(row.donationsCount ?? row.donations_count ?? 0),
  donationsAmount: Number(row.donationsAmount ?? row.donations_amount ?? row.donations ?? 0),
  avgSession: row.avgSession || row.avg_session || '-',
  updatedAt: row.updatedAt || new Date().toISOString()
});

const defaultTrend = [
  { metricDate: '2026-07-04', totalVisits: 120, uniqueVisitors: 97, eventRegistrations: 9, sevaRegistrations: 6, donationsCount: 4, donationsAmount: 450 },
  { metricDate: '2026-07-05', totalVisits: 146, uniqueVisitors: 114, eventRegistrations: 11, sevaRegistrations: 8, donationsCount: 5, donationsAmount: 620 },
  { metricDate: '2026-07-06', totalVisits: 131, uniqueVisitors: 101, eventRegistrations: 7, sevaRegistrations: 5, donationsCount: 3, donationsAmount: 390 },
  { metricDate: '2026-07-07', totalVisits: 158, uniqueVisitors: 121, eventRegistrations: 12, sevaRegistrations: 9, donationsCount: 6, donationsAmount: 710 },
  { metricDate: '2026-07-08', totalVisits: 167, uniqueVisitors: 130, eventRegistrations: 13, sevaRegistrations: 10, donationsCount: 7, donationsAmount: 880 },
  { metricDate: '2026-07-09', totalVisits: 149, uniqueVisitors: 118, eventRegistrations: 10, sevaRegistrations: 7, donationsCount: 5, donationsAmount: 560 },
  { metricDate: '2026-07-10', totalVisits: 172, uniqueVisitors: 137, eventRegistrations: 14, sevaRegistrations: 11, donationsCount: 8, donationsAmount: 930 }
];

const ensureSeed = async () => {
  const rows = await contentApiService.list(RESOURCE);
  if (rows.length > 0) {
    return rows.map((row) => normalizeMetricRow(row));
  }

  await Promise.all(defaultTrend.map((row) => contentApiService.create(RESOURCE, normalizeMetricRow(row))));
  const seeded = await contentApiService.list(RESOURCE);
  return seeded.map((row) => normalizeMetricRow(row));
};

const summarizeMetrics = (rows = []) => {
  const sorted = [...rows].sort((a, b) => a.metricDate.localeCompare(b.metricDate));
  const latest = sorted[sorted.length - 1] || normalizeMetricRow({});

  return {
    visitorsToday: latest.totalVisits,
    eventRegistrations: latest.eventRegistrations,
    volunteers: latest.sevaRegistrations,
    avgSession: latest.avgSession || '-',
    donationAmount: sorted.reduce((sum, row) => sum + Number(row.donationsAmount || 0), 0)
  };
};

const analyticsService = {
  getTrend: async () => {
    try {
      const rows = await ensureSeed();
      const sorted = [...rows].sort((a, b) => a.metricDate.localeCompare(b.metricDate));

      return serviceResponse(sorted.map((row) => ({
        name: dayLabel(row.metricDate),
        visitors: row.totalVisits,
        donations: row.donationsAmount
      })));
    } catch {
      return serviceResponse(defaultTrend.map((row) => ({
        name: dayLabel(row.metricDate),
        visitors: row.totalVisits,
        donations: row.donationsAmount
      })));
    }
  },

  getMetrics: async () => {
    try {
      const rows = await ensureSeed();
      return serviceResponse(summarizeMetrics(rows));
    } catch {
      return serviceResponse(summarizeMetrics(defaultTrend.map((row) => normalizeMetricRow(row))));
    }
  }
};

export default analyticsService;
