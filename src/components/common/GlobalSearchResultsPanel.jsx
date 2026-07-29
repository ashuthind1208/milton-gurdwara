const GlobalSearchResultsPanel = ({
  groupedResults = [],
  activeResultId = '',
  onSelectResult,
  query = '',
  isLoading = false,
  hasError = false,
  minChars = 2
}) => {
  if (!query.trim()) {
    return null;
  }

  if (query.trim().length < minChars) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-lg">
        Type at least {minChars} characters to search.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-lg">
        Searching content...
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 shadow-lg">
        Some search sources are unavailable right now. Try again in a moment.
      </div>
    );
  }

  if (groupedResults.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-lg">
        No matching results. Try a different keyword.
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] max-w-full overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_34px_-22px_rgba(15,23,42,0.5)]">
      {groupedResults.map((group) => (
        <section key={group.type} className="mb-1.5 last:mb-0">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {group.label}
          </div>
          <ul role="listbox" aria-label="Search results">
            {group.items.map((item) => {
              const isActive = activeResultId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => onSelectResult(item)}
                    className={`w-full rounded-lg px-2.5 py-2 text-left transition ${isActive ? 'bg-brand-blue text-white' : 'bg-transparent text-slate-800 hover:bg-blue-50'}`}
                  >
                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                    {item.subtitle ? <p className={`mt-0.5 truncate text-xs ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>{item.subtitle}</p> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default GlobalSearchResultsPanel;
