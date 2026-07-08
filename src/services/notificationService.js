import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-notification-subscribers';

const readSubscribers = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeSubscribers = (records) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const notificationService = {
  subscribe: async (payload) => {
    const record = {
      id: `sub-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      interests: payload.interests || 'Events and updates',
      source: payload.source || 'Website',
      createdAt: new Date().toISOString(),
      active: true
    };

    const existing = readSubscribers();
    const deduped = existing.filter((entry) => entry.email !== record.email);
    const next = [record, ...deduped];
    writeSubscribers(next);
    return mockResponse(record);
  },
  getSubscribers: async () => mockResponse(readSubscribers()),
  removeSubscriber: async (id) => {
    const next = readSubscribers().filter((entry) => entry.id !== id);
    writeSubscribers(next);
    return mockResponse(next);
  }
};

export default notificationService;