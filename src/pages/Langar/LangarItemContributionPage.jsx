import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GiftIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import cmsService from '../../services/cmsService';
import langarService, { LANGAR_CONTRIBUTIONS_RESOURCE } from '../../services/langarService';
import { useBranding } from '../../context/BrandingContext';

const LangarItemContributionPage = () => {
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('itemId') || '';
  const { user, isAuthenticated } = useAuth();
  const { branding, logoSrc } = useBranding();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState({});
  const [submittedItems, setSubmittedItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const meta = useSeoMeta('Make a Langar Contribution', 'Select one or more requested Langar items to support the sangat.');

  const { data: content } = useQuery({
    queryKey: ['langar-item-contribution-content'],
    queryFn: () => cmsService.getHomeContent().then((response) => response.data),
    refetchInterval: 15000
  });
  const { data: contributions = [] } = useQuery({
    queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE, 'item-contribution'],
    queryFn: () => langarService.getContributions().then((response) => response.data),
    refetchInterval: 12000
  });

  const itemNeeds = useMemo(() => {
    const items = (content?.langarItems || []).map(langarService.normalizeItem);
    return items.map((entry) => {
      const pending = contributions
        .filter((contribution) => String(contribution.itemId) === String(entry.id) && String(contribution.status).toLowerCase() === 'pending')
        .reduce((sum, contribution) => sum + Number(contribution.quantity || 0), 0);
      const remaining = Math.max(0, Number(entry.quantityRequired || 0) - Number(entry.quantityReceived || 0) - pending);
      return { ...entry, remaining };
    });
  }, [content, contributions]);
  const selectedItems = useMemo(() => itemNeeds
    .filter((entry) => Number(quantities[entry.id] || 0) > 0)
    .map((entry) => ({ ...entry, selectedQuantity: Math.min(Number(quantities[entry.id] || 0), entry.remaining) })), [itemNeeds, quantities]);

  useEffect(() => {
    if (!itemNeeds.length) return;
    setQuantities((current) => {
      const next = { ...current };
      let changed = false;
      itemNeeds.forEach((entry) => {
        if (!Object.prototype.hasOwnProperty.call(next, entry.id)) {
          next[entry.id] = String(entry.id) === String(itemId) && entry.remaining > 0 ? 1 : 0;
          changed = true;
        } else if (next[entry.id] > entry.remaining) {
          next[entry.id] = entry.remaining;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [itemNeeds, itemId]);
  const openAllLangarNeeds = () => {
    try { window.sessionStorage.setItem('ssm_langar_reopen_board', '1'); } catch { /* Storage may be disabled. */ }
    queryClient.invalidateQueries({ queryKey: ['cms-home'] });
    queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE] });
    navigate('/?openLangar=1');
  };
  const closeContributionPage = () => {
    window.close();
    window.setTimeout(() => navigate('/'), 150);
  };
  const adjustQuantity = (entry, delta) => setQuantities((current) => ({
    ...current,
    [entry.id]: Math.min(entry.remaining, Math.max(0, Number(current[entry.id] || 0) + delta))
  }));
  const chooseSuggestedQuantity = (entry, amount) => setQuantities((current) => ({
    ...current,
    [entry.id]: Math.min(entry.remaining, Math.max(0, Number(amount) || 0))
  }));
  const signIn = () => {
    const nextSearch = itemId ? `?itemId=${encodeURIComponent(itemId)}` : '';
    const next = `/langar-contribute${nextSearch}`;
    try {
      window.sessionStorage.setItem('ssm_post_login_next', next);
      window.localStorage.setItem('ssm_post_login_next', next);
    } catch {
      // LoginPage also receives the return path through the router state/query.
    }
    navigate(`/login?next=${encodeURIComponent(next)}`, { state: { from: { pathname: '/langar-contribute', search: nextSearch } } });
  };
  const submitCommitment = async () => {
    if (!isAuthenticated) {
      signIn();
      return;
    }
    if (!selectedItems.length) {
      setNotice('Choose a quantity for at least one item.');
      return;
    }
    setIsSubmitting(true);
    setNotice('');
    try {
      const createdItems = await langarService.createContributionBatch({
        items: selectedItems.map((entry) => ({ itemId: entry.id, quantity: entry.selectedQuantity })),
        donorName: user?.name || 'Member',
        donorEmail: String(user?.email || '').toLowerCase(),
        donorAvatarUrl: user?.avatarUrl || user?.picture || user?.photoURL || '',
        anonymous,
        expectedDeliveryDate: ''
      });
      await queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE] });
      setSubmittedItems(createdItems);
      setHasSubmitted(true);
    } catch (error) {
      setNotice(error?.message || 'Unable to record your commitment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Seo {...meta} />
      <main className="min-h-screen bg-gradient-to-br from-brand-cream via-white to-blue-50 px-4 py-8 text-slate-900 sm:px-8">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl">
          <header className="flex items-center gap-4 bg-gradient-to-r from-brand-blue via-blue-700 to-brand-saffron p-5 text-white sm:p-7">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-14 w-14 rounded-full border-2 border-brand-saffron object-cover" />
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">{branding.shortName}</p><h1 className="mt-1 font-heading text-3xl font-bold">{hasSubmitted ? 'Thank You for Your Seva' : 'Choose Langar Needs'}</h1><p className="mt-1 text-sm text-blue-50">{hasSubmitted ? 'Your Langar commitments have been recorded.' : 'Select one or more items and quantities to support Langar seva.'}</p></div>
          </header>
          {hasSubmitted ? <div className="space-y-5 p-5 sm:p-7">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-heading text-2xl font-bold text-emerald-900">Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh</p>
              <p className="mt-2 text-sm leading-6 text-emerald-800">Thank you for supporting the sangat. Your commitments have been recorded:</p>
              <ul className="mt-4 divide-y divide-emerald-200 rounded-xl border border-emerald-200 bg-white text-left">{submittedItems.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"><span className="font-bold text-emerald-950">{entry.itemName}</span><span className="shrink-0 font-extrabold text-emerald-800">{entry.quantity} {entry.unit}</span></li>)}</ul>
              <p className="mt-2 text-xs text-emerald-700">A confirmation email will be sent to {String(user?.email || 'your account email')} if email delivery is available.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={openAllLangarNeeds} className="min-h-12 rounded-xl bg-brand-saffron px-5 py-3 font-extrabold text-brand-navy shadow-lg hover:bg-amber-400">Donate more</button>
              <button type="button" onClick={closeContributionPage} className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Close page</button>
            </div>
          </div> : <div className="space-y-5 p-5 sm:p-7">
            {!itemNeeds.length ? <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><p>There are no Langar needs available to commit right now.</p><button type="button" onClick={openAllLangarNeeds} className="min-h-11 rounded-xl bg-brand-saffron px-4 py-2 font-extrabold text-brand-navy">Back to Langar needs</button></div> : <>
              <p className="text-sm leading-6 text-slate-600">Choose quantities for any items you can provide. You can select several items in one commitment.</p>
              {itemId && !itemNeeds.some((entry) => String(entry.id) === String(itemId)) ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">The item from this QR code is no longer available; you can still select other current needs below.</div> : null}
              <section className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                {itemNeeds.map((entry) => {
                  const selectedQuantity = Number(quantities[entry.id] || 0);
                  const available = entry.remaining > 0;
                  const suggestedQuantities = entry.remaining > 10
                    ? Array.from({ length: Math.ceil(entry.remaining / 20) }, (_, index) => Math.min((index + 1) * 20, entry.remaining))
                    : [];
                  return <article key={entry.id} className={`rounded-2xl border p-3 sm:p-4 ${selectedQuantity ? 'border-brand-blue/40 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center gap-3"><img src={entry.imageUrl || logoSrc} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16" /><div className="min-w-0 flex-1"><h2 className="truncate font-heading text-lg font-bold text-brand-navy">{entry.name}</h2><p className="text-xs font-semibold text-slate-600">{entry.category || 'Langar need'} · {entry.remaining} {entry.unit} available</p></div></div>
                    {suggestedQuantities.length ? <div className="mt-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Suggested quantities</p><div className="mt-1.5 flex flex-wrap gap-2">{suggestedQuantities.map((amount) => <button key={amount} type="button" onClick={() => chooseSuggestedQuantity(entry, amount)} aria-pressed={selectedQuantity === amount} className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${selectedQuantity === amount ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white text-brand-blue hover:border-brand-blue'}`}>{amount} {entry.unit}</button>)}</div></div> : null}
                    <div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-700">{selectedQuantity ? `${selectedQuantity} ${entry.unit} selected` : 'Not selected'}</span><div className="flex items-center gap-2"><button type="button" onClick={() => adjustQuantity(entry, -1)} disabled={!available || selectedQuantity <= 0} aria-label={`Decrease ${entry.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40"><MinusIcon className="h-5 w-5" /></button><span className="min-w-8 text-center text-lg font-black text-brand-blue">{selectedQuantity}</span><button type="button" onClick={() => adjustQuantity(entry, 1)} disabled={!available || selectedQuantity >= entry.remaining} aria-label={`Increase ${entry.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40"><PlusIcon className="h-5 w-5" /></button></div></div>
                    {!available ? <p className="mt-2 text-xs font-semibold text-emerald-800">Fully committed — thank you.</p> : null}
                  </article>;
                })}
              </section>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-4 w-4" /> Keep my name anonymous</label>
              {notice && !hasSubmitted ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</p> : null}
              {selectedItems.length ? <p className="text-sm font-bold text-brand-blue">{selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected · {selectedItems.reduce((sum, entry) => sum + entry.selectedQuantity, 0)} total units</p> : null}
              {isAuthenticated ? <p className="text-xs text-slate-500">Contributing as {user?.name || user?.email}</p> : <p className="text-sm text-slate-600">Sign in is required to commit these items. You’ll return here after signing in.</p>}
              <button type="button" onClick={() => void submitCommitment()} disabled={!selectedItems.length || isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-saffron px-5 py-3 font-extrabold text-brand-navy shadow-lg hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"><GiftIcon className="h-5 w-5" />{isSubmitting ? 'Recording commitments…' : isAuthenticated ? `Commit ${selectedItems.length || ''} ${selectedItems.length === 1 ? 'item' : 'items'}` : 'Sign in to contribute'}</button>
            </>}
          </div>}
        </div>
      </main>
    </>
  );
};

export default LangarItemContributionPage;
