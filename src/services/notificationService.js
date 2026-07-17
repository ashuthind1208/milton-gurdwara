import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const RESOURCE = 'subscribers';

const normalizeSubscriber = (item = {}, index = 0) => ({
  id: item.id || `sub-${Date.now()}-${index}`,
  name: item.name || '',
  email: String(item.email || '').trim().toLowerCase(),
  interests: item.interests || 'Events and updates',
  source: item.source || 'Website',
  createdAt: item.createdAt || new Date().toISOString(),
  active: item.active !== false
});

const notificationService = {
  subscribe: async (payload) => {
    const existing = await contentApiService.list(RESOURCE);
    const normalizedEmail = String(payload?.email || '').trim().toLowerCase();

    const duplicate = existing.find((entry) => String(entry?.email || '').trim().toLowerCase() === normalizedEmail);
    if (duplicate?.id) {
      await contentApiService.remove(RESOURCE, duplicate.id);
    }

    const record = normalizeSubscriber({
      id: `sub-${Date.now()}`,
      name: payload?.name,
      email: normalizedEmail,
      interests: payload?.interests,
      source: payload?.source,
      createdAt: new Date().toISOString(),
      active: true
    });

    const created = await contentApiService.create(RESOURCE, record);
    return serviceResponse(normalizeSubscriber(created || record));
  },

  getSubscribers: async () => {
    const rows = await contentApiService.list(RESOURCE);
    return serviceResponse(rows.map((item, index) => normalizeSubscriber(item, index)));
  },

  sendApprovalEmail: async (user) => {
    const targetEmail = String(user?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      return serviceResponse({ sent: false, reason: 'missing_email' });
    }

    const webhookUrl = String(process.env.REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL || '').trim();
    if (!webhookUrl) {
      return serviceResponse({ sent: false, reason: 'missing_webhook' });
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
        return serviceResponse({ sent: false, reason: 'webhook_error' });
      }

      return serviceResponse({ sent: true });
    } catch {
      return serviceResponse({ sent: false, reason: 'network_error' });
    }
  },

  removeSubscriber: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    const rows = await contentApiService.list(RESOURCE);
    return serviceResponse(rows.map((item, index) => normalizeSubscriber(item, index)));
  }
};

export default notificationService;
