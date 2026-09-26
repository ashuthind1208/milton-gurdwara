import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, GiftIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
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
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const meta = useSeoMeta('Make a Langar Contribution', 'Commit a requested Langar item to support the sangat.');

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

  const item = useMemo(() => (content?.langarItems || []).map(langarService.normalizeItem).find((entry) => String(entry.id) === String(itemId)) || null, [content, itemId]);
  const remaining = useMemo(() => {
    if (!item) return 0;
    const pending = contributions.filter((entry) => String(entry.itemId) === String(item.id) && String(entry.status).toLowerCase() === 'pending').reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    return Math.max(0, Number(item.quantityRequired || 0) - Number(item.quantityReceived || 0) - pending);
  }, [contributions, item]);

  const adjustQuantity = (delta) => setQuantity((current) => Math.min(remaining, Math.max(1, current + delta)));
  const signIn = () => {
    const next = `/langar-contribute?itemId=${encodeURIComponent(itemId)}`;
    navigate(`/login?next=${encodeURIComponent(next)}`, { state: { from: { pathname: '/langar-contribute', search: `?itemId=${encodeURIComponent(itemId)}` } } });
  };
  const submitCommitment = async () => {
    if (!isAuthenticated) {
      signIn();
      return;
    }
    if (!item || remaining <= 0 || quantity > remaining) return;
    setIsSubmitting(true);
    setNotice('');
    try {
      await langarService.createContribution({
        itemId: item.id,
        itemName: item.name,
        quantity: Math.min(quantity, remaining),
        unit: item.unit,
        donorName: user?.name || 'Member',
        donorEmail: String(user?.email || '').toLowerCase(),
        donorAvatarUrl: user?.avatarUrl || user?.picture || user?.photoURL || '',
        anonymous,
        expectedDeliveryDate: ''
      });
      await queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE] });
      setNotice(`Your commitment is recorded. A confirmation email will be sent to ${String(user?.email || 'your account email')} if email delivery is available.`);
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
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">{branding.shortName}</p><h1 className="mt-1 font-heading text-3xl font-bold">Make a Contribution</h1><p className="mt-1 text-sm text-blue-50">Commit this requested item for Langar seva.</p></div>
          </header>
          <div className="space-y-5 p-5 sm:p-7">
            <Link to="/langar-board" className="inline-flex items-center gap-2 text-sm font-bold text-brand-blue hover:underline"><ArrowLeftIcon className="h-4 w-4" /> Back to Langar needs</Link>
            {!item ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">This Langar item is not available. Please scan the QR code from a current needs board.</div> : <>
              <section className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <img src={item.imageUrl || logoSrc} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <div className="min-w-0 flex-1"><p className="font-heading text-2xl font-bold text-brand-navy">{item.name}</p><p className="text-sm font-semibold text-slate-600">{item.category || 'Langar need'} · {item.quantityRequired} {item.unit} required</p><p className="mt-1 text-sm font-bold text-brand-blue">{remaining} {item.unit} still available to commit</p></div>
              </section>
              {remaining > 0 ? <section className="rounded-2xl border border-slate-200 p-4"><label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Quantity to commit</label><div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => adjustQuantity(-1)} disabled={quantity <= 1} aria-label="Decrease quantity" className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-slate-700 disabled:opacity-40"><MinusIcon className="h-5 w-5" /></button><div className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 text-xl font-black text-brand-blue">{quantity} {item.unit}</div><button type="button" onClick={() => adjustQuantity(1)} disabled={quantity >= remaining} aria-label="Increase quantity" className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 text-slate-700 disabled:opacity-40"><PlusIcon className="h-5 w-5" /></button></div><p className="mt-2 text-xs text-slate-500">Maximum commitment: {remaining} {item.unit}</p></section> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">This item is fully committed. Thank you for supporting the sangat.</div>}
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-4 w-4" /> Keep my name anonymous</label>
              {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</p> : null}
              {isAuthenticated ? <p className="text-xs text-slate-500">Contributing as {user?.name || user?.email}</p> : <p className="text-sm text-slate-600">Sign in is required to commit this item. You’ll return here after signing in.</p>}
              <button type="button" onClick={() => void submitCommitment()} disabled={!item || remaining <= 0 || isSubmitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-saffron px-5 py-3 font-extrabold text-brand-navy shadow-lg hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"><GiftIcon className="h-5 w-5" />{isSubmitting ? 'Recording commitment…' : isAuthenticated ? 'Make Commitment' : 'Sign in to contribute'}</button>
            </>}
          </div>
        </div>
      </main>
    </>
  );
};

export default LangarItemContributionPage;
