import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { stripHtml } from '../../utils/newsContent';

const articleContentClassName = 'mt-4 max-w-none text-sm leading-7 text-slate-700 [&_a]:font-semibold [&_a]:text-brand-saffron [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-saffron [&_blockquote]:pl-4 [&_h1]:mt-6 [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:mt-5 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:mt-4 [&_h3]:font-heading [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 [&_img]:my-5 [&_img]:h-auto [&_img]:w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_table]:my-5 [&_table]:w-full [&_ul]:list-disc';

const NewsArticleDialog = ({ article, onClose }) => {
  useEffect(() => {
    if (!article) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [article, onClose]);

  if (!article) {
    return null;
  }

  const images = article.imageLinks || [];
  const heroImage = images[0];
  const remainingImages = images.slice(1);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="news-article-title">
      <button type="button" className="absolute inset-0 bg-slate-950/75" onClick={onClose} aria-label="Close article" />
      <article className="relative z-10 max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl sm:max-h-[92vh]">
        <button type="button" className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-700 shadow-md hover:bg-white" onClick={onClose} aria-label="Close article">
          <XMarkIcon className="h-5 w-5" />
        </button>

        {heroImage ? (
          <img src={heroImage} alt={article.heading || 'News article'} className="max-h-[70vh] w-full object-cover" />
        ) : (
          <div className="h-32 w-full bg-slate-900" />
        )}

        <div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
          <h2 id="news-article-title" className="pr-8 font-heading text-2xl font-bold text-slate-900 sm:text-4xl">{article.heading || 'Untitled'}</h2>
          <p className="mt-1 text-xs text-slate-500">Published: {article.publishedAt || 'Date unavailable'}</p>

          {stripHtml(article.content) ? (
            <div className={articleContentClassName} dangerouslySetInnerHTML={{ __html: String(article.content || '') }} />
          ) : (
            <p className="mt-4 text-sm text-slate-600">No content available.</p>
          )}

          {remainingImages.length > 0 ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {remainingImages.map((url, index) => (
                <img key={`${article.id}-article-image-${index + 1}`} src={url} alt={`${article.heading || 'News article'} ${index + 2}`} className="h-auto w-full rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
          ) : null}

          {(article.links || []).length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-5">
              {(article.links || []).map((url, index) => (
                <a key={`${article.id}-article-link-${index}`} href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-saffron underline underline-offset-2 hover:text-amber-600">
                  Open Link {index + 1}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
};

export default NewsArticleDialog;