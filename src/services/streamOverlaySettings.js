export const STREAM_OVERLAY_SETTINGS_KEY = 'ssm-stream-overlay-settings-v1';
export const DEFAULT_STREAM_OVERLAY_SETTINGS = Object.freeze({
  overlayOn: true, overlayLogo: true, overlayLanguages: 'gpe', overlayOpacity: 100,
  gurmukhiSize: 100, punjabiSize: 100, englishSize: 100, overlayAnnouncement: '',
  overlayHeaderMessage: '', headerSize: 100, headerPunjabiSize: 100, punjabiAnnouncement: '',
  headerPunjabi: '', upperEnglish: '', upperPunjabi: '', upperSpeed: 100, lowerSpeed: 100,
  tickerColors: {}, upperSize: 100, lowerSize: 100, overlayThemeId: 'brand-colors'
});

export const readStreamOverlaySettings = (storage = window.localStorage) => {
  try {
    const saved = JSON.parse(storage.getItem(STREAM_OVERLAY_SETTINGS_KEY) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...DEFAULT_STREAM_OVERLAY_SETTINGS };
    return { ...DEFAULT_STREAM_OVERLAY_SETTINGS, ...saved, tickerColors: { ...DEFAULT_STREAM_OVERLAY_SETTINGS.tickerColors, ...(saved.tickerColors || {}) } };
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