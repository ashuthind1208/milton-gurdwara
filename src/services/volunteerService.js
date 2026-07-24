import { serviceResponse } from './serviceResponse';
import { normalizeErrorMessage } from './publicError';
import userService from './userService';
import contentApiService from './contentApiService';

const OPPORTUNITIES_RESOURCE = 'seva_opportunities';
const APPLICATIONS_RESOURCE = 'volunteer_registrations';

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

const toIsoDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) {
    return dateOnlyMatch[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const parseTimeTokenToMinutes = (token) => {
  const raw = String(token || '').trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const meridiem = String(match[3] || '').toLowerCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (meridiem === 'am') {
      hour = hour % 12;
    } else {
      hour = (hour % 12) + 12;
    }
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
};

const extractRangeEndMinutes = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const parts = raw.split(/\s*-\s*/);
  if (parts.length < 2) {
    return null;
  }

  const endRaw = parts[parts.length - 1] || '';
  const startRaw = parts[0] || '';
  const endHasMeridiem = /\b(am|pm)\b/i.test(endRaw);
  const startMeridiemMatch = startRaw.match(/\b(am|pm)\b/i);
  const normalizedEnd = endHasMeridiem || !startMeridiemMatch
    ? endRaw
    : `${endRaw} ${startMeridiemMatch[1]}`;

  return parseTimeTokenToMinutes(normalizedEnd);
};

const nowLocalMinutes = () => {
  const now = new Date();
  return (now.getHours() * 60) + now.getMinutes();
};

const normalizeOpportunity = (item, index = 0) => ({
  id: item.id || `op-${index + 1}`,
  sevaType: item.sevaType || '',
  date: item.date || toIsoDate(Date.now()),
  time: item.time || '',
  totalVolunteersRequired: Math.max(1, Number(item.totalVolunteersRequired) || 10),
  expiryDate: item.expiryDate || item.date || toIsoDate(Date.now()),
  waitlistEnabled: normalizeBoolean(item.waitlistEnabled, true),
  active: normalizeBoolean(item.active, true)
});

const isOpportunityClosedByDate = (item, todayDateKey = toIsoDate(Date.now())) => {
  const normalizedDate = normalizeDateKey(item?.date);
  const normalizedExpiryDate = normalizeDateKey(item?.expiryDate);
  const isPastDate = Boolean(normalizedDate) && normalizedDate < todayDateKey;
  const isExpired = Boolean(normalizedExpiryDate) && normalizedExpiryDate < todayDateKey;
  if (isPastDate || isExpired) {
    return true;
  }

  if (normalizedDate && normalizedDate === todayDateKey) {
    const endMinutes = extractRangeEndMinutes(item?.time);
    if (Number.isFinite(endMinutes) && nowLocalMinutes() > endMinutes) {
      return true;
    }
  }

  return false;
};

const enrichOpportunityStatus = (item) => {
  const today = toIsoDate(Date.now());
  const isClosed = isOpportunityClosedByDate(item, today);

  return {
    ...item,
    isClosed,
    status: isClosed ? 'closed' : (item.active ? 'active' : 'inactive')
  };
};

const ensureDefaultOpportunities = async () => {
  const rows = await contentApiService.list(OPPORTUNITIES_RESOURCE);
  return rows.map((entry, index) => normalizeOpportunity(entry, index));
};

const readRegistrations = async () => {
  const rows = await contentApiService.list(APPLICATIONS_RESOURCE);
  return rows;
};

const countRegisteredForOpportunity = (opportunity, registrations) => registrations.filter((entry) => (
  entry.opportunityId === opportunity.id ||
  (!entry.opportunityId && (entry.sevaType || entry.area) === opportunity.sevaType && entry.sevaDate === opportunity.date)
)).length;

const countConfirmedForOpportunity = (opportunity, registrations) => registrations.filter((entry) => {
  const sameOpportunity = entry.opportunityId === opportunity.id
    || (!entry.opportunityId && (entry.sevaType || entry.area) === opportunity.sevaType && entry.sevaDate === opportunity.date);

  if (!sameOpportunity) {
    return false;
  }

  return normalizeComparableValue(entry.status) !== 'waitlisted';
}).length;

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(normalizeErrorMessage({ response, message: data?.message }, 'Unable to complete the request right now.', 'volunteerService'));
    error.response = response;
    error.data = data;
    throw error;
  }
  return data;
};

const opportunities = ['Langar', 'Cleaning', 'Parking', 'Teaching', 'Events'];

