const test = require('node:test');
const assert = require('node:assert/strict');
const { findDailyAiQuiz, getTorontoDateKey, storeDailyAiQuiz } = require('./aiQuizStore');

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

test('uses the Toronto calendar date for daily quiz caching', () => {
  assert.equal(getTorontoDateKey(new Date('2026-09-03T02:00:00Z')), '2026-09-02');
});

test('stores only one quiz for the same day, topic, and difficulty', async () => {
  const db = createMemoryDb();
  const date = new Date('2026-09-03T02:00:00Z');
  const first = await storeDailyAiQuiz(db, { topic: 'mixed-review', difficulty: 'Easy', questions: [{ id: 'original' }] }, date);
  const stored = await findDailyAiQuiz(db, 'mixed-review', 'Easy', date);

  assert.equal(db.records.length, 1);
  assert.equal(stored.id, first.id);
  assert.equal(stored.questions[0].id, 'original');
});