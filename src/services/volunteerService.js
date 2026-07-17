import { serviceResponse } from './serviceResponse';
import userService from './userService';
import contentApiService from './contentApiService';

const OPPORTUNITIES_RESOURCE = 'seva_opportunities';
const APPLICATIONS_RESOURCE = 'volunteer_registrations';

const defaultSevaOpportunities = [
  { id: 'op-1', sevaType: 'Langar', date: '2026-07-12', time: '10:00 AM - 1:00 PM', totalVolunteersRequired: 10, expiryDate: '2026-07-11', active: true },
  { id: 'op-2', sevaType: 'Parking', date: '2026-07-12', time: '9:30 AM - 12:30 PM', totalVolunteersRequired: 8, expiryDate: '2026-07-11', active: true },
  { id: 'op-3', sevaType: 'Cleaning', date: '2026-07-13', time: '6:30 PM - 8:00 PM', totalVolunteersRequired: 6, expiryDate: '2026-07-12', active: true }
];

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') {
      return true;
    }
    if (lowered === 'false') {
      return false;
    }
  }
  return fallback;
};

const toIsoDate = (value) => new Date(value).toISOString().slice(0, 10);

const normalizeOpportunity = (item, index = 0) => ({
  id: item.id || `op-${index + 1}`,
  sevaType: item.sevaType || '',
  date: item.date || toIsoDate(Date.now()),
  time: item.time || '',
  totalVolunteersRequired: Math.max(1, Number(item.totalVolunteersRequired) || 10),
  expiryDate: item.expiryDate || item.date || toIsoDate(Date.now()),
  active: normalizeBoolean(item.active, true)
});

const enrichOpportunityStatus = (item) => {
  const today = toIsoDate(Date.now());
  const isPastDate = Boolean(item?.date) && item.date < today;
  const isExpired = Boolean(item?.expiryDate) && item.expiryDate < today;
  const isClosed = isPastDate || isExpired;

  return {
    ...item,
    isClosed,
    status: isClosed ? 'closed' : (item.active ? 'active' : 'inactive')
  };
};

const ensureDefaultOpportunities = async () => {
  const rows = await contentApiService.list(OPPORTUNITIES_RESOURCE);
  if (rows.length > 0) {
    return rows.map((entry, index) => normalizeOpportunity(entry, index));
  }

  await Promise.all(defaultSevaOpportunities.map((entry, index) => contentApiService.create(OPPORTUNITIES_RESOURCE, normalizeOpportunity(entry, index))));
  const seeded = await contentApiService.list(OPPORTUNITIES_RESOURCE);
  return seeded.map((entry, index) => normalizeOpportunity(entry, index));
};

const readRegistrations = async () => {
  const rows = await contentApiService.list(APPLICATIONS_RESOURCE);
  return rows;
};

const countRegisteredForOpportunity = (opportunity, registrations) => registrations.filter((entry) => (
  entry.opportunityId === opportunity.id ||
  (!entry.opportunityId && (entry.sevaType || entry.area) === opportunity.sevaType && entry.sevaDate === opportunity.date)
)).length;

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || `Request failed for ${url}`);
  }
  return data;
};

const opportunities = ['Langar', 'Cleaning', 'Parking', 'Teaching', 'Events'];

