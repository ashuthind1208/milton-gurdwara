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

const harness = ({ env = {}, post, now = new Date('2099-01-10T13:00:00Z'), publicBaseUrl = 'https://example.org' } = {}) => {
  const db = makeDb();
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssm-social-'));
  const calls = [];
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
    http: { post: async (url, body) => { calls.push({ url, body }); return post ? post(url, body) : { data: { id: 'ext-1' } }; } },
    logger: { error() {}, warn() {} },
    now: () => now
  });
  const call = async (method, route, { body, admin = true } = {}) => {
    const response = {};
    await service.handleApi({ method, body, headers: admin ? { 'x-actor-role': 'Admin' } : {} }, response, new URL(`http://localhost${route}`));
    return response;
  };
  return { db, service, call, calls, uploadsDir };
};

test('card renderers return JPEG images', async () => {
  const hukam = await renderHukamnamaCard({ lines: HUKAM.lines.slice(1), ang: '631', raag: 'Raag Sorath', writer: 'Guru Arjan Dev Ji', dateLabel: 'Saturday, January 10, 2099', websiteLabel: 'example.org/hukamnama' });
  const poster = await renderEventPoster({ title: 'Gurpurab Diwan', when: 'Friday, November 5', where: 'Darbar Hall', description: 'Kirtan and langar', websiteLabel: 'example.org/events' });
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
  const imageUrls = calls.map((entry) => entry.body.image_url || entry.body.url).filter(Boolean);
  assert.equal(imageUrls.length, 2);
  imageUrls.forEach((url) => assert.match(url, /^https:\/\/example\.org\/api\/uploads\/social\/\d{4}\/\d{2}\/card-.*\.jpg$/));
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
  await db.setSingleton('social_card_settings', { hukamnamaAuto: true, hukamnamaTime: '07:00', dryRun: false });
  assert.equal((await service.runScheduledSweep()).status, 'posted');
  assert.equal(await service.runScheduledSweep(), null);
  assert.equal(calls.length, 3);
});

test('scheduled sweep waits until the configured time and needs a Hukamnama', async () => {
  const early = harness({ now: new Date('2099-01-10T10:00:00Z') }); // 05:00 in Toronto
  await early.db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  await early.db.setSingleton('social_card_settings', { hukamnamaAuto: true, hukamnamaTime: '07:00', dryRun: false });
  assert.equal(await early.service.runScheduledSweep(), null);
  const empty = harness();
  await empty.db.setSingleton('social_card_settings', { hukamnamaAuto: true, dryRun: false });
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

test('live posting refuses a non-https public URL', async () => {
  const { db, call, calls } = harness({ publicBaseUrl: 'http://localhost:3001' });
  await db.setSingleton('hukamnama_ssm_hukamnama_entries', { '2099-01-10': { morning: HUKAM } });
  const result = await call('POST', '/api/social/post', { body: { kind: 'hukamnama', date: '2099-01-10', dryRun: false } });
  assert.equal(result.payload.data.status, 'failed');
  assert.equal(calls.length, 0);
});
