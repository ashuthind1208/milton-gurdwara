const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSocialPostingService, formatEventWhen, normalizeSettings, pickCoverUrl, isPrivateHost } = require('./socialPosting');
const { renderHukamnamaCard, renderEventPoster } = require('./socialCards');

const makeDb = () => {
  const singletons = new Map();
  const lists = new Map();
  const list = (resource) => lists.get(resource) || [];
  return {
    hasDatabaseConnection: true,
    singletons,
    getSingleton: async (resource, fallback) => singletons.get(resource) ?? fallback,
    setSingleton: async (resource, payload) => { singletons.set(resource, payload); return payload; },
    listItems: async (resource) => [...list(resource)],
    createItem: async (resource, record) => { lists.set(resource, [...list(resource), record]); return record; },
    removeItem: async (resource, id) => { lists.set(resource, list(resource).filter((item) => item.id !== id)); },
    getEvents: async () => [{ id: 7, title: 'Gurpurab Diwan', date: '2099-11-05T18:00', endDate: '2099-11-05T20:30', location: 'Darbar Hall', description: 'Kirtan and langar for all.' }]
  };
};

const HUKAM = {
  ang: 631,
  selectedShabadId: '',
  metadata: { raag: 'Raag Sorath', writer: 'Guru Arjan Dev Ji' },
  lines: [
    { gurmukhi: 'ਸੋਰਠਿ ਮਹਲਾ ੫ ॥', lineType: 1, translationEnglish: 'Sorath, Fifth Mehl:' },
    { gurmukhi: 'ਗੁਰ ਪੂਰੇ ਕਾ ਸੁਣਿ ਉਪਦੇਸੁ ॥', translationEnglish: 'Listen to the teachings of the Perfect Guru.' },
    { gurmukhi: 'ਪਾਰਬ੍ਰਹਮੁ ਨਿਕਟਿ ਕਰਿ ਪੇਖੁ ॥', translationEnglish: 'See the Supreme Lord God close at hand.' }
  ]
};

const harness = ({ env = {}, post, get, now = new Date('2099-01-10T13:00:00Z'), publicBaseUrl = 'https://example.org' } = {}) => {
  const db = makeDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-social-'));
  const calls = [];
  const getCalls = [];
  const service = createSocialPostingService({
    eventsDb: db,
    sendJson: (response, status, payload) => { response.status = status; response.payload = payload; },
    parseJsonObjectBody: async (request) => request.body || {},
    assertInput: (condition, message, status = 400) => { if (!condition) throw Object.assign(new Error(message), { status }); },
    isAdmin: (request) => request.headers?.['x-actor-role'] === 'Admin',
    uploadsDir,
    publicBaseUrl,
    timeZone: 'America/Toronto',
    env: { ENABLE_SOCIAL_CARDS: 'true', META_PAGE_ACCESS_TOKEN: 'tok', INSTAGRAM_BUSINESS_ACCOUNT_ID: 'ig1', FACEBOOK_PAGE_ID: 'fb1', ...env },
    http: {
      get: async (url, options) => { getCalls.push({ url, params: options?.params }); return get ? get(url, options) : { data: { data: { is_valid: true, expires_at: 0, scopes: ['whatsapp_business_messaging'] } } }; },
      post: async (url, body, options) => { calls.push({ url, body, options }); return post ? post(url, body, options) : { data: url.endsWith('/media') ? { id: 'media-1' } : { messages: [{ id: 'wamid-1' }] } }; }
    },
    logger: { error() {}, warn() {} },
    now: () => now
  });
  const call = async (method, route, { body, admin = true } = {}) => {
    const response = {};
    await service.handleApi({ method, body, headers: admin ? { 'x-actor-role': 'Admin' } : {} }, response, new URL(`http://localhost${route}`));
    return response;
  };
  return { db, service, call, calls, getCalls, uploadsDir };
};

test('card renderers return JPEG images', async () => {
  const hukam = await renderHukamnamaCard({ lines: HUKAM.lines.slice(1), ang: '631', raag: 'Raag Sorath', writer: 'Guru Arjan Dev Ji', dateLabel: 'Saturday, January 10, 2099', websiteLabel: 'example.org/hukamnama' });
  const poster = await renderEventPoster({ title: 'Gurpurab Diwan', whenDate: 'Friday, November 5', whenTime: '6:00 PM – 8:30 PM', where: 'Darbar Hall', description: 'Kirtan and langar', websiteLabel: 'example.org/events' });
  const posterWithEventPhoto = await renderEventPoster({ title: 'Gurpurab Diwan', whenDate: 'Friday, November 5', whenTime: '6:00 PM – 8:30 PM', where: 'Darbar Hall', description: 'Kirtan and langar', coverImages: [{ width: 1, height: 1 }], websiteLabel: 'example.org/events' });
  assert.deepEqual(posterWithEventPhoto.buffer, poster.buffer);
  [hukam.buffer, poster.buffer].forEach((buffer) => {
    assert.equal(buffer[0], 0xff);
    assert.equal(buffer[1], 0xd8);
    assert.ok(buffer.length > 20000);
  });
});

