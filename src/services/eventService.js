import apiClient from './apiClient';

const eventService = {
  getEvents: async (options = {}) => {
    const includeInactive = options?.includeInactive === true;
    const query = includeInactive ? '?includeInactive=true' : '';
    const response = await apiClient.get(`/events${query}`);
    return { data: response.data?.data || [] };
  },

  createEvent: async (payload) => {
    const response = await apiClient.post('/events', payload);
    return { data: response.data?.data };
  },

  updateEvent: async (id, payload) => {
    const response = await apiClient.patch(`/events/${id}`, payload);
    return { data: response.data?.data };
  },

  removeEvent: async (id) => {
    const response = await apiClient.delete(`/events/${id}`);
    return { data: response.data?.data };
  },

  registerForEvent: async ({ eventId, name, contact, email }) => {
    const normalizedEventId = String(eventId || '').trim();
    const response = await apiClient.post('/events/register', { eventId: normalizedEventId, name, contact, email });
    return { data: response.data?.data };
  },

  removeEventRegistrant: async ({ eventId, registrantId }) => {
    const normalizedEventId = String(eventId || '').trim();
    const response = await apiClient.post('/events/registrant/remove', { eventId: normalizedEventId, registrantId });
    return { data: response.data?.data };
  },

  updateRegistrantStatus: async ({ eventId, registrantId, status }) => {
    const normalizedEventId = String(eventId || '').trim();
    const response = await apiClient.post('/events/registrant/status', {
      eventId: normalizedEventId,
      registrantId,
      status
    });
    return { data: response.data?.data };
  },

  runEventReminders: async (force = false) => {
    const response = await apiClient.post('/events/reminders/run', { force: Boolean(force) });
    return { data: response.data?.data };
  },

  getCalendarFeedUrl: () => '/api/events/calendar.ics',

  getEventCalendarUrl: (id) => `/api/events/${encodeURIComponent(String(id))}/calendar.ics`,

  downloadEventCalendar: async (id) => {
    const response = await apiClient.get(`/events/${encodeURIComponent(String(id))}/calendar.ics`, {
      responseType: 'blob'
    });
    return { data: response.data };
  },

  rsvp: async (payload) => {
    const normalizedPayload = {
      ...(payload || {}),
      eventId: String(payload?.eventId || '').trim()
    };
    const response = await apiClient.post('/events/register', normalizedPayload);
    return { data: response.data?.data };
  }
};

export default eventService;
