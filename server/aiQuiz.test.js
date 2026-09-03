const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiQuiz, normalizeQuizRequest } = require('./aiQuiz');

const source = (id) => ({
  sourceId: id,
  category: 'Sikh Values',
  difficulty: 'Easy',
  question: { en: `Source question ${id}`, pa: `ਸਵਾਲ ${id}` },
  options: [{ en: `Trusted ${id}`, pa: `ਸਹੀ ${id}` }, { en: 'Wrong', pa: 'ਗਲਤ' }],
  correctAnswer: 0,
  explanation: { en: `Trusted explanation ${id}`, pa: `ਸਹੀ ਵਿਆਖਿਆ ${id}` },
  reference: { en: 'Trusted reference', pa: 'ਭਰੋਸੇਯੋਗ ਹਵਾਲਾ' }
});

test('validates topic and difficulty choices', () => {
  assert.deepEqual(normalizeQuizRequest('mixed-review', 'Medium'), { topic: 'mixed-review', difficulty: 'Medium' });
  assert.throws(() => normalizeQuizRequest('invalid', 'Easy'), /valid quiz topic/);
});

test('anchors generated questions to trusted answers and explanations', async () => {
  const sources = Array.from({ length: 5 }, (_, index) => source(`source-${index + 1}`));
  const generated = {
    questions: sources.map((entry, index) => ({
      sourceId: entry.sourceId,
      question: { en: `AI question ${index + 1}`, pa: `ਏਆਈ ਸਵਾਲ ${index + 1}` },
      distractors: [{ en: 'A', pa: 'ੳ' }, { en: 'B', pa: 'ਅ' }, { en: 'C', pa: 'ੲ' }],
      correctPosition: index % 4
    }))
  };
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ message: { content: JSON.stringify(generated) } })
  });

  const quiz = await createAiQuiz('mixed-review', 'Easy', { provider: 'ollama', sources, fetchImpl });
  assert.equal(quiz.questions.length, 5);
  quiz.questions.forEach((question, index) => {
    assert.equal(question.options[question.correctAnswer].en, `Trusted source-${index + 1}`);
    assert.equal(question.explanation.en, `Trusted explanation source-${index + 1}`);
  });
});