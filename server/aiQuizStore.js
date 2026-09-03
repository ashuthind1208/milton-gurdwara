const crypto = require('crypto');
const { normalizeQuizRequest } = require('./aiQuiz');

const RESOURCE = 'ai_kids_quizzes';

const getTorontoDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const createQuizId = (dateKey, topic, difficulty) => {
  const key = `${dateKey}:${topic}:${difficulty.toLowerCase()}`;
  return `ai-quiz-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
};

const findDailyAiQuiz = async (db, topicValue, difficultyValue, date = new Date()) => {
  const { topic, difficulty } = normalizeQuizRequest(topicValue, difficultyValue);
  const dateKey = getTorontoDateKey(date);
  const quizId = createQuizId(dateKey, topic, difficulty);
  const records = await db.listItems(RESOURCE);
  return records.find((record) => record.id === quizId) || null;
};

const storeDailyAiQuiz = async (db, quiz, date = new Date()) => {
  const { topic, difficulty } = normalizeQuizRequest(quiz?.topic, quiz?.difficulty);
  const dateKey = getTorontoDateKey(date);
  const existing = await findDailyAiQuiz(db, topic, difficulty, date);
  if (existing) return existing;

  const record = {
    ...quiz,
    id: createQuizId(dateKey, topic, difficulty),
    dateKey,
    generatedAt: new Date().toISOString()
  };
  try {
    return await db.createItem(RESOURCE, record);
  } catch (error) {
    const concurrentlyStored = await findDailyAiQuiz(db, topic, difficulty, date);
    if (concurrentlyStored) return concurrentlyStored;
    throw error;
  }
};

module.exports = {
  RESOURCE,
  findDailyAiQuiz,
  getTorontoDateKey,
  storeDailyAiQuiz
};