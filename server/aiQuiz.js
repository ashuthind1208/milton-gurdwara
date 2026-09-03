const fs = require('fs');
const path = require('path');

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3:latest';

const QUIZ_TOPICS = Object.freeze([
  { value: 'mixed-review', label: 'Mixed Review', file: '' },
  { value: 'guru-nanak', label: 'Guru Nanak Dev Ji', file: '001_guru_nanak.json' },
  { value: 'ten-gurus', label: 'Ten Gurus', file: '002_ten_gurus.json' },
  { value: 'khalsa-panj-pyare', label: 'Khalsa & Panj Pyare', file: '003_khalsa_panj_pyare.json' },
  { value: 'five-ks', label: 'Five Ks & Symbols', file: '004_five_ks_symbols.json' },
  { value: 'gurdwara-gurbani', label: 'Gurdwara & Gurbani', file: '005_gurdwara_gurbani.json' },
  { value: 'sikh-history', label: 'Sikh History', file: '006_sikh_history.json' },
  { value: 'values-festivals', label: 'Sikh Values & Festivals', file: '007_sikh_values_festivals.json' }
]);

const hasGurmukhi = (value) => /[\u0A00-\u0A7F]/.test(String(value || ''));
const limitText = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const createInputError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const normalizeQuizRequest = (topicValue, difficultyValue) => {
  const topic = String(topicValue || 'mixed-review').trim().toLowerCase();
  const difficulty = String(difficultyValue || 'Easy').trim();
  if (!QUIZ_TOPICS.some((entry) => entry.value === topic)) {
    throw createInputError('Choose a valid quiz topic.');
  }
  if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
    throw createInputError('Choose Easy, Medium, or Hard.');
  }
  return { topic, difficulty };
};

const readQuizSources = (topic) => {
  const quizDirectory = path.resolve(__dirname, '..', 'public', 'quiz');
  const selectedTopic = QUIZ_TOPICS.find((entry) => entry.value === topic);
  const fileNames = selectedTopic?.file
    ? [selectedTopic.file]
    : fs.readdirSync(quizDirectory).filter((fileName) => fileName.endsWith('.json')).sort();

  return fileNames.flatMap((fileName) => {
    const payload = JSON.parse(fs.readFileSync(path.join(quizDirectory, fileName), 'utf8'));
    return (Array.isArray(payload) ? payload : []).map((question) => ({ ...question, sourceId: `${fileName}:${question.id}` }));
  });
};

const readJsonObject = (value) => {
  const text = String(value || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    const error = new Error('The AI returned an invalid quiz. Please try again.');
    error.status = 502;
    throw error;
  }
};

const chooseSourceFacts = (sources, difficulty) => {
  const preferred = sources.filter((entry) => String(entry.difficulty || '').toLowerCase() === difficulty.toLowerCase());
  const pool = preferred.length >= 10 ? preferred : sources;
  const daySeed = Math.floor(Date.now() / 86400000);
  return Array.from({ length: Math.min(15, pool.length) }, (_, index) => pool[(daySeed + (index * 7)) % pool.length]);
};

const toPromptFact = (source) => {
  const correctIndex = Math.max(0, Math.min(3, Number(source.correctAnswer) || 0));
  return {
    sourceId: source.sourceId,
    category: source.category,
    question: source.question,
    trustedAnswer: source.options?.[correctIndex],
    explanation: source.explanation
  };
};

const createPrompt = ({ difficulty, topic, sources }) => `Create a five-question bilingual Sikh learning quiz for children ages 7-12.
Topic: ${JSON.stringify(QUIZ_TOPICS.find((entry) => entry.value === topic)?.label || topic)}
Difficulty: ${JSON.stringify(difficulty)}

Use only these trusted source facts:
${JSON.stringify(sources.map(toPromptFact))}

Return only JSON: {"questions":[{"sourceId":"...","question":{"en":"...","pa":"..."},"distractors":[{"en":"...","pa":"..."},{"en":"...","pa":"..."},{"en":"...","pa":"..."}],"correctPosition":0}]}

Rules:
- Return exactly five questions using five different sourceId values from the list.
- Paraphrase each source question clearly without changing its trusted answer.
- Punjabi text must be natural Gurmukhi, never Hindi or Shahmukhi.
- Provide exactly three plausible but unambiguously incorrect bilingual distractors.
- correctPosition must be an integer from 0 to 3; the server inserts the trusted answer there.
- Never invent, quote, or complete Gurbani lines, historical dates, names, or religious rulings.
- Keep each question and option concise and suitable for the requested difficulty.`;

const validateGeneratedQuiz = (generated, sourceMap) => {
  const questions = Array.isArray(generated?.questions) ? generated.questions : [];
  const sourceIds = new Set();
  const valid = questions.length === 5 && questions.every((question) => {
    const distractors = Array.isArray(question?.distractors) ? question.distractors : [];
    const sourceId = String(question?.sourceId || '');
    sourceIds.add(sourceId);
    return sourceMap.has(sourceId)
      && String(question?.question?.en || '').trim()
      && hasGurmukhi(question?.question?.pa)
      && distractors.length === 3
      && distractors.every((option) => String(option?.en || '').trim() && hasGurmukhi(option?.pa))
      && Number.isInteger(Number(question?.correctPosition))
      && Number(question.correctPosition) >= 0
      && Number(question.correctPosition) <= 3;
  });

  if (!valid || sourceIds.size !== 5) {
    const error = new Error('The AI could not produce a reliable bilingual quiz. Please try again.');
    error.status = 502;
    throw error;
  }
};

