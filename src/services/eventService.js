import apiClient from './apiClient';

const eventService = {
  getEvents: async () => {
    const response = await apiClient.get('/events');
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
    const response = await apiClient.post('/events/register', { eventId, name, contact, email });
    return { data: response.data?.data };
  },

  removeEventRegistrant: async ({ eventId, registrantId }) => {
    const response = await apiClient.post('/events/registrant/remove', { eventId, registrantId });
    return { data: response.data?.data };
  },

  runEventReminders: async (force = false) => {
    const response = await apiClient.post('/events/reminders/run', { force: Boolean(force) });
    return { data: response.data?.data };
  },

  getCalendarFeedUrl: () => '/api/events/calendar.ics',

  getEventCalendarUrl: (id) => `/api/events/${encodeURIComponent(String(id))}/calendar.ics`,

  rsvp: async (payload) => {
    const response = await apiClient.post('/events/register', payload);
    return { data: response.data?.data };
  }
};

export default eventService;
