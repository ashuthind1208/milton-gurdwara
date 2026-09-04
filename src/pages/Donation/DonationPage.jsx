import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BanknotesIcon, CreditCardIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PageHero from '../../components/common/PageHero';
import DonationForm from '../../components/forms/DonationForm';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import donationService from '../../services/donationService';
import advertisementService from '../../services/advertisementService';
import contentApiService from '../../services/contentApiService';
import { formatCurrency } from '../../utils/formatters';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';
import PhoneNumberRequiredNotice from '../../components/common/PhoneNumberRequiredNotice';
import ZeffyDonationModal from './ZeffyDonationModal';
import { toZeffyEmbedUrl } from '../../utils/zeffy';
import {
  getCampaignProgressStatusClassName,
  getCampaignProgressStatusLabel,
  isCampaignProgressVisible
} from '../../constants/campaignProgress';

const DONATION_IDENTITY_SETTING_KEY = 'settings-donation-allow-custom-name-email';

const DonationPage = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const meta = useSeoMeta('Donation', 'Daswand contribution page with Stripe popup checkout.');
  const { user, isAuthenticated } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedProgressItem, setSelectedProgressItem] = useState(null);
  const [enlargedProgressPhoto, setEnlargedProgressPhoto] = useState('');
  const [isZeffyModalOpen, setIsZeffyModalOpen] = useState(false);
  const [zeffyFormUrl, setZeffyFormUrl] = useState('');
  const [zeffyCompletionVersion, setZeffyCompletionVersion] = useState(0);
  const checkoutWindowRef = useRef(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => donationService.getCampaigns().then((res) => res.data)
  });
  const { data: donationIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [DONATION_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(DONATION_IDENTITY_SETTING_KEY, { enabled: false })
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });

  const donationTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Donation Top Banner'), [ads]);
  const donationFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Donation Footer Banner'), [ads]);
  const donationTopAdImageHeightClass = donationTopAds.length > 2 ? 'h-16 md:h-20' : 'h-24 md:h-28';
  const donationFooterAdImageHeightClass = donationFooterAds.length > 2 ? 'h-16 md:h-20' : 'h-24 md:h-28';
  const donationTopAdsGridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${Math.max(1, donationTopAds.length)}, minmax(0, 1fr))` }), [donationTopAds.length]);
  const donationFooterAdsGridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${Math.max(1, donationFooterAds.length)}, minmax(0, 1fr))` }), [donationFooterAds.length]);

  const openCampaigns = useMemo(() => campaigns.filter((campaign) => !campaign.isClosed), [campaigns]);
  const preferredCampaignId = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return String(params.get('campaignId') || '').trim();
  }, [location.search]);
  const returnedFromZeffy = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return params.get('zeffy') === 'completed';
  }, [location.search]);
  const allowIdentityOverride = Boolean(donationIdentitySettings?.enabled);
  const profilePhoneMissing = !String(user?.phone || '').trim();

  useEffect(() => {
    if (!returnedFromZeffy || window.parent === window) {
      return;
    }
    window.parent.postMessage({ type: 'ssm:zeffy-payment-completed' }, window.location.origin);
  }, [returnedFromZeffy]);

  useEffect(() => {
    const handleZeffyCompletion = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'ssm:zeffy-payment-completed') {
        return;
      }
      setIsZeffyModalOpen(false);
      setStatusMessage('Thank you. Your Zeffy payment is complete. The campaign total is being updated.');
      setZeffyCompletionVersion((current) => current + 1);
    };

    window.addEventListener('message', handleZeffyCompletion);
    return () => window.removeEventListener('message', handleZeffyCompletion);
  }, []);

  useEffect(() => {
    if (!returnedFromZeffy && zeffyCompletionVersion === 0) {
      return undefined;
    }

    let active = true;
    const refreshCampaignTotals = async () => {
      await donationService.getDonations().catch(() => null);
      if (active) {
        await queryClient.refetchQueries({ queryKey: ['campaigns'], type: 'active' }).catch(() => null);
      }
    };

    void refreshCampaignTotals();
    const timers = [2500, 7500, 15000, 32000].map((delay) => (
      window.setTimeout(() => void refreshCampaignTotals(), delay)
    ));

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [queryClient, returnedFromZeffy, zeffyCompletionVersion]);

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
    mutationFn: (payload) => {
      if (!isAuthenticated) {
        throw new Error('Please sign in before donating.');
      }
      const suppliedPhone = String(payload?.donorPhone || '').trim();
      if (!allowIdentityOverride && profilePhoneMissing) {
        throw new Error('Please add your phone number in profile before donating.');
      }
      if (allowIdentityOverride && !suppliedPhone) {
        throw new Error('Please provide your phone number before donating.');
      }

      return donationService.initiateDonation(payload);
    },
    onSuccess: (response) => {
      const pending = response.data;
      const selectedCampaign = openCampaigns.find((campaign) => Number(campaign.id) === Number(pending.campaignId));
      const paymentProvider = String(
        pending.campaign?.paymentProvider || selectedCampaign?.paymentProvider || pending.paymentProvider || 'STRIPE'
      ).toUpperCase();
      setPendingCheckout({ ...pending, paymentProvider });

      if (paymentProvider === 'ZEFFY') {
        const configuredUrl = toZeffyEmbedUrl(pending.checkoutUrl);
        if (!configuredUrl) {
          setStatusMessage('This Zeffy campaign does not have a valid donation form link.');
          return;
        }
        setZeffyFormUrl(configuredUrl);
        setIsZeffyModalOpen(true);
        setPopupBlocked(false);
        setStatusMessage('');
        return;
      }

      const opened = navigateCheckoutWindow(pending.checkoutUrl);
      setPopupBlocked(!opened);

      if (opened) {
        setStatusMessage('');
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
        description="Support the sangat through daswand and pay securely with Zeffy or Stripe."
      />
      <ZeffyDonationModal
        isOpen={isZeffyModalOpen}
        formUrl={zeffyFormUrl}
        onClose={() => setIsZeffyModalOpen(false)}
      />
      {returnedFromZeffy ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Thank you. Zeffy is confirming your payment, and the donation will appear in our records after its secure webhook is processed.
        </p>
      ) : null}
      {isAuthenticated && profilePhoneMissing ? <PhoneNumberRequiredNotice activityLabel="donations" /> : null}

      {donationTopAds.length > 0 ? (
        <section className="rounded-xl py-2">
          <div className="grid w-full gap-2" style={donationTopAdsGridStyle}>
            {donationTopAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block min-w-0 overflow-hidden rounded-lg transition hover:opacity-95"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className={`${donationTopAdImageHeightClass} w-full p-1 object-contain`} loading="lazy" /> : null}
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

            {!isAuthenticated ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Please <Link to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`} state={{ from: { pathname: location.pathname, search: location.search } }} className="font-bold underline">sign in</Link> to continue with donation.
              </p>
            ) : null}
            {isAuthenticated && openCampaigns.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">All campaigns are currently closed.</p>
            ) : null}
            {isAuthenticated && openCampaigns.length > 0 ? (
              <div className="mt-4">
                <DonationForm
                  key={formResetKey}
                  onSubmit={(values) => {
                    if (!allowIdentityOverride && profilePhoneMissing) {
                      setStatusMessage('Please update your profile phone number before donating.');
                      return;
                    }
                    setStatusMessage('');
                    const selectedCampaign = openCampaigns.find((campaign) => String(campaign.id) === String(values.campaignId));
                    if (selectedCampaign?.paymentProvider !== 'ZEFFY') {
                      const opened = openPlaceholderPopup();
                      setPopupBlocked(!opened);
                    }
                    initiateDonationMutation.mutate(values);
                  }}
                  loading={initiateDonationMutation.isPending}
                  campaigns={openCampaigns}
                  user={user}
                  preferredCampaignId={preferredCampaignId}
                  showIdentityFields={allowIdentityOverride}
                  submitLabel="Secure Payment"
                />
              </div>
            ) : null}
            {isAuthenticated && profilePhoneMissing && !allowIdentityOverride ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Add your phone number in profile before donating.
              </p>
            ) : null}

            {isAuthenticated && pendingCheckout ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">Payment ready for {formatCurrency(pendingCheckout.amount || 0)}</p>
                <p className="mt-1 text-xs text-slate-600">Email: {pendingCheckout.donorEmail || '-'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (pendingCheckout.paymentProvider === 'ZEFFY') {
                        const configuredUrl = toZeffyEmbedUrl(pendingCheckout.checkoutUrl);
                        if (configuredUrl) {
                          setZeffyFormUrl(configuredUrl);
                          setIsZeffyModalOpen(true);
                        }
                        return;
                      }
                      openStripePopup(pendingCheckout.checkoutUrl);
                    }}
                  >
                    {pendingCheckout.paymentProvider === 'ZEFFY' ? 'Open Zeffy Donation' : 'Open Payment'}
                  </Button>
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
            const activeProgressItems = (Array.isArray(campaign.progressItems) ? campaign.progressItems : [])
              .filter((item) => isCampaignProgressVisible(item?.status, item?.isActive));
            const paymentProvider = String(campaign.paymentProvider || 'STRIPE').toUpperCase();
            const PaymentProviderIcon = paymentProvider === 'ZEFFY'
              ? ShieldCheckIcon
              : paymentProvider === 'PAYPAL' ? BanknotesIcon : CreditCardIcon;
            const paymentProviderLabel = paymentProvider === 'ZEFFY'
              ? 'Zeffy'
              : paymentProvider === 'PAYPAL' ? 'PayPal' : 'Stripe';
            return (
              <Card key={campaign.id} className="border border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 font-heading text-lg font-semibold text-slate-900">{campaign.name}</h3>
                  <span className="inline-flex flex-none items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase text-slate-600" title={`Payments routed through ${paymentProviderLabel}`}>
                    <PaymentProviderIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {paymentProviderLabel}
                  </span>
                </div>
                {campaign.description ? <p className="mt-1 text-sm text-slate-600">{campaign.description}</p> : null}
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Raised so far</p>
                <p className="mt-1 text-3xl font-extrabold leading-none text-brand-blue">{formatCurrency(raised)}</p>
                {target > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-slate-700">Target: {formatCurrency(target)}</p>
                    <div className="mt-4 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${progress}%` }} />
                    </div>
                  </>
                ) : null}
                <p className="mt-2 text-xs font-semibold text-slate-500">{progress.toFixed(1)}% complete</p>
                {activeProgressItems.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeProgressItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedProgressItem({ campaignName: campaign.name, item })}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 ${getCampaignProgressStatusClassName(item.status, item.isActive)}`}
                        title={item.title || 'Progress update'}
                      >
                        <span>{String(item.title || 'Progress update').slice(0, 25)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getCampaignProgressStatusLabel(item.status, item.isActive)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {campaign.isClosed ? <p className="mt-2 text-xs font-semibold text-red-600">Campaign closed</p> : null}
              </Card>
            );
          })}
        </section>
      </div>

      {donationFooterAds.length > 0 ? (
        <section className="rounded-xl py-2">
          <div className="grid w-full gap-2" style={donationFooterAdsGridStyle}>
            {donationFooterAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block min-w-0 overflow-hidden rounded-lg transition hover:opacity-95"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className={`${donationFooterAdImageHeightClass} w-full p-1 object-contain`} loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {selectedProgressItem ? (
        <div className="fixed inset-0 z-[122] overflow-y-auto bg-slate-900/70 px-4 py-6" onClick={() => setSelectedProgressItem(null)}>
          <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
            <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress Detail</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{selectedProgressItem.campaignName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProgressItem(null)}
                  className="rounded-full border border-brand-blue/40 bg-blue-50 p-2 text-brand-blue transition hover:border-brand-saffron hover:bg-amber-100 hover:text-amber-700"
                  aria-label="Close progress detail modal"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <section className={`rounded-xl border border-slate-200 bg-slate-50 p-5 ${Array.isArray(selectedProgressItem.item.photos) && selectedProgressItem.item.photos.length > 0 ? '' : 'lg:col-span-2'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="min-w-0 font-heading text-2xl font-semibold text-slate-900">{selectedProgressItem.item.title || 'Progress Item'}</h3>
                    <span className={`inline-flex flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${getCampaignProgressStatusClassName(selectedProgressItem.item.status, selectedProgressItem.item.isActive)}`}>
                      {getCampaignProgressStatusLabel(selectedProgressItem.item.status, selectedProgressItem.item.isActive)}
                    </span>
                  </div>
                  <div className="mt-4 h-px bg-slate-200" />
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedProgressItem.item.description || 'No description has been added.'}</p>
                </section>

                {Array.isArray(selectedProgressItem.item.photos) && selectedProgressItem.item.photos.length > 0 ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid grid-cols-2 gap-3">
                      {selectedProgressItem.item.photos.slice(0, 25).map((photoUrl, index) => (
                        <button
                          key={`${photoUrl}-${index}`}
                          type="button"
                          onClick={() => setEnlargedProgressPhoto(photoUrl)}
                          className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left transition hover:border-brand-blue/40"
                        >
                          <img src={photoUrl} alt={`Campaign progress ${index + 1}`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                        </button>
                      ))}
                    </div>
                    {selectedProgressItem.item.photos.length > 25 ? <p className="mt-2 text-xs font-medium text-slate-500">Showing first 25 photos in the grid.</p> : null}
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {enlargedProgressPhoto ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/85 px-4 py-6"
          onClick={() => setEnlargedProgressPhoto('')}
        >
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEnlargedProgressPhoto('')}
              className="absolute right-3 top-3 z-10 rounded-full border border-brand-blue/40 bg-blue-50 p-2 text-brand-blue transition hover:border-brand-saffron hover:bg-amber-100 hover:text-amber-700"
              aria-label="Close enlarged progress photo"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
            <img src={enlargedProgressPhoto} alt="Campaign progress enlarged" className="max-h-[88vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DonationPage;
