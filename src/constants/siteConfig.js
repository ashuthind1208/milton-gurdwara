const sanitizeStreamUrl = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/[;\s]+$/, '');
};

const darbarSahibStreamProxyUrl = '/api/streaming/darbar-sahib/audio';

const normalizeDarbarSahibStreamUrl = (value = '') => {
  const sanitized = sanitizeStreamUrl(value);
  if (!sanitized) {
    return darbarSahibStreamProxyUrl;
  }

  if (sanitized.startsWith('/api/streaming/darbar-sahib/')) {
    return darbarSahibStreamProxyUrl;
  }

  if (/live\.sgpc\.net|sgpc\.net/i.test(sanitized)) {
    return darbarSahibStreamProxyUrl;
  }

  return sanitized;
};

export const siteConfig = {
  name: 'Singh Sabha Milton Gurdwara',
  shortName: 'Singh Sabha Milton',
  baseUrl: 'https://singhsabhamilton.com',
  description:
    'A digital sangat platform for events, seva, education, daily hukamnama, and online donations.',
  contact: {
    phone: '+1 (905) 546-7035',
    email: 'singhsabhamilton@gmail.com',
    address: '7035 Sixth Line, Milton ON'
  },
  social: {
    youtube: 'https://www.youtube.com/@SinghSabhaMilton',
    facebook: 'https://facebook.com/singhsabhamilton',
    instagram: 'https://www.instagram.com/miltongurdwara/'
  },
  liveKirtanStreamUrl: normalizeDarbarSahibStreamUrl(
    process.env.REACT_APP_DARBAR_SAHIB_STREAM_URL ||
    darbarSahibStreamProxyUrl
  ),
  calendarSourceUrl: String(
    process.env.REACT_APP_SIKHNET_GURPURAB_CALENDAR_URL ||
    'https://sikhnet.com/pages/sikh-gurpurab-calendar'
  ).trim()
};

export const userRoles = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  FAMILY: 'Family',
  MEMBER: 'Member',
  VOLUNTEER: 'Volunteer'
};
