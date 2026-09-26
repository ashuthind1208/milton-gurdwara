import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import cmsService from '../../services/cmsService';
import langarService, { LANGAR_CONTRIBUTIONS_RESOURCE } from '../../services/langarService';
import { useBranding } from '../../context/BrandingContext';

const imageFallback = (item) => item.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=240&q=80';
const toNumber = (value) => Math.max(0, Number(value) || 0);
const displayName = (entry) => entry.anonymous ? 'Anonymous seva' : (entry.donorName || 'Sangat member');
const previewItems = [
  { id: 'preview-ginger', name: 'Ginger', category: 'Grocery', quantityRequired: 20, quantityReceived: 8, unit: 'lb' },
  { id: 'preview-atta', name: 'Atta', category: 'Grocery', quantityRequired: 30, quantityReceived: 12, unit: 'kg' },
  { id: 'preview-plates', name: 'Disposable Plates', category: 'Supplies', quantityRequired: 100, quantityReceived: 40, unit: 'units' },
  { id: 'preview-tomatoes', name: 'Tomatoes', category: 'Grocery', quantityRequired: 30, quantityReceived: 18, unit: 'kg' },
  { id: 'preview-onions', name: 'Onions', category: 'Grocery', quantityRequired: 50, quantityReceived: 20, unit: 'kg' },
  { id: 'preview-rice', name: 'Basmati Rice', category: 'Grocery', quantityRequired: 40, quantityReceived: 10, unit: 'kg' },
  { id: 'preview-lentils', name: 'Lentils', category: 'Grocery', quantityRequired: 25, quantityReceived: 9, unit: 'kg' },
  { id: 'preview-oil', name: 'Cooking Oil', category: 'Grocery', quantityRequired: 20, quantityReceived: 6, unit: 'L' },
  { id: 'preview-milk', name: 'Milk', category: 'Dairy', quantityRequired: 30, quantityReceived: 15, unit: 'bags' },
  { id: 'preview-paneer', name: 'Paneer', category: 'Dairy', quantityRequired: 20, quantityReceived: 5, unit: 'kg' },
  { id: 'preview-potatoes', name: 'Potatoes', category: 'Grocery', quantityRequired: 60, quantityReceived: 30, unit: 'kg' },
  { id: 'preview-sugar', name: 'Sugar', category: 'Grocery', quantityRequired: 25, quantityReceived: 7, unit: 'kg' },
  { id: 'preview-tea', name: 'Tea', category: 'Grocery', quantityRequired: 15, quantityReceived: 4, unit: 'boxes' },
  { id: 'preview-cups', name: 'Paper Cups', category: 'Supplies', quantityRequired: 100, quantityReceived: 25, unit: 'units' },
  { id: 'preview-napkins', name: 'Napkins', category: 'Supplies', quantityRequired: 100, quantityReceived: 50, unit: 'packs' }
];

