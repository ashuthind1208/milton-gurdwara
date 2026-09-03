const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findStoredGurmatGuide,
  listRecentGurmatGuides,
  storeGurmatGuide
} = require('./gurmatGuideStore');

const createMemoryDb = () => {
  const records = [];
  return {
    records,
    listItems: async () => records,
    createItem: async (_resource, record) => {
      records.push(record);
      return record;
    }
  };
};

test('stores a generated lesson once and reuses its original snapshot', async () => {
  const db = createMemoryDb();
  const first = await storeGurmatGuide(db, { requestedWord: 'Seva', meaningEnglish: 'Original meaning' });
  const stored = await findStoredGurmatGuide(db, '  SEVA ');

  assert.equal(db.records.length, 1);
  assert.equal(stored.searchId, first.searchId);
  assert.equal(stored.meaningEnglish, 'Original meaning');
});

test('returns only the five newest stored lessons', async () => {
  const db = createMemoryDb();
  for (let index = 0; index < 7; index += 1) {
    db.records.push({
      id: `word-${index}`,
      generatedAt: new Date(2026, 0, index + 1).toISOString(),
      guide: { requestedWord: `Word ${index}` }
    });
  }

  const recent = await listRecentGurmatGuides(db);
  assert.equal(recent.length, 5);
  assert.deepEqual(recent.map((entry) => entry.requestedWord), ['Word 6', 'Word 5', 'Word 4', 'Word 3', 'Word 2']);
});