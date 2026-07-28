import { useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import PageHero from '../../components/common/PageHero';
import { useQuery } from '@tanstack/react-query';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import newsService from '../../services/newsService';
import Card from '../../components/ui/Card';

const PAGE_SIZE = 9;

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const truncateText = (value, maxLength = 150) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
};

const byNewest = (left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime();
const byOldest = (left, right) => new Date(left.publishedAt || 0).getTime() - new Date(right.publishedAt || 0).getTime();

const isWithinDays = (value, days) => {
  const published = new Date(value || '').getTime();
  if (!Number.isFinite(published)) {
    return false;
  }

  const now = Date.now();
  const range = days * 24 * 60 * 60 * 1000;
  return published >= now - range && published <= now;
};

const isCurrentMonth = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const NewsPage = () => {
  const meta = useSeoMeta('News', 'Latest announcements, blogs, and community news.');
  const { data: articles = [] } = useQuery({ queryKey: ['news-articles'], queryFn: () => newsService.getArticles().then((res) => res.data) });
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [activeArticle, setActiveArticle] = useState(null);

  const sortedArticles = useMemo(() => [...(articles || [])].sort(byNewest), [articles]);

  const filteredArticles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const base = sortedArticles.filter((item) => {
      if (statusFilter === 'active' && item.active !== true) {
        return false;
      }

      if (statusFilter === 'inactive' && item.active !== false) {
        return false;
      }

      if (dateFilter === 'this-month' && !isCurrentMonth(item.publishedAt)) {
        return false;
      }

      if (dateFilter === 'last-90-days' && !isWithinDays(item.publishedAt, 90)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.heading,
        stripHtml(item.content),
        item.publishedAt,
        ...(item.links || [])
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    if (dateFilter === 'oldest') {
      return [...base].sort(byOldest);
    }

    return [...base].sort(byNewest);
  }, [dateFilter, searchTerm, sortedArticles, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const visibleArticles = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredArticles.slice(start, start + PAGE_SIZE);
  }, [filteredArticles, page]);

  const getPrimaryImage = (article) => (article.imageLinks || [])[0] || '';

  useEffect(() => {
    setPage(1);
  }, [searchTerm, dateFilter, statusFilter]);

  return (
    <div className="space-y-8 pb-8">
      <Seo {...meta} />
      <PageHero title="News and Articles" description="Latest announcements, blogs, and community insights." />

      <section>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,2.4fr)_180px_180px]">
          <label className="text-sm font-semibold text-slate-700 lg:col-span-1">
            Search
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, content, or link"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:text-sm sm:normal-case sm:tracking-normal">
            Date
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 sm:text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="this-month">This Month</option>
              <option value="last-90-days">Last 90 Days</option>
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:text-sm sm:normal-case sm:tracking-normal">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleArticles.map((article) => {
            const primaryImage = getPrimaryImage(article);

            return (
              <Card key={article.id} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setActiveArticle(article)}
                  className="group relative block aspect-video w-full overflow-hidden bg-slate-900"
                >
                  {primaryImage ? <img src={primaryImage} alt={article.heading} className="h-full w-full object-cover opacity-80 transition group-hover:opacity-60" /> : <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />}
                </button>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${article.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{article.active ? 'Active' : 'Inactive'}</p>
                      <h3 className="mt-1 font-semibold leading-snug text-slate-800">{article.heading || 'Untitled'}</h3>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {(article.imageLinks || []).length} img
                    </span>
                  </div>
                  {stripHtml(article.content) ? <p className="mt-1 text-xs text-slate-600">{truncateText(stripHtml(article.content), 120)}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">Published: {article.publishedAt}</p>
                </div>
              </Card>
            );
          })}

          {filteredArticles.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">No news found for selected filters.</div>
          ) : null}
        </div>

        {totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Prev</button>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((currentPage) => currentPage + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-40">Next</button>
          </div>
        ) : null}
      </section>

      {activeArticle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" onClick={() => setActiveArticle(null)} />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl max-h-[96vh] overflow-y-auto sm:rounded-2xl sm:max-h-[92vh]">
            {(activeArticle.imageLinks || []).length > 0 ? (
              <div className="grid gap-1.5 bg-black p-1.5 sm:grid-cols-2 sm:gap-2 sm:p-2">
                {(activeArticle.imageLinks || []).slice(0, 4).map((url, index) => (
                  <div key={`${activeArticle.id}-popup-image-${index}`} className="aspect-video overflow-hidden rounded-lg bg-slate-900">
                    <img src={url} alt={`${activeArticle.heading} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-28 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700" />
            )}

            <div className="p-3 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-slate-800 sm:text-xl">{activeArticle.heading || 'Untitled'}</h3>
                  <p className="text-[11px] text-slate-500 sm:text-xs">Published: {activeArticle.publishedAt} · Expiry: {activeArticle.expiryDate || 'No expiry'}</p>
                </div>
                <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setActiveArticle(null)}><XMarkIcon className="h-5 w-5" /></button>
              </div>

              {stripHtml(activeArticle.content) ? (
                <div className="prose prose-sm mt-3 max-w-none text-slate-700 sm:mt-4" dangerouslySetInnerHTML={{ __html: String(activeArticle.content || '') }} />
              ) : (
                <p className="mt-3 text-sm text-slate-600 sm:mt-4">No content available.</p>
              )}

              {(activeArticle.links || []).length > 0 ? (
                <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap">
                  {(activeArticle.links || []).map((url, index) => (
                    <a
                      key={`${activeArticle.id}-popup-link-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-brand-blue px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 sm:w-auto sm:justify-start sm:py-1.5"
                    >
                      Open Link {index + 1}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NewsPage;
