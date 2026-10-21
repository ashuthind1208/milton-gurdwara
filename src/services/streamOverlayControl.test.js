import { publishStreamOverlayVisibility, readStreamOverlayVisibility, STREAM_OVERLAY_VISIBILITY_KEY, subscribeStreamOverlayVisibility } from './streamOverlayControl';

beforeEach(() => window.localStorage.clear());

test('stores and reads overlay visibility preference', () => {
  expect(readStreamOverlayVisibility()).toBe(true);
  publishStreamOverlayVisibility(false);
  expect(window.localStorage.getItem(STREAM_OVERLAY_VISIBILITY_KEY)).toBe('0');
  expect(readStreamOverlayVisibility()).toBe(false);
  publishStreamOverlayVisibility(true);
  expect(readStreamOverlayVisibility()).toBe(true);
});

test('notifies a same-origin browser source immediately when admin visibility changes', () => {
  const callback = jest.fn();
  const unsubscribe = subscribeStreamOverlayVisibility(callback);
  window.dispatchEvent(new StorageEvent('storage', { key: STREAM_OVERLAY_VISIBILITY_KEY, newValue: '0' }));
  expect(callback).toHaveBeenCalledWith(false);
  window.dispatchEvent(new StorageEvent('storage', { key: STREAM_OVERLAY_VISIBILITY_KEY, newValue: '1' }));
  expect(callback).toHaveBeenCalledWith(true);
  unsubscribe();
});
