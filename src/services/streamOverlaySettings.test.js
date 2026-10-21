import { DEFAULT_STREAM_OVERLAY_SETTINGS, readStreamOverlaySettings, saveStreamOverlaySettings, STREAM_OVERLAY_SETTINGS_KEY } from './streamOverlaySettings';

const createStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test('loads defaults and persists overlay settings across reloads', () => {
  const storage = createStorage();
  expect(readStreamOverlaySettings(storage)).toEqual(DEFAULT_STREAM_OVERLAY_SETTINGS);
  const changed = { ...DEFAULT_STREAM_OVERLAY_SETTINGS, upperEnglish: 'Welcome sangat', upperSpeed: 42, overlayOpacity: 68 };
  expect(saveStreamOverlaySettings(changed, storage)).toBe(true);
  expect(readStreamOverlaySettings(storage)).toEqual(changed);
});

test('invalid saved JSON falls back safely and nested ticker colors merge', () => {
  const storage = createStorage({ [STREAM_OVERLAY_SETTINGS_KEY]: '{broken' });
  expect(readStreamOverlaySettings(storage)).toEqual(DEFAULT_STREAM_OVERLAY_SETTINGS);
  storage.setItem(STREAM_OVERLAY_SETTINGS_KEY, JSON.stringify({ tickerColors: { upperbg: '#123456' } }));
  expect(readStreamOverlaySettings(storage).tickerColors).toEqual({ upperbg: '#123456' });
});