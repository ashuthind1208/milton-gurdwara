import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-gallery-albums';

const normalizeDriveUrl = (url) => {
  const value = String(url);

  const fileMatch = value.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }

  const openMatch = value.match(/[?&]id=([^&]+)/);
  if (openMatch && value.includes('drive.google.com')) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }

  return value;
};

const normalizeDropboxUrl = (url) => {
  const value = String(url);
  if (!value.includes('dropbox.com')) {
    return value;
  }
  return value.replace('?dl=0', '?raw=1').replace('&dl=0', '&raw=1');
};

const normalizeUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const withProtocol = raw.startsWith('www.') ? `https://${raw}` : raw;
  return normalizeDropboxUrl(normalizeDriveUrl(withProtocol));
};

const normalizeFolderUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  return raw.startsWith('www.') ? `https://${raw}` : raw;
};

const normalizeBool = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return fallback;
};

const getDriveFolderEmbedUrl = (folderUrl) => {
  const value = String(folderUrl || '');
  const folderMatch = value.match(/drive\.google\.com\/drive\/folders\/([^/?]+)/);
  if (!folderMatch) {
    return '';
  }

  return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
};

const getDropboxFolderEmbedUrl = (folderUrl) => {
  const value = String(folderUrl || '');
  if (!/dropbox\.com\//.test(value)) {
    return '';
  }

  try {
    const parsed = new URL(value);
    parsed.searchParams.set('raw', '1');
    parsed.searchParams.set('preview', '1');
    return parsed.toString();
  } catch {
    return value;
  }
};

const isFolderLikeUrl = (url) => {
  const value = String(url || '');
  return (
    /drive\.google\.com\/drive\/folders\//.test(value)
    || /dropbox\.com\/.+\/(sh|scl\/fo)\//.test(value)
    || /onedrive\.live\.com\/.+/.test(value)
  );
};

const normalizeImage = (image, index) => {
  if (typeof image === 'string') {
    return {
      id: `img-${Date.now()}-${index}`,
      url: normalizeUrl(image),
      caption: ''
    };
  }

  return {
    id: image.id || `img-${Date.now()}-${index}`,
    url: normalizeUrl(image.url || image.imageUrl || image.link || image.src || ''),
    caption: image.caption || image.title || ''
  };
};

const expandMultiLinkImage = (image, index) => {
  const normalized = normalizeImage(image, index);
  const urlValue = normalized.url || '';
  const splitLinks = urlValue.includes(',') || urlValue.includes('\n')
    ? urlValue.split(/\s*[\n,]\s*/).filter(Boolean)
    : [urlValue].filter(Boolean);

  return splitLinks.map((url, splitIndex) => ({
    ...normalized,
    id: `${normalized.id}-${splitIndex}`,
    url
  }));
};

const seedAlbums = [
  {
    id: 'album-1',
    title: 'Vaisakhi 2026',
    description: 'Nagar kirtan, kirtan diwan, and langar seva memories.',
    eventDate: '2026-04-14',
    frontImage: 'https://images.unsplash.com/photo-1585241936939-be4099591252?auto=format&fit=crop&w=1200&q=80',
    googleDriveFolderUrl: '',
    dropboxFolderUrl: '',
    isActive: true,
    images: [
      {
        id: 'img-1',
        url: 'https://images.unsplash.com/photo-1585241936939-be4099591252?auto=format&fit=crop&w=1200&q=80',
        caption: 'Nagar kirtan and sangat gathering'
      }
    ]
  },
  {
    id: 'album-2',
    title: 'Gurpurab Celebration',
    description: 'Gurpurab kirtan and sangat gathering highlights.',
    eventDate: '2026-06-21',
    frontImage: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=1200&q=80',
    googleDriveFolderUrl: '',
    dropboxFolderUrl: '',
    isActive: true,
    images: [
      {
        id: 'img-2',
        url: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=1200&q=80',
        caption: 'Kirtan diwan and ardaas'
      }
    ]
  }
];

const normalizeAlbum = (album) => {
  const expandedItems = [...(album.images || []), ...(album.imageLinks || [])]
    .flatMap((image, index) => expandMultiLinkImage(image, index))
    .filter((image) => Boolean(image.url));

  const folderFromImage = expandedItems.find((image) => isFolderLikeUrl(image.url))?.url || '';
  const googleDriveFolderUrl = normalizeFolderUrl(album.googleDriveFolderUrl || '');
  const dropboxFolderUrl = normalizeFolderUrl(album.dropboxFolderUrl || '');
  const folderUrl = normalizeFolderUrl(album.folderUrl || album.sourceFolderUrl || googleDriveFolderUrl || dropboxFolderUrl || folderFromImage || '');
  const folderEmbedUrl = getDriveFolderEmbedUrl(googleDriveFolderUrl || folderUrl)
    || getDropboxFolderEmbedUrl(dropboxFolderUrl || folderUrl);
  const images = expandedItems.filter((image) => !isFolderLikeUrl(image.url));
  const frontImage = normalizeUrl(album.frontImage || album.cover || images[0]?.url || '');
  const isActive = normalizeBool(album.isActive, true);

  return {
    id: album.id,
    title: album.title || '',
    description: album.description || '',
    eventDate: album.eventDate || '',
    frontImage,
    googleDriveFolderUrl,
    dropboxFolderUrl,
    isActive,
    folderUrl,
    folderEmbedUrl,
    images,
    cover: frontImage || images[0]?.url || '',
    items: images.length
  };
};

const readAlbums = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedAlbums.map(normalizeAlbum);
    }
    const parsed = JSON.parse(raw);
    return parsed.map(normalizeAlbum);
  } catch {
    return seedAlbums.map(normalizeAlbum);
  }
};

const writeAlbums = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const galleryService = {
  getAlbums: async () => mockResponse(readAlbums()),
  getPublicAlbums: async () => mockResponse(readAlbums().filter((album) => album.isActive)),
  createAlbum: async (payload) => {
    const record = normalizeAlbum({
      id: `album-${Date.now()}`,
      title: payload.title,
      description: payload.description,
      eventDate: payload.eventDate,
      frontImage: payload.frontImage,
      googleDriveFolderUrl: payload.googleDriveFolderUrl,
      dropboxFolderUrl: payload.dropboxFolderUrl,
      isActive: payload.isActive,
      folderUrl: payload.folderUrl,
      images: payload.images || []
    });
    const next = [record, ...readAlbums()];
    writeAlbums(next);
    return mockResponse(record);
  },
  updateAlbum: async (id, payload) => {
    const next = readAlbums().map((album) => (
      album.id === id ? normalizeAlbum({ ...album, ...payload, id }) : album
    ));
    writeAlbums(next);
    return mockResponse(next.find((album) => album.id === id));
  },
  removeAlbum: async (id) => {
    const next = readAlbums().filter((album) => album.id !== id);
    writeAlbums(next);
    return mockResponse({ success: true });
  }
};

export default galleryService;
