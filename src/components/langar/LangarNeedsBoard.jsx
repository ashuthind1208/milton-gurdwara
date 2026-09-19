import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveBoxIcon, ChevronRightIcon, ClockIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import langarService, { LANGAR_CONTRIBUTIONS_RESOURCE } from '../../services/langarService';

const itemImageFallbacks = {
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=160&q=80',
  tomato: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=160&q=80',
  ginger: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=160&q=80',
  onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=160&q=80',
  potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=160&q=80',
  paneer: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=160&q=80'
};

const resolveItemImage = (item) => {
  if (item?.imageUrl) return item.imageUrl;
  const key = String(item?.name || '').toLowerCase();
  return Object.entries(itemImageFallbacks).find(([name]) => key.includes(name))?.[1] || '';
};

const formatDate = (value) => {
  if (!value) return 'Date not set';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const normalizeItem = (item) => langarService.normalizeItem(item);

const LangarNeedsBoard = ({ items = [], compact = false, triggerOnly = false, onOpen }) => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [notice, setNotice] = useState('');
  const activeItems = useMemo(() => items.map(normalizeItem).filter((item) => item.needed !== false || item.quantityReceived < item.quantityRequired), [items]);
  const { data: contributions = [] } = useQuery({
    queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE],
    queryFn: () => langarService.getContributions().then((response) => response.data),
    refetchInterval: 15000
  });
  const totals = useMemo(() => {
    const required = activeItems.reduce((sum, item) => sum + Number(item.quantityRequired || 0), 0);
    const received = activeItems.reduce((sum, item) => sum + Math.min(Number(item.quantityReceived || 0), Number(item.quantityRequired || 0)), 0);
    const coveredItems = activeItems.filter((item) => Number(item.quantityRequired || 0) > 0 && Number(item.quantityReceived || 0) >= Number(item.quantityRequired || 0)).length;
    const contributorEmails = new Set(contributions.map((entry) => entry.anonymous ? `anonymous-${entry.id}` : entry.donorEmail).filter(Boolean));
    return {
      required,
      received,
      progress: required > 0 ? Math.min(100, Math.round((received / required) * 100)) : 0,
      neededCount: activeItems.length,
      coveredItems,
      contributors: contributorEmails.size
    };
  }, [activeItems, contributions]);
  const contributionMutation = useMutation({
    mutationFn: (payload) => langarService.createContribution(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE] });
      setNotice('Your contribution has been recorded for the Langar team.');
      setSelectedItem(null);
      setQuantity(1);
      setExpectedDeliveryDate('');
      setAnonymous(false);
    },
    onError: (error) => setNotice(error?.message || 'Unable to record this contribution.')
  });

  const openBoard = () => {
    setIsBoardOpen(true);
    onOpen?.();
  };
  const openContribution = (item) => {
    setNotice('');
    setSelectedItem(item);
    setQuantity(Math.max(1, Math.min(Number(item.quantityRequired || 1) - Number(item.quantityReceived || 0), 1)));
  };
  const submitContribution = (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setNotice('Please sign in before making a contribution.');
      return;
    }
    if (!selectedItem || Number(quantity) <= 0) return;
    contributionMutation.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity: Number(quantity),
      unit: selectedItem.unit,
      donorName: user?.name || 'Member',
      donorEmail: user?.email || '',
      anonymous,
      expectedDeliveryDate
    });
  };

  return (
    <>
      {triggerOnly ? <button type="button" onClick={openBoard} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"><ArchiveBoxIcon className="h-4 w-4" /> Help stock the kitchen</button> : null}
      {!triggerOnly ? (
      <aside className={`overflow-hidden rounded-xl border border-brand-blue/20 bg-white shadow-[0_18px_45px_-34px_rgba(11,78,162,0.65)] ${compact ? '' : 'h-full'}`}>
        <div className="bg-gradient-to-r from-brand-blue to-blue-700 px-4 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100">Langar needs board</p>
              <h3 className="mt-1 font-heading text-2xl font-bold">Help stock the kitchen</h3>
            </div>
            <ArchiveBoxIcon className="h-10 w-10 shrink-0 rounded-lg bg-white/15 p-2" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-blue-100">Bring supplies or make a commitment to support meals for the sangat.</p>
        </div>
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 pb-3 text-center">
            <div><p className="text-xl font-black text-emerald-600">{totals.progress}%</p><p className="text-[10px] font-bold uppercase text-slate-500">Overall progress</p></div>
            <div><p className="text-xl font-black text-brand-blue">{totals.neededCount}</p><p className="text-[10px] font-bold uppercase text-slate-500">Items needed</p></div>
            <div><p className="text-xl font-black text-brand-blue">{totals.contributors}</p><p className="text-[10px] font-bold uppercase text-slate-500">Contributors</p></div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${totals.progress}%` }} /></div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500"><span>{totals.coveredItems} of {activeItems.length} items covered</span><span>{totals.received} received</span></div>
          <button type="button" onClick={openBoard} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-saffron px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-500">Open Langar Needs Board <ChevronRightIcon className="h-4 w-4" /></button>
        </div>
      </aside>
      ) : null}

      {isBoardOpen ? (
        <div className="fixed inset-0 z-[180] overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur-sm sm:px-5" onClick={() => setIsBoardOpen(false)}>
          <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Help us stock the kitchen" onClick={(event) => event.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-blue via-blue-800 to-slate-900 px-5 py-5 text-white sm:px-7">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Langar needs board</p><h2 className="mt-1 font-heading text-3xl font-bold">Help stock the kitchen</h2><p className="mt-1 max-w-2xl text-sm text-blue-100">Every item below helps the Gurdwara prepare meals for the sangat.</p></div><button type="button" onClick={() => setIsBoardOpen(false)} className="rounded-full border border-white/30 p-2 text-white hover:bg-white/15" aria-label="Close Langar needs board"><XMarkIcon className="h-5 w-5" /></button></div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{totals.progress}%</p><p className="text-[11px] text-blue-100">Overall progress</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{totals.neededCount}</p><p className="text-[11px] text-blue-100">Items needed</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{totals.contributors}</p><p className="text-[11px] text-blue-100">Contributors</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-2xl font-black">{totals.received}</p><p className="text-[11px] text-blue-100">Units received</p></div></div>
            </div>
            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.4fr_0.8fr]">
              <section><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Current Langar needs</p><h3 className="mt-1 font-heading text-2xl font-bold text-slate-900">Choose an item to contribute</h3></div><span className="hidden text-xs font-semibold text-slate-500 sm:inline">{activeItems.length} items</span></div><div className="mt-4 space-y-2">{activeItems.map((item) => { const required = Number(item.quantityRequired || 0); const received = Number(item.quantityReceived || 0); const progress = required > 0 ? Math.min(100, Math.round((received / required) * 100)) : 0; return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-3"><img src={resolveItemImage(item)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h4 className="font-bold text-slate-900">{item.name}</h4><p className="text-xs text-slate-500">{item.category} · {item.unit}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${progress >= 100 ? 'bg-emerald-100 text-emerald-700' : progress >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>{progress >= 100 ? 'Covered' : progress >= 60 ? 'Partial' : 'Urgent'}</span></div><div className="mt-2 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><span className="w-10 text-right text-[11px] font-bold text-slate-600">{progress}%</span></div><div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>{received} of {required || '?'} {item.unit} received</span><button type="button" onClick={() => openContribution(item)} className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-1.5 font-bold text-white hover:bg-blue-800">Make contribution <ChevronRightIcon className="h-3.5 w-3.5" /></button></div></div></div></article>; })}</div></section>
              <aside className="rounded-xl border border-sky-200 bg-sky-50/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Recent commitments</p><div className="mt-3 space-y-2">{contributions.slice(0, 6).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{entry.anonymous ? 'Anonymous' : entry.donorName}</p><p className="truncate text-xs text-slate-500">{entry.itemName} · {entry.quantity} {entry.unit}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${entry.status === 'received' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{entry.status === 'received' ? 'Completed' : 'Pending'}</span></div>)}{contributions.length === 0 ? <p className="text-sm text-slate-600">Your community commitments will appear here.</p> : null}</div><div className="mt-5 rounded-lg border border-sky-200 bg-white p-3 text-xs leading-5 text-slate-600"><UserGroupIcon className="mb-1 h-5 w-5 text-brand-blue" />Every contribution, big or small, helps serve more meals.</div></aside>
            </div>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/75 px-3 py-5" onClick={() => setSelectedItem(null)}><div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-label="Make a Langar contribution" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Make a contribution</p><h2 className="mt-1 font-heading text-2xl font-bold text-slate-900">{selectedItem.name}</h2><p className="mt-1 text-sm text-slate-600">Choose the quantity and share your expected delivery date.</p></div><button type="button" onClick={() => setSelectedItem(null)} className="rounded-full border border-slate-300 p-2 text-slate-600" aria-label="Close contribution form"><XMarkIcon className="h-5 w-5" /></button></div><form className="mt-5 grid gap-5 md:grid-cols-2" onSubmit={submitContribution}><div className="space-y-3"><label className="block text-sm font-semibold text-slate-700">Quantity<input type="number" min="1" max={Math.max(1, Number(selectedItem.quantityRequired || 999) - Number(selectedItem.quantityReceived || 0))} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" required /></label><label className="block text-sm font-semibold text-slate-700">Expected delivery date<input type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-4 w-4" /> Keep my name anonymous</label>{notice ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{notice}</p> : null}</div><div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-blue">Contribution summary</p><div className="mt-4 flex items-center gap-3"><img src={resolveItemImage(selectedItem)} alt="" className="h-16 w-16 rounded-lg object-cover" /><div><p className="font-bold text-slate-900">{selectedItem.name} ({selectedItem.unit})</p><p className="text-sm text-slate-600">Quantity: <strong>{quantity}</strong> {selectedItem.unit}</p><p className="text-xs text-slate-500">Expected delivery: {expectedDeliveryDate ? formatDate(expectedDeliveryDate) : 'Select date'}</p></div></div><div className="mt-5 flex items-start gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"><ClockIcon className="h-5 w-5 shrink-0 text-brand-blue" />Your commitment will be shared with the Gurdwara team.</div><button type="submit" disabled={contributionMutation.isPending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-saffron px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-500 disabled:opacity-50">{contributionMutation.isPending ? 'Saving...' : isAuthenticated ? 'Submit contribution' : 'Sign in to contribute'}</button></div></form></div></div>
      ) : null}
    </>
  );
};

export default LangarNeedsBoard;
