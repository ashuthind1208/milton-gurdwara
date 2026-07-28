import { Link } from 'react-router-dom';

const BreadcrumbTrail = ({ items = [], className = '' }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-600">
        {items.map((item, index) => {
          const isCurrent = Boolean(item?.isCurrent);
          const hasPath = typeof item?.path === 'string' && item.path.trim().length > 0;
          const label = String(item?.label || '').trim() || 'Untitled';

          return (
            <li key={`${label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="text-slate-400">/</span>
              ) : null}

              {isCurrent || !hasPath ? (
                <span
                  aria-current={isCurrent ? 'page' : undefined}
                  className="max-w-[14rem] truncate font-semibold text-slate-900 sm:max-w-[20rem]"
                  title={label}
                >
                  {label}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="max-w-[12rem] truncate text-brand-blue hover:text-brand-blue/80 hover:underline sm:max-w-[18rem]"
                  title={label}
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default BreadcrumbTrail;