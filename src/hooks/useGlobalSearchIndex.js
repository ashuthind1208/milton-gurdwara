import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import eventService from '../services/eventService';
import newsService from '../services/newsService';
import libraryService from '../services/libraryService';
import volunteerService from '../services/volunteerService';
import cmsService from '../services/cmsService';
import { isEventCurrent, isLibraryProgramCurrent } from '../utils/eventAvailability';

const CMS_PAGE_ROUTE_MAP = {
  about: '/about',
  sikhism: '/sikhism',
  events: '/events',
  gallery: '/gallery',
  contact: '/contact'
};

const toDateLabel = (value = '') => {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const normalizeEvents = (events = []) => (Array.isArray(events) ? events : [])
  .filter((event) => isEventCurrent(event))
  .map((event) => ({
    id: `event-${event.id}`,
    type: 'event',
    title: String(event.title || 'Event').trim(),
    subtitle: `${toDateLabel(event.date)}${event.location ? ` - ${event.location}` : ''}`.trim(),
    body: String(event.description || '').trim(),
    keywords: [event.category, event.location].filter(Boolean),
    route: '/events',
    updatedAt: event.updatedAt || event.date || ''
  }));

const normalizeNews = (articles = []) => (Array.isArray(articles) ? articles : [])
  .filter((article) => newsService.isLiveArticle(article))
  .map((article) => ({
    id: `news-${article.id}`,
    type: 'news',
    title: String(article.heading || 'News Update').trim(),
    subtitle: `Published ${toDateLabel(article.publishedAt)}`.trim(),
    body: String(article.content || '').trim(),
    keywords: Array.isArray(article.links) ? article.links : [],
    route: '/news',
    updatedAt: article.publishedAt || ''
  }));

const normalizeLibrary = (payload = {}) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const physicalBooks = Array.isArray(source.physicalBooks) ? source.physicalBooks : [];
  const digitalResources = Array.isArray(source.digitalResources) ? source.digitalResources : [];
  const programUpdates = Array.isArray(source.programUpdates) ? source.programUpdates : [];

  const bookRows = physicalBooks.map((book) => ({
    id: `library-book-${book.id}`,
    type: 'library',
    title: String(book.title || 'Library Book').trim(),
    subtitle: String(book.author || book.category || 'Physical Book').trim(),
    body: String(book.notes || '').trim(),
    keywords: [book.category, book.isbn].filter(Boolean),
    route: '/library',
    updatedAt: book.updatedAt || ''
  }));

  const digitalRows = digitalResources.map((entry) => ({
    id: `library-digital-${entry.id}`,
    type: 'library',
    title: String(entry.title || 'Digital Resource').trim(),
    subtitle: String(entry.fileType || 'Resource').trim(),
    body: String(entry.description || '').trim(),
    keywords: String(entry.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    route: '/library',
    updatedAt: entry.updatedAt || ''
  }));

  const programRows = programUpdates
    .filter((entry) => isLibraryProgramCurrent(entry))
    .map((entry) => ({
      id: `library-program-${entry.id}`,
      type: 'library',
      title: String(entry.title || 'Library Program').trim(),
      subtitle: `${entry.scheduleDate || ''}${entry.scheduleTime ? ` - ${entry.scheduleTime}` : ''}`.trim(),
      body: String(entry.summary || '').trim(),
      keywords: [entry.speaker, entry.audience, entry.location].filter(Boolean),
      route: '/library',
      updatedAt: entry.updatedAt || entry.scheduleDate || ''
    }));

  return [...bookRows, ...digitalRows, ...programRows];
};

const normalizeSeva = (opportunities = []) => (Array.isArray(opportunities) ? opportunities : []).map((entry) => ({
  id: `seva-${entry.id}`,
  type: 'seva',
  title: String(entry.sevaType || 'Seva Opportunity').trim(),
  subtitle: `${entry.date || ''}${entry.time ? ` - ${entry.time}` : ''}`.trim(),
  body: `Need ${Number(entry.totalVolunteersRequired || 0)} volunteers`,
  keywords: [entry.status, entry.date, entry.time].filter(Boolean),
  route: '/seva',
  updatedAt: entry.updatedAt || entry.date || ''
}));

const normalizeCmsPages = (payload = {}) => {
  const source = payload && typeof payload === 'object' ? payload : {};

  return Object.keys(CMS_PAGE_ROUTE_MAP)
    .map((pageKey) => {
      const page = source[pageKey] || null;
      if (!page) {
        return null;
      }

      const sectionText = Array.isArray(page.sections)
        ? page.sections.map((entry) => `${entry?.title || ''} ${entry?.body || ''}`).join(' ')
        : '';

      return {
        id: `cms-${pageKey}`,
        type: 'cms',
        title: String(page.heroTitle || pageKey).trim(),
        subtitle: String(page.heroDescription || '').trim(),
        body: `${String(page.intro || '').trim()} ${sectionText}`.trim(),
        keywords: [pageKey, page.address, page.phone, page.email].filter(Boolean),
        route: CMS_PAGE_ROUTE_MAP[pageKey],
        updatedAt: ''
      };
    })
    .filter(Boolean);
};

const useGlobalSearchIndex = (options = {}) => {
  const enabled = options.enabled !== false;

  const eventsQuery = useQuery({
    queryKey: ['events', 'search-index'],
    queryFn: () => eventService.getEvents().then((res) => res.data || []),
    staleTime: 60 * 1000,
    enabled
  });

  const newsQuery = useQuery({
    queryKey: ['news-articles', 'search-index'],
    queryFn: () => newsService.getArticles().then((res) => res.data || []),
    staleTime: 60 * 1000,
    enabled
  });

  const libraryQuery = useQuery({
    queryKey: ['library-content', 'search-index'],
    queryFn: () => libraryService.getLibraryData().then((res) => res.data || {}),
    staleTime: 60 * 1000,
    enabled
  });

  const sevaQuery = useQuery({
    queryKey: ['seva-opportunities', 'search-index'],
    queryFn: () => volunteerService.getSevaOpportunities().then((res) => res.data || []),
    staleTime: 60 * 1000,
    enabled
  });

  const cmsPagesQuery = useQuery({
    queryKey: ['cms-page-content', 'search-index'],
    queryFn: () => cmsService.getAllPageContent().then((res) => res.data || {}),
    staleTime: 60 * 1000,
    enabled
  });

  const items = useMemo(() => {
    return [
      ...normalizeEvents(eventsQuery.data || []),
      ...normalizeNews(newsQuery.data || []),
      ...normalizeLibrary(libraryQuery.data || {}),
      ...normalizeSeva(sevaQuery.data || []),
      ...normalizeCmsPages(cmsPagesQuery.data || {})
    ];
  }, [eventsQuery.data, newsQuery.data, libraryQuery.data, sevaQuery.data, cmsPagesQuery.data]);

  return {
    items,
    isLoading: eventsQuery.isLoading || newsQuery.isLoading || libraryQuery.isLoading || sevaQuery.isLoading || cmsPagesQuery.isLoading,
    hasError: eventsQuery.isError || newsQuery.isError || libraryQuery.isError || sevaQuery.isError || cmsPagesQuery.isError
  };
};

export default useGlobalSearchIndex;
