import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-events';

const seedEvents = [
  {
    id: 1,
    title: 'Sundar Gutka Paath Samagam',
    date: '2026-07-12T10:00:00.000Z',
    location: 'Main Darbar Hall',
    category: 'Paath',
    registrations: 96,
    active: true
  },
  {
    id: 2,
    title: 'Youth Kirtan Workshop',
    date: '2026-07-18T16:00:00.000Z',
    location: 'Community Classroom',
    category: 'Workshop',
    registrations: 54,
    active: true
  },
  {
    id: 3,
    title: 'Monthly Langar Seva Day',
    date: '2026-07-20T09:00:00.000Z',
    location: 'Langar Hall',
    category: 'Seva',
    registrations: 122,
    active: true
  }
];

const readEvents = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedEvents;
    }
    return JSON.parse(raw);
  } catch {
    return seedEvents;
  }
};

const writeEvents = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const eventService = {
  getEvents: async () => mockResponse(readEvents()),
  createEvent: async (payload) => {
    const allEvents = readEvents();
    const record = {
      id: Date.now(),
      title: payload.title,
      date: payload.date,
      location: payload.location,
      category: payload.category,
      registrations: Number(payload.registrations || 0),
      registrants: [],
      active: typeof payload.active === 'boolean' ? payload.active : true
    };
    const next = [record, ...allEvents];
    writeEvents(next);
    return mockResponse(record);
  },
  updateEvent: async (id, payload) => {
    const next = readEvents().map((event) => (
      event.id === id
        ? {
            ...event,
            ...payload,
            registrations: Number(payload.registrations ?? event.registrations ?? 0),
            registrants: Array.isArray(payload.registrants) ? payload.registrants : (event.registrants || []),
            active: typeof payload.active === 'boolean' ? payload.active : (typeof event.active === 'boolean' ? event.active : true)
          }
        : event
    ));
    writeEvents(next);
    return mockResponse(next.find((event) => event.id === id));
  },
  removeEvent: async (id) => {
    const next = readEvents().filter((event) => event.id !== id);
    writeEvents(next);
    return mockResponse({ success: true });
  },
  registerForEvent: async ({ eventId, name, contact }) => {
    const allEvents = readEvents();
    const next = allEvents.map((event) => {
      if (event.id !== eventId) {
        return event;
      }

      const registrants = Array.isArray(event.registrants) ? event.registrants : [];
      return {
        ...event,
        registrations: Number(event.registrations || 0) + 1,
        registrants: [
          {
            id: `evt-reg-${Date.now()}`,
            name: name || 'Anonymous',
            contact: contact || '',
            createdAt: new Date().toISOString()
          },
          ...registrants
        ]
      };
    });

    writeEvents(next);
    return mockResponse(next.find((event) => event.id === eventId));
  },
  removeEventRegistrant: async ({ eventId, registrantId }) => {
    const next = readEvents().map((event) => {
      if (event.id !== eventId) {
        return event;
      }

      const registrants = (event.registrants || []).filter((entry) => entry.id !== registrantId);
      return {
        ...event,
        registrants,
        registrations: registrants.length
      };
    });

    writeEvents(next);
    return mockResponse(next.find((event) => event.id === eventId));
  },
  rsvp: async (payload) => mockResponse({ success: true, payload })
};

export default eventService;