test('settings default to a safe dry run and reject bad values', () => {
  assert.equal(normalizeSettings({}).dryRun, true);
  assert.equal(normalizeSettings({ dryRun: false }).dryRun, false);
  assert.equal(normalizeSettings({ hukamnamaTime: '25:99' }).hukamnamaTime, '07:00');
});

test('event helpers format times, pick images and block private hosts', () => {
  assert.equal(formatEventWhen('2099-11-05T18:00', '2099-11-05T20:30', 'America/Toronto'), 'Thursday, November 5, 2099 • 6:00 PM – 8:30 PM');
  assert.equal(formatEventWhen('2099-11-05', '', 'America/Toronto'), 'Thursday, November 5, 2099');
  assert.equal(pickCoverUrl('https://x.test/clip.mp4, /api/uploads/events/a.jpg'), '/api/uploads/events/a.jpg');
  assert.ok(isPrivateHost('127.0.0.1') && isPrivateHost('192.168.1.5') && isPrivateHost('localhost'));
  assert.ok(!isPrivateHost('images.example.com'));
});

test('settings and posting endpoints require a admin role', async () => {
  const { call } = harness();
  assert.equal((await call('GET', '/api/social/settings', { admin: false })).status, 403);
  assert.equal((await call('POST', '/api/social/post', { admin: false, body: { kind: 'hukamnama' } })).status, 403);
});

test('Meta token status is admin-only and returns safe validity and expiry metadata', async () => {
  const { call, getCalls } = harness({ env: { META_APP_ID: 'app-id', META_APP_SECRET: 'app-secret', META_WA_ACCESS_TOKEN: 'wa-token' } });
  assert.equal((await call('POST', '/api/social/meta-token-status', { admin: false })).status, 403);
  const response = await call('POST', '/api/social/meta-token-status');
  assert.equal(response.status, 200);
  assert.equal(response.payload.data.page.valid, true);
  assert.equal(response.payload.data.page.neverExpires, true);
  assert.equal(response.payload.data.whatsapp.valid, true);
  assert.equal(getCalls.length, 2);
  assert.ok(getCalls.every((entry) => entry.url.endsWith('/debug_token')));
  assert.equal(JSON.stringify(response.payload).includes('wa-token'), false);
});

test('Meta token status reports invalid token without disclosing credentials', async () => {
  const { call } = harness({
    env: { META_APP_ID: 'app-id', META_APP_SECRET: 'app-secret', META_WA_ACCESS_TOKEN: 'expired-token' },
    get: async () => ({ data: { data: { is_valid: false, expires_at: 0 } } })
  });
  const response = await call('POST', '/api/social/meta-token-status');
  assert.equal(response.payload.data.whatsapp.valid, false);
  assert.match(response.payload.data.whatsapp.reason, /invalid or expired/i);
  assert.equal(JSON.stringify(response.payload).includes('expired-token'), false);
});

test('manual post is a dry run by default and calls no network API', async () => {
  const { db, call, calls, uploadsDir } = harness();
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10' } });
  assert.equal(result.status, 200);
  assert.equal(result.payload.data.status, 'dry-run');
  assert.equal(calls.length, 0);
  const saved = path.join(uploadsDir, result.payload.data.imageUrl.replace('/api/uploads/', ''));
  assert.ok(fs.existsSync(saved));
  assert.match(result.payload.data.caption, /Ang 631/);
});

test('live post publishes to Instagram and Facebook with a public https image URL', async () => {
  const { db, call, calls } = harness();
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.status, 'posted');
  const instagramUrls = calls.map((entry) => entry.body.image_url).filter(Boolean);
  assert.equal(instagramUrls.length, 1);
  assert.match(instagramUrls[0], /^https:\/\/example\.org\/api\/uploads\/social\/\d{4}\/\d{2}\/card-.*\.jpg$/);
  const facebookCall = calls.find((entry) => entry.url.includes('/fb1/photos'));
  assert.ok(facebookCall.body instanceof FormData);
  assert.ok(facebookCall.body.get('source').size > 20000);
});

test('one failing platform is reported without hiding the other', async () => {
  const { db, call } = harness({ post: async (url) => { if (url.includes('/fb1/')) throw Object.assign(new Error('x'), { response: { data: { error: { message: 'Token expired' } } } }); return { data: { id: 'ok' } }; } });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.status, 'partial');
  assert.equal(result.payload.data.results.find((item) => item.platform === 'facebook').message, 'Token expired');
});

test('scheduled sweep posts once after the set time and never twice', async () => {
  const { db, service, calls } = harness({ now: new Date('2099-01-10T13:00:00Z') }); // 08:00 in Toronto
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await db.setSingleton('social_card_settings', { hukamnamaMode: 'scheduled', hukamnamaTime: '07:00', dryRun: false });
  assert.equal((await service.runScheduledSweep()).status, 'posted');
  assert.equal(await service.runScheduledSweep(), null);
  assert.equal(calls.length, 3);
});

test('scheduled sweep waits until the configured time and needs a Hukamnama', async () => {
  const early = harness({ now: new Date('2099-01-10T10:00:00Z') }); // 05:00 in Toronto
  await early.db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await early.db.setSingleton('social_card_settings', { hukamnamaMode: 'scheduled', hukamnamaTime: '07:00', dryRun: false });
  assert.equal(await early.service.runScheduledSweep(), null);
  const empty = harness();
  await empty.db.setSingleton('social_card_settings', { hukamnamaMode: 'scheduled', dryRun: false });
  assert.equal(await empty.service.runScheduledSweep(), null);
});

test('new events post automatically only when enabled', async () => {
  const off = harness();
  assert.equal(await off.service.onEventCreated({ id: 7, title: 'Diwan', date: '2099-11-05T18:00' }), null);
  const on = harness();
  await on.db.setSingleton('social_card_settings', { eventAuto: true, dryRun: false });
  assert.equal((await on.service.onEventCreated({ id: 7, title: 'Diwan', date: '2099-11-05T18:00', location: 'Hall' })).status, 'posted');
  assert.equal(await on.service.onEventCreated({ id: 7, title: 'Diwan', date: '2099-11-05T18:00' }), null);
  assert.equal(await on.service.shouldReplaceLegacyEventPost(), true);
});

test('a non-https public URL blocks Instagram but still allows Facebook', async () => {
  const { db, call, calls } = harness({ publicBaseUrl: 'http://localhost:3001' });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.status, 'partial');
  assert.equal(result.payload.data.results.find((item) => item.platform === 'instagram').status, 'failed');
  assert.equal(result.payload.data.results.find((item) => item.platform === 'facebook').status, 'posted');
  assert.equal(calls.length, 1);
});

test('saving today\'s Hukamnama posts it once, and only when automatic posting is on', async () => {
  const off = harness();
  await off.db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  assert.equal(await off.service.onHukamnamaSaved('2099-01-10'), null);
  const on = harness();
  await on.db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await on.db.setSingleton('social_card_settings', { hukamnamaMode: 'onSave', dryRun: false });
  assert.equal((await on.service.onHukamnamaSaved('2099-01-10')).status, 'posted');
  assert.equal(await on.service.onHukamnamaSaved('2099-01-10'), null);
  assert.equal(await on.service.onHukamnamaSaved('2099-01-11'), null);
});

test('a failed platform can be retried and only that platform is re-sent', async () => {
  let failFacebook = true;
  const { db, call, calls } = harness({ post: async (url) => { if (url.includes('/fb1/') && failFacebook) throw Object.assign(new Error('x'), { response: { data: { error: { message: 'Temporary error' } } } }); return { data: { id: 'ok' } }; } });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  const first = (await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } })).payload.data;
  assert.equal(first.status, 'partial');
  failFacebook = false;
  calls.length = 0;
  const retried = await call('POST', '/api/social/retry', { body: { id: first.id } });
  assert.equal(retried.payload.data.status, 'posted');
  assert.equal(retried.payload.data.mode, 'retry');
  assert.equal(calls.length, 1);
  assert.equal((await call('POST', '/api/social/retry', { body: { id: retried.payload.data.id } })).status, 400);
});

