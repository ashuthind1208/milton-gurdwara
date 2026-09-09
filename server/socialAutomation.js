const axios = require('axios');

const buildInstagramCaption = ({ title, summary, type = 'Update', link = '', hashtags = [] }) => {
  const normalizedTitle = String(title || '').trim();
  const normalizedSummary = String(summary || '').trim();
  const normalizedLink = String(link || '').trim();
  const finalHashtags = Array.isArray(hashtags) && hashtags.length > 0
    ? hashtags.map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' ')
    : '#SinghSabha #Community #Seva';

  const parts = [
    normalizedTitle ? normalizedTitle : type,
    normalizedSummary ? '' : '',
    normalizedSummary,
    normalizedLink ? '' : '',
    normalizedLink,
    finalHashtags
  ].filter((part) => part !== '' && part !== null && part !== undefined);

  return parts.join('\n');
};

const buildWhatsAppTemplatePayload = ({ to, templateName, parameters = [], templateLanguage = 'en_US' }) => ({
  messaging_product: 'whatsapp',
  to: String(to || '').trim(),
  type: 'template',
  template: {
    name: String(templateName || 'event_announcement').trim(),
    language: { code: String(templateLanguage || 'en_US').trim() },
    components: [
      {
        type: 'body',
        parameters: (Array.isArray(parameters) ? parameters : []).map((value) => ({
          type: 'text',
          text: String(value ?? '')
        }))
      }
    ]
  }
});

class InstagramService {
  constructor({ pageAccessToken, instagramBusinessAccountId, logger = console, apiBaseUrl = 'https://graph.facebook.com/v20.0' }) {
    this.pageAccessToken = String(pageAccessToken || '').trim();
    this.instagramBusinessAccountId = String(instagramBusinessAccountId || '').trim();
    this.logger = logger;
    this.apiBaseUrl = apiBaseUrl;
  }

  buildMediaPayload({
    mediaType = 'IMAGE',
    imageUrl = null,
    videoUrl = null,
    caption = '',
    isCarousel = false,
    children = []
  }) {
    if (!this.pageAccessToken) {
      throw new Error('META_PAGE_ACCESS_TOKEN is required for Instagram publishing.');
    }
    if (!this.instagramBusinessAccountId) {
      throw new Error('INSTAGRAM_BUSINESS_ACCOUNT_ID is required for Instagram publishing.');
    }
    if (!imageUrl && !videoUrl) {
      throw new Error('Either imageUrl or videoUrl must be supplied for an Instagram post.');
    }

    const payload = {
      access_token: this.pageAccessToken,
      media_type: mediaType,
      caption: String(caption || '').trim(),
      ...(mediaType === 'IMAGE' && imageUrl ? { image_url: imageUrl } : {}),
      ...(mediaType === 'VIDEO' && videoUrl ? { video_url: videoUrl } : {}),
      ...(isCarousel ? { is_carousel_item: true } : {})
    };

    if (Array.isArray(children) && children.length > 0) {
      payload.children = children;
    }

    return payload;
  }

  async createMediaContainer(options = {}) {
    const payload = this.buildMediaPayload(options);
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/${this.instagramBusinessAccountId}/media`,
        payload
      );
      return response.data;
    } catch (error) {
      this.logger.error?.('Instagram media container creation failed', this._formatMetaError(error));
      throw error;
    }
  }

  async publishMedia(containerId) {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/${this.instagramBusinessAccountId}/media_publish`,
        {
          creation_id: String(containerId || '').trim(),
          access_token: this.pageAccessToken
        }
      );
      return response.data;
    } catch (error) {
      this.logger.error?.('Instagram media publish failed', this._formatMetaError(error));
      throw error;
    }
  }

  async publishPost(options = {}) {
    const created = await this.createMediaContainer(options);
    const containerId = created?.id || created?.creation_id;
    if (!containerId) {
      throw new Error('Instagram media container was not created successfully.');
    }

    const published = await this.publishMedia(containerId);
    return {
      containerId,
      published
    };
  }

  _formatMetaError(error) {
    return error?.response?.data || { message: error?.message || 'Unknown Meta API error' };
  }
}

class WhatsAppService {
  constructor({ accessToken, phoneNumberId, templateName = 'event_announcement', templateLanguage = 'en_US', logger = console, apiBaseUrl = 'https://graph.facebook.com/v20.0' }) {
    this.accessToken = String(accessToken || '').trim();
    this.phoneNumberId = String(phoneNumberId || '').trim();
    this.templateName = String(templateName || 'event_announcement').trim();
    this.templateLanguage = String(templateLanguage || 'en_US').trim();
    this.logger = logger;
    this.apiBaseUrl = apiBaseUrl;
  }

