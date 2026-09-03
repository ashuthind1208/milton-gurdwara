const crypto = require('crypto');
const { normalizeWordInput } = require('./gurmatGuide');

const RESOURCE = 'gurmat_word_searches';

const normalizeSearchKey = (word) => normalizeWordInput(word).normalize('NFC').toLocaleLowerCase('en-CA');

const createRecordId = (searchKey) => `gurmat-${crypto.createHash('sha256').update(searchKey).digest('hex').slice(0, 24)}`;

const toPublicGuide = (record = {}) => ({
  ...(record.guide || {}),
  searchId: String(record.id || ''),
  generatedAt: String(record.generatedAt || '')
});

const listRecentGurmatGuides = async (db, limit = 5) => {
  const records = await db.listItems(RESOURCE);
  return records
    .filter((record) => record?.guide && record?.generatedAt)
    .sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime())
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 20)))
    .map(toPublicGuide);
};

const findStoredGurmatGuide = async (db, word) => {
  const searchKey = normalizeSearchKey(word);
  const recordId = createRecordId(searchKey);
  const records = await db.listItems(RESOURCE);
  const record = records.find((entry) => entry.id === recordId || entry.searchKey === searchKey);
  return record ? toPublicGuide(record) : null;
};

const storeGurmatGuide = async (db, guide) => {
  const searchKey = normalizeSearchKey(guide?.requestedWord);
  const existing = await findStoredGurmatGuide(db, searchKey);
  if (existing) {
    return existing;
  }

  const record = {
    id: createRecordId(searchKey),
    searchKey,
    generatedAt: new Date().toISOString(),
    guide
  };

  try {
    return toPublicGuide(await db.createItem(RESOURCE, record));
  } catch (error) {
    const concurrentlyStored = await findStoredGurmatGuide(db, searchKey);
    if (concurrentlyStored) {
      return concurrentlyStored;
    }
    throw error;
  }
};

module.exports = {
  RESOURCE,
  findStoredGurmatGuide,
  listRecentGurmatGuides,
  normalizeSearchKey,
  storeGurmatGuide
};