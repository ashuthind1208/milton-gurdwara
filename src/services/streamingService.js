import { mockResponse } from './mockApi';
import { siteConfig } from '../constants/siteConfig';
import { getYouTubeEmbedUrl } from './videoService';
import contentApiService from './contentApiService';

const RESOURCE = 'streaming_configs';

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

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
};

const normalizeStreaming = (streaming = {}, index = 0) => ({
  id: String(streaming.id || `stream-${Date.now()}-${index}`),
  title: String(streaming.title ?? streaming.stream_title ?? defaultStreaming.title),
  text: String(streaming.text ?? streaming.stream_text ?? defaultStreaming.text),
  streamUrl: String(streaming.streamUrl ?? streaming.stream_url ?? defaultStreaming.streamUrl),
  active: normalizeBoolean(streaming.active, defaultStreaming.active),
  updatedAt: String(streaming.updatedAt ?? streaming.updated_at ?? new Date().toISOString()),
  checkedAt: String(streaming.checkedAt ?? streaming.checked_at ?? '')
});

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

const ensureSeedStreaming = async () => {
  const rows = await contentApiService.list(RESOURCE);
  if (rows.length > 0) {
    return rows.map((row, index) => normalizeStreaming(row, index));
  }

  await contentApiService.create(RESOURCE, normalizeStreaming(defaultStreaming));
  const seeded = await contentApiService.list(RESOURCE);
  return seeded.map((row, index) => normalizeStreaming(row, index));
};

export const verifyStreamingAvailability = async (streaming) => {
  const list = streaming ? [streaming] : await ensureSeedStreaming();
  const normalized = normalizeStreaming(list[0]);
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
  getStreamingItems: async () => {
    const rows = await ensureSeedStreaming();
    return mockResponse(rows.map((row, index) => normalizeStreaming(row, index)));
  },

  getStreaming: async () => {
    const rows = await ensureSeedStreaming();
    return mockResponse(rows.find((entry) => entry.active) || rows[0] || null);
  },

  addStreaming: async (payload) => {
    const record = normalizeStreaming({ ...payload, id: `stream-${Date.now()}`, updatedAt: new Date().toISOString() });
    await contentApiService.create(RESOURCE, record);
    const rows = await contentApiService.list(RESOURCE);
    return mockResponse(rows.map((row, index) => normalizeStreaming(row, index)));
  },

  updateStreaming: async (id, payload) => {
    const rows = await contentApiService.list(RESOURCE);
    const existing = rows.find((entry) => entry.id === id) || { id };
    const updated = normalizeStreaming({ ...existing, ...payload, id, updatedAt: new Date().toISOString() });
    await contentApiService.update(RESOURCE, id, updated);
    const next = await contentApiService.list(RESOURCE);
    return mockResponse(next.map((row, index) => normalizeStreaming(row, index)));
  },

  removeStreaming: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    const rows = await contentApiService.list(RESOURCE);
    return mockResponse(rows.map((row, index) => normalizeStreaming(row, index)));
  },

  setStreamingActive: async (idOrActive, activeValue) => {
    const rows = await ensureSeedStreaming();
    if (rows.length === 0) {
      return mockResponse([]);
    }

    let targetId = '';
    let nextActive = false;

    if (typeof idOrActive === 'boolean') {
      const target = rows.find((entry) => entry.active) || rows[0];
      targetId = target?.id || '';
      nextActive = idOrActive;
    } else {
      targetId = String(idOrActive || '');
      nextActive = Boolean(activeValue);
    }

    const target = rows.find((entry) => entry.id === targetId);
    if (!target) {
      return mockResponse(rows);
    }

    await contentApiService.update(RESOURCE, targetId, {
      ...target,
      active: nextActive,
      updatedAt: new Date().toISOString()
    });

    const next = await contentApiService.list(RESOURCE);
    return mockResponse(next.map((row, index) => normalizeStreaming(row, index)));
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
