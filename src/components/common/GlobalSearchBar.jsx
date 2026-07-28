import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useGlobalSearchIndex from '../../hooks/useGlobalSearchIndex';
import phase2Service from '../../services/phase2Service';
import { groupSearchResultsByType, performGlobalSearch } from '../../utils/searchRanker';
import GlobalSearchResultsPanel from './GlobalSearchResultsPanel';

const GlobalSearchBar = ({
  className = '',
  inputClassName = '',
  panelClassName = '',
  placeholder = 'Search events, news, library, and seva...',
  minChars = 2,
  autoFocus = false,
  inputId = 'global-search-input',
  onResultSelect,
  items = null,
  disableRemoteSearch = false,
  remoteSearchFn = null,
  scope = 'all'
}) => {
  const navigate = useNavigate();
  const hasCustomRemoteSearch = typeof remoteSearchFn === 'function';
  const shouldUseRemoteIndex = !Array.isArray(items) && !disableRemoteSearch;
  const { items: indexedItems, isLoading, hasError } = useGlobalSearchIndex({ enabled: shouldUseRemoteIndex });
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const isScopedItem = useCallback((item) => {
    const route = String(item?.route || '').trim();
    if (!route) {
      return false;
    }

    if (scope === 'admin') {
      return route.startsWith('/admin');
    }

    if (scope === 'public') {
      return !route.startsWith('/admin');
    }

    return true;
  }, [scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [query]);

  const searchItems = useMemo(
    () => (Array.isArray(items) ? items : indexedItems).filter((item) => isScopedItem(item)),
    [items, indexedItems, isScopedItem]
  );

  const localResultPayload = useMemo(
    () => performGlobalSearch(searchItems, debouncedQuery, { maxResults: 8, maxPerGroup: 3 }),
    [searchItems, debouncedQuery]
  );

  const useBackendSearch = (hasCustomRemoteSearch || shouldUseRemoteIndex) && debouncedQuery.trim().length >= minChars;
  const backendSearchQuery = useQuery({
    queryKey: ['phase2-fulltext-search', debouncedQuery],
    queryFn: async () => {
      if (hasCustomRemoteSearch) {
        const rows = await remoteSearchFn(debouncedQuery);
        return Array.isArray(rows) ? rows : [];
      }
      return phase2Service.searchFullText(debouncedQuery, { limit: 8 }).then((res) => res.data || []);
    },
    enabled: useBackendSearch,
    retry: false,
    staleTime: 30 * 1000
  });

  const backendResultPayload = useMemo(
    () => groupSearchResultsByType((backendSearchQuery.data || []).filter((item) => isScopedItem(item)), { maxResults: 8, maxPerGroup: 3 }),
    [backendSearchQuery.data, isScopedItem]
  );

  const shouldUseBackendResults = backendSearchQuery.isSuccess;
  const usingFallback = useBackendSearch && backendSearchQuery.isError;
  const customRemoteResultPayload = useMemo(() => {
    if (!hasCustomRemoteSearch || !backendSearchQuery.isSuccess) {
      return localResultPayload;
    }

    const merged = new Map();
    [...(backendSearchQuery.data || []), ...(localResultPayload.flatResults || [])].forEach((item) => {
      if (!isScopedItem(item)) {
        return;
      }
      if (!item?.route) {
        return;
      }
      const key = `${String(item.route)}::${String(item.id || item.title || '')}`;
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    });

    return groupSearchResultsByType(Array.from(merged.values()), { maxResults: 8, maxPerGroup: 3 });
  }, [backendSearchQuery.data, backendSearchQuery.isSuccess, hasCustomRemoteSearch, localResultPayload, isScopedItem]);

  const resultPayload = hasCustomRemoteSearch
    ? customRemoteResultPayload
    : (shouldUseBackendResults ? backendResultPayload : localResultPayload);

  const flatResults = resultPayload.flatResults || [];
  const activeResult = activeIndex >= 0 ? flatResults[activeIndex] : null;

  useEffect(() => {
    const onMouseDown = (event) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    if (!autoFocus || !inputRef.current) {
      return;
    }

    inputRef.current.focus();
    setOpen(true);
  }, [autoFocus]);

  const handleSelect = (item) => {
    if (!item?.route) {
      return;
    }
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    if (typeof onResultSelect === 'function') {
      onResultSelect(item);
    }
    navigate(item.route);
  };

  const handleKeyDown = (event) => {
    if (!open) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatResults.length === 0) {
        return;
      }
      setActiveIndex((current) => (current + 1) % flatResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatResults.length === 0) {
        return;
      }
      setActiveIndex((current) => (current <= 0 ? flatResults.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter' && activeResult) {
      event.preventDefault();
      handleSelect(activeResult);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="sr-only" htmlFor={inputId}>Global search</label>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-300 bg-white/95 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.35)] outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 ${inputClassName}`}
        />
      </div>

      {open ? (
        <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-[260] ${panelClassName}`}>
          <GlobalSearchResultsPanel
            groupedResults={resultPayload.groupedResults}
            activeResultId={activeResult?.id || ''}
            onSelectResult={handleSelect}
            query={query}
            isLoading={useBackendSearch ? backendSearchQuery.isFetching : isLoading}
            hasError={useBackendSearch ? (!usingFallback && backendSearchQuery.isError) : hasError}
            minChars={minChars}
          />
        </div>
      ) : null}
    </div>
  );
};

export default GlobalSearchBar;
