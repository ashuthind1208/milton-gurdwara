import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-advertisements';

export const AD_PLACEMENT_OPTIONS = [
  'Global Banner',
  'Homepage Sidebar',
  'Homepage Footer',
  'Events Sidebar',
  'Seva Top Banner',
  'Seva Footer Banner',
  'Donation Top Banner',
  'Donation Footer Banner',
  'Library Top Banner',
  'Library Footer Banner',
  'Events Top Banner',
  'Events Footer Banner'
];

const seedAds = [
  {
    id: 'ad-1',
    title: 'Local Business Support',
    content: 'Support local advertisers who support the sangat.',
    website: '',
    imageUrl: '',
    bannerUrl: '',
    targetLink: '',
    placement: 'Homepage Sidebar',
    active: true
  }
];

const normalizeAd = (ad, index = 0) => ({
  id: ad.id || `ad-${Date.now()}-${index}`,
  title: ad.title || '',
  content: ad.content || '',
  website: ad.website || '',
  imageUrl: ad.imageUrl || '',
  bannerUrl: ad.bannerUrl || '',
  targetLink: ad.targetLink || ad.website || '',
  placement: ad.placement || 'Homepage Sidebar',
  active: typeof ad.active === 'boolean' ? ad.active : true
});

const readAds = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedAds.map(normalizeAd);
    }

    const parsed = JSON.parse(raw);
    return parsed.map((ad, index) => normalizeAd(ad, index));
  } catch {
    return seedAds.map(normalizeAd);
  }
};

const writeAds = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write failures in mock mode.
  }
};

const advertisementService = {
  getAds: async () => mockResponse(readAds()),
  createAd: async (payload) => {
    const record = normalizeAd({
      ...payload,
      id: `ad-${Date.now()}`
    });
    const next = [record, ...readAds()];
    writeAds(next);
    return mockResponse(record);
  },
  updateAd: async (id, payload) => {
    const next = readAds().map((ad) => (ad.id === id ? normalizeAd({ ...ad, ...payload, id }) : ad));
    writeAds(next);
    return mockResponse(next.find((ad) => ad.id === id));
  },
  removeAd: async (id) => {
    const next = readAds().filter((ad) => ad.id !== id);
    writeAds(next);
    return mockResponse({ success: true });
  }
};

export default advertisementService;
