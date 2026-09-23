import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArchiveBoxIcon, CalendarDaysIcon, ChevronRightIcon, GiftIcon, MinusIcon, PlusIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import langarService, { LANGAR_CONTRIBUTIONS_RESOURCE } from '../../services/langarService';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';

const HEADER_IMAGE = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1800&q=88';
const ANONYMOUS_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" rx="40" fill="%23dbeafe"/%3E%3Ccircle cx="40" cy="29" r="13" fill="%230f3b75"/%3E%3Cpath d="M17 68c2-15 12-23 23-23s21 8 23 23" fill="%230f3b75"/%3E%3C/svg%3E';
const fallbackImages = {
  milk: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=160&q=80',
  tomato: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=160&q=80',
  ginger: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=160&q=80',
  onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=160&q=80',
  potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=160&q=80',
  paneer: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=160&q=80'
};

const CONTRIBUTORS_PER_PAGE = 10;
const LANGAR_REOPEN_BOARD_KEY = 'ssm_langar_reopen_board';
const LANGAR_REOPEN_ITEM_KEY = 'ssm_langar_reopen_item_id';

const imageForItem = (item) => item.imageUrl || Object.entries(fallbackImages).find(([key]) => String(item.name || '').toLowerCase().includes(key))?.[1] || gurdwaraLogo;
const avatarFor = (entry) => entry.anonymous ? ANONYMOUS_AVATAR : (entry.donorAvatarUrl || `https://ui-avatars.com/api/?background=0f3b75&color=fff&bold=true&name=${encodeURIComponent(entry.donorName || 'Member')}`);
const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : 'Select date';
const getStatus = (progress, complete = progress >= 100) => {
  if (progress >= 100 && complete) return { label: 'Complete', pill: 'bg-emerald-200 text-emerald-800', bar: 'bg-emerald-500' };
  if (progress >= 60) return { label: 'On Track', pill: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (progress > 0) return { label: 'Partial', pill: 'bg-amber-100 text-amber-800', bar: 'bg-amber-400' };
  return { label: 'Urgent', pill: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' };
};

const formatSubmittedAt = (value) => {
  if (!value) return 'Recent';
  const submitted = new Date(value);
  if (Number.isNaN(submitted.getTime())) return 'Recent';
  const diffMs = Date.now() - submitted.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 5) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return submitted.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const Donut = ({ value, size = 'h-16 w-16' }) => (
  <div className={`relative shrink-0 rounded-full ${size}`} style={{ background: `conic-gradient(#10b981 ${value * 3.6}deg, #e2e8f0 0deg)` }}>
    <div className="absolute inset-2 grid place-items-center rounded-full bg-white text-sm font-black text-brand-blue">{value}%</div>
  </div>
);

const LangarNeedsBoardReference = ({ items = [], triggerOnly = false, navItem = false, onOpen }) => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [boardOpen, setBoardOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [notice, setNotice] = useState('');
  const [itemsPage, setItemsPage] = useState(1);
  const [contributorsPage, setContributorsPage] = useState(1);
  const itemsPerPage = 10;

  const activeItems = useMemo(() => items.map(langarService.normalizeItem).filter((item) => item.needed !== false || item.quantityReceived < item.quantityRequired), [items]);
  const totalItemPages = Math.max(1, Math.ceil(activeItems.length / itemsPerPage));
  const visibleItems = activeItems.slice((itemsPage - 1) * itemsPerPage, itemsPage * itemsPerPage);

  const { data: contributions = [] } = useQuery({
    queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE],
    queryFn: () => langarService.getContributions().then((response) => response.data),
    refetchInterval: 15000
  });

  const sortedContributions = useMemo(() => [...contributions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [contributions]);
  const totalContributorPages = Math.max(1, Math.ceil(sortedContributions.length / CONTRIBUTORS_PER_PAGE));
  const visibleContributions = sortedContributions.slice((contributorsPage - 1) * CONTRIBUTORS_PER_PAGE, contributorsPage * CONTRIBUTORS_PER_PAGE);

  const totals = useMemo(() => {
    const required = activeItems.reduce((sum, item) => sum + Number(item.quantityRequired || 0), 0);
    const received = activeItems.reduce((sum, item) => sum + Math.min(Number(item.quantityReceived || 0), Number(item.quantityRequired || 0)), 0);
    const contributors = new Set(contributions.map((entry) => entry.anonymous ? `anonymous-${entry.id}` : entry.donorEmail).filter(Boolean)).size;
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const receivedThisWeek = contributions.filter((entry) => String(entry.status || '').toLowerCase() === 'received' && new Date(entry.createdAt || 0).getTime() >= weekAgo).length;
    return { received, progress: required ? Math.min(100, Math.round(received / required * 100)) : 0, contributors, receivedThisWeek };
  }, [activeItems, contributions]);

  const lastUpdatedAt = useMemo(() => {
    const timestamps = activeItems.map((item) => new Date(item.updatedAt || 0).getTime()).filter((value) => Number.isFinite(value) && value > 0);
    if (timestamps.length === 0) return '';
    return new Date(Math.max(...timestamps)).toISOString();
  }, [activeItems]);
  const lastUpdatedLabel = lastUpdatedAt ? formatSubmittedAt(lastUpdatedAt) : 'Not available yet';

  const pendingByItem = useMemo(() => contributions.reduce((result, entry) => {
    if (String(entry.status || 'pending').toLowerCase() !== 'pending') return result;
    const itemId = String(entry.itemId || '');
    result[itemId] = (result[itemId] || 0) + Number(entry.quantity || 0);
    return result;
  }, {}), [contributions]);

  const remainingForItem = (item) => Math.max(0, Number(item?.quantityRequired || 0) - Number(item?.quantityReceived || 0) - Number(pendingByItem[String(item?.id || '')] || 0));

  const remainingForSelected = selectedItem ? remainingForItem(selectedItem) : 0;

  const contributionMutation = useMutation({
    mutationFn: (payload) => langarService.createContribution(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE] });
      setSelectedItem(null);
      setQuantity(1);
      setDeliveryDate('');
      setAnonymous(false);
    },
    onError: (error) => setNotice(error?.message || 'Unable to record this contribution.')
  });

  const openBoard = () => { setBoardOpen(true); onOpen?.(); };
  const openContribution = (item) => { setSelectedItem(item); setQuantity(1); setNotice(''); };

  useEffect(() => {
    if (!isAuthenticated || activeItems.length === 0) return;
    let shouldReopenBoard = false;
    let reopenItemId = '';
    try {
      shouldReopenBoard = window.sessionStorage.getItem(LANGAR_REOPEN_BOARD_KEY) === '1' || window.localStorage.getItem(LANGAR_REOPEN_BOARD_KEY) === '1';
      reopenItemId = window.sessionStorage.getItem(LANGAR_REOPEN_ITEM_KEY) || window.localStorage.getItem(LANGAR_REOPEN_ITEM_KEY) || '';
    } catch {
      return;
    }
    if (!shouldReopenBoard) return;

    setBoardOpen(true);
    if (reopenItemId) {
      const matchedItem = activeItems.find((entry) => String(entry.id) === reopenItemId);
      if (matchedItem) {
        openContribution(matchedItem);
      }
    }
    try {
      window.sessionStorage.removeItem(LANGAR_REOPEN_BOARD_KEY);
      window.localStorage.removeItem(LANGAR_REOPEN_BOARD_KEY);
      window.sessionStorage.removeItem(LANGAR_REOPEN_ITEM_KEY);
      window.localStorage.removeItem(LANGAR_REOPEN_ITEM_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, [isAuthenticated, activeItems]);

  const startSignInForContribution = () => {
    try {
      window.sessionStorage.setItem(LANGAR_REOPEN_BOARD_KEY, '1');
      window.localStorage.setItem(LANGAR_REOPEN_BOARD_KEY, '1');
      if (selectedItem?.id) {
        window.sessionStorage.setItem(LANGAR_REOPEN_ITEM_KEY, String(selectedItem.id));
        window.localStorage.setItem(LANGAR_REOPEN_ITEM_KEY, String(selectedItem.id));
      }
    } catch {
      // Ignore storage errors.
    }
    const nextPath = `${location.pathname}${location.search || ''}`;
    navigate(`/login?next=${encodeURIComponent(nextPath)}`);
  };

  const adjustQuantity = (delta) => {
    setQuantity((current) => Math.min(remainingForSelected, Math.max(1, current + delta)));
  };

  const submitContribution = (event) => {
    event.preventDefault();
    if (!isAuthenticated) { startSignInForContribution(); return; }
    contributionMutation.mutate({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity: Math.min(Number(quantity), remainingForSelected),
      unit: selectedItem.unit,
      donorName: user?.name || 'Member',
      donorEmail: user?.email || '',
      donorAvatarUrl: user?.avatarUrl || user?.picture || user?.photoURL || '',
      anonymous,
      expectedDeliveryDate: deliveryDate
    });
  };

  const homeCard = (
    <aside className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-brand-blue to-blue-700 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100">Langar needs board</p>
            <h3 className="mt-1 font-heading text-3xl font-bold leading-tight">Help stock the kitchen</h3>
            <p className="mt-2 text-sm text-blue-100">Only supplies currently requested by the Langar team are shown here.</p>
            <hr className="mt-3 border-t border-white/20" />
            <p className="mt-2 pt-1 text-[11px] font-semibold text-amber-200">Last updated {lastUpdatedLabel}</p>
          </div>
          <ArchiveBoxIcon className="h-12 w-12 shrink-0 rounded-xl bg-white/15 p-2.5" />
        </div>
      </div>
      <div className="px-3 py-3 sm:px-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-h-[74px] items-center gap-2 rounded-lg border border-sky-100 bg-white px-2 py-2 shadow-sm">
            <Donut value={totals.progress} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold leading-tight text-brand-blue">Overall Progress</p>
              <p className="text-[9px] leading-tight text-slate-500">Items partially covered</p>
            </div>
          </div>
          <div className="min-h-[74px] rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-2xl font-black leading-none text-brand-blue">{activeItems.length}</p>
            <p className="mt-1 text-[10px] font-bold leading-tight text-brand-blue">Items Needed</p>
            <p className="text-[9px] text-slate-500">of {activeItems.length} total</p>
          </div>
          <div className="min-h-[74px] rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-2xl font-black leading-none text-brand-blue">{totals.contributors}</p>
            <p className="mt-1 text-[10px] font-bold leading-tight text-brand-blue">Contributors</p>
            <p className="text-[9px] text-slate-500">from our Sangat</p>
          </div>
          <div className="min-h-[74px] rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-2xl font-black leading-none text-brand-blue">{totals.receivedThisWeek}</p>
            <p className="mt-1 text-[10px] font-bold leading-tight text-brand-blue">Meals Supported</p>
            <p className="text-[9px] text-slate-500">so far this week</p>
          </div>
        </div>
        <button type="button" onClick={openBoard} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-saffron px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-500">
          Open Langar Needs Board <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {triggerOnly ? (
        navItem ? (
          <button type="button" onClick={openBoard} className="inline-flex flex-col items-center gap-0.5 rounded-xl border border-amber-300 bg-white px-1.5 py-1.5 text-[9px] font-bold text-amber-700 hover:bg-amber-50">
            <ArchiveBoxIcon className="h-5 w-5" />
            Langar
          </button>
        ) : (
          <button type="button" onClick={openBoard} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100">
            <ArchiveBoxIcon className="h-4 w-4" /> Help stock the kitchen
          </button>
        )
      ) : homeCard}

      {boardOpen ? createPortal(
        <div className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur-sm sm:px-5" onClick={() => setBoardOpen(false)}>
          <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Help us stock the kitchen" onClick={(event) => event.stopPropagation()}>
            <header
              className="relative min-h-[172px] overflow-hidden bg-brand-blue px-5 py-6 text-white sm:min-h-[188px] sm:px-7"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(3,35,82,.99) 0%, rgba(3,35,82,.97) 42%, rgba(3,35,82,.72) 70%, rgba(3,35,82,.18) 100%), url(${HEADER_IMAGE})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Langar needs board</p>
                  <h2 className="mt-1 max-w-xl font-heading text-3xl font-bold leading-tight sm:text-4xl">Help stock the kitchen</h2>
                  <p className="mt-2 max-w-md text-sm leading-5 text-blue-100">Support the Langar by bringing supplies or contributing to the items below.</p>
                  <hr className="mt-3 border-t border-white/20" />
                  <p className="mt-2 pt-1 text-xs font-semibold text-amber-200">Last updated {lastUpdatedLabel}</p>
                </div>
                <button type="button" onClick={() => setBoardOpen(false)} className="rounded-full border border-brand-saffron bg-brand-saffron p-2 text-slate-950 shadow-lg hover:bg-amber-400" aria-label="Close Langar needs board">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
              <div className="flex items-center justify-center gap-3 rounded-xl border border-sky-100 px-3 py-3 shadow-sm sm:justify-start">
                <Donut value={totals.progress} size="h-14 w-14 sm:h-16 sm:w-16" />
                <div className="hidden min-w-0 sm:block">
                  <p className="text-sm font-extrabold text-brand-blue">Overall progress</p>
                  <p className="text-[10px] text-slate-500">Items partially covered</p>
                </div>
              </div>
              <div className="rounded-xl border border-sky-100 px-3 py-3 shadow-sm">
                <p className="text-3xl font-black text-brand-blue">{activeItems.length}</p>
                <p className="text-sm font-extrabold text-brand-blue">Items needed</p>
                <p className="text-[10px] text-slate-500">of {activeItems.length} total</p>
              </div>
              <div className="rounded-xl border border-sky-100 px-3 py-3 shadow-sm">
                <p className="text-3xl font-black text-brand-blue">{totals.contributors}</p>
                <p className="text-sm font-extrabold text-brand-blue">Contributors</p>
                <p className="text-[10px] text-slate-500">from our Sangat</p>
              </div>
              <div className="rounded-xl border border-sky-100 px-3 py-3 shadow-sm">
                <p className="text-3xl font-black text-brand-blue">{totals.receivedThisWeek}</p>
                <p className="text-sm font-extrabold text-brand-blue">Meals supported</p>
                <p className="text-[10px] text-slate-500">so far this week</p>
              </div>
            </div>

            <div className="grid items-start gap-5 p-4 sm:p-6 lg:grid-cols-[1.4fr_0.8fr]">
              <section>
                <h3 className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">Current Langar Needs</h3>
                <div className="mt-2">
                  {visibleItems.map((item) => {
                    const required = Number(item.quantityRequired || 0);
                    const received = Number(item.quantityReceived || 0);
                    const receivedProgress = required ? Math.min(100, Math.round((received / required) * 100)) : 0;
                    const status = getStatus(receivedProgress);
                    const isFullyDone = required > 0 && remainingForItem(item) <= 0;
                    return (
                      <article key={item.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-slate-200 py-4 sm:flex-nowrap sm:items-center">
                        <img src={imageForItem(item)} alt="" className="mt-1 h-12 w-12 shrink-0 rounded-lg object-cover sm:mt-0" />
                        <div className="min-w-0 flex-1 sm:min-w-[8rem] sm:flex-none">
                          <h4 className="text-lg font-black leading-tight text-slate-900 sm:text-xl">{item.name}</h4>
                          <p className="truncate text-xs text-slate-500">{item.category} · {required} {item.unit} needed</p>
                        </div>
                        <div className="mt-1 flex w-20 shrink-0 items-center gap-1 sm:mt-0 sm:w-auto sm:flex-1 sm:gap-2">
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${receivedProgress}%` }} />
                          </div>
                          <span className="w-7 shrink-0 text-right text-[10px] font-bold text-slate-600 sm:w-9 sm:text-[11px]">{receivedProgress}%</span>
                        </div>
                        {!isFullyDone ? (
                          <button
                            type="button"
                            onClick={() => openContribution(item)}
                            className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-brand-blue px-2.5 py-1.5 text-[11px] font-bold text-white sm:ml-3 sm:w-auto sm:justify-start sm:px-3 sm:text-xs"
                          >
                            <GiftIcon className="h-3.5 w-3.5" />Make contribution <ChevronRightIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {totalItemPages > 1 ? (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">Page {itemsPage} of {totalItemPages}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={itemsPage === 1} onClick={() => setItemsPage((page) => Math.max(1, page - 1))} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-bold disabled:opacity-40">Previous</button>
                      <button type="button" disabled={itemsPage === totalItemPages} onClick={() => setItemsPage((page) => Math.min(totalItemPages, page + 1))} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-bold disabled:opacity-40">Next</button>
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="h-full rounded-xl border border-sky-100 bg-white p-4">
                <h3 className="font-heading text-2xl font-bold text-slate-900">Recent Contributors</h3>
                <hr className="mt-3 border-slate-200" />
                <div className="mt-3">
                  {visibleContributions.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 border-b border-sky-100 py-2">
                      <img src={avatarFor(entry)} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-slate-800">{entry.anonymous ? 'Anonymous' : entry.donorName}</p>
                        <p className="truncate text-sm text-brand-blue">{entry.itemName} · {entry.quantity} {entry.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-sky-600">Submitted {formatSubmittedAt(entry.createdAt)}</p>
                        {entry.status === 'received' ? (
                          <p className="text-[10px] font-bold text-emerald-600">Completed {formatSubmittedAt(entry.updatedAt || entry.createdAt)}</p>
                        ) : (
                          <span className="mt-0.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {contributions.length === 0 ? <p className="py-4 text-sm text-slate-600">Your community contributors will appear here.</p> : null}
                </div>
                {totalContributorPages > 1 ? (
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">Page {contributorsPage} of {totalContributorPages}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={contributorsPage === 1} onClick={() => setContributorsPage((page) => Math.max(1, page - 1))} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-bold disabled:opacity-40">Previous</button>
                      <button type="button" disabled={contributorsPage === totalContributorPages} onClick={() => setContributorsPage((page) => Math.min(totalContributorPages, page + 1))} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-bold disabled:opacity-40">Next</button>
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {selectedItem ? createPortal(
        <div className="fixed inset-0 z-[310] overflow-y-auto bg-slate-950/75 px-3 py-5" onClick={() => setSelectedItem(null)}>
          <div className="mx-auto w-full max-w-lg max-h-[calc(100vh-2.5rem)] overflow-hidden overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Make a Langar contribution" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-brand-blue via-blue-700 to-brand-saffron px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white"><GiftIcon className="h-5 w-5" /></span>
                <div>
                  <h2 className="font-heading text-xl font-bold text-white">Make a Contribution</h2>
                  <p className="mt-0.5 text-xs text-blue-50">Enter the quantity and your details. You can also contribute anonymously.</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)} className="rounded-full border border-white/40 p-2 text-white hover:bg-white/10" aria-label="Close contribution form">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4 p-4 sm:p-6" onSubmit={submitContribution}>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-blue">Contribution Summary</p>
                <div className="mt-3 flex items-center gap-3">
                  <img src={imageForItem(selectedItem)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <div>
                    <p className="font-bold text-slate-900">{selectedItem.name} ({selectedItem.unit})</p>
                    <p className="text-sm text-slate-600">Quantity: <strong>{quantity}</strong> {selectedItem.unit}</p>
                    <p className="text-xs text-slate-500">Expected Delivery Date: {formatDate(deliveryDate)}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">Quantity</p>
                <div className="mt-1 flex items-center gap-3">
                  <button type="button" onClick={() => adjustQuantity(-1)} disabled={quantity <= 1} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40"><MinusIcon className="h-4 w-4" /></button>
                  <span className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-center text-lg font-black text-brand-blue">{quantity}</span>
                  <button type="button" onClick={() => adjustQuantity(1)} disabled={quantity >= remainingForSelected} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40"><PlusIcon className="h-4 w-4" /></button>
                  <span className="shrink-0 text-sm font-semibold text-slate-500">{selectedItem.unit}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Up to {remainingForSelected} {selectedItem.unit} still needed for this item.</p>
              </div>

              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Your Details</p>
                <div className="mt-2 space-y-2.5">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5">
                    <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <input value={anonymous ? 'Anonymous' : (user?.name || 'Member')} readOnly disabled className="w-full cursor-not-allowed bg-transparent text-sm text-slate-600 outline-none" />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5">
                    <CalendarDaysIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <input type="date" value={deliveryDate} max={selectedItem.expiryDate || undefined} onChange={(event) => setDeliveryDate(event.target.value)} className="w-full text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-4 w-4" /> Keep my name anonymous
                  </label>
                </div>
              </div>

              {notice ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{notice}</p> : null}

              <button type="submit" disabled={contributionMutation.isPending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-saffron px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-500 disabled:opacity-50">
                <GiftIcon className="h-4 w-4" />
                {contributionMutation.isPending ? 'Saving...' : isAuthenticated ? 'Submit Contribution' : 'Sign in to contribute'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
};

export default LangarNeedsBoardReference;
