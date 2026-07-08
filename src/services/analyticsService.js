import { mockResponse } from './mockApi';

const metrics = {
  visitorsToday: 1842,
  donationAmount: 12650,
  eventRegistrations: 312,
  volunteers: 88,
  bounceRate: 34,
  avgSession: '04:12'
};

const trend = [
  { name: 'Mon', visitors: 1200, donations: 900 },
  { name: 'Tue', visitors: 1320, donations: 1100 },
  { name: 'Wed', visitors: 1510, donations: 1200 },
  { name: 'Thu', visitors: 1480, donations: 980 },
  { name: 'Fri', visitors: 1760, donations: 1520 },
  { name: 'Sat', visitors: 2100, donations: 1900 },
  { name: 'Sun', visitors: 2300, donations: 2050 }
];

const analyticsService = {
  getMetrics: async () => mockResponse(metrics),
  getTrend: async () => mockResponse(trend)
};

export default analyticsService;
