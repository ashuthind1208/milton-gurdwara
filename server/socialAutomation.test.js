const test = require('node:test');
const assert = require('node:assert/strict');
const {
  InstagramService,
  WhatsAppService,
  enqueueSocialAutomationEvent,
  buildInstagramCaption,
  buildWhatsAppTemplatePayload,
  triggerSocialAutomation
} = require('./socialAutomation');

test('builds a valid Instagram media payload and caption', () => {
  const service = new InstagramService({
    pageAccessToken: 'token',
    instagramBusinessAccountId: 'acct-123'
  });

  const payload = service.buildMediaPayload({
    mediaType: 'IMAGE',
    imageUrl: 'https://example.com/post.jpg',
    caption: 'Community update #Seva'
  });

  assert.equal(payload.media_type, 'IMAGE');
  assert.equal(payload.image_url, 'https://example.com/post.jpg');
  assert.match(payload.caption, /Community update/);
  assert.match(payload.caption, /#Seva/);
});

test('builds a WhatsApp template payload with dynamic parameters', () => {
  const service = new WhatsAppService({
    accessToken: 'wa-token',
    phoneNumberId: 'phone-123',
    templateName: 'event_announcement',
    templateLanguage: 'en_US'
  });

  const payload = buildWhatsAppTemplatePayload({
    to: '15551234567',
    templateName: 'event_announcement',
    parameters: ['Seva Day', 'Sunday', 'Gurdwara']
  });

  assert.equal(payload.to, '15551234567');
  assert.equal(payload.template.name, 'event_announcement');
  assert.equal(payload.template.components[0].parameters.length, 3);
  assert.equal(payload.template.components[0].parameters[0].text, 'Seva Day');
  assert.equal(service.buildTemplateParameters(['A']).length, 1);
});

test('enqueues social automation events with retry metadata', async () => {
  const result = await enqueueSocialAutomationEvent({
    type: 'event.created',
    payload: { title: 'Langar Night', link: 'https://example.com/events' },
    maxAttempts: 3
  });

  assert.equal(result.type, 'event.created');
  assert.equal(result.attempts, 1);
  assert.ok(Array.isArray(result.metadata));
});

test('supports WhatsApp-only notifications for langar item lifecycle events', async () => {
  const result = await triggerSocialAutomation({
    type: 'langar.item.updated',
    platforms: ['whatsapp'],
    payload: {
      title: 'Rice',
      summary: 'Rice added to the langar list',
      link: 'https://example.com/seva',
      whatsappNumber: '15551234567'
    },
    services: {
      instagram: null,
      whatsapp: {
        sendTemplateMessage: async ({ to, parameters }) => ({
          to,
          parameters,
          ok: true
        })
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.results[0].platform, 'whatsapp');
  assert.equal(result.results[0].data.to, '15551234567');
  assert.equal(result.results.length, 1);
});
