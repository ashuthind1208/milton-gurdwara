import { mockResponse } from './mockApi';
import contentApiService from './contentApiService';

const RESOURCE = 'videos';

const defaultVideos = [
  {
    id: 'vid-1',
    title: 'Sunday Samagam - July 6, 2026',
    description: 'Full recording of Sukhmani Sahib Paath, Kirtan, Katha, and Ardaas from the Sunday diwan.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'youtube',
    category: 'Samagam',
    thumbnailUrl: '',
    featuredDate: '2026-07-06',
    featured: true,
    tags: 'samagam, sunday, kirtan',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'vid-2',
    title: 'Youth Kirtan Darbar - June 2026',
    description: 'Youth sangat performing shabad kirtan at the monthly youth program.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'youtube',
    category: 'Youth',
    thumbnailUrl: '',
    featuredDate: '2026-06-15',
    featured: false,
    tags: 'youth, kirtan',
    updatedAt: new Date().toISOString()
  }
];

const PLATFORMS = ['youtube', 'facebook', 'other'];
const CATEGORIES = ['Samagam', 'Kirtan', 'Katha', 'Special', 'Youth', 'General'];

export { CATEGORIES };

const normalizeVideo = (video = {}, index = 0) => ({
  id: video.id || `vid-${Date.now()}-${index}`,
  title: video.title || '',
  description: video.description || '',
  videoUrl: video.videoUrl || '',
  platform: PLATFORMS.includes(video.platform) ? video.platform : detectPlatform(video.videoUrl || ''),
  category: video.category || 'General',
  thumbnailUrl: video.thumbnailUrl || '',
  featuredDate: video.featuredDate || new Date().toISOString().slice(0, 10),
  featured: Boolean(video.featured),
  tags: video.tags || '',
  updatedAt: video.updatedAt || new Date().toISOString()
});

function detectPlatform(url) {
  if (!url) {
    return 'other';
  }

  if (/youtube\.com|youtu\.be/.test(url)) {
    return 'youtube';
  }

  if (/facebook\.com|fb\.watch/.test(url)) {
    return 'facebook';
  }

  return 'other';
}

export function getYouTubeEmbedUrl(url) {
  if (!url) {
    return '';
  }

  const input = String(url).trim();

  if (input.includes('youtube.com/embed/')) {
    return input;
  }

  const channelIdMatch = input.match(/(?:youtube\.com\/channel\/)?(UC[A-Za-z0-9_-]{20,})/i);
  if (channelIdMatch?.[1]) {
    return `https://www.youtube.com/embed/live_stream?channel=${channelIdMatch[1]}`;
  }

  const shortMatch = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }

  const shortsMatch = input.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) {
    return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  }

  const liveMatch = input.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/);
  if (liveMatch) {
    return `https://www.youtube.com/embed/${liveMatch[1]}`;
  }

  const watchMatch = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  return '';
}

export function getYouTubeThumbnail(url) {
  const embedUrl = getYouTubeEmbedUrl(url);
  if (!embedUrl) {
    return '';
  }

  const idMatch = embedUrl.match(/embed\/([A-Za-z0-9_-]{11})/);
  return idMatch ? `https://img.youtube.com/vi/${idMatch[1]}/hqdefault.jpg` : '';
}

export function getFacebookEmbedUrl(url) {
  if (!url) {
    return '';
  }

  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=1280&height=720`;
}

const ensureSeedVideos = async () => {
  const rows = await contentApiService.list(RESOURCE);
  if (rows.length > 0) {
    return rows;
  }

  await Promise.all(defaultVideos.map((video, index) => contentApiService.create(RESOURCE, normalizeVideo(video, index))));
  return contentApiService.list(RESOURCE);
};

const videoService = {
  getVideos: async () => {
    const rows = await ensureSeedVideos();
    return mockResponse(rows.map((v, i) => normalizeVideo(v, i)));
  },

  addVideo: async (payload) => {
    const record = normalizeVideo({
      ...payload,
      id: `vid-${Date.now()}`,
      platform: detectPlatform(payload?.videoUrl || ''),
      updatedAt: new Date().toISOString()
    });

    const created = await contentApiService.create(RESOURCE, record);
    const allRows = await contentApiService.list(RESOURCE);
    return mockResponse([normalizeVideo(created || record), ...allRows.filter((v) => v.id !== (created || record).id).map(normalizeVideo)]);
  },

  updateVideo: async (id, payload) => {
    const currentRows = await contentApiService.list(RESOURCE);
    const existing = currentRows.find((v) => v.id === id) || { id };
    const updatedPayload = normalizeVideo({
      ...existing,
      ...payload,
      id,
      platform: detectPlatform(payload?.videoUrl || existing.videoUrl || ''),
      updatedAt: new Date().toISOString()
    });

    await contentApiService.update(RESOURCE, id, updatedPayload);
    const rows = await contentApiService.list(RESOURCE);
    return mockResponse(rows.map((v, i) => normalizeVideo(v, i)));
  },

  removeVideo: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    const rows = await contentApiService.list(RESOURCE);
    return mockResponse(rows.map((v, i) => normalizeVideo(v, i)));
  }
};

export default videoService;
