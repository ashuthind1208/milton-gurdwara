import { mockResponse } from './mockApi';
import contentApiService from './contentApiService';

const RESOURCE = 'news_articles';

const parseList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/\s*[\n,]\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toTimestamp = (value, fallback = 0) => {
  const parsed = new Date(value || '').getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeArticle = (article = {}, index = 0) => ({
  id: article.id || `news-${Date.now()}-${index}`,
  heading: article.heading || article.title || '',
  content: article.content || article.summary || '',
  links: parseList(article.links || article.link || ''),
  imageLinks: parseList(article.imageLinks || article.images || article.imageUrl || ''),
  publishedAt: article.publishedAt || new Date().toISOString().slice(0, 10),
  expiryDate: article.expiryDate || '',
  active: typeof article.active === 'boolean' ? article.active : true
});

const isExpired = (article, nowTs = Date.now()) => {
  if (!article.expiryDate) {
    return false;
  }
  return toTimestamp(article.expiryDate, Number.MAX_SAFE_INTEGER) < nowTs;
};

const isPublished = (article, nowTs = Date.now()) => toTimestamp(article.publishedAt) <= nowTs;

const isLiveArticle = (article, nowTs = Date.now()) => Boolean(article.active && isPublished(article, nowTs) && !isExpired(article, nowTs));

const sortChronological = (articles = []) => [...articles].sort((a, b) => toTimestamp(b.publishedAt) - toTimestamp(a.publishedAt));

const newsService = {
  getArticles: async () => {
    try {
      const data = await contentApiService.list(RESOURCE);
      return { data: sortChronological(data.map((article, index) => normalizeArticle(article, index))) };
    } catch {
      return mockResponse([]);
    }
  },

  createArticle: async (payload) => {
    const nextRecord = normalizeArticle({ ...payload, id: `news-${Date.now()}` });
    const created = await contentApiService.create(RESOURCE, nextRecord);
    return { data: normalizeArticle(created || nextRecord) };
  },

  updateArticle: async (id, payload) => {
    const updated = await contentApiService.update(RESOURCE, id, payload);
    return { data: normalizeArticle(updated || { id, ...payload }) };
  },

  removeArticle: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return mockResponse({ success: true });
  },

  getLatestLiveArticle: async () => {
    const articles = await newsService.getArticles().then((res) => res.data || []);
    const latest = sortChronological(articles).find((article) => isLiveArticle(article));
    return mockResponse(latest || null);
  },

  isLiveArticle
};

export default newsService;