  buildTemplateParameters(values = []) {
    return (Array.isArray(values) ? values : []).map((value) => ({
      type: 'text',
      text: String(value ?? '')
    }));
  }

  async sendTemplateMessage({ to, templateName = this.templateName, languageCode = this.templateLanguage, parameters = [] }) {
    if (!this.accessToken) {
      throw new Error('META_WA_ACCESS_TOKEN is required for WhatsApp messaging.');
    }
    if (!this.phoneNumberId) {
      throw new Error('META_WA_PHONE_NUMBER_ID is required for WhatsApp messaging.');
    }
    if (!to) {
      throw new Error('A WhatsApp recipient number is required.');
    }

    const payload = buildWhatsAppTemplatePayload({
      to,
      templateName,
      templateLanguage: languageCode,
      parameters
    });

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      this.logger.error?.('WhatsApp template send failed', this._formatMetaError(error));
      throw error;
    }
  }

  async sendTextMessage({ to, message }) {
    if (!this.accessToken) {
      throw new Error('META_WA_ACCESS_TOKEN is required for WhatsApp messaging.');
    }
    if (!this.phoneNumberId) {
      throw new Error('META_WA_PHONE_NUMBER_ID is required for WhatsApp messaging.');
    }
    if (!to) {
      throw new Error('A WhatsApp recipient number is required.');
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to || '').trim(),
      type: 'text',
      text: {
        body: String(message || '').trim()
      }
    };

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      this.logger.error?.('WhatsApp text send failed', this._formatMetaError(error));
      throw error;
    }
  }

  _formatMetaError(error) {
    return error?.response?.data || { message: error?.message || 'Unknown WhatsApp API error' };
  }
}

const enqueueSocialAutomationEvent = async ({ type, payload = {}, maxAttempts = 5 }) => {
  const event = {
    type: String(type || 'social-event').trim(),
    payload,
    attempts: 1,
    metadata: [
      { key: 'createdAt', value: new Date().toISOString() },
      { key: 'maxAttempts', value: String(maxAttempts) }
    ]
  };

  return event;
};

const triggerSocialAutomation = async ({
  type,
  payload = {},
  platforms = ['instagram', 'whatsapp'],
  services = {},
  maxAttempts = 5
}) => {
  const selectedPlatforms = Array.isArray(platforms) && platforms.length > 0 ? platforms : ['instagram', 'whatsapp'];
  const instagramService = services.instagram || null;
  const whatsappService = services.whatsapp || null;

  const results = [];
  const basePayload = payload || {};
  const title = String(basePayload.title || basePayload.name || 'Community update').trim();
  const summary = String(basePayload.summary || basePayload.description || basePayload.message || '').trim();
  const link = String(basePayload.link || '').trim();
  const instagramCaption = buildInstagramCaption({
    title,
    summary,
    type: String(type || '').replace(/\./g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
    link,
    hashtags: Array.isArray(basePayload.hashtags) && basePayload.hashtags.length > 0 ? basePayload.hashtags : ['Seva', 'Community', 'Gurdwara']
  });

  if (selectedPlatforms.includes('instagram') && instagramService) {
    try {
      const response = await instagramService.publishPost({
        mediaType: basePayload.mediaType || 'IMAGE',
        imageUrl: basePayload.imageUrl || basePayload.coverImageUrl || basePayload.featuredImageUrl || null,
        videoUrl: basePayload.videoUrl || null,
        caption: instagramCaption
      });
      results.push({ platform: 'instagram', ok: true, data: response });
    } catch (error) {
      results.push({ platform: 'instagram', ok: false, error: error?.response?.data || error?.message || String(error) });
    }
  }

  if (selectedPlatforms.includes('whatsapp') && whatsappService) {
    try {
      const whatsappNumber = String(basePayload.whatsappNumber || '').trim();
      const parameters = basePayload.whatsappParameters || [
        title || 'Community Update',
        summary || basePayload.date || 'Upcoming',
        basePayload.location || 'Community',
        link || 'https://example.com'
      ];

      const response = await whatsappService.sendTemplateMessage({
        to: whatsappNumber,
        templateName: basePayload.templateName || 'event_announcement',
        parameters
      });
      results.push({ platform: 'whatsapp', ok: true, data: response });
    } catch (error) {
      results.push({ platform: 'whatsapp', ok: false, error: error?.response?.data || error?.message || String(error) });
    }
  }

  await enqueueSocialAutomationEvent({
    type,
    payload: basePayload,
    maxAttempts
  });

  return {
    ok: true,
    results,
    type,
    attempts: 1
  };
};

module.exports = {
  InstagramService,
  WhatsAppService,
  buildInstagramCaption,
  buildWhatsAppTemplatePayload,
  enqueueSocialAutomationEvent,
  triggerSocialAutomation
};