const requestAiJson = async ({ apiKey, baseUrl, fetchImpl, model, prompt, provider, signal }) => {
  if (provider !== 'gemini') {
    const response = await fetchImpl(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, format: 'json', options: { temperature: 0.35 }, messages: [{ role: 'user', content: prompt }] }),
      signal
    });
    if (!response.ok) {
      const error = new Error(`Local AI model is unavailable (${response.status}).`);
      error.status = 503;
      throw error;
    }
    const payload = await response.json();
    return { generated: readJsonObject(payload?.message?.content), model };
  }

  if (!apiKey) {
    const error = new Error('The AI quiz is not configured yet.');
    error.status = 503;
    throw error;
  }
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
  const requestModel = (modelName) => fetchImpl(`${baseUrl}/v1beta/models/${encodeURIComponent(modelName)}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, responseMimeType: 'application/json' }
    }),
    signal
  });
  let resolvedModel = model;
  let response = await requestModel(resolvedModel);
  if (response.status === 404) {
    const modelsResponse = await fetchImpl(`${baseUrl}/v1beta/models?pageSize=100`, { method: 'GET', headers, signal });
    if (modelsResponse.ok) {
      const modelsPayload = await modelsResponse.json();
      const available = (modelsPayload?.models || [])
        .filter((entry) => entry.supportedGenerationMethods?.includes('generateContent'))
        .map((entry) => String(entry.name || '').replace(/^models\//, ''));
      resolvedModel = available.find((name) => name.includes('flash-lite')) || available.find((name) => name.includes('flash')) || available[0] || model;
      if (resolvedModel !== model) response = await requestModel(resolvedModel);
    }
  }
  if (!response.ok) {
    const error = new Error(response.status === 429 ? 'The free AI quiz limit has been reached. Please try again later.' : `The AI quiz service is unavailable (${response.status}).`);
    error.status = response.status === 429 ? 429 : 503;
    throw error;
  }
  const payload = await response.json();
  return { generated: readJsonObject(payload?.candidates?.[0]?.content?.parts?.[0]?.text), model: resolvedModel };
};

const createAiQuiz = async (topicValue, difficultyValue, options = {}) => {
  const { topic, difficulty } = normalizeQuizRequest(topicValue, difficultyValue);
  const sources = chooseSourceFacts(options.sources || readQuizSources(topic), difficulty);
  const sourceMap = new Map(sources.map((source) => [source.sourceId, source]));
  const provider = String(options.provider || process.env.GURMAT_AI_PROVIDER || (process.env.NODE_ENV === 'production' ? 'gemini' : 'ollama')).trim().toLowerCase();
  const isGemini = provider === 'gemini';
  const apiKey = String(options.apiKey ?? process.env.GEMINI_API_KEY ?? '').trim();
  const baseUrl = String(options.baseUrl || (isGemini ? process.env.GEMINI_BASE_URL : process.env.OLLAMA_BASE_URL) || (isGemini ? DEFAULT_GEMINI_BASE_URL : DEFAULT_OLLAMA_BASE_URL)).trim().replace(/\/$/, '');
  const model = String(options.model || (isGemini ? process.env.GEMINI_MODEL : process.env.OLLAMA_MODEL) || (isGemini ? DEFAULT_GEMINI_MODEL : DEFAULT_OLLAMA_MODEL)).trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || process.env.GURMAT_AI_TIMEOUT_MS || 60000));

  try {
    const response = await requestAiJson({ apiKey, baseUrl, fetchImpl: options.fetchImpl || global.fetch, model, prompt: createPrompt({ difficulty, topic, sources }), provider, signal: controller.signal });
    validateGeneratedQuiz(response.generated, sourceMap);
    const questions = response.generated.questions.map((generated, index) => {
      const source = sourceMap.get(generated.sourceId);
      const trustedAnswerIndex = Math.max(0, Math.min(3, Number(source.correctAnswer) || 0));
      const trustedAnswer = source.options[trustedAnswerIndex];
      const correctAnswer = Number(generated.correctPosition);
      const quizOptions = generated.distractors.map((option) => ({ en: limitText(option.en, 100), pa: limitText(option.pa, 120) }));
      quizOptions.splice(correctAnswer, 0, { en: limitText(trustedAnswer.en, 100), pa: limitText(trustedAnswer.pa, 120) });
      return {
        id: `ai-${Date.now()}-${index + 1}`,
        category: limitText(source.category || 'Sikh Learning', 80),
        difficulty,
        question: { en: limitText(generated.question.en, 180), pa: limitText(generated.question.pa, 220) },
        options: quizOptions,
        correctAnswer,
        explanation: source.explanation,
        reference: source.reference,
        points: 10,
        image: null
      };
    });
    return { topic, difficulty, provider, model: response.model, questions };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('The AI quiz took too long to respond. Please try again.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  QUIZ_TOPICS,
  createAiQuiz,
  normalizeQuizRequest,
  validateGeneratedQuiz
};