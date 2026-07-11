import { mockResponse } from './mockApi';
import contentApiService from './contentApiService';

const RESOURCE = 'gallery_albums';

const hasProtocol = (value) => /^https?:\/\//i.test(String(value || '').trim());

const normalizeUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  return hasProtocol(trimmed) ? trimmed : `https://${trimmed}`;
};

const normalizeImage = (image = {}, index = 0) => ({
  id: image.id || `img-${Date.now()}-${index}`,
  title: image.title || image.caption || '',
  caption: image.caption || image.title || '',
  url: normalizeUrl(image.url || image.imageUrl || image.src),
  createdAt: image.createdAt || new Date().toISOString()
});

const resolveGoogleEmbedUrl = (url) => {
  const value = normalizeUrl(url);
  if (!value) {
    return '';
  }

  const folderMatch = value.match(/\/folders\/([^/?#]+)/i);
  if (!folderMatch?.[1]) {
    return '';
  }

  return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
};

const resolveDropboxEmbedUrl = (url) => {
  const value = normalizeUrl(url);
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    parsed.searchParams.set('raw', '1');
    return parsed.toString();
  } catch {
    return value;
  }
};

const buildFolderSources = ({ googleDriveFolderUrl = '', dropboxFolderUrl = '' } = {}) => {
  const sources = [];

  const googleUrl = normalizeUrl(googleDriveFolderUrl);
  if (googleUrl) {
    sources.push({
      type: 'google',
      label: 'Google Drive',
      url: googleUrl,
      embedUrl: resolveGoogleEmbedUrl(googleUrl)
    });
  }

  const dropboxUrl = normalizeUrl(dropboxFolderUrl);
  if (dropboxUrl) {
    sources.push({
      type: 'dropbox',
      label: 'Dropbox',
      url: dropboxUrl,
      embedUrl: resolveDropboxEmbedUrl(dropboxUrl)
    });
  }

  return sources;
};

const normalizeAlbum = (album = {}, index = 0) => {
  const images = Array.isArray(album.images) ? album.images : [];
  const folderSources = buildFolderSources({
    googleDriveFolderUrl: album.googleDriveFolderUrl,
    dropboxFolderUrl: album.dropboxFolderUrl
  });
  const primaryFolder = folderSources[0] || null;

  return {
    id: album.id || `alb-${Date.now()}-${index}`,
    title: album.title || '',
    description: album.description || '',
    coverUrl: normalizeUrl(album.coverUrl || album.coverImage || ''),
    frontImage: normalizeUrl(album.frontImage || album.coverImage || album.coverUrl || ''),
    eventDate: album.eventDate || '',
    isActive: album.isActive !== false,
    googleDriveFolderUrl: normalizeUrl(album.googleDriveFolderUrl || ''),
    dropboxFolderUrl: normalizeUrl(album.dropboxFolderUrl || ''),
    folderSources,
    folderUrl: primaryFolder?.url || '',
    folderEmbedUrl: primaryFolder?.embedUrl || '',
    items: images.length,
    createdAt: album.createdAt || new Date().toISOString(),
    updatedAt: album.updatedAt || new Date().toISOString(),
    images: images.map((image, imageIndex) => normalizeImage(image, imageIndex))
  };
};

const sortAlbums = (albums = []) => [...albums].sort((a, b) => {
  const aTime = new Date(a.eventDate || a.createdAt || 0).getTime();
  const bTime = new Date(b.eventDate || b.createdAt || 0).getTime();
  return bTime - aTime;
});

const galleryService = {
  getAlbums: async () => {
    try {
      const records = await contentApiService.list(RESOURCE);
      return { data: sortAlbums(records.map((album, index) => normalizeAlbum(album, index))) };
    } catch {
      return mockResponse([]);
    }
  },

  createAlbum: async (payload) => {
    const record = normalizeAlbum({ ...payload, id: `alb-${Date.now()}` });
    const created = await contentApiService.create(RESOURCE, record);
    return { data: normalizeAlbum(created || record) };
  },

  updateAlbum: async (id, payload) => {
    const updated = await contentApiService.update(RESOURCE, id, {
      ...payload,
      updatedAt: new Date().toISOString()
    });

    return { data: normalizeAlbum(updated || { id, ...payload }) };
  },

  removeAlbum: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return mockResponse({ success: true });
  },

  getPublicAlbums: async () => {
    const response = await galleryService.getAlbums();
    const publicAlbums = (response.data || []).filter((album) => album.isActive !== false);
    return { data: publicAlbums };
  }
};

export default galleryService;
