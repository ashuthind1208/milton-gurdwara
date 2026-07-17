import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const RESOURCE = 'advertisements';
const VIEWER_ID_STORAGE_KEY = 'ssm_ad_viewer_id';
const AD_VIEW_LEDGER_STORAGE_KEY = 'ssm_ad_view_ledger';
const ORGANIC_VIEW_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ORGANIC_LEDGER_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const ORGANIC_LEDGER_MAX_ENTRIES = 500;

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
  bannerUrl: ad.bannerUrl || ad.imageUrl || '',
  targetLink: '',
  placement: ad.placement || 'Homepage Sidebar',
  active: typeof ad.active === 'boolean' ? ad.active : true,
  clickCount: Number(ad.clickCount || 0),
  clickHistory: Array.isArray(ad.clickHistory) ? ad.clickHistory : [],
  organicViewLedger: Array.isArray(ad.organicViewLedger) ? ad.organicViewLedger : []
});

const hashString = (value = '') => {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getOrganicViewerSignature = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'server-fallback';
  }

  const parts = [
    navigator.userAgent || '',
    navigator.platform || '',
    navigator.language || '',
    String(window.screen?.width || ''),
    String(window.screen?.height || ''),
    String(new Date().getTimezoneOffset())
  ];

  return `sig-${hashString(parts.join('|'))}`;
};

const canUseBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const getViewerId = () => {
  if (!canUseBrowserStorage()) {
    return '';
  }

  const existing = window.localStorage.getItem(VIEWER_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = `viewer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(VIEWER_ID_STORAGE_KEY, generated);
  return generated;
};

const readViewLedger = () => {
  if (!canUseBrowserStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(AD_VIEW_LEDGER_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeViewLedger = (ledger) => {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(AD_VIEW_LEDGER_STORAGE_KEY, JSON.stringify(ledger || {}));
  } catch {
    // Ignore storage write failures and continue without local dedup cache.
  }
};

const advertisementService = {
  getAds: async () => {
    try {
      const data = await contentApiService.list(RESOURCE);
      return { data: data.map((ad, index) => normalizeAd(ad, index)) };
    } catch {
      return serviceResponse([]);
    }
  },

  createAd: async (payload) => {
    const { imageUrl: _imageUrl, ...payloadWithoutImage } = payload || {};
    void _imageUrl;
    const record = normalizeAd({
      ...payloadWithoutImage,
      targetLink: '',
      clickCount: 0,
      clickHistory: [],
      id: `ad-${Date.now()}`
    });
    const created = await contentApiService.create(RESOURCE, record);
    return { data: normalizeAd(created || record) };
  },

  updateAd: async (id, payload) => {
    const { imageUrl: _imageUrl, ...payloadWithoutImage } = payload || {};
    void _imageUrl;
    const updated = await contentApiService.update(RESOURCE, id, {
      ...payloadWithoutImage,
      targetLink: ''
    });
    return { data: normalizeAd(updated || { id, ...payloadWithoutImage, targetLink: '' }) };
  },

  recordAdClick: async (id) => {
    if (!id) {
      return serviceResponse({ success: false });
    }

    const nowMs = Date.now();
    const viewerId = getViewerId();
    const ledger = readViewLedger();
    const adLedger = ledger[String(id)] || {};
    const lastCountedAt = Number(adLedger.lastCountedAt || 0);

    // Count only one organic view per device/browser for the same ad in a 24h window.
    if (lastCountedAt > 0 && (nowMs - lastCountedAt) < ORGANIC_VIEW_COOLDOWN_MS) {
      const ads = await contentApiService.list(RESOURCE);
      const current = (ads || []).find((entry) => String(entry.id) === String(id));
      return { data: normalizeAd(current || { id }) };
    }

    const ads = await contentApiService.list(RESOURCE);
    const current = (ads || []).find((entry) => String(entry.id) === String(id));
    if (!current) {
      return serviceResponse({ success: false });
    }

    const signature = getOrganicViewerSignature();
    const organicViewLedger = Array.isArray(current.organicViewLedger) ? current.organicViewLedger : [];
    const recentLedger = organicViewLedger
      .filter((entry) => {
        const stamp = new Date(entry?.at || '').getTime();
        return Number.isFinite(stamp) && (nowMs - stamp) <= ORGANIC_LEDGER_RETENTION_MS;
      })
      .slice(-ORGANIC_LEDGER_MAX_ENTRIES);
    const recentBySameSignature = recentLedger.find((entry) => (
      String(entry?.signature || '') === signature && (nowMs - new Date(entry.at).getTime()) < ORGANIC_VIEW_COOLDOWN_MS
    ));

    if (recentBySameSignature) {
      return { data: normalizeAd(current) };
    }

    const clickHistory = Array.isArray(current.clickHistory) ? current.clickHistory : [];
    const clickStamp = new Date(nowMs).toISOString();
    const payload = {
      clickCount: Number(current.clickCount || 0) + 1,
      clickHistory: [...clickHistory, clickStamp],
      organicViewLedger: [...recentLedger, { signature, at: clickStamp }].slice(-ORGANIC_LEDGER_MAX_ENTRIES)
    };

    const updated = await contentApiService.update(RESOURCE, id, payload);

    ledger[String(id)] = {
      lastCountedAt: nowMs,
      lastViewerId: viewerId,
      lastClickAt: clickStamp
    };
    writeViewLedger(ledger);

    return { data: normalizeAd(updated || { ...current, ...payload }) };
  },

  removeAd: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return serviceResponse({ success: true });
  }
};

export default advertisementService;
