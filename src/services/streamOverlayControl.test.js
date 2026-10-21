import { publishStreamOverlayVisibility, readStreamOverlayVisibility, STREAM_OVERLAY_VISIBILITY_KEY, subscribeStreamOverlayVisibility } from './streamOverlayControl';

beforeEach(() => window.localStorage.clear());

test('stores and reads the overlay visibility preference', () => {
  expect(readStreamOverlayVisibility()).toBe(true);
  publishStreamOverlayVisibility(false);
  expect(window.localStorage.getItem(STREAM_OVERLAY_VISIBILITY_KEY)).toBe('0');
  expect(readStreamOverlayVisibility()).toBe(false);
});

test('notifies other same-origin tabs immediately about visibility changes', () => {
  const onChange = jest.fn();
  const unsubscribe = subscribeStreamOverlayVisibility(onChange);
  window.dispatchEvent(new StorageEvent('storage', { key: STREAM_OVERLAY_VISIBILITY_KEY, newValue: '0' }));
  expect(onChange).toHaveBeenCalledWith(false);
  unsubscribe();
});