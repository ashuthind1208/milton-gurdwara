import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const RESOURCE = 'sponsors';

const normalizeSponsor = (sponsor = {}, index = 0) => ({
  id: sponsor.id || `sponsor-${Date.now()}-${index}`,
  title: String(sponsor.title || '').trim(),
  bannerUrl: String(sponsor.bannerUrl || sponsor.imageUrl || '').trim(),
  createdAt: String(sponsor.createdAt || new Date().toISOString()),
  expiryDate: String(sponsor.expiryDate || ''),
  active: typeof sponsor.active === 'boolean' ? sponsor.active : true
});

const sponsorService = {
  getSponsors: async () => {
    try {
      const data = await contentApiService.list(RESOURCE);
      const normalized = (data || [])
        .map((entry, index) => normalizeSponsor(entry, index))
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

      return { data: normalized };
    } catch {
      return serviceResponse([]);
    }
  },

  createSponsor: async (payload) => {
    const record = normalizeSponsor({
      ...payload,
      id: `sponsor-${Date.now()}`,
      createdAt: payload?.createdAt || new Date().toISOString()
    });

    const created = await contentApiService.create(RESOURCE, record);
    return { data: normalizeSponsor(created || record) };
  },

  updateSponsor: async (id, payload) => {
    const updated = await contentApiService.update(RESOURCE, id, payload || {});
    return { data: normalizeSponsor(updated || { id, ...(payload || {}) }) };
  },

  removeSponsor: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return serviceResponse({ success: true });
  }
};

export default sponsorService;
