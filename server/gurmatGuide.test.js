const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TRUSTED_GURBANI_LINES,
  createGurmatGuide,
  normalizeWordInput,
  validateGeneratedGuide
} = require('./gurmatGuide');

test('normalizes a valid English or Gurmukhi word', () => {
  assert.equal(normalizeWordInput('  Selfless   service  '), 'Selfless service');
  assert.equal(normalizeWordInput('ਸੇਵਾ'), 'ਸੇਵਾ');
});

test('rejects markup and oversized input', () => {
  assert.throws(() => normalizeWordInput('<script>'), /letters/);
  assert.throws(() => normalizeWordInput('a'.repeat(41)), /2 and 40/);
});

test('always replaces model scripture with the trusted line selected by ID', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      message: {
        content: JSON.stringify({
          gurbaniId: 'hukam',
          gurbani: 'fabricated model line',
          wordPunjabi: 'ਸੇਵਾ',
          wordTransliteration: 'Seva',
          wordEnglish: 'Selfless service',
          meaningEnglish: 'Helping without expecting a reward.',
          meaningPunjabi: 'ਬਿਨਾਂ ਫਲ ਦੀ ਆਸ ਤੋਂ ਮਦਦ ਕਰਨੀ।',
          importanceEnglish: 'It helps us care for everyone.',
          importancePunjabi: 'ਇਹ ਸਾਨੂੰ ਸਭ ਦੀ ਸੰਭਾਲ ਕਰਨੀ ਸਿਖਾਉਂਦੀ ਹੈ।',
          reflectionQuestion: 'How can you help someone today?'
        })
      }
    })
  });

  const guide = await createGurmatGuide('Seva', { fetchImpl, timeoutMs: 100 });
  const trustedHukam = TRUSTED_GURBANI_LINES.find((line) => line.id === 'hukam');

  assert.equal(guide.gurbani.gurmukhi, trustedHukam.gurmukhi);
  assert.equal(guide.gurbani.source, trustedHukam.source);
  assert.equal(Object.hasOwn(guide, 'gurbaniLine'), false);
});

test('rejects generated lessons without Gurmukhi teaching fields', () => {
  assert.throws(() => validateGeneratedGuide({
    gurbaniId: 'hukam',
    wordPunjabi: 'Daya',
    wordEnglish: 'Compassion',
    meaningEnglish: 'Caring for others.',
    meaningPunjabi: 'Punjabi missing',
    importanceEnglish: 'It helps everyone.',
    importancePunjabi: 'Punjabi missing'
  }), /reliable bilingual lesson/);
});

test('uses the Gemini API without placing the key in the URL', async () => {
  let capturedUrl = '';
  let capturedHeaders = {};
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                gurbaniId: 'aad-sach',
                wordPunjabi: 'ਸੱਚ',
                wordTransliteration: 'Sach',
                wordEnglish: 'Truth',
                meaningEnglish: 'Being honest and real.',
                meaningPunjabi: 'ਇਮਾਨਦਾਰ ਅਤੇ ਸੱਚਾ ਹੋਣਾ।',
                importanceEnglish: 'Truth builds trust.',
                importancePunjabi: 'ਸੱਚ ਭਰੋਸਾ ਬਣਾਉਂਦਾ ਹੈ।',
                reflectionQuestion: 'How can you practice truth today?'
              })
            }]
          }
        }]
      })
    };
  };

  const guide = await createGurmatGuide('Truth', {
    provider: 'gemini',
    apiKey: 'test-secret',
    fetchImpl,
    timeoutMs: 100
  });

  assert.equal(guide.provider, 'gemini');
  assert.equal(capturedUrl.includes('test-secret'), false);
  assert.equal(capturedHeaders['x-goog-api-key'], 'test-secret');
  assert.equal(guide.gurbani.id, 'aad-sach');
});