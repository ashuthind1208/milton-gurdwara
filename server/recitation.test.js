const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clampLineIndex,
  createRecitationService,
  isProtectedResource,
  normalizeSource,
  slimVerse,
  toPublicSession
} = require('./recitation');

const createFakeDb = () => {
  const items = [];
  const singletons = new Map();
  return {
    hasDatabaseConnection: true,
    items,
    listItems: async () => items.map((item) => ({ ...item })),
    createItem: async (_resource, record) => { items.push({ ...record }); return record; },
    updateItem: async (_resource, id, record) => { items[items.findIndex((item) => item.id === id)] = { ...record }; return record; },
    removeItem: async (_resource, id) => { items.splice(items.findIndex((item) => item.id === id), 1); },
    getSingleton: async (resource, fallback) => singletons.get(resource) ?? fallback,
    setSingleton: async (resource, payload) => { singletons.set(resource, payload); return payload; },
    singletons
  };
};

const createHarness = () => {
  const db = createFakeDb();
  const failure = (message, status) => Object.assign(new Error(message), { status });
  const service = createRecitationService({
    eventsDb: db,
    sendJson: (response, status, payload) => { response.status = status; response.payload = payload; },
    parseJsonObjectBody: async (request) => request.body || {},
    assertInput: (condition, message, status = 400) => { if (!condition) throw failure(message, status); },
    now: () => Date.now()
  });
  const call = async (method, path, { body } = {}) => {
    const request = { method, body, headers: {} };
    const response = {};
    await service.handleApi(request, response, new URL(`http://localhost${path}`));
    return response;
  };
  return { db, service, call };
};

const seedText = (db, id = 31) => db.setSingleton(`recitation_text_bani_${id}`, {
  key: `bani-${id}`, type: 'bani', id, title: 'ਸੁਖਮਨੀ ਸਾਹਿਬ', titleEnglish: 'Sukhmani Sahib', totalLines: 3,
  lines: [{ g: 'ਇੱਕ', e: 'one', p: 'ਇੱਕ ਹੈ', a: 262 }, { g: 'ਦੋ', e: 'two', p: 'ਦੋ ਹੈ', a: 262 }, { g: 'ਤਿੰਨ', e: 'three', p: 'ਤਿੰਨ ਹੈ', a: 262 }]
});

test('slimVerse reads nested bani verses and flat ang verses', () => {
  const nested = { verse: { verseId: 5, verse: { unicode: 'ਸਤਿ' }, translation: { en: { bdb: 'Truth' }, pu: { ss: { unicode: 'ਸੱਚ' } } }, pageNo: 4 } };
  const flat = { verseId: 6, verse: { unicode: 'ਨਾਮ' }, translation: { en: { ssk: 'Name' }, pu: { bdb: { unicode: 'ਨਾਮ ਹੈ' } } }, pageNo: 9 };
  assert.deepEqual(slimVerse(nested), { g: 'ਸਤਿ', e: 'Truth', p: 'ਸੱਚ', a: 4 });
  assert.deepEqual(slimVerse(flat), { g: 'ਨਾਮ', e: 'Name', p: 'ਨਾਮ ਹੈ', a: 9 });
});

test('normalizeSource accepts only known types and valid ids', () => {
  assert.deepEqual(normalizeSource({ sourceType: 'bani', sourceId: '31' }), { type: 'bani', id: 31, key: 'bani-31' });
  assert.equal(normalizeSource({ type: 'ang', id: 1431 }), null);
  assert.equal(normalizeSource({ type: 'hukam', id: 3 }), null);
  assert.equal(normalizeSource({ type: 'bani', id: 'abc' }), null);
});

test('clampLineIndex stays inside the text', () => {
  assert.equal(clampLineIndex(-4, 10), 0);
  assert.equal(clampLineIndex(99, 10), 9);
  assert.equal(clampLineIndex(3.9, 10), 3);
});

test('recitation resources are protected from the generic content API', () => {
  assert.equal(isProtectedResource('recitation_sessions'), true);
  assert.equal(isProtectedResource('recitation_text_bani_31'), true);
  assert.equal(isProtectedResource('led_board_settings'), false);
});

test('public session data never exposes internal fields', () => {
  const publicSession = toPublicSession({ id: 'a', status: 'live', title: 't', secret: 'x', endedReason: 'ended', currentIndex: 2 });
  assert.equal('secret' in publicSession, false);
  assert.equal('endedReason' in publicSession, false);
});

test('Granthi controls no longer expose a PIN unlock endpoint', async () => {
  const { call } = createHarness();
  assert.equal((await call('POST', '/api/recitation/unlock', { body: { pin: '0000' } })).status, 404);
});

test('a session starts, steps forward and back within bounds, and ends with times recorded', async () => {
  const { db, call } = createHarness();
  await seedText(db);
  const started = await call('POST', '/api/recitation/sessions', { body: { sourceType: 'bani', sourceId: 31, reciter: 'Granthi Ji' } });
  assert.equal(started.status, 201);
  const id = started.payload.data.id;
  assert.equal(started.payload.data.currentIndex, 0);
  assert.ok(started.payload.data.startedAt);

  assert.equal((await call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: -1 } })).payload.data.currentIndex, 0);
  assert.equal((await call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: 1 } })).payload.data.currentIndex, 1);
  await call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: 1 } });
  assert.equal((await call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: 1 } })).payload.data.currentIndex, 2);
  assert.equal((await call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: 5 } })).status, 400);

  assert.equal((await call('GET', '/api/recitation/state')).payload.data.session.id, id);

  const ended = await call('POST', `/api/recitation/sessions/${id}/end`);
  assert.equal(ended.payload.data.status, 'ended');
  assert.ok(ended.payload.data.endedAt);
  assert.equal((await call('GET', '/api/recitation/state')).payload.data.session, null);
  assert.equal((await call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: 1 } })).status, 409);
});

test('starting a new recitation ends the one that is live', async () => {
  const { db, call } = createHarness();
  await seedText(db);
  const first = (await call('POST', '/api/recitation/sessions', { body: { sourceType: 'bani', sourceId: 31 } })).payload.data;
  const second = (await call('POST', '/api/recitation/sessions', { body: { sourceType: 'bani', sourceId: 31 } })).payload.data;
  const list = (await call('GET', '/api/recitation/sessions')).payload.data;
  assert.equal(list.filter((session) => session.status === 'live').length, 1);
  assert.equal(list.find((session) => session.id === first.id).status, 'ended');
  assert.equal(list.find((session) => session.id === second.id).status, 'live');
});

test('rapid taps are applied one at a time without losing any', async () => {
  const { db, call } = createHarness();
  await db.setSingleton('recitation_text_bani_31', { key: 'bani-31', type: 'bani', id: 31, title: 't', titleEnglish: 't', totalLines: 50, lines: Array.from({ length: 50 }, (_, index) => ({ g: `line ${index}`, e: '', p: '', a: 1 })) });
  const id = (await call('POST', '/api/recitation/sessions', { body: { sourceType: 'bani', sourceId: 31 } })).payload.data.id;
  await Promise.all(Array.from({ length: 10 }, () => call('POST', `/api/recitation/sessions/${id}/step`, { body: { delta: 1 } })));
  assert.equal((await call('GET', `/api/recitation/sessions/${id}`)).payload.data.currentIndex, 10);
});
