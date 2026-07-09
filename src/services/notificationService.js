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
  sendApprovalEmail: async (user) => {
    const targetEmail = String(user?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      return mockResponse({ sent: false, reason: 'missing_email' });
    }

    const webhookUrl = String(process.env.REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL || '').trim();
    if (!webhookUrl) {
      return mockResponse({ sent: false, reason: 'missing_webhook' });
    }

    const payload = {
      to: targetEmail,
      name: user?.name || 'Member',
      subject: 'Your registration is approved',
      message: 'Your registration has been approved. You can now sign in and continue.',
      approvedAt: new Date().toISOString()
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return mockResponse({ sent: false, reason: 'webhook_error' });
      }

      return mockResponse({ sent: true });
    } catch {
      return mockResponse({ sent: false, reason: 'network_error' });
    }
  },
  removeSubscriber: async (id) => {
    const next = readSubscribers().filter((entry) => entry.id !== id);
    writeSubscribers(next);
    return mockResponse(next);
  }
};

export default notificationService;