import contentApiService from './contentApiService';
import { serviceResponse } from './serviceResponse';

const RESOURCE = 'led_board_announcements';

export const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeAnnouncement = (entry = {}) => ({
  id: String(entry.id || ''),
  type: entry.type === 'image' ? 'image' : 'text',
  title: String(entry.title || '').trim(),
  subtitle: String(entry.subtitle || '').trim(),
  details: String(entry.details || '').trim(),
  imageUrl: String(entry.imageUrl || '').trim(),
  eventDate: String(entry.eventDate || '').slice(0, 10),
  location: String(entry.location || '').trim(),
  displayUntil: String(entry.displayUntil || '').slice(0, 10),
  active: typeof entry.active === 'boolean' ? entry.active : true,
  createdAt: String(entry.createdAt || ''),
  updatedAt: String(entry.updatedAt || '')
});

// An announcement is shown only when it is switched on, has content for its type, and has not passed its display-until date.
export const isAnnouncementLive = (announcement, today = toLocalDateKey()) => {
  if (!announcement?.active) return false;
  const hasContent = announcement.type === 'image' ? Boolean(announcement.imageUrl) : Boolean(announcement.title);
  if (!hasContent) return false;
  return !announcement.displayUntil || announcement.displayUntil >= today;
};

const ledAnnouncementService = {
  getAnnouncements: async () => {
    const data = await contentApiService.list(RESOURCE);
    const normalized = (data || [])
      .map(normalizeAnnouncement)
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    return serviceResponse(normalized);
  },

  createAnnouncement: async (payload) => {
    const now = new Date().toISOString();
    const record = normalizeAnnouncement({ ...payload, id: `led-announcement-${Date.now()}`, createdAt: now, updatedAt: now });
    const created = await contentApiService.create(RESOURCE, record);
    return serviceResponse(normalizeAnnouncement(created || record));
  },

  updateAnnouncement: async (id, payload) => {
    const updated = await contentApiService.update(RESOURCE, id, { ...(payload || {}), updatedAt: new Date().toISOString() });
    return serviceResponse(normalizeAnnouncement(updated || { id, ...(payload || {}) }));
  },

  removeAnnouncement: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return serviceResponse({ success: true });
  }
};

export default ledAnnouncementService;
