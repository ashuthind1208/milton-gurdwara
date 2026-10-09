const test = require('node:test');
const assert = require('node:assert/strict');
const { activeOverride, createLedScreenService, HEARTBEAT_RESOURCE, OVERRIDE_RESOURCE } = require('./ledScreenService');

const makeHarness = (initialNow = new Date('2026-10-08T12:00:00Z')) => {
  let clock = initialNow;
  const singletons = new Map();
  const items = new Map();
  const db = {
    hasDatabaseConnection: true,
    getSingleton: async (resource, fallback) => singletons.get(resource) ?? fallback,
    setSingleton: async (resource, value) => { singletons.set(resource, value); return value; },
    listItems: async (resource) => [...(items.get(resource) || [])],
    createItem: async (resource, value) => { items.set(resource, [...(items.get(resource) || []), value]); return value; },
    updateItem: async (resource, id, value) => { items.set(resource, (items.get(resource) || []).map((item) => item.id === id ? value : item)); return value; }
  };
  const service = createLedScreenService({
    eventsDb: db,
    sendJson: (response, status, payload) => { response.status = status; response.payload = payload; },
    parseJsonObjectBody: async (request) => request.body || {},
    assertInput: (condition, message, status = 400) => { if (!condition) throw Object.assign(new Error(message), { status }); },
    isAdmin: (request) => request.headers?.['x-actor-role'] === 'Admin',
    now: () => clock
  });
  const call = async (method, path, body = {}, admin = true) => {
    const response = {};
    await service.handleApi({ method, body, headers: admin ? { 'x-actor-role': 'Admin' } : {} }, response, new URL(`http://localhost${path}`));
    return response;
  };
  return { db, singletons, items, service, call, setNow: (value) => { clock = value; } };
};

test('emergency override is active until expiry', () => {
  const start = new Date('2026-10-08T12:00:00Z');
  assert.equal(activeOverride({ active: true, endsAt: '2026-10-08T12:30:00Z' }, start).active, true);
  assert.equal(activeOverride({ active: true, endsAt: '2026-10-08T11:30:00Z' }, start), null);
  assert.equal(activeOverride({ active: false }, start), null);
});

test('only admin can activate or clear emergency override', async () => {
  const { call } = makeHarness();
  assert.equal((await call('PUT', '/api/led/override', { active: true, title: 'Urgent notice' }, false)).status, 403);
  const active = await call('PUT', '/api/led/override', { active: true, title: 'Urgent notice', details: 'Please follow staff directions.', durationMinutes: 15 });
  assert.equal(active.status, 200);
  assert.equal(active.payload.data.title, 'Urgent notice');
  assert.equal(new Date(active.payload.data.endsAt).getTime() - new Date(active.payload.data.startedAt).getTime(), 15 * 60000);
  const cleared = await call('PUT', '/api/led/override', { active: false });
  assert.equal(cleared.payload.data.active, false);
});

test('public override read hides expired notices', async () => {
  const { call, setNow } = makeHarness();
  await call('PUT', '/api/led/override', { active: true, title: 'Urgent notice', durationMinutes: 5 });
  setNow(new Date('2026-10-08T12:06:00Z'));
  const response = await call('GET', '/api/led/override', {}, false);
  assert.equal(response.payload.data, null);
});

test('heartbeat validates screen ID and limits writes to once per 45 seconds', async () => {
  const { call, db, items, setNow } = makeHarness();
  assert.equal((await call('POST', '/api/led/heartbeat', { screenId: 'Bad Screen!' })).status, 400);
  const first = await call('POST', '/api/led/heartbeat', { screenId: 'darbar', label: 'Darbar Hall', currentSlide: 'Hukamnama' }, false);
  assert.equal(first.status, 200);
  assert.equal((await db.listItems(HEARTBEAT_RESOURCE)).length, 1);
  setNow(new Date('2026-10-08T12:00:30Z'));
  await call('POST', '/api/led/heartbeat', { screenId: 'darbar', currentSlide: 'Changed' }, false);
  assert.equal((await db.listItems(HEARTBEAT_RESOURCE))[0].currentSlide, 'Hukamnama');
  setNow(new Date('2026-10-08T12:00:46Z'));
  await call('POST', '/api/led/heartbeat', { screenId: 'darbar', currentSlide: 'Changed' }, false);
  assert.equal((await db.listItems(HEARTBEAT_RESOURCE))[0].currentSlide, 'Changed');
  assert.equal(items.get(HEARTBEAT_RESOURCE).length, 1);
});

test('health view requires admin and reports status for all screens', async () => {
  const { call, db } = makeHarness();
  await call('POST', '/api/led/heartbeat', { screenId: 'lobby', currentSlide: 'Announcements' }, false);
  assert.equal((await call('GET', '/api/led/screens/health', {}, false)).status, 403);
  const response = await call('GET', '/api/led/screens/health');
  assert.equal(response.payload.data.find((item) => item.id === 'lobby').status, 'online');
  assert.equal(response.payload.data.find((item) => item.id === 'main').status, 'unknown');
  assert.ok(db);
});

test('emergency record is stored as the LED override singleton', async () => {
  const { call, singletons } = makeHarness();
  await call('PUT', '/api/led/override', { active: true, title: 'Emergency' });
  assert.equal(singletons.get(OVERRIDE_RESOURCE).title, 'Emergency');
});

test('custom screens can report heartbeats and appear in health', async () => {
  const { call } = makeHarness();
  assert.equal((await call('POST', '/api/led/heartbeat', { screenId: 'youth-room', label: 'Youth Room' }, false)).status, 200);
  const health = (await call('GET', '/api/led/screens/health')).payload.data;
  assert.equal(health.find((item) => item.id === 'youth-room').label, 'Youth Room');
  assert.equal(health.find((item) => item.id === 'youth-room').status, 'online');
});
