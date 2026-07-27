import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const RESOURCE = 'subscribers';
const NEWSLETTER_RESOURCE = 'newsletter_campaigns';
const NEWSLETTER_TOPICS_RESOURCE = 'newsletter_topics';

const DEFAULT_NEWSLETTER_TOPICS = [
  'Events and updates',
  'Seva opportunities',
  'Youth and kids programs',
  'Langar and community services',
  'Volunteer and donation campaigns',
  'All announcements'
];

const normalizeTopicName = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');

const normalizeEmailAddress = (value = '') => {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email === 'null' || email === 'undefined') {
    return '';
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return valid ? email : '';
};

const uniqueTopics = (topics = []) => {
  const seen = new Set();
  return (Array.isArray(topics) ? topics : [])
    .map((topic) => normalizeTopicName(topic))
    .filter((topic) => {
      if (!topic) {
        return false;
      }
      const key = topic.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const normalizeWeekIso = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
};

const isLifecycleInactive = (record = {}) => {
  const explicit = String(record?.lifecycleStatus || '').trim().toLowerCase();
  if (explicit === 'inactive') {
    return true;
  }

  const weekEnd = normalizeWeekIso(record?.weekEnd || '');
  if (!weekEnd) {
    return false;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  return weekEnd < todayIso;
};

const normalizeSubscriber = (item = {}, index = 0) => ({
  id: item.id || `sub-${Date.now()}-${index}`,
  name: item.name || '',
  email: normalizeEmailAddress(item.email),
  interests: item.interests || 'Events and updates',
  source: item.source || 'Website',
  createdAt: item.createdAt || new Date().toISOString(),
  active: item.active !== false,
  userId: item.userId || ''
});

const normalizeCampaign = (item = {}, index = 0) => ({
  id: item.id || `newsletter-${Date.now()}-${index}`,
  title: String(item.title || '').trim(),
  subject: String(item.subject || '').trim(),
  body: String(item.body || '').trim(),
  bodyHtml: String(item.bodyHtml || item.body || '').trim(),
  status: String(item.status || 'draft').trim().toLowerCase(),
  lifecycleStatus: isLifecycleInactive(item) ? 'inactive' : 'active',
  topic: normalizeTopicName(item.topic || ''),
  weekStart: normalizeWeekIso(item.weekStart || ''),
  weekEnd: normalizeWeekIso(item.weekEnd || ''),
  recipientsCount: Number(item.recipientsCount || 0),
  sentAt: String(item.sentAt || '').trim(),
  createdAt: String(item.createdAt || new Date().toISOString()),
  updatedAt: String(item.updatedAt || new Date().toISOString()),
  errorReason: String(item.errorReason || '').trim()
});

const escapeHtml = (value = '') => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toNewsletterLogoUrl = () => {
  const configured = String(process.env.REACT_APP_NEWSLETTER_LOGO_URL || '').trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined' && window?.location?.origin) {
    return `${window.location.origin}/gurdwara-logo.webp`;
  }

  return '';
};

const buildNewsletterEmailHtml = (campaign = {}) => {
  const logoUrl = toNewsletterLogoUrl();
  const topic = normalizeTopicName(campaign.topic || '') || 'Newsletter Update';
  const title = String(campaign.title || 'Singh Sabha Milton Newsletter').trim();
  const subject = String(campaign.subject || '').trim();
  const contentHtml = String(campaign.bodyHtml || '').trim() || `<p>${escapeHtml(String(campaign.body || '').trim())}</p>`;

  return `
  <div style="background:#f5f8fc;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:16px 22px;background:linear-gradient(90deg,#0a4d9f,#0b67c2,#e58b16);color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <div style="display:flex;align-items:center;gap:12px;">
                  ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Singh Sabha Milton logo" width="44" height="44" style="display:block;border-radius:9999px;background:#ffffff;object-fit:cover;"/>` : ''}
                  <div>
                    <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Singh Sabha Milton</div>
                    <div style="font-size:18px;font-weight:800;line-height:1.3;">Newsletter Bulletin</div>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 10px;text-align:center;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#0b67c2;margin-bottom:8px;">Topic</div>
          <div style="display:inline-block;background:#eef5ff;border:1px solid #cfe1fb;color:#0a4d9f;border-radius:9999px;padding:8px 16px;font-size:18px;font-weight:800;line-height:1.3;">
            ${escapeHtml(topic)}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 0;">
          <div style="font-size:21px;line-height:1.35;font-weight:800;color:#0f172a;text-align:center;">${escapeHtml(title)}</div>
          ${subject ? `<div style="margin-top:8px;font-size:14px;line-height:1.7;color:#334155;text-align:center;">${escapeHtml(subject)}</div>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:18px 24px 26px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:15px;line-height:1.8;color:#334155;">
            ${contentHtml}
          </div>
        </td>
      </tr>
    </table>
  </div>`;
};

const notificationService = {
  getNewsletterTopics: async () => {
    const stored = await contentApiService.getSingleton(NEWSLETTER_TOPICS_RESOURCE, null);
    const storedTopics = Array.isArray(stored)
      ? stored
      : (Array.isArray(stored?.topics) ? stored.topics : []);
    const topics = uniqueTopics([...DEFAULT_NEWSLETTER_TOPICS, ...storedTopics]);

    if (topics.length !== storedTopics.length) {
      await contentApiService.setSingleton(NEWSLETTER_TOPICS_RESOURCE, {
        topics,
        updatedAt: new Date().toISOString()
      });
    }

    return serviceResponse(topics);
  },

  addNewsletterTopic: async (topicName) => {
    const topic = normalizeTopicName(topicName);
    if (!topic) {
      return serviceResponse([]);
    }

    const current = await notificationService.getNewsletterTopics().then((res) => res.data || []);
    const topics = uniqueTopics([...current, topic]);
    await contentApiService.setSingleton(NEWSLETTER_TOPICS_RESOURCE, {
      topics,
      updatedAt: new Date().toISOString()
    });
    return serviceResponse(topics);
  },

  subscribe: async (payload) => {
    const existing = await contentApiService.list(RESOURCE);
    const normalizedEmail = String(payload?.email || '').trim().toLowerCase();

    const duplicate = existing.find((entry) => String(entry?.email || '').trim().toLowerCase() === normalizedEmail);
    if (duplicate?.id) {
      await contentApiService.remove(RESOURCE, duplicate.id);
    }

    const chosenTopic = normalizeTopicName(payload?.customTopic || payload?.interests || '');

    if (chosenTopic) {
      await notificationService.addNewsletterTopic(chosenTopic);
    }

    const record = normalizeSubscriber({
      id: `sub-${Date.now()}`,
      name: payload?.name,
      email: normalizedEmail,
      interests: chosenTopic || payload?.interests,
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

  updateSubscriber: async (subscriberId, payload = {}) => {
    const id = String(subscriberId || '').trim();
    if (!id) {
      throw new Error('Subscriber id is required.');
    }

    const existingRows = await contentApiService.list(RESOURCE);
    const existing = existingRows.find((entry) => String(entry?.id || '').trim() === id);
    if (!existing) {
      throw new Error('Subscriber not found.');
    }

    const merged = normalizeSubscriber({
      ...existing,
      ...payload,
      id,
      updatedAt: new Date().toISOString()
    });

    if (!merged.email) {
      throw new Error('Subscriber must have a valid email address.');
    }

    const updated = await contentApiService.update(RESOURCE, id, merged);
    return serviceResponse(normalizeSubscriber(updated || merged));
  },

  getNewsletterCampaigns: async () => {
    const rows = await contentApiService.list(NEWSLETTER_RESOURCE);
    const normalized = rows.map((item, index) => normalizeCampaign(item, index));

    const updates = normalized
      .filter((entry) => entry.lifecycleStatus === 'inactive' && String(entry.status || '') !== 'inactive')
      .map((entry) => contentApiService.update(NEWSLETTER_RESOURCE, entry.id, {
        ...entry,
        status: 'inactive',
        updatedAt: new Date().toISOString()
      }));

    if (updates.length > 0) {
      await Promise.all(updates);
      const refreshed = await contentApiService.list(NEWSLETTER_RESOURCE);
      const nextRows = refreshed.map((item, index) => normalizeCampaign(item, index));
      nextRows.sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
      return serviceResponse(nextRows);
    }

    normalized.sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    return serviceResponse(normalized);
  },

  createNewsletterCampaign: async (payload) => {
    const record = normalizeCampaign({
      id: `newsletter-${Date.now()}`,
      title: payload?.title,
      subject: payload?.subject,
      body: payload?.body,
      bodyHtml: payload?.bodyHtml || payload?.body,
      topic: payload?.topic,
      weekStart: payload?.weekStart,
      weekEnd: payload?.weekEnd,
      lifecycleStatus: String(payload?.lifecycleStatus || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      status: String(payload?.status || 'draft').trim().toLowerCase() || 'draft',
      recipientsCount: 0,
      sentAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errorReason: ''
    });

    const created = await contentApiService.create(NEWSLETTER_RESOURCE, record);

    if (record.topic) {
      await notificationService.addNewsletterTopic(record.topic);
    }

    return serviceResponse(normalizeCampaign(created || record));
  },

  updateNewsletterCampaign: async (campaignId, payload = {}) => {
    const id = String(campaignId || '').trim();
    if (!id) {
      throw new Error('Newsletter campaign id is required.');
    }

    const existingRows = await contentApiService.list(NEWSLETTER_RESOURCE);
    const existing = existingRows.find((entry) => String(entry?.id || '').trim() === id);
    if (!existing) {
      throw new Error('Newsletter campaign not found.');
    }

    const merged = normalizeCampaign({
      ...existing,
      ...payload,
      id,
      updatedAt: new Date().toISOString()
    });

    const updated = await contentApiService.update(NEWSLETTER_RESOURCE, id, merged);

    if (merged.topic) {
      await notificationService.addNewsletterTopic(merged.topic);
    }

    return serviceResponse(normalizeCampaign(updated || merged));
  },

  deleteNewsletterCampaign: async (campaignId) => {
    const id = String(campaignId || '').trim();
    if (!id) {
      throw new Error('Newsletter campaign id is required.');
    }

    await contentApiService.remove(NEWSLETTER_RESOURCE, id);
    const rows = await contentApiService.list(NEWSLETTER_RESOURCE);
    return serviceResponse(rows.map((item, index) => normalizeCampaign(item, index)));
  },

  sendNewsletterCampaign: async (campaignId) => {
    const campaigns = await contentApiService.list(NEWSLETTER_RESOURCE);
    const campaign = campaigns.find((entry) => String(entry?.id || '') === String(campaignId || ''));
    if (!campaign) {
      throw new Error('Newsletter campaign not found.');
    }

    const subscribers = await contentApiService.list(RESOURCE);
    const activeSubscribers = subscribers
      .map((entry, index) => normalizeSubscriber(entry, index))
      .filter((entry) => entry.active !== false && entry.email);

    if (activeSubscribers.length === 0) {
      throw new Error('No active subscribers found.');
    }

    if (isLifecycleInactive(campaign) || String(campaign?.status || '').trim().toLowerCase() === 'inactive') {
      throw new Error('Campaign is inactive and cannot be sent.');
    }

    const recipients = [...new Set(activeSubscribers
      .map((entry) => normalizeEmailAddress(entry.email))
      .filter(Boolean))];

    if (recipients.length === 0) {
      throw new Error('No valid recipient email addresses found.');
    }
    const deliveryUrl = String(
      process.env.REACT_APP_NEWSLETTER_WEBHOOK_URL ||
      process.env.REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL ||
      '/api/internal/mail-relay'
    ).trim();

    let status = 'sent';
    let errorReason = '';
    let sentAt = new Date().toISOString();
    const wrappedBodyHtml = buildNewsletterEmailHtml(campaign);

    try {
      const response = await fetch(deliveryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'newsletter',
          campaignId: campaign.id,
          to: recipients.join(','),
          toList: recipients,
          recipientEmails: recipients,
          primaryRecipient: recipients[0] || '',
          title: campaign.title,
          subject: campaign.subject,
          body: wrappedBodyHtml,
          html: wrappedBodyHtml,
          message: wrappedBodyHtml,
          content: wrappedBodyHtml,
          bodyText: campaign.body || '',
          text: campaign.body || '',
          bodyHtml: wrappedBodyHtml,
          rawBodyHtml: campaign.bodyHtml || campaign.body,
          topic: campaign.topic || '',
          weekStart: campaign.weekStart || '',
          weekEnd: campaign.weekEnd || '',
          recipients
        })
      });

      if (!response.ok) {
        status = 'failed';
        errorReason = 'webhook_error';
        sentAt = '';
      }
    } catch {
      status = 'failed';
      errorReason = 'network_error';
      sentAt = '';
    }

    const updatedRecord = normalizeCampaign({
      ...campaign,
      status,
      recipientsCount: recipients.length,
      sentAt,
      updatedAt: new Date().toISOString(),
      errorReason
    });

    const updated = await contentApiService.update(NEWSLETTER_RESOURCE, campaign.id, updatedRecord);
    return serviceResponse(normalizeCampaign(updated || updatedRecord));
  },

  sendApprovalEmail: async (user) => {
    const targetEmail = String(user?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      return serviceResponse({ sent: false, reason: 'missing_email' });
    }

    const deliveryUrl = String(process.env.REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL || '/api/internal/mail-relay').trim();

    const payload = {
      type: 'approval',
      to: targetEmail,
      name: user?.name || 'Member',
      subject: 'Your registration is approved',
      message: 'Your registration has been approved. You can now sign in and continue.',
      approvedAt: new Date().toISOString()
    };

    try {
      const response = await fetch(deliveryUrl, {
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