const volunteerService = {
  getOpportunities: async () => serviceResponse(opportunities),

  getSevaOpportunities: async (options = {}) => {
    const rows = await ensureDefaultOpportunities();
    const enriched = rows.map((item) => enrichOpportunityStatus(item));
    if (options.includeClosed) {
      return serviceResponse(enriched);
    }
    return serviceResponse(enriched.filter((item) => !item.isClosed));
  },

  createSevaOpportunity: async (payload) => {
    const record = normalizeOpportunity({
      id: `op-${Date.now()}`,
      sevaType: payload.sevaType,
      date: payload.date,
      time: payload.time || '',
      totalVolunteersRequired: payload.totalVolunteersRequired,
      expiryDate: payload.expiryDate,
      active: normalizeBoolean(payload.active, true)
    });
    const created = await contentApiService.create(OPPORTUNITIES_RESOURCE, record);
    return serviceResponse(normalizeOpportunity(created || record));
  },

  updateSevaOpportunity: async (id, payload) => {
    const current = await ensureDefaultOpportunities();
    const existing = current.find((item) => item.id === id) || { id };
    const next = normalizeOpportunity({ ...existing, ...payload, id });
    await contentApiService.update(OPPORTUNITIES_RESOURCE, id, next);
    return serviceResponse(next);
  },

  removeSevaOpportunity: async (id) => {
    await contentApiService.remove(OPPORTUNITIES_RESOURCE, id);
    return serviceResponse({ success: true });
  },

  apply: async (payload) => {
    const allRecords = await readRegistrations();
    const allOpportunities = await ensureDefaultOpportunities();
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

    const payloadEmail = normalizeComparableValue(payload.email);
    const payloadPhone = normalizeComparableValue(payload.phone);
    const payloadName = normalizeComparableValue(payload.name);

    const alreadyRegistered = allRecords.some((entry) => {
      const sameOpportunity =
        String(entry.opportunityId || '').trim() === String(selectedOpportunity.id || '').trim()
        || (
          !entry.opportunityId
          && normalizeComparableValue(entry.sevaType || entry.area) === normalizeComparableValue(selectedOpportunity.sevaType)
          && String(entry.sevaDate || '').trim() === String(selectedOpportunity.date || '').trim()
        );

      if (!sameOpportunity) {
        return false;
      }

      const entryEmail = normalizeComparableValue(entry.email);
      const entryPhone = normalizeComparableValue(entry.phone || entry.whatsapp);
      const entryName = normalizeComparableValue(entry.name);

      return (payloadEmail && entryEmail === payloadEmail)
        || (payloadPhone && entryPhone === payloadPhone)
        || (payloadName && entryName === payloadName);
    });

    if (alreadyRegistered) {
      throw new Error('You have already registered for this seva opportunity.');
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

    await contentApiService.create(APPLICATIONS_RESOURCE, record);

    try {
      await userService.upsertUserByEmail({
        name: payload.name,
        email: payload.email,
        phone: payload.phone || '',
        memberType: 'Volunteer',
        role: 'Volunteer',
        authProvider: 'LOCAL',
        registrationComplete: true,
        approvalStatus: 'pending'
      });
    } catch {
      // Do not block volunteer registration if user upsert fails.
    }

    return serviceResponse({ success: true, payload: record });
  },

  getApplications: async () => {
    const rows = await readRegistrations();
    return serviceResponse(rows);
  },

  updateApplication: async (id, payload) => {
    const rows = await readRegistrations();
    const existing = rows.find((item) => item.id === id) || { id };
    const updated = { ...existing, ...payload, id };
    await contentApiService.update(APPLICATIONS_RESOURCE, id, updated);
    return serviceResponse(updated);
  },

  sendOpportunityReminderEmails: async (opportunityId) => {
    const response = await fetchJson(`/api/volunteer-reminders/opportunity/${encodeURIComponent(opportunityId)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return serviceResponse(response.data || {});
  },

  getOpportunityReminderPreview: async (opportunityId) => {
    const response = await fetchJson(`/api/volunteer-reminders/opportunity/${encodeURIComponent(opportunityId)}/preview?format=json`);
    return serviceResponse(response.data || {});
  },

  getTodayRegistrations: async () => {
    const today = toIsoDate(Date.now());
    const records = (await readRegistrations()).filter((item) => item.date === today);
    return serviceResponse(records);
  },

  getArchive: async () => {
    const grouped = (await readRegistrations()).reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date].push(item);
      return acc;
    }, {});

    const archive = Object.entries(grouped)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, entries]) => ({ date, entries }));

    return serviceResponse(archive);
  }
};

export default volunteerService;