test('WhatsApp uploads and sends the card through Meta Cloud API when enabled', async () => {
  const { db, call, calls } = harness({ env: { META_WA_ACCESS_TOKEN: 'wa-token', META_WA_PHONE_NUMBER_ID: 'wa-phone-id', WHATSAPP_GROUP_NUMBER: '+15551234567' } });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await db.setSingleton('social_card_settings', { dryRun: false, instagram: false, facebook: false, whatsapp: true });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.status, 'posted');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v25.0/wa-phone-id/media');
  assert.equal(calls[0].body.get('messaging_product'), 'whatsapp');
  assert.ok(calls[0].body.get('file').size > 20000);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer wa-token');
  assert.equal(calls[1].url, 'https://graph.facebook.com/v25.0/wa-phone-id/messages');
  assert.deepEqual(calls[1].body, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '+15551234567', type: 'image',
    image: { id: 'media-1', caption: result.payload.data.caption.slice(0, 1024) }
  });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer wa-token');
});

test('WhatsApp is skipped when Meta credentials or recipient are not configured', async () => {
  const { db, call, calls } = harness();
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await db.setSingleton('social_card_settings', { dryRun: false, instagram: false, facebook: false, whatsapp: true });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.results[0].status, 'skipped');
  assert.equal(calls.length, 0);
});

test('WhatsApp Cloud API supports Meta Groups API recipients', async () => {
  const { db, call, calls } = harness({ env: {
    META_WA_ACCESS_TOKEN: 'wa-token', META_WA_PHONE_NUMBER_ID: 'wa-phone-id',
    SOCIAL_WHATSAPP_RECIPIENT_TYPE: 'group', SOCIAL_WHATSAPP_GROUP_ID: 'meta-group-id'
  } });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await db.setSingleton('social_card_settings', { dryRun: false, instagram: false, facebook: false, whatsapp: true });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.status, 'posted');
  assert.equal(calls[1].body.recipient_type, 'group');
  assert.equal(calls[1].body.to, 'meta-group-id');
});

test('the Hukamnama mode decides whether it posts on save or at the set time, and an old on/off flag still works', async () => {
  const scheduled = harness();
  await scheduled.db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await scheduled.db.setSingleton('social_card_settings', { hukamnamaMode: 'scheduled', hukamnamaTime: '07:00', dryRun: false });
  assert.equal(await scheduled.service.onHukamnamaSaved('2099-01-10'), null);
  assert.equal((await scheduled.service.runScheduledSweep()).status, 'posted');
  const onSave = harness();
  await onSave.db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await onSave.db.setSingleton('social_card_settings', { hukamnamaMode: 'onSave', hukamnamaTime: '07:00', dryRun: false });
  assert.equal(await onSave.service.runScheduledSweep(), null);
  assert.equal((await onSave.service.onHukamnamaSaved('2099-01-10')).status, 'posted');
  assert.equal(normalizeSettings({ hukamnamaAuto: true }).hukamnamaMode, 'onSave');
  assert.equal(normalizeSettings({}).hukamnamaMode, 'off');
  assert.equal(normalizeSettings({ hukamnamaMode: 'bogus' }).hukamnamaMode, 'off');
});

test('an existing WhatsApp group is posted through OpenWA and never through Meta', async () => {
  const { db, call, calls } = harness({ env: {
    META_WA_ACCESS_TOKEN: 'wa-token', META_WA_PHONE_NUMBER_ID: 'wa-phone-id', SOCIAL_WHATSAPP_RECIPIENT_TYPE: 'group',
    SOCIAL_WHATSAPP_GROUP_ID: '120363430833024671@g.us',
    OPENWA_URL: 'http://localhost:2785/api', OPENWA_API_KEY: 'gw-key', OPENWA_SESSION_ID: 'sess'
  } });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await db.setSingleton('social_card_settings', { dryRun: false, instagram: false, facebook: false, whatsapp: true, whatsappGroup: true });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  const byPlatform = Object.fromEntries(result.payload.data.results.map((item) => [item.platform, item.status]));
  assert.equal(byPlatform.whatsappGroup, 'posted');
  assert.equal(byPlatform.whatsapp, 'skipped');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:2785/api/sessions/sess/messages/send-image');
  assert.equal(calls[0].body.chatId, '120363430833024671@g.us');
  assert.equal(calls[0].options.headers['X-API-Key'], 'gw-key');
  assert.ok(calls[0].body.caption.length <= 1000);
});

test('the WhatsApp group option is skipped when the gateway is not configured', async () => {
  const { db, call, calls } = harness();
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await db.setSingleton('social_card_settings', { dryRun: false, instagram: false, facebook: false, whatsapp: false, whatsappGroup: true });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.results[0].platform, 'whatsappGroup');
  assert.equal(result.payload.data.results[0].status, 'skipped');
  assert.equal(calls.length, 0);
});
