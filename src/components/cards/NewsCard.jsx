import Card from '../ui/Card';
import { formatDate } from '../../utils/formatters';

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const truncateText = (value, maxLength = 220) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
};

const NewsCard = ({ article, featured = false }) => {
  const statusLabel = article.active ? 'Active' : 'Inactive';
  const excerpt = truncateText(stripHtml(article.content), featured ? 300 : 180);
  const mainImage = (article.imageLinks || [])[0] || '';
  const extraImages = featured ? (article.imageLinks || []).slice(1, 4) : (article.imageLinks || []).slice(1, 3);

  return (
    <Card className={featured ? 'overflow-hidden border-sky-200/80 bg-gradient-to-br from-white via-sky-50/50 to-amber-50/70 p-0' : ''}>
      <div className={featured ? 'grid gap-0 lg:grid-cols-[1.2fr_1fr]' : 'grid gap-4'}>
        {mainImage ? (
          <div className={`relative ${featured ? 'min-h-[260px] lg:min-h-[340px]' : 'h-52 overflow-hidden rounded-2xl'}`}>
            <img
              src={mainImage}
              alt={`${article.heading} hero`}
              className={`h-full w-full ${featured ? 'object-cover' : 'rounded-2xl object-cover'}`}
              loading="lazy"
            />
            {featured ? <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" /> : null}
            {featured ? (
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="inline-flex rounded-full border border-white/40 bg-black/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">Featured Story</p>
                <h3 className="mt-2 font-heading text-2xl font-bold leading-tight">{article.heading || 'Untitled'}</h3>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={featured ? 'space-y-4 p-5 sm:p-6' : 'space-y-3'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${article.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{statusLabel}</p>
            <p className="text-xs text-slate-500">Published: {formatDate(article.publishedAt)}</p>
          </div>

          {!featured ? <h3 className="font-heading text-2xl font-bold text-slate-900">{article.heading || 'Untitled'}</h3> : null}

          <p className="text-sm leading-7 text-slate-700">{excerpt || '-'}</p>

          {extraImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {extraImages.map((url, index) => (
                <img key={`${article.id}-image-${index + 1}`} src={url} alt={`${article.heading} ${index + 2}`} className="h-20 w-full rounded-xl border border-slate-200 object-cover" loading="lazy" />
              ))}
            </div>
          ) : null}

          {(article.links || []).length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {(article.links || []).slice(0, featured ? 3 : 2).map((url, index) => (
                <a
                  key={`${article.id}-link-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-brand-blue transition hover:border-brand-blue/50 hover:bg-sky-50"
                >
                  <span className="truncate">{url.replace(/^https?:\/\//i, '')}</span>
                </a>
              ))}
            </div>
          ) : null}

          <p className="text-xs font-medium text-slate-500">Expiry: {article.expiryDate ? formatDate(article.expiryDate) : 'No expiry'}</p>
        </div>
      </div>
    </Card>
  );
};

export default NewsCard;
