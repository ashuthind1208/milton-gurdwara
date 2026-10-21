export const STREAM_OVERLAY_VISIBILITY_KEY = 'ssm-stream-overlay-visible';
export const STREAM_OVERLAY_VISIBILITY_CHANNEL = 'ssm-stream-overlay-control';
const publisherChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(STREAM_OVERLAY_VISIBILITY_CHANNEL);

export const readStreamOverlayVisibility = () => {
  try {
    const value = window.localStorage.getItem(STREAM_OVERLAY_VISIBILITY_KEY);
    return value == null ? true : value !== '0';
  } catch {
    return true;
  }
};

export const publishStreamOverlayVisibility = (visible) => {
  const value = Boolean(visible);
  try { window.localStorage.setItem(STREAM_OVERLAY_VISIBILITY_KEY, value ? '1' : '0'); } catch { /* BroadcastChannel may still deliver the change. */ }
  publisherChannel?.postMessage({ visible: value });
};

export const subscribeStreamOverlayVisibility = (onChange) => {
  const handleStorage = (event) => {
    if (event.key === STREAM_OVERLAY_VISIBILITY_KEY && event.newValue != null) onChange(event.newValue !== '0');
  };
  window.addEventListener('storage', handleStorage);
  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(STREAM_OVERLAY_VISIBILITY_CHANNEL);
    channel.onmessage = (event) => { if (typeof event.data?.visible === 'boolean') onChange(event.data.visible); };
  }
  return () => { window.removeEventListener('storage', handleStorage); channel?.close(); };
};