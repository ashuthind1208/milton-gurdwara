import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import PageHero from '../../components/common/PageHero';
import DonationForm from '../../components/forms/DonationForm';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import donationService from '../../services/donationService';
import advertisementService from '../../services/advertisementService';
import { formatCurrency } from '../../utils/formatters';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';

const DonationPage = () => {
  const meta = useSeoMeta('Donation', 'Daswand contribution page with Stripe popup checkout.');
  const { user } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const checkoutWindowRef = useRef(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => donationService.getCampaigns().then((res) => res.data)
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });

  const donationTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Donation Top Banner').slice(0, 2), [ads]);
  const donationFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Donation Footer Banner').slice(0, 2), [ads]);

  const openCampaigns = useMemo(() => campaigns.filter((campaign) => !campaign.isClosed), [campaigns]);

  const openStripePopup = (checkoutUrl) => {
    if (!checkoutUrl) {
      return false;
    }

    const popup = window.open(checkoutUrl, 'donation_checkout', 'popup=yes,width=560,height=780');
    if (popup) {
      checkoutWindowRef.current = popup;
    }
    return Boolean(popup);
  };

  const openPlaceholderPopup = () => {
    if (checkoutWindowRef.current && !checkoutWindowRef.current.closed) {
      return true;
    }

    const popup = window.open('', 'donation_checkout', 'popup=yes,width=560,height=780');
    if (!popup) {
      return false;
    }

    popup.document.title = 'Preparing Secure Payment';
    popup.document.body.innerHTML = '<div style="font-family:sans-serif;padding:24px;text-align:center">Preparing secure Stripe checkout...</div>';
    checkoutWindowRef.current = popup;
    return true;
  };

  const navigateCheckoutWindow = (checkoutUrl) => {
    const popup = checkoutWindowRef.current;
    if (popup && !popup.closed) {
      popup.location.href = checkoutUrl;
      popup.focus();
      return true;
    }

    return openStripePopup(checkoutUrl);
  };

  const resetForm = () => {
    setFormResetKey((prev) => prev + 1);
    setPendingCheckout(null);
    setPopupBlocked(false);
    setStatusMessage('');
  };

  const initiateDonationMutation = useMutation({
    mutationFn: (payload) => donationService.initiateDonation(payload),
    onSuccess: (response) => {
      const pending = response.data;
      setPendingCheckout(pending);

      const opened = navigateCheckoutWindow(pending.checkoutUrl);
      setPopupBlocked(!opened);

      if (opened) {
        setStatusMessage('Stripe checkout opened. Complete payment there.');
      } else {
        if (pending.checkoutUrl) {
          window.location.href = pending.checkoutUrl;
          return;
        }
        setStatusMessage('Popup was blocked. Click "Open Stripe Payment" below.');
      }
    },
    onError: (error) => {
      if (checkoutWindowRef.current && !checkoutWindowRef.current.closed) {
        checkoutWindowRef.current.close();
        checkoutWindowRef.current = null;
      }
      setStatusMessage(error?.message || 'Unable to start donation.');
    }
  });

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title="Daswand | Donation"
        description="Support the sangat through daswand. Fill details once, then pay securely with Stripe popup checkout."
      />

      {donationTopAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {donationTopAds.map((ad) => (
              <a key={ad.id} href={ad.targetLink || ad.website || '#'} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30">
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="space-y-4">
          <Card className="border border-orange-200/70 bg-[radial-gradient(circle_at_top_left,_#fff7ed,_#ffffff_45%,_#eff6ff)] shadow-[0_20px_60px_-35px_rgba(30,64,175,0.35)]">
            <h2 className="font-heading text-2xl font-semibold text-slate-900">Make a Contribution</h2>
            <p className="mt-1 text-sm text-slate-600">Your daswand supports langar, youth education, and community seva.</p>

            {statusMessage ? (
              <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{statusMessage}</p>
            ) : null}

            {openCampaigns.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">All campaigns are currently closed.</p>
            ) : (
              <div className="mt-4">
                <DonationForm
                  key={formResetKey}
                  onSubmit={(values) => {
                    setStatusMessage('');
                    const opened = openPlaceholderPopup();
                    setPopupBlocked(!opened);
                    initiateDonationMutation.mutate(values);
                  }}
                  loading={initiateDonationMutation.isPending}
                  campaigns={openCampaigns}
                  user={user}
                  submitLabel="Secure Payment"
                />
              </div>
            )}

            {pendingCheckout ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Payment ready for {formatCurrency(pendingCheckout.amount || 0)}</p>
                <p className="mt-1 text-xs text-slate-600">Email: {pendingCheckout.donorEmail || '-'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => openStripePopup(pendingCheckout.checkoutUrl)}>Open Stripe Payment</Button>
                  <Button type="button" variant="ghost" onClick={resetForm}>Reset Donation Form</Button>
                </div>
                {popupBlocked ? <p className="mt-2 text-xs text-amber-700">Popup was blocked by browser. Use the button above.</p> : null}
              </div>
            ) : null}
          </Card>
        </section>

        <section className="space-y-4">
          {campaigns.map((campaign) => {
            const raised = Number.isFinite(Number(campaign.raised)) ? Math.max(0, Number(campaign.raised)) : 0;
            const target = Number.isFinite(Number(campaign.target)) ? Math.max(0, Number(campaign.target)) : 0;
            const progress = target > 0 ? Math.min((raised / target) * 100, 100) : 0;
            return (
              <Card key={campaign.id} className="border border-slate-200 bg-white">
                <h3 className="font-heading text-lg font-semibold text-slate-900">{campaign.name}</h3>
                {campaign.description ? <p className="mt-1 text-sm text-slate-600">{campaign.description}</p> : null}
                <p className="mt-3 text-sm text-slate-700">{formatCurrency(raised)} raised of {formatCurrency(target)}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-brand-saffron" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">{progress.toFixed(1)}% complete</p>
                {campaign.isClosed ? <p className="mt-2 text-xs font-semibold text-red-600">Campaign closed</p> : null}
              </Card>
            );
          })}
        </section>
      </div>

      {donationFooterAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {donationFooterAds.map((ad) => (
              <a key={ad.id} href={ad.targetLink || ad.website || '#'} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30">
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default DonationPage;