const Donut = ({ value }) => (
  <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(#f5a623 ${value * 3.6}deg, rgba(255,255,255,.14) 0deg)` }}>
    <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-[#071b3b] px-1 text-center">
      <strong className="block text-3xl font-black leading-none text-white">{value}%</strong>
      <span className="mt-0.5 block text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-cyan-100">complete</span>
    </div>
  </div>
);

const LangarDisplayBoardPage = () => {
  const { branding, logoSrc } = useBranding();
  const [searchParams] = useSearchParams();
  const meta = useSeoMeta('Langar Needs Display Board', 'Live portrait display of current Langar needs and community contributions.');
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(Boolean(document.fullscreenElement));

  const { data: homeContent } = useQuery({
    queryKey: ['langar-display-board-content'],
    queryFn: () => cmsService.getHomeContent().then((response) => response.data),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });
  const { data: contributions = [] } = useQuery({
    queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE, 'display-board'],
    queryFn: () => langarService.getContributions().then((response) => response.data),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });

  const items = useMemo(() => {
    const sourceItems = searchParams.get('sample') === '1' ? previewItems : (homeContent?.langarItems || []);
    return sourceItems.map(langarService.normalizeItem).filter((item) => item.needed !== false || toNumber(item.quantityReceived) < toNumber(item.quantityRequired));
  }, [homeContent, searchParams]);
  const displayedItems = useMemo(() => items.slice(0, 12), [items]);
  const receivedTotal = useMemo(() => items.reduce((sum, item) => sum + Math.min(toNumber(item.quantityReceived), toNumber(item.quantityRequired)), 0), [items]);
  const requiredTotal = useMemo(() => items.reduce((sum, item) => sum + toNumber(item.quantityRequired), 0), [items]);
  const completion = requiredTotal ? Math.min(100, Math.round((receivedTotal / requiredTotal) * 100)) : 0;
  const receivedContributions = useMemo(() => contributions.filter((entry) => entry.status === 'received'), [contributions]);
  const contributorCount = useMemo(() => new Set(receivedContributions.map((entry) => entry.anonymous ? `anonymous-${entry.id}` : entry.donorEmail || entry.donorName)).size, [receivedContributions]);
  const tickerItems = useMemo(() => {
    const source = [...receivedContributions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 12);
    return source.length ? [...source, ...source] : [];
  }, [receivedContributions]);

  useEffect(() => {
    const handleFullscreen = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const contributionUrl = useMemo(() => new URL('/?openLangar=1', window.location.origin).toString(), []);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  };

  return (
    <>
      <Seo {...meta} />
      <div className="langar-display-board h-screen w-full overflow-hidden bg-[#06142f] text-white">
        <style>{`@keyframes langar-board-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } } .langar-board-ticker { animation: langar-board-ticker 42s linear infinite; } @media (prefers-reduced-motion: reduce) { .langar-board-ticker { animation-play-state: paused; } }`}</style>
        <div className="mx-auto flex h-full w-full flex-col px-4 py-3 sm:px-6 lg:px-8">
          <header className="flex shrink-0 items-center gap-3 pb-3">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-12 w-12 rounded-full border-2 border-brand-saffron object-cover sm:h-14 sm:w-14" />
            <div className="min-w-0 flex-1">
              <p className="pt-1 text-xs font-bold uppercase tracking-[0.25em] text-brand-saffron">{branding.shortName}</p>
              <h1 className="font-heading text-3xl font-bold leading-none sm:text-4xl">Langar Needs</h1>
              <p className="mt-1 text-xs text-cyan-100 sm:text-sm">Help stock the kitchen for the sangat</p>
            </div>
            <button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white">{isBrowserFullscreen ? 'Exit' : 'Fullscreen'}</button>
          </header>

          <div className="mt-2 w-full max-w-full shrink-0 overflow-hidden border-y border-white/15 py-2"><div className="langar-board-ticker flex w-max max-w-none gap-3">{tickerItems.map((entry, index) => <span key={`${entry.id}-${index}`} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold"><span className="text-brand-saffron">{displayName(entry)}</span> contributed {entry.quantity} {entry.unit} of {entry.itemName}</span>)}</div>{!tickerItems.length ? <p className="text-center text-xs font-semibold text-slate-300">Contributions will appear here as the sangat helps.</p> : null}</div>

          <section className="mt-2 shrink-0 rounded-3xl border border-white/15 bg-white/10 px-3 py-5 shadow-2xl backdrop-blur sm:px-4 sm:py-6">
            <div className="grid items-center gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(360px,1.3fr)_minmax(280px,1fr)]">
              <div className="flex items-center gap-3"><Donut value={completion} /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Overall completion</p><p className="mt-1 font-heading text-3xl font-bold">{receivedTotal} <span className="text-lg text-cyan-100">of {requiredTotal} units</span></p><p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200"><UserGroupIcon className="h-4 w-4 text-brand-saffron" /> {contributorCount} contributors</p></div></div>
              <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2"><p className="text-xl font-black text-white">{items.length}</p><p className="text-[9px] font-bold uppercase tracking-wide text-cyan-100">Open items</p></div><div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2"><p className="text-xl font-black text-white">{receivedTotal}</p><p className="text-[9px] font-bold uppercase tracking-wide text-cyan-100">Units received</p></div><div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2"><p className="text-xl font-black text-white">{requiredTotal - receivedTotal}</p><p className="text-[9px] font-bold uppercase tracking-wide text-cyan-100">Units remaining</p></div><div className="rounded-xl border border-brand-saffron/30 bg-brand-saffron/10 px-3 py-2"><p className="text-xl font-black text-brand-saffron">{receivedContributions.length}</p><p className="text-[9px] font-bold uppercase tracking-wide text-amber-100">Completed sevas</p></div></div>
              <div className="hidden w-fit items-center justify-self-end gap-3 rounded-2xl border border-brand-saffron/35 bg-white p-3 sm:flex"><QRCodeSVG value={contributionUrl} size={132} level="M" marginSize={1} fgColor="#071b3b" bgColor="#ffffff" className="h-28 w-28 shrink-0" aria-label="Scan to contribute to Langar" /><div className="w-[8rem] text-slate-900"><p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue">Scan to help</p><p className="mt-1 text-xs font-bold">Bring supplies or order delivery.</p><p className="mt-1 text-[11px] text-slate-500">Sign in required.</p></div></div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-saffron/30 bg-brand-saffron/10 p-3 sm:hidden"><QRCodeSVG value={contributionUrl} size={104} level="M" marginSize={1} fgColor="#071b3b" bgColor="#ffffff" className="h-24 w-24 shrink-0 rounded-lg bg-white p-1" aria-label="Scan to contribute to Langar" /><div><p className="text-xs font-black uppercase tracking-[0.16em] text-brand-saffron">Scan to help</p><p className="mt-1 text-sm font-bold">Bring supplies or order delivery.</p><p className="mt-1 text-xs text-cyan-100">Sign in required.</p></div></div>
          </section>

          <main className="mt-3 min-h-0 flex-1">
            <div className="flex items-center justify-between"><h2 className="font-heading text-2xl font-bold">Current needs</h2><span className="rounded-full border border-brand-saffron/50 bg-brand-saffron/10 px-3 py-1 text-xs font-bold text-brand-saffron">Live</span></div>
            <div className="mt-2 grid min-h-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {displayedItems.map((item) => {
              const required = toNumber(item.quantityRequired);
              const received = Math.min(toNumber(item.quantityReceived), required);
              const percent = required ? Math.min(100, Math.round((received / required) * 100)) : 0;
              const itemUrl = new URL(`/langar-contribute?itemId=${encodeURIComponent(item.id)}`, window.location.origin).toString();
              return <article key={item.id} className="flex min-h-[138px] items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3"><img src={imageFallback(item)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /><div className="min-w-0 flex-1"><h3 className="truncate text-base font-extrabold">{item.name}</h3><p className="text-[11px] font-semibold text-cyan-100">{item.category} · {required} {item.unit} needed</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400" style={{ width: `${percent}%` }} /></div><p className="mt-1 text-[10px] font-bold text-slate-200">{received} received · {percent}% fulfilled</p></div><div className="flex shrink-0 flex-col items-center gap-1 rounded-lg bg-white p-1.5 text-center"><QRCodeSVG value={itemUrl} size={68} level="M" marginSize={1} fgColor="#071b3b" bgColor="#ffffff" aria-label={`Scan to donate ${item.name}`} /><span className="text-[8px] font-black uppercase leading-tight tracking-wide text-brand-blue">Donate this item<br />Scan this</span></div></article>;
            })}
            </div>
            {!items.length ? <p className="rounded-2xl bg-white/10 p-6 text-center text-slate-200">The Langar team has no open needs right now.</p> : null}
          </main>

        </div>
      </div>
    </>
  );
};

export default LangarDisplayBoardPage;
