const crypto = require('crypto');
const { normalizeGranthiQuestion } = require('./askGranthi');

const QUESTION_RESOURCE = 'ask_granthi_questions';

const normalizeQuestionKey = (question) => normalizeGranthiQuestion(question)
  .normalize('NFC')
  .toLocaleLowerCase('en-CA')
  .replace(/[?.!,;:]+$/g, '');

const createQuestionId = () => `granthi-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

const hasCompleteGurbaniReference = (record) => Boolean(
  String(record?.gurbani?.gurmukhi || '').trim()
  && String(record?.gurbani?.source || '').trim()
  && String(record?.gurbani?.translationPunjabi || '').trim()
  && String(record?.gurbani?.translationEnglish || '').trim()
);

const sortQuestions = (records) => [...records].sort((left, right) => {
  const leftDate = new Date(left.lastAskedAt || left.createdAt || 0).getTime();
  const rightDate = new Date(right.lastAskedAt || right.createdAt || 0).getTime();
  return rightDate - leftDate;
});

const listGranthiQuestions = async (db) => sortQuestions(await db.listItems(QUESTION_RESOURCE));

const listPublicGranthiQuestions = async (db, limit = 12) => {
  const records = await listGranthiQuestions(db);
  return records
    .filter((record) => record.status === 'thinking'
      || (record.status === 'answered' && record.visible !== false && hasCompleteGurbaniReference(record)))
    .sort((left, right) => Number(right.status === 'thinking') - Number(left.status === 'thinking')
      || new Date(right.lastAskedAt || right.createdAt || 0).getTime() - new Date(left.lastAskedAt || left.createdAt || 0).getTime())
    .slice(0, Math.max(1, Math.min(Number(limit) || 12, 30)));
};

const findReusableAnswer = async (db, question) => {
  const questionKey = normalizeQuestionKey(question);
  const records = await listGranthiQuestions(db);
  return records.find((record) => record.questionKey === questionKey
    && record.status === 'answered'
    && record.answerEnglish
    && hasCompleteGurbaniReference(record)) || null;
};

const createThinkingQuestion = async (db, question, metadata = {}) => {
  const now = new Date().toISOString();
  return db.createItem(QUESTION_RESOURCE, {
    id: createQuestionId(),
    question,
    questionKey: normalizeQuestionKey(question),
    status: 'thinking',
    visible: true,
    featured: false,
    askCount: 1,
    submittedFrom: String(metadata.submittedFrom || 'qr').slice(0, 40),
    createdAt: now,
    updatedAt: now,
    lastAskedAt: now
  });
};

const reuseGranthiAnswer = async (db, record) => {
  const now = new Date().toISOString();
  return db.updateItem(QUESTION_RESOURCE, record.id, {
    ...record,
    askCount: Math.max(1, Number(record.askCount) || 1) + 1,
    lastAskedAt: now,
    updatedAt: now,
    visible: true
  });
};

const completeGranthiAnswer = async (db, record, answer) => {
  const now = new Date().toISOString();
  return db.updateItem(QUESTION_RESOURCE, record.id, {
    ...record,
    ...answer,
    status: 'answered',
    answeredAt: now,
    updatedAt: now,
    errorMessage: ''
  });
};

const failGranthiAnswer = async (db, record, error) => db.updateItem(QUESTION_RESOURCE, record.id, {
  ...record,
  status: 'error',
  visible: false,
  errorMessage: String(error?.message || 'Unable to generate an answer.').slice(0, 300),
  updatedAt: new Date().toISOString()
});

module.exports = {
  QUESTION_RESOURCE,
  completeGranthiAnswer,
  createThinkingQuestion,
  failGranthiAnswer,
  findReusableAnswer,
  listGranthiQuestions,
  listPublicGranthiQuestions,
  normalizeQuestionKey,
  reuseGranthiAnswer
};