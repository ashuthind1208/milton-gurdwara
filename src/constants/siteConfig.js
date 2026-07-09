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
  liveKirtanStreamUrl:
    process.env.REACT_APP_DARBAR_SAHIB_STREAM_URL ||
    'https://live.sgpc.net:8442/;'
};

export const userRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VOLUNTEER_COORDINATOR: 'VOLUNTEER_COORDINATOR',
  FINANCE: 'FINANCE'
};
