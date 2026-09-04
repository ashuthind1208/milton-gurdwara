const test = require('node:test');
const assert = require('node:assert/strict');
const { createGranthiAnswer } = require('./askGranthi');

const createJsonResponse = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload
});

const validAnswerPayload = {
  candidates: [{
    content: {
      parts: [{
        text: JSON.stringify({
          shortAnswer: 'Ik Onkar teaches that the Creator and creation are one.',
          answerPunjabi: 'ਇਕ ਓਅੰਕਾਰ ਸਾਨੂੰ ਇੱਕ ਸਰਬਵਿਆਪਕ ਕਰਤਾ ਅਤੇ ਸਾਰੀ ਸ੍ਰਿਸ਼ਟੀ ਦੀ ਏਕਤਾ ਬਾਰੇ ਸਿਖਾਉਂਦਾ ਹੈ।',
          answerEnglish: 'Ik Onkar opens Sikh scripture by affirming one universal Creator and the unity of all creation.',
          referenceId: 'mool-mantar',
          category: 'Core Sikh Beliefs'
        })
      }]
    }
  }]
};

test('sends the Gemini key in a header and returns a trusted reference', async () => {
  let requestUrl = '';
  let requestOptions = null;
  const answer = await createGranthiAnswer('What is the meaning of Ik Onkar?', {
    apiKey: 'secret-test-key',
    model: 'gemini-test-flash',
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return createJsonResponse(200, validAnswerPayload);
    }
  });

  assert.equal(requestUrl.includes('secret-test-key'), false);
  assert.equal(requestOptions.headers['x-goog-api-key'], 'secret-test-key');
  assert.equal(answer.gurbani.source, 'Sri Guru Granth Sahib Ji, Ang 1');
  assert.match(answer.gurbani.translationPunjabi, /[\u0A00-\u0A7F]/);
  assert.ok(answer.gurbani.translationEnglish.length > 40);
  assert.equal(answer.model, 'gemini-test-flash');
});

test('discovers an available Gemini Flash model after a missing configured model', async () => {
  const requestedUrls = [];
  const answer = await createGranthiAnswer('Why is equality important in Sikhi?', {
    apiKey: 'secret-test-key',
    model: 'gemini-missing',
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (url.includes('gemini-missing:generateContent')) {
        return createJsonResponse(404, {});
      }
      if (url.includes('/v1beta/models?pageSize=100')) {
        return createJsonResponse(200, {
          models: [{ name: 'models/gemini-available-flash-lite', supportedGenerationMethods: ['generateContent'] }]
        });
      }
      return createJsonResponse(200, validAnswerPayload);
    }
  });

  assert.equal(answer.model, 'gemini-available-flash-lite');
  assert.ok(requestedUrls.some((url) => url.includes('gemini-available-flash-lite:generateContent')));
});