import contentApiService from './contentApiService';
import { serviceResponse } from './serviceResponse';

export const LANGAR_CONTRIBUTIONS_RESOURCE = 'langar_contributions';

const GROCERY_IMAGE_KEYWORDS = {
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=300&q=80',
  tomato: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=300&q=80',
  ginger: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=300&q=80',
  onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=300&q=80',
  potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=300&q=80',
  paneer: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=300&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80',
  flour: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80',
  atta: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80',
  lentil: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=300&q=80',
  daal: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=300&q=80',
  dal: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=300&q=80',
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
  sugar: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=300&q=80',
  tea: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?auto=format&fit=crop&w=300&q=80',
  yogurt: 'https://images.unsplash.com/photo-1571212515416-fca988083b40?auto=format&fit=crop&w=300&q=80',
  fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=300&q=80',
  vegetable: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=300&q=80'
};

export const resolveGroceryImage = (name = '') => {
  const query = String(name || '').trim().toLowerCase();
  if (!query) return '';
  const match = Object.entries(GROCERY_IMAGE_KEYWORDS).find(([key]) => query.includes(key));
  if (match) return match[1];
  return `https://loremflickr.com/300/300/${encodeURIComponent(query)},grocery`;
};

const normalizeContribution = (entry = {}) => ({
  id: String(entry.id || ''),
  itemId: String(entry.itemId || ''),
  itemName: String(entry.itemName || '').trim(),
  quantity: Math.max(0, Number(entry.quantity || 0)),
  unit: String(entry.unit || 'items').trim() || 'items',
  donorName: String(entry.anonymous ? 'Anonymous' : entry.donorName || 'Member').trim(),
  donorEmail: String(entry.donorEmail || '').trim().toLowerCase(),
  donorAvatarUrl: String(entry.donorAvatarUrl || '').trim(),
  anonymous: Boolean(entry.anonymous),
  expectedDeliveryDate: String(entry.expectedDeliveryDate || '').trim(),
  status: String(entry.status || 'pending').trim().toLowerCase(),
  createdAt: String(entry.createdAt || '').trim(),
  updatedAt: String(entry.updatedAt || '').trim()
});

const normalizeItem = (entry = {}) => ({
  ...entry,
  quantityRequired: Math.max(0, Number(entry.quantityRequired ?? 0)),
  quantityReceived: Math.max(0, Number(entry.quantityReceived ?? 0)),
  unit: String(entry.unit || 'items').trim() || 'items',
  imageUrl: String(entry.imageUrl || '').trim()
});

const langarService = {
  getContributions: async () => serviceResponse((await contentApiService.list(LANGAR_CONTRIBUTIONS_RESOURCE)).map(normalizeContribution)),
  createContribution: async (payload) => serviceResponse(normalizeContribution(await contentApiService.create(LANGAR_CONTRIBUTIONS_RESOURCE, {
    ...payload,
    id: `langar-contribution-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }))),
  deleteContribution: async (id) => serviceResponse(await contentApiService.remove(LANGAR_CONTRIBUTIONS_RESOURCE, id)),
  normalizeItem
};

export default langarService;
