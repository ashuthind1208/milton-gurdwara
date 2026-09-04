const BRANDING_RESOURCE = 'gurdwara_branding';
const LEGACY_BRANDING_RESOURCE = 'ask_granthi_branding';

const DEFAULT_GURDWARA_BRANDING = Object.freeze({
  organizationName: 'Gurdwara Singh Sabha Milton',
  shortName: 'Singh Sabha Milton',
  logoUrl: '',
  primaryColor: '#0B4EA2',
  accentColor: '#F4A300',
  surfaceColor: '#FFF8E8'
});

const getGurdwaraBranding = async (db) => {
  const stored = await db.getSingleton(BRANDING_RESOURCE, null);
  if (stored) {
    return { ...DEFAULT_GURDWARA_BRANDING, ...stored };
  }

  const legacy = await db.getSingleton(LEGACY_BRANDING_RESOURCE, null);
  const { productName, ...legacyBranding } = legacy || {};
  return {
    ...DEFAULT_GURDWARA_BRANDING,
    ...legacyBranding,
    shortName: String(legacy?.shortName || legacy?.organizationName || DEFAULT_GURDWARA_BRANDING.shortName).trim(),
  };
};

const saveGurdwaraBranding = async (db, branding) => db.setSingleton(BRANDING_RESOURCE, {
  ...DEFAULT_GURDWARA_BRANDING,
  ...branding,
  updatedAt: new Date().toISOString()
});

module.exports = {
  BRANDING_RESOURCE,
  DEFAULT_GURDWARA_BRANDING,
  getGurdwaraBranding,
  saveGurdwaraBranding
};