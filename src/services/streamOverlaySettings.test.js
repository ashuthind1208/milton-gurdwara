import { DEFAULT_STREAM_OVERLAY_SETTINGS, getPublishedStreamOverlaySettings, publishStreamOverlaySettings, readStreamOverlaySettings, saveStreamOverlaySettings, STREAM_OVERLAY_SETTINGS_KEY, STREAM_OVERLAY_SETTINGS_URL } from './streamOverlaySettings';
import apiClient from './apiClient';

jest.mock('./apiClient', () => ({ put: jest.fn() }));

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
  expect(JSON.parse(storage.getItem(STREAM_OVERLAY_SETTINGS_KEY))).toEqual(changed);
  expect(readStreamOverlaySettings(storage)).toEqual(changed);
});

test('invalid saved JSON safely falls back to defaults and nested colors merge', () => {
  const storage = createStorage({ [STREAM_OVERLAY_SETTINGS_KEY]: '{broken' });
  expect(readStreamOverlaySettings(storage)).toEqual(DEFAULT_STREAM_OVERLAY_SETTINGS);
  storage.setItem(STREAM_OVERLAY_SETTINGS_KEY, JSON.stringify({ tickerColors: { upperbg: '#123456' } }));
  expect(readStreamOverlaySettings(storage).tickerColors).toEqual({ ...DEFAULT_STREAM_OVERLAY_SETTINGS.tickerColors, upperbg: '#123456' });
});

describe('published overlay settings', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = jest.fn(); });
  afterEach(() => { global.fetch = originalFetch; });

  test('reads fresh public settings without caching', async () => {
    const settings = { overlayHeaderMessage: 'Welcome' };
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: settings }) });
    await expect(getPublishedStreamOverlaySettings()).resolves.toEqual(settings);
    expect(global.fetch).toHaveBeenCalledWith(STREAM_OVERLAY_SETTINGS_URL, {
      cache: 'no-store', headers: { Accept: 'application/json' }
    });
  });

  test('rejects failed reads instead of replacing last-known settings', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(getPublishedStreamOverlaySettings()).rejects.toThrow('503');
  });

  test('publishes through the authenticated API client', async () => {
    apiClient.put.mockResolvedValue({ data: { data: DEFAULT_STREAM_OVERLAY_SETTINGS } });
    await expect(publishStreamOverlaySettings(DEFAULT_STREAM_OVERLAY_SETTINGS)).resolves.toEqual(DEFAULT_STREAM_OVERLAY_SETTINGS);
    expect(apiClient.put).toHaveBeenCalledWith('/stream-overlay/settings', DEFAULT_STREAM_OVERLAY_SETTINGS);
  });
});
