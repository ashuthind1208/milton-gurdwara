const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createOpenWaNotifications,
  makeBilingualText,
  readConfig,
  DEFAULT_BURST_WINDOW_MS
} = require('./openWaNotifications');

const configuredEnv = (overrides = {}) => ({
  OPENWA_URL: 'http://openwa.local/',
  OPENWA_API_KEY: 'test-key',
  OPENWA_SESSION_ID: 'session-uuid',
  WA_GROUP_ID: '123@g.us',
  WA_NOTIFICATIONS_ENABLED: 'true',
  WA_DRY_RUN: 'false',
  ...overrides
});

const memoryDb = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    async getSingleton(key, fallback) { return data[key] ?? fallback; },
    async setSingleton(key, value) { data[key] = structuredClone(value); return value; },
    async listItems() { return []; }
  };
};

test('bilingual message includes both languages and public URL', () => {
  assert.equal(
    makeBilingualText({ titleEn: 'Update', titlePa: 'ਅੱਪਡੇਟ', bodyEn: 'News', bodyPa: 'ਖ਼ਬਰ', url: 'https://site.test/news' }),
    'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh\nDear Sangat Ji,\nUpdate\nNews\nਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਹਿ\nਪਿਆਰੀ ਸੰਗਤ ਜੀ,\nਅੱਪਡੇਟ\nਖ਼ਬਰ\nWebsite: https://site.test/news'
  );
});

test('notifications are disabled and unconfigured by default', () => {
  const config = readConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.dryRun, false);
  assert.equal(config.burstWindowMs, DEFAULT_BURST_WINDOW_MS);
});

test('enqueue is durable, idempotent, and coalesces Langar burst messages', async () => {
  const db = memoryDb();
  const notifier = createOpenWaNotifications({ db, env: configuredEnv(), now: () => 1000, logger: { info() {}, error() {} } });
  assert.equal((await notifier.enqueue({ type: 'langar', idempotencyKey: 'a', text: 'Added rice', coalesceKey: 'langar', coalesceWindowMs: 3000 })).queued, true);
  assert.equal((await notifier.enqueue({ type: 'langar', idempotencyKey: 'a', text: 'Added rice', coalesceKey: 'langar' })).reason, 'duplicate');
  assert.equal((await notifier.enqueue({ type: 'langar', idempotencyKey: 'b', text: 'Removed beans', coalesceKey: 'langar', coalesceWindowMs: 3000 })).coalesced, true);
  const state = db.data.openwa_notification_queue_v1;
  assert.equal(state.jobs.length, 1);
  assert.match(state.jobs[0].text, /Added rice/);
  assert.match(state.jobs[0].text, /Removed beans/);
  assert.equal(state.jobs[0].sourceKeys.length, 2);
});

test('queue obeys dry-run without calling OpenWA or consuming send throttle', async () => {
  const db = memoryDb();
  let calls = 0;
  const notifier = createOpenWaNotifications({
    db,
    env: configuredEnv({ WA_DRY_RUN: 'true' }),
    now: () => new Date('2026-09-30T12:00:00.000Z').getTime(),
    client: { async post() { calls += 1; } },
    logger: { info() {}, error() {} }
  });
  db.listItems = async () => [{ id: '1', active: true, publishedAt: '2026-09-01', expiryDate: '' }];
  await notifier.enqueue({ type: 'news', idempotencyKey: 'news-1', text: 'New news', newsId: '1' });
  const result = await notifier.processQueue();
  assert.equal(result.dryRun, true);
  assert.equal(calls, 0);
  assert.equal(db.data.openwa_notification_queue_v1.rateWindow.length, 0);
  assert.equal(db.data.openwa_notification_queue_v1.sent[0].outcome, 'dry_run');
});

test('expired or inactive News is dropped before send', async () => {
  const db = memoryDb();
  db.data.news_articles = undefined;
  db.listItems = async () => [{ id: 'article-1', active: false, publishedAt: '2026-01-01', expiryDate: '' }];
  let calls = 0;
  const notifier = createOpenWaNotifications({
    db,
    env: configuredEnv(),
    now: () => new Date('2026-09-30T12:00:00Z').getTime(),
    client: { async post() { calls += 1; } },
    logger: { info() {}, error() {} }
  });
  await notifier.enqueue({ type: 'news', idempotencyKey: 'news-1', text: 'News', newsId: 'article-1' });
  assert.equal((await notifier.processQueue()).reason, 'news_no_longer_public');
  assert.equal(calls, 0);
});

test('sends one request using OpenWA endpoint, group chat ID, and API key', async () => {
  const db = memoryDb();
  let request;
  const notifier = createOpenWaNotifications({
    db,
    env: configuredEnv(),
    now: () => 5000,
    client: { async post(...args) { request = args; return { status: 200 }; } },
    logger: { info() {}, error() {} }
  });
  await notifier.enqueue({ type: 'event', idempotencyKey: 'event-1', text: 'Event' });
  assert.equal((await notifier.processQueue()).sent, true);
  assert.equal(request[0], 'http://openwa.local/api/sessions/session-uuid/messages/send-text');
  assert.deepEqual(request[1], { chatId: '123@g.us', text: 'Event' });
  assert.equal(request[2].headers['X-API-Key'], 'test-key');
});

test('accepts the documented OpenWA API base URL with /api suffix', async () => {
  const db = memoryDb();
  let request;
  const notifier = createOpenWaNotifications({
    db,
    env: configuredEnv({ OPENWA_URL: 'http://openwa.local/api/' }),
    now: () => 5000,
    client: { async post(...args) { request = args; return { status: 200 }; } },
    logger: { info() {}, error() {} }
  });
  await notifier.enqueue({ type: 'event', idempotencyKey: 'event-api-base', text: 'Event' });
  await notifier.processQueue();
  assert.equal(request[0], 'http://openwa.local/api/sessions/session-uuid/messages/send-text');
});
