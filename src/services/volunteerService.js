import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-volunteer-registrations';
const OPPORTUNITIES_STORAGE_KEY = 'ssm-seva-opportunities';

const defaultSevaOpportunities = [
  { id: 'op-1', sevaType: 'Langar', date: '2026-07-12', time: '10:00 AM - 1:00 PM', totalVolunteersRequired: 10, expiryDate: '2026-07-11' },
  { id: 'op-2', sevaType: 'Parking', date: '2026-07-12', time: '9:30 AM - 12:30 PM', totalVolunteersRequired: 8, expiryDate: '2026-07-11' },
  { id: 'op-3', sevaType: 'Cleaning', date: '2026-07-13', time: '6:30 PM - 8:00 PM', totalVolunteersRequired: 6, expiryDate: '2026-07-12' }
];

const readRegistrations = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const normalizeOpportunity = (item, index = 0) => ({
  id: item.id || `op-${index + 1}`,
  sevaType: item.sevaType || '',
  date: item.date || toIsoDate(Date.now()),
  time: item.time || '',
  totalVolunteersRequired: Math.max(1, Number(item.totalVolunteersRequired) || 10),
  expiryDate: item.expiryDate || item.date || toIsoDate(Date.now())
});

const writeRegistrations = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    // Ignore localStorage write failures in mock mode.
  }
};

const readSevaOpportunities = () => {
  try {
    const raw = window.localStorage.getItem(OPPORTUNITIES_STORAGE_KEY);
    const source = raw ? JSON.parse(raw) : defaultSevaOpportunities;
    return source.map((item, index) => normalizeOpportunity(item, index));
  } catch {
    return defaultSevaOpportunities.map((item, index) => normalizeOpportunity(item, index));
  }
};

const writeSevaOpportunities = (records) => {
  try {
    window.localStorage.setItem(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write failures in mock mode.
  }
};

const toIsoDate = (value) => new Date(value).toISOString().slice(0, 10);

const countRegisteredForOpportunity = (opportunity, registrations) => registrations.filter((entry) => (
  entry.opportunityId === opportunity.id ||
  (!entry.opportunityId && (entry.sevaType || entry.area) === opportunity.sevaType && entry.sevaDate === opportunity.date)
)).length;

const opportunities = [
  'Langar',
  'Cleaning',
  'Parking',
  'Teaching',
  'Events'
];

const volunteerService = {
  getOpportunities: async () => mockResponse(opportunities),
  getSevaOpportunities: async () => mockResponse(readSevaOpportunities()),
  createSevaOpportunity: async (payload) => {
    const record = normalizeOpportunity({
      id: `op-${Date.now()}`,
      sevaType: payload.sevaType,
      date: payload.date,
      time: payload.time || '',
      totalVolunteersRequired: payload.totalVolunteersRequired,
      expiryDate: payload.expiryDate
    });
    const next = [record, ...readSevaOpportunities()];
    writeSevaOpportunities(next);
    return mockResponse(record);
  },
  updateSevaOpportunity: async (id, payload) => {
    const next = readSevaOpportunities().map((item) => (
      item.id === id ? normalizeOpportunity({ ...item, ...payload, id }) : item
    ));
    writeSevaOpportunities(next);
    return mockResponse(next.find((item) => item.id === id));
  },
  removeSevaOpportunity: async (id) => {
    const next = readSevaOpportunities().filter((item) => item.id !== id);
    writeSevaOpportunities(next);
    return mockResponse({ success: true });
  },
  apply: async (payload) => {
    const allRecords = readRegistrations();
    const allOpportunities = readSevaOpportunities();
    const selectedOpportunity = allOpportunities.find((item) => item.id === payload.opportunityId);

    if (!selectedOpportunity) {
      throw new Error('Please select a valid seva opportunity.');
    }

    const today = toIsoDate(Date.now());
    if (selectedOpportunity.expiryDate && selectedOpportunity.expiryDate < today) {
      throw new Error('Registration is closed for this seva opportunity.');
    }

    const registeredCount = countRegisteredForOpportunity(selectedOpportunity, allRecords);
    if (registeredCount >= selectedOpportunity.totalVolunteersRequired) {
      throw new Error('Volunteer limit reached for this seva opportunity.');
    }

    const record = {
      id: `vol-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      opportunityId: selectedOpportunity.id,
      area: selectedOpportunity.sevaType,
      sevaType: selectedOpportunity.sevaType,
      sevaDate: selectedOpportunity.date,
      sevaTime: selectedOpportunity.time,
      contactPreference: payload.contactPreference || 'Email',
      wantsEventEmails: Boolean(payload.wantsEventEmails),
      notes: payload.notes || '',
      status: 'Pending',
      date: toIsoDate(Date.now()),
      createdAt: new Date().toISOString()
    };

    allRecords.unshift(record);
    writeRegistrations(allRecords);

    return mockResponse({ success: true, payload: record });
  },
  getApplications: async () => mockResponse(readRegistrations()),
  updateApplication: async (id, payload) => {
    const updated = readRegistrations().map((item) => (
      item.id === id ? { ...item, ...payload } : item
    ));
    writeRegistrations(updated);
    return mockResponse(updated.find((item) => item.id === id));
  },
  getTodayRegistrations: async () => {
    const today = toIsoDate(Date.now());
    const records = readRegistrations().filter((item) => item.date === today);
    return mockResponse(records);
  },
  getArchive: async () => {
    const grouped = readRegistrations().reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date].push(item);
      return acc;
    }, {});

    const archive = Object.entries(grouped)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, entries]) => ({ date, entries }));

    return mockResponse(archive);
  }
};

export default volunteerService;
