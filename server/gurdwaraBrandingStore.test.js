const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_GURDWARA_BRANDING, getGurdwaraBranding, saveGurdwaraBranding } = require('./gurdwaraBrandingStore');

const createDb = (singletons = {}) => ({
  getSingleton: async (resource, fallback) => singletons[resource] || fallback,
  setSingleton: async (resource, value) => {
    singletons[resource] = value;
    return value;
  }
});

test('returns default Gurdwara branding', async () => {
  assert.deepEqual(await getGurdwaraBranding(createDb()), DEFAULT_GURDWARA_BRANDING);
});

test('preserves branding saved under the former Ask a Granthi key', async () => {
  const branding = await getGurdwaraBranding(createDb({
    ask_granthi_branding: {
      organizationName: 'Another Gurdwara',
      logoUrl: '/uploads/logo.png',
      primaryColor: '#123456'
    }
  }));

  assert.equal(branding.organizationName, 'Another Gurdwara');
  assert.equal(branding.shortName, 'Another Gurdwara');
  assert.equal(branding.logoUrl, '/uploads/logo.png');
  assert.equal(branding.primaryColor, '#123456');
  assert.equal(Object.hasOwn(branding, 'productName'), false);
});

test('saves branding under the application-wide resource', async () => {
  const singletons = {};
  const saved = await saveGurdwaraBranding(createDb(singletons), {
    organizationName: 'Test Gurdwara',
    shortName: 'Test',
    logoUrl: '',
    primaryColor: '#112233',
    accentColor: '#445566',
    surfaceColor: '#778899'
  });

  assert.equal(singletons.gurdwara_branding, saved);
  assert.equal(saved.organizationName, 'Test Gurdwara');
  assert.ok(saved.updatedAt);
});