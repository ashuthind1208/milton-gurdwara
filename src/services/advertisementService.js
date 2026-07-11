import { mockResponse } from './mockApi';
import contentApiService from './contentApiService';

const RESOURCE = 'advertisements';

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

const advertisementService = {
  getAds: async () => {
    try {
      const data = await contentApiService.list(RESOURCE);
      return { data: data.map((ad, index) => normalizeAd(ad, index)) };
    } catch {
      return mockResponse([]);
    }
  },

  createAd: async (payload) => {
    const record = normalizeAd({ ...payload, id: `ad-${Date.now()}` });
    const created = await contentApiService.create(RESOURCE, record);
    return { data: normalizeAd(created || record) };
  },

  updateAd: async (id, payload) => {
    const updated = await contentApiService.update(RESOURCE, id, payload);
    return { data: normalizeAd(updated || { id, ...payload }) };
  },

  removeAd: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return mockResponse({ success: true });
  }
};

export default advertisementService;
