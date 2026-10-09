import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon, PlayIcon } from '@heroicons/react/24/solid';
import recitationService from '../../services/recitationService';

const themes = {
  light: { panel: 'border-slate-200 bg-white text-slate-800', input: 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400', row: 'border-slate-200 hover:bg-slate-50', rowOn: 'border-brand-blue bg-blue-50', tab: 'border-slate-300 text-slate-700', tabOn: 'border-brand-blue bg-brand-blue text-white', hint: 'text-slate-500', button: 'bg-brand-blue text-white hover:bg-blue-700' },
  dark: { panel: 'border-white/15 bg-white/10 text-white', input: 'border-white/25 bg-slate-950/60 text-white placeholder:text-slate-400', row: 'border-white/15 hover:bg-white/10', rowOn: 'border-brand-saffron bg-brand-saffron/15', tab: 'border-white/25 text-slate-200', tabOn: 'border-brand-saffron bg-brand-saffron text-slate-950', hint: 'text-slate-300', button: 'bg-brand-saffron text-slate-950 hover:bg-amber-400' }
};

const TABS = [{ key: 'bani', label: 'Banis' }, { key: 'ang', label: 'Ang' }, { key: 'search', label: 'Find a shabad' }];
const SEARCH_MODES = [{ key: 'first', label: 'First letters' }, { key: 'anywhere', label: 'Letters anywhere' }, { key: 'english', label: 'English word' }];

// Chooses what will be recited: a bani (Sukhmani Sahib, Japji Sahib...), any Ang of Sri Guru Granth Sahib, or any shabad found by search.
const RecitationPicker = ({ onStart, busy = false, tone = 'light', startLabel = '' }) => {
  const theme = themes[tone];
  const [tab, setTab] = useState('bani');
  const [filter, setFilter] = useState('');
  const [ang, setAng] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('first');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [reciter, setReciter] = useState('');
  const [notes, setNotes] = useState('');

  const { data: catalog = [], isLoading } = useQuery({ queryKey: ['recitation-catalog'], queryFn: recitationService.getCatalog, staleTime: 60 * 60 * 1000 });
  const visibleBanis = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? catalog.filter((bani) => `${bani.english} ${bani.gurmukhi}`.toLowerCase().includes(needle)) : catalog;
  }, [catalog, filter]);

  const runSearch = async (event) => {
    event.preventDefault();
    setSearching(true);
    setSearchMessage('');
    try {
      const found = await recitationService.search(query.trim(), mode);
      setResults(found);
      if (!found.length) setSearchMessage('No shabads matched. Try fewer letters or another search type.');
    } catch (error) {
      setResults([]);
      setSearchMessage(error?.response?.data?.message || 'Search is unavailable right now.');
    } finally {
      setSearching(false);
    }
  };

  const chooseAng = (event) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 4);
    setAng(value);
    const number = Number(value);
    setSelected(number >= 1 && number <= 1430 ? { sourceType: 'ang', sourceId: number, label: `Ang ${number}` } : null);
  };

  const start = () => selected && onStart({ sourceType: selected.sourceType, sourceId: selected.sourceId, reciter: reciter.trim(), notes: notes.trim() });
  const rowClass = (on) => `flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${on ? theme.rowOn : theme.row}`;

  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${theme.panel}`}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="What to recite">
        {TABS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${tab === item.key ? theme.tabOn : theme.tab}`}>{item.label}</button>)}
      </div>

      {tab === 'bani' ? (
        <div className="mt-3">
          <label className="relative block"><MagnifyingGlassIcon className={`pointer-events-none absolute left-3 top-3 h-4 w-4 ${theme.hint}`} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Search ${catalog.length || ''} banis`} aria-label="Search banis" className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand-saffron ${theme.input}`} /></label>
          <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {isLoading ? <p className={`py-4 text-center text-sm ${theme.hint}`}>Loading banis...</p> : null}
            {visibleBanis.map((bani) => (
              <button key={bani.id} type="button" onClick={() => setSelected({ sourceType: 'bani', sourceId: bani.id, label: bani.english })} className={rowClass(selected?.sourceType === 'bani' && selected.sourceId === bani.id)}>
                <span className="min-w-0 truncate text-sm font-semibold">{bani.english}</span>
                <span className="shrink-0 font-gurmukhi text-sm opacity-80">{bani.gurmukhi}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'ang' ? (
        <div className="mt-3">
          <label className="block text-sm font-semibold">Ang number (1 to 1430)
            <input value={ang} onChange={chooseAng} inputMode="numeric" placeholder="e.g. 662" className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-lg font-bold outline-none focus:ring-2 focus:ring-brand-saffron ${theme.input}`} />
          </label>
          <p className={`mt-1 text-xs ${theme.hint}`}>Recites every line on that Ang of Sri Guru Granth Sahib Ji.</p>
        </div>
      ) : null}

      {tab === 'search' ? (
        <div className="mt-3">
          <form onSubmit={runSearch} className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === 'english' ? 'e.g. waheguru' : 'e.g. ਸਸਅ or first letters'} aria-label="Shabad search" className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-saffron ${theme.input}`} />
            <button type="submit" disabled={searching || query.trim().length < 2} className={`rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${theme.button}`}>{searching ? '...' : 'Search'}</button>
          </form>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Search type">
            {SEARCH_MODES.map((item) => <button key={item.key} type="button" onClick={() => setMode(item.key)} aria-pressed={mode === item.key} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${mode === item.key ? theme.tabOn : theme.tab}`}>{item.label}</button>)}
          </div>
          {searchMessage ? <p className={`mt-2 text-sm ${theme.hint}`}>{searchMessage}</p> : null}
          <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {results.map((item) => (
              <button key={`${item.shabadId}-${item.gurmukhi}`} type="button" onClick={() => setSelected({ sourceType: 'shabad', sourceId: item.shabadId, label: `${item.gurmukhi.slice(0, 40)}${item.ang ? ` (Ang ${item.ang})` : ''}` })} className={rowClass(selected?.sourceType === 'shabad' && selected.sourceId === item.shabadId)}>
                <span className="min-w-0"><span className="block truncate font-gurmukhi text-base font-semibold">{item.gurmukhi}</span><span className={`block truncate text-xs ${theme.hint}`}>{[item.ang ? `Ang ${item.ang}` : '', item.raag, item.writer].filter(Boolean).join(' · ')}</span></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input value={reciter} onChange={(event) => setReciter(event.target.value)} maxLength={120} placeholder="Reciter / Granthi (optional)" aria-label="Reciter" className={`rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-saffron ${theme.input}`} />
        <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={400} placeholder="Occasion or note (optional)" aria-label="Note" className={`rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-saffron ${theme.input}`} />
      </div>

      <button type="button" onClick={start} disabled={!selected || busy} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${theme.button}`}>
        <PlayIcon className="h-5 w-5" />{busy ? 'Starting...' : startLabel ? startLabel : selected ? `Start: ${selected.label}` : 'Choose something to start'}
      </button>
    </div>
  );
};

export default RecitationPicker;
