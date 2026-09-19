import contentApiService from './contentApiService';
import { serviceResponse } from './serviceResponse';

export const LANGAR_CONTRIBUTIONS_RESOURCE = 'langar_contributions';

const normalizeContribution = (entry = {}) => ({
  id: String(entry.id || ''),
  itemId: String(entry.itemId || ''),
  itemName: String(entry.itemName || '').trim(),
  quantity: Math.max(0, Number(entry.quantity || 0)),
  unit: String(entry.unit || 'items').trim() || 'items',
  donorName: String(entry.anonymous ? 'Anonymous' : entry.donorName || 'Member').trim(),
  donorEmail: String(entry.donorEmail || '').trim().toLowerCase(),
  anonymous: Boolean(entry.anonymous),
  expectedDeliveryDate: String(entry.expectedDeliveryDate || '').trim(),
  status: String(entry.status || 'pending').trim().toLowerCase(),
  createdAt: String(entry.createdAt || '').trim()
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
  normalizeItem
};

export default langarService;
