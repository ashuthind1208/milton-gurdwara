import apiClient from './apiClient';

export const STREAM_OVERLAY_SETTINGS_KEY = 'ssm-stream-overlay-settings-v1';
export const STREAM_OVERLAY_SETTINGS_URL = '/api/stream-overlay/settings';

export const DEFAULT_STREAM_OVERLAY_SETTINGS = Object.freeze({
  overlayOn: true,
  overlayLogo: true,
  overlayLanguages: 'gpe',
  overlayOpacity: 100,
  gurmukhiSize: 100,
  punjabiSize: 100,
  englishSize: 100,
  overlayAnnouncement: '',
  overlayHeaderMessage: '',
  headerSize: 100,
  headerPunjabiSize: 100,
  punjabiAnnouncement: '',
  headerPunjabi: '',
  upperEnglish: '',
  upperPunjabi: '',
  upperSpeed: 100,
  lowerSpeed: 100,
  tickerColors: { upperbg: '#004080', upperfg: '#ffffff', lowerbg: '#F89820', lowerfg: '#004080' },
  upperSize: 100,
  lowerSize: 100,
  overlayThemeId: 'brand-colors'
});

export const readStreamOverlaySettings = (storage = window.localStorage) => {
  try {
    const saved = JSON.parse(storage.getItem(STREAM_OVERLAY_SETTINGS_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...DEFAULT_STREAM_OVERLAY_SETTINGS };
    return {
      ...DEFAULT_STREAM_OVERLAY_SETTINGS,
      ...saved,
      tickerColors: { ...DEFAULT_STREAM_OVERLAY_SETTINGS.tickerColors, ...(saved.tickerColors || {}) }
    };
  } catch {
    return { ...DEFAULT_STREAM_OVERLAY_SETTINGS };
  }
};

export const saveStreamOverlaySettings = (settings, storage = window.localStorage) => {
  try {
    storage.setItem(STREAM_OVERLAY_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
};

export const getPublishedStreamOverlaySettings = async () => {
  const response = await fetch(STREAM_OVERLAY_SETTINGS_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Overlay settings request failed (${response.status}).`);
  const payload = await response.json();
  return payload?.data && typeof payload.data === 'object' ? payload.data : {};
};

export const publishStreamOverlaySettings = async (settings) => {
  const response = await apiClient.put('/stream-overlay/settings', settings);
  return response.data?.data || settings;
};