const volunteerService = {
  getOpportunities: async () => serviceResponse(opportunities),

  getSevaOpportunities: async (options = {}) => {
    const rows = await ensureDefaultOpportunities();
    const enriched = rows.map((item) => enrichOpportunityStatus(item));
    const includeInactive = Boolean(options.includeInactive);
    const visibilityFiltered = includeInactive ? enriched : enriched.filter((item) => item.active !== false);
    if (options.includeClosed) {
      return serviceResponse(visibilityFiltered);
    }
    return serviceResponse(visibilityFiltered.filter((item) => !item.isClosed));
  },

  createSevaOpportunity: async (payload) => {
    const record = normalizeOpportunity({
      id: `op-${Date.now()}`,
      sevaType: payload.sevaType,
      date: payload.date,
      time: payload.time || '',
      totalVolunteersRequired: payload.totalVolunteersRequired,
      expiryDate: payload.expiryDate,
      waitlistEnabled: payload.waitlistEnabled,
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
    if (isOpportunityClosedByDate(selectedOpportunity, today)) {
      throw new Error('Registration is closed for this seva opportunity.');
    }

    const confirmedCount = countConfirmedForOpportunity(selectedOpportunity, allRecords);
    const isAtCapacity = confirmedCount >= selectedOpportunity.totalVolunteersRequired;

    if (isAtCapacity && selectedOpportunity.waitlistEnabled === false) {
      throw new Error('Volunteer limit reached for this seva opportunity.');
    }

    const payloadEmail = normalizeComparableValue(payload.email);
    const payloadPhone = normalizeComparableValue(payload.phone);
    const payloadPhoneDigits = normalizeDigits(payload.phone);
    const canCheckByEmail = Boolean(payloadEmail);
    const canCheckByPhone = !canCheckByEmail && Boolean(payloadPhoneDigits || payloadPhone);

    if (!payloadEmail && !payloadPhoneDigits && !payloadPhone) {
      throw new Error('Please provide at least an email or phone number.');
    }

    const alreadyRegistered = allRecords.some((entry) => {
      const selectedDateKey = normalizeDateKey(selectedOpportunity.date);
      const selectedTimeKey = normalizeComparableValue(selectedOpportunity.time);
      const entryDateKey = normalizeDateKey(entry.sevaDate || entry.date);
      const entryTimeKey = normalizeComparableValue(entry.sevaTime || entry.time);

      const sameOpportunity =
        String(entry.opportunityId || '').trim() === String(selectedOpportunity.id || '').trim()
        || (
          !entry.opportunityId
          && normalizeComparableValue(entry.sevaType || entry.area) === normalizeComparableValue(selectedOpportunity.sevaType)
          && entryDateKey === selectedDateKey
          && entryTimeKey === selectedTimeKey
        );

      if (!sameOpportunity) {
        return false;
      }

      const entryEmail = normalizeComparableValue(entry.email);
      const entryPhone = normalizeComparableValue(entry.phone || entry.whatsapp);
      const entryPhoneDigits = normalizeDigits(entry.phone || entry.whatsapp);

      if (canCheckByEmail) {
        return Boolean(payloadEmail && entryEmail && entryEmail === payloadEmail);
      }

      if (canCheckByPhone && payloadPhoneDigits && entryPhoneDigits && entryPhoneDigits === payloadPhoneDigits) {
        return true;
      }

      if (canCheckByPhone && payloadPhone && entryPhone && entryPhone === payloadPhone) {
        return true;
      }

      return false;
    });

    if (alreadyRegistered) {
      throw new Error('You have already registered for this seva opportunity.');
    }

    const registrationStatus = isAtCapacity ? 'waitlisted' : 'confirmed';

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
      status: registrationStatus,
      date: toIsoDate(Date.now()),
      createdAt: new Date().toISOString()
    };

    await contentApiService.create(APPLICATIONS_RESOURCE, record);

    if (payload.isAuthenticated) {
      try {
        await userService.upsertUserByEmail({
          name: payload.name,
          email: payload.email,
          phone: payload.phone || '',
          registrationComplete: true
        });
      } catch {
        // Do not block volunteer registration if user upsert fails.
      }
    }

    const waitlistCount = Math.max(0, countRegisteredForOpportunity(selectedOpportunity, allRecords) - confirmedCount);

    return serviceResponse({
      success: true,
      payload: record,
      waitlisted: registrationStatus === 'waitlisted',
      status: registrationStatus,
      waitlistCount: registrationStatus === 'waitlisted' ? waitlistCount + 1 : waitlistCount
    });
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

  removeApplication: async (id) => {
    await contentApiService.remove(APPLICATIONS_RESOURCE, id);
    return serviceResponse({ success: true });
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
  },

  getRecognition: async () => {
    const response = await fetchJson('/api/volunteer-recognition');
    return serviceResponse(response.data || { totalRecognized: 0, topLeaders: [], allLeaders: [] });
  }
};

export default volunteerService;
