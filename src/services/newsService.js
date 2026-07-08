import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-news-articles';

const seedArticles = [
  {
    id: 'news-1',
    heading: 'Gurpurab Seva Schedule Released',
    content: 'Volunteer slots, kirtan timings, and langar seva registration are now open for this month.',
    links: ['https://www.gurdwarasinghsabhamilton.org/events'],
    imageLinks: ['https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80'],
    publishedAt: '2026-07-05',
    expiryDate: '',
    active: true
  },
  {
    id: 'news-2',
    heading: 'Youth Camp Registrations Open',
    content: 'A 3-day Sikh leadership and Gurbani learning camp for ages 12-18 is now accepting registrations.',
    links: [],
    imageLinks: [],
    publishedAt: '2026-07-01',
    expiryDate: '',
    active: true
  }
];

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

const readArticles = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return sortChronological(seedArticles.map((article, index) => normalizeArticle(article, index)));
    }

    const parsed = JSON.parse(raw);
    const normalized = Array.isArray(parsed) ? parsed.map((article, index) => normalizeArticle(article, index)) : [];
    return sortChronological(normalized);
  } catch {
    return sortChronological(seedArticles.map((article, index) => normalizeArticle(article, index)));
  }
};

const writeArticles = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write failures in mock mode.
  }
};

const newsService = {
  getArticles: async () => mockResponse(readArticles()),
  createArticle: async (payload) => {
    const nextRecord = normalizeArticle({
      ...payload,
      id: `news-${Date.now()}`
    });

    const next = sortChronological([nextRecord, ...readArticles()]);
    writeArticles(next);
    return mockResponse(nextRecord);
  },
  updateArticle: async (id, payload) => {
    const next = sortChronological(readArticles().map((article) => (
      article.id === id ? normalizeArticle({ ...article, ...payload, id }) : article
    )));

    writeArticles(next);
    return mockResponse(next.find((article) => article.id === id) || null);
  },
  removeArticle: async (id) => {
    const next = readArticles().filter((article) => article.id !== id);
    writeArticles(next);
    return mockResponse({ success: true });
  },
  getLatestLiveArticle: async () => {
    const latest = sortChronological(readArticles()).find((article) => isLiveArticle(article));
    return mockResponse(latest || null);
  },
  isLiveArticle
};

export default newsService;
