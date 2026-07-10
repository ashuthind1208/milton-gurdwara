import { mockResponse } from './mockApi';
import { siteConfig } from '../constants/siteConfig';
import { getYouTubeEmbedUrl } from './videoService';

const STORAGE_KEY = 'ssm-streaming-config';

const defaultStreaming = {
  id: 'stream-1',
  title: 'Live Streaming',
  text: 'YouTube live stream for sangat',
  streamUrl: siteConfig.social.youtube,
  active: Boolean(siteConfig.social.youtube),
  updatedAt: new Date().toISOString(),
  checkedAt: new Date().toISOString()
};

const isYouTubeSource = (value = '') => /youtube\.com|youtu\.be|^@|\bUC[A-Za-z0-9_-]{20,}\b/i.test(String(value || '').trim());

const normalizeStreaming = (streaming = {}, index = 0) => ({
  id: streaming.id || `stream-${Date.now()}-${index}`,
  title: streaming.title || defaultStreaming.title,
  text: streaming.text || defaultStreaming.text,
  streamUrl: streaming.streamUrl || defaultStreaming.streamUrl,
  active: Boolean(streaming.active ?? defaultStreaming.active),
  updatedAt: streaming.updatedAt || new Date().toISOString(),
  checkedAt: streaming.checkedAt || ''
});

const readStreamingItems = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [normalizeStreaming(defaultStreaming, 0)];
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry, index) => normalizeStreaming(entry, index));
    }

    return [normalizeStreaming(parsed, 0)];
  } catch {
    return [normalizeStreaming(defaultStreaming, 0)];
  }
};

const writeStreamingItems = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }

  return records;
};

const resolveEmbedUrl = (streamUrl) => getYouTubeEmbedUrl(streamUrl) || String(streamUrl || '');

const resolveYouTubeLive = async (sourceUrl) => {
  const response = await fetch(`/api/streaming/youtube/live?source=${encodeURIComponent(String(sourceUrl || ''))}`);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.ok) {
    return {
      available: false,
      checkedAt: new Date().toISOString(),
      reason: payload?.message || 'lookup_failed',
      embedUrl: ''
    };
  }

  return {
    available: Boolean(payload.data?.available),
    checkedAt: payload.data?.checkedAt || new Date().toISOString(),
    reason: payload.data?.reason || '',
    embedUrl: payload.data?.embedUrl || '',
    watchUrl: payload.data?.watchUrl || '',
    channelId: payload.data?.channelId || '',
    videoId: payload.data?.videoId || '',
    title: payload.data?.title || '',
    channelTitle: payload.data?.channelTitle || '',
    concurrentViewers: payload.data?.concurrentViewers ?? null,
    totalViews: payload.data?.totalViews ?? null
  };
};

export const verifyStreamingAvailability = async (streaming = readStreamingItems()[0]) => {
  const normalized = normalizeStreaming(streaming);
  if (!normalized.active || !normalized.streamUrl) {
    return { available: false, checkedAt: new Date().toISOString(), reason: 'inactive' };
  }

  if (isYouTubeSource(normalized.streamUrl)) {
    return resolveYouTubeLive(normalized.streamUrl);
  }

  const embedUrl = resolveEmbedUrl(normalized.streamUrl);

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    await fetch(normalized.streamUrl, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    window.clearTimeout(timer);
    return { available: true, checkedAt: new Date().toISOString(), embedUrl };
  } catch {
    return { available: Boolean(embedUrl), checkedAt: new Date().toISOString(), embedUrl, reason: 'unreachable' };
  }
};

const streamingService = {
  getStreamingItems: async () => mockResponse(readStreamingItems()),
  getStreaming: async () => {
    const items = readStreamingItems();
    return mockResponse(items.find((entry) => entry.active) || items[0] || null);
  },
  addStreaming: async (payload) => {
    const items = readStreamingItems();
    const nextItem = normalizeStreaming({
      ...payload,
      id: `stream-${Date.now()}`,
      updatedAt: new Date().toISOString()
    });
    return mockResponse(writeStreamingItems([nextItem, ...items]));
  },
  updateStreaming: async (id, payload) => {
    const items = readStreamingItems();
    const next = items.map((entry, index) => (
      entry.id === id
        ? normalizeStreaming({
            ...entry,
            ...payload,
            id,
            updatedAt: new Date().toISOString()
          }, index)
        : entry
    ));
    return mockResponse(writeStreamingItems(next));
  },
  removeStreaming: async (id) => {
    const next = readStreamingItems().filter((entry) => entry.id !== id);
    return mockResponse(writeStreamingItems(next));
  },
  setStreamingActive: async (idOrActive, activeValue) => {
    const items = readStreamingItems();
    if (items.length === 0) {
      return mockResponse([]);
    }

    let targetId = '';
    let nextActive = false;

    if (typeof idOrActive === 'boolean') {
      const target = items.find((entry) => entry.active) || items[0];
      targetId = target?.id || '';
      nextActive = idOrActive;
    } else {
      targetId = String(idOrActive || '');
      nextActive = Boolean(activeValue);
    }

    const next = items.map((entry, index) => (
      entry.id === targetId
        ? normalizeStreaming({
            ...entry,
            active: nextActive,
            updatedAt: new Date().toISOString()
          }, index)
        : entry
    ));

    return mockResponse(writeStreamingItems(next));
  },
  saveStreaming: async (payload) => {
    if (payload?.id) {
      return streamingService.updateStreaming(payload.id, payload);
    }
    return streamingService.addStreaming(payload);
  },
  verifyStreamingAvailability
};

export const getStreamingEmbedUrl = resolveEmbedUrl;

export const resolveStreamingLive = async (sourceUrl) => resolveYouTubeLive(sourceUrl);

export default streamingService;