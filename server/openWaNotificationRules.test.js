const test = require('node:test');
const assert = require('node:assert/strict');
const {
  stableJson,
  hashValue,
  newsIsPublic,
  torontoDateKey,
  stripVolatile,
  getLangarMaterialChanges
} = require('./openWaNotificationRules');

const now = new Date('2026-09-30T16:00:00.000Z').getTime();

test('News visibility requires active, publication reached, and not expired', () => {
  assert.equal(newsIsPublic({ active: true, publishedAt: '2026-09-30', expiryDate: '2026-09-30' }, now), true);
  assert.equal(newsIsPublic({ active: false, publishedAt: '2026-09-01' }, now), false);
  assert.equal(newsIsPublic({ active: true, publishedAt: '2026-10-01' }, now), false);
  assert.equal(newsIsPublic({ active: true, publishedAt: '2026-09-01', expiryDate: '2026-09-29' }, now), false);
  assert.equal(newsIsPublic({ active: true, publishedAt: '2026-09-01', expiryDate: 'bad-date' }, now), true);
});

test('Toronto date key follows the community local calendar date', () => {
  assert.equal(torontoDateKey(new Date('2026-09-30T02:00:00.000Z')), '2026-09-29');
  assert.equal(torontoDateKey(new Date('2026-09-30T16:00:00.000Z')), '2026-09-30');
});

test('CMS comparison strips timestamps but retains public content changes', () => {
  const previous = { about: { intro: 'Welcome', updatedAt: 'one' } };
  const sameContent = { about: { intro: 'Welcome', updatedAt: 'two' } };
  const changed = { about: { intro: 'Waheguru Ji', updatedAt: 'two' } };
  assert.equal(stableJson(stripVolatile(previous)), stableJson(stripVolatile(sameContent)));
  assert.notEqual(hashValue(stripVolatile(previous)), hashValue(stripVolatile(changed)));
});

test('Langar comparison detects add, material edit, and remove but ignores receipt-only changes', () => {
  const previous = [
    { id: 'rice', name: 'Rice', quantityRequired: 4, quantityReceived: 1 },
    { id: 'beans', name: 'Beans' }
  ];
  const next = [
    { id: 'rice', name: 'Rice', quantityRequired: 4, quantityReceived: 3 },
    { id: 'oil', name: 'Oil' }
  ];
  const changes = getLangarMaterialChanges(previous, next);
  assert.deepEqual(changes.added.map((item) => item.id), ['oil']);
  assert.deepEqual(changes.updated, []);
  assert.deepEqual(changes.removed.map((item) => item.id), ['beans']);
});
