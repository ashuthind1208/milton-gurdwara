import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-gurdwara-videos';

const defaultVideos = [
  {
    id: 'vid-1',
    title: 'Sunday Samagam — July 6, 2026',
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
    title: 'Youth Kirtan Darbar — June 2026',
    description: 'Youth sangat performing shabad kirtan at the monthly youth program.',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'youtube',
    category: 'Youth',
    thumbnailUrl: '',
    featuredDate: '2026-06-15',
    featured: false,
    tags: 'youth, kirtan',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'vid-3',
    title: 'Akhand Paath Bhog — Gurpurab 2026',
    description: 'Bhog of Akhand Paath Sahib held at Singh Sabha Milton on the occasion of Gurpurab.',
    videoUrl: 'https://www.facebook.com/singhsabhamilton/videos/sample',
    platform: 'facebook',
    category: 'Special',
    thumbnailUrl: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=640&q=70',
    featuredDate: '2026-05-20',
    featured: false,
    tags: 'akhand paath, gurpurab',
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

  // Already an embed URL.
  if (url.includes('youtube.com/embed/')) {
    return url;
  }

  // Short URL: youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }

  // Shorts: youtube.com/shorts/ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shortsMatch) {
    return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  }

  // Live: youtube.com/live/ID
  const liveMatch = url.match(/youtube\.com\/live\/([A-Za-z0-9_-]{11})/);
  if (liveMatch) {
    return `https://www.youtube.com/embed/${liveMatch[1]}`;
  }

  // Standard watch?v=ID
  const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
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

const readVideos = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultVideos.map((v, i) => normalizeVideo(v, i));
    }

    return JSON.parse(raw).map((v, i) => normalizeVideo(v, i));
  } catch {
    return defaultVideos.map((v, i) => normalizeVideo(v, i));
  }
};

const persistVideos = (videos) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch {
    // Ignore storage errors.
  }

  return videos;
};

const videoService = {
  getVideos: async () => mockResponse(readVideos()),

  addVideo: async (payload) => {
    const current = readVideos();
    const next = [
      normalizeVideo({
        ...payload,
        id: `vid-${Date.now()}`,
        platform: detectPlatform(payload.videoUrl || ''),
        updatedAt: new Date().toISOString()
      }),
      ...current
    ];

    return mockResponse(persistVideos(next));
  },

  updateVideo: async (id, payload) => {
    const current = readVideos();
    const next = current.map((v) => (
      v.id === id
        ? normalizeVideo({
            ...v,
            ...payload,
            id,
            platform: detectPlatform(payload.videoUrl || v.videoUrl),
            updatedAt: new Date().toISOString()
          })
        : v
    ));

    return mockResponse(persistVideos(next));
  },

  removeVideo: async (id) => {
    const next = readVideos().filter((v) => v.id !== id);
    return mockResponse(persistVideos(next));
  }
};

export default videoService;
