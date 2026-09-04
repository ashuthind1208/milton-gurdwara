const test = require('node:test');
const assert = require('node:assert/strict');
const {
  completeGranthiAnswer,
  createThinkingQuestion,
  failGranthiAnswer,
  findReusableAnswer,
  listPublicGranthiQuestions,
  reuseGranthiAnswer
} = require('./askGranthiStore');

const createFakeDb = () => {
  const records = [];
  return {
    records,
    listItems: async () => records,
    createItem: async (_resource, record) => {
      records.push(record);
      return record;
    },
    updateItem: async (_resource, id, record) => {
      const index = records.findIndex((entry) => entry.id === id);
      records[index] = record;
      return record;
    }
  };
};

test('persists thinking state before completing an answer', async () => {
  const db = createFakeDb();
  const pending = await createThinkingQuestion(db, 'What is the meaning of Ik Onkar?');

  assert.equal(pending.status, 'thinking');
  assert.equal((await listPublicGranthiQuestions(db)).length, 1);

  const completed = await completeGranthiAnswer(db, pending, {
    shortAnswer: 'There is one universal Creator.',
    answerPunjabi: 'ਇੱਕ ਸਰਬਵਿਆਪਕ ਕਰਤਾ ਹੈ।',
    answerEnglish: 'Ik Onkar teaches the oneness of the Creator and creation.'
  });

  assert.equal(completed.status, 'answered');
  assert.ok(completed.answeredAt);
});

test('reuses a normalized stored answer and records another ask', async () => {
  const db = createFakeDb();
  const pending = await createThinkingQuestion(db, 'Why do we do seva?');
  const answered = await completeGranthiAnswer(db, pending, {
    answerPunjabi: 'ਸੇਵਾ ਨਿਮਰਤਾ ਸਿਖਾਉਂਦੀ ਹੈ।',
    answerEnglish: 'Seva develops humility.',
    shortAnswer: 'Seva develops humility.',
    gurbani: {
      gurmukhi: 'ਵਿਚਿ ਦੁਨੀਆ ਸੇਵ ਕਮਾਈਐ ॥',
      source: 'Sri Guru Granth Sahib Ji, Ang 26',
      translationEnglish: 'In the midst of this world, perform selfless service.'
    }
  });

  assert.deepEqual(await findReusableAnswer(db, '  WHY do we do seva??? '), answered);
  const reused = await reuseGranthiAnswer(db, answered);
  assert.equal(reused.askCount, 2);
});

test('hides failed generations from the public board', async () => {
  const db = createFakeDb();
  const pending = await createThinkingQuestion(db, 'Can you explain this Sikh teaching?');
  await failGranthiAnswer(db, pending, new Error('AI unavailable'));

  assert.deepEqual(await listPublicGranthiQuestions(db), []);
  assert.equal(db.records[0].status, 'error');
});

test('hides answered records without a complete Gurbani reference', async () => {
  const db = createFakeDb();
  const pending = await createThinkingQuestion(db, 'What does Ik Onkar teach us?');
  await completeGranthiAnswer(db, pending, {
    answerPunjabi: 'ਇਕ ਓਅੰਕਾਰ ਏਕਤਾ ਸਿਖਾਉਂਦਾ ਹੈ।',
    answerEnglish: 'Ik Onkar teaches oneness.',
    shortAnswer: 'The Creator and creation are one.'
  });

  assert.deepEqual(await listPublicGranthiQuestions(db), []);
  assert.equal(await findReusableAnswer(db, 'What does Ik Onkar teach us?'), null);
});

test('places a new thinking question ahead of an older featured answer', async () => {
  const db = createFakeDb();
  const older = await createThinkingQuestion(db, 'What does equality mean in Sikhi?');
  await completeGranthiAnswer(db, older, {
    answerPunjabi: 'ਸਿੱਖੀ ਸਭ ਦੀ ਬਰਾਬਰੀ ਸਿਖਾਉਂਦੀ ਹੈ।',
    answerEnglish: 'Sikhi teaches the equality of all people.',
    shortAnswer: 'Every person carries equal dignity.',
    featured: true
  });
  const newest = await createThinkingQuestion(db, 'Why do Sikhs remember Waheguru each day?');

  const publicQuestions = await listPublicGranthiQuestions(db);
  assert.equal(publicQuestions[0].id, newest.id);
});