import Card from '../ui/Card';
import { formatDate } from '../../utils/formatters';

const NewsCard = ({ article }) => {
  const statusLabel = article.active ? 'Active' : 'Inactive';

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">{statusLabel}</p>
        <p className="text-xs text-slate-500">Published: {formatDate(article.publishedAt)}</p>
      </div>

      <h3 className="mt-2 font-heading text-xl font-semibold text-slate-900 dark:text-white">{article.heading}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{article.content}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {(article.imageLinks || []).map((url, index) => (
          <img key={`${article.id}-image-${index}`} src={url} alt={`${article.heading} ${index + 1}`} className="h-48 w-full rounded-lg object-cover" loading="lazy" />
        ))}
      </div>

      {(article.links || []).length > 0 ? (
        <div className="mt-3 space-y-1">
          {(article.links || []).map((url, index) => (
            <a key={`${article.id}-link-${index}`} href={url} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-brand-blue hover:underline">
              {url}
            </a>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">Expiry: {article.expiryDate ? formatDate(article.expiryDate) : 'No expiry'}</p>
    </Card>
  );
};

export default NewsCard;
