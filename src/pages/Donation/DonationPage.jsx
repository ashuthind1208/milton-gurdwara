import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BanknotesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PageHero from '../../components/common/PageHero';
import DonationForm from '../../components/forms/DonationForm';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';
import donationService from '../../services/donationService';
import advertisementService from '../../services/advertisementService';
import contentApiService from '../../services/contentApiService';
import { formatCurrency } from '../../utils/formatters';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';
import PhoneNumberRequiredNotice from '../../components/common/PhoneNumberRequiredNotice';
import ZeffyDonationModal from './ZeffyDonationModal';

const DONATION_IDENTITY_SETTING_KEY = 'settings-donation-allow-custom-name-email';
const ZEFFY_EMBED_URL = 'https://www.zeffy.com/embed/donation-form/help-us-build-our-gurdwara?modal=true';

const DonationPage = () => {
  const location = useLocation();
  const meta = useSeoMeta('Donation', 'Daswand contribution page with Stripe popup checkout.');
  const { user, isAuthenticated } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedProgressItem, setSelectedProgressItem] = useState(null);
  const [enlargedProgressPhoto, setEnlargedProgressPhoto] = useState('');
  const [isZeffyModalOpen, setIsZeffyModalOpen] = useState(false);
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

  const donationTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Donation Top Banner').slice(0, 2), [ads]);
  const donationFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Donation Footer Banner').slice(0, 2), [ads]);

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
      setStatusMessage('Thank you. Your Zeffy payment is complete and the donation is being added to our records.');
    };

    window.addEventListener('message', handleZeffyCompletion);
    return () => window.removeEventListener('message', handleZeffyCompletion);
  }, []);

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
        description="Support the sangat through daswand and pay securely with Zeffy or Stripe."
        titleActions={(
          <button
            type="button"
            onClick={() => setIsZeffyModalOpen(true)}
            aria-label="Donate securely with Zeffy"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <BanknotesIcon className="h-5 w-5" aria-hidden="true" />
            Donate with Zeffy
          </button>
        )}
      />
      <ZeffyDonationModal
        isOpen={isZeffyModalOpen}
        formUrl={ZEFFY_EMBED_URL}
        onClose={() => setIsZeffyModalOpen(false)}
      />
      {returnedFromZeffy ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Thank you. Zeffy is confirming your payment, and the donation will appear in our records after its secure webhook is processed.
        </p>
      ) : null}
      {isAuthenticated && profilePhoneMissing ? <PhoneNumberRequiredNotice activityLabel="donations" /> : null}

      {donationTopAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
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
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
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
                    const opened = openPlaceholderPopup();
                    setPopupBlocked(!opened);
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
            const activeProgressItems = (Array.isArray(campaign.progressItems) ? campaign.progressItems : []).filter((item) => item?.isActive !== false);
            const activeStoryBlocks = (Array.isArray(campaign.storyBlocks) ? campaign.storyBlocks : []).filter((item) => item?.isActive !== false);
            return (
              <Card key={campaign.id} className="border border-slate-200 bg-white">
                <h3 className="font-heading text-lg font-semibold text-slate-900">{campaign.name}</h3>
                {campaign.description ? <p className="mt-1 text-sm text-slate-600">{campaign.description}</p> : null}
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Raised so far</p>
                <p className="mt-1 text-3xl font-extrabold leading-none text-brand-blue">{formatCurrency(raised)}</p>
                <p className="mt-1 text-sm text-slate-700">Target: {formatCurrency(target)}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-brand-saffron" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">{progress.toFixed(1)}% complete</p>
                {activeProgressItems.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeProgressItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedProgressItem({ campaignName: campaign.name, item })}
                        className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
                        title={item.title || 'Progress update'}
                      >
                        {String(item.title || 'Progress update').slice(0, 25)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeStoryBlocks.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Impact Stories</p>
                    {activeStoryBlocks.slice(0, 2).map((story) => (
                      <div key={story.id} className="rounded-md border border-amber-200/80 bg-white px-2.5 py-2">
                        <p className="text-sm font-semibold text-slate-900">{story.title || 'Community Story'}</p>
                        {story.summary ? <p className="mt-0.5 text-xs text-slate-700">{story.summary}</p> : null}
                        {story.quote ? <p className="mt-1 text-xs italic text-brand-blue">"{story.quote}"</p> : null}
                        {(story.beneficiary || story.impactMetric) ? <p className="mt-1 text-[11px] font-semibold text-slate-600">{story.beneficiary || '-'} {story.impactMetric ? `• ${story.impactMetric}` : ''}</p> : null}
                      </div>
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
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
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
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {selectedProgressItem ? (
        <div className="fixed inset-0 z-[122] overflow-y-auto bg-slate-900/70 px-4 py-6" onClick={() => setSelectedProgressItem(null)}>
          <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
            <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50/80 via-white to-amber-50/75 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="pointer-events-none absolute inset-0">
                <img
                  src={gurdwaraLogo}
                  alt=""
                  aria-hidden="true"
                  className="absolute right-4 top-4 h-44 w-44 rounded-full opacity-[0.07]"
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress Detail</p>
                  <h3 className="mt-1 font-heading text-2xl font-semibold text-slate-900">{selectedProgressItem.item.title || 'Progress Item'}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{selectedProgressItem.campaignName}</p>
                  <span className="mt-2 inline-flex rounded-full border border-brand-blue/25 bg-blue-50 px-3 py-1 text-sm font-bold text-brand-blue">{selectedProgressItem.item.date || '-'}</span>
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

              <div className="relative z-10 mt-3 grid gap-3 text-sm text-slate-700">
                <p>{selectedProgressItem.item.description || '-'}</p>
              </div>

              {Array.isArray(selectedProgressItem.item.photos) && selectedProgressItem.item.photos.length > 0 ? (
                <div className="mt-4">
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {selectedProgressItem.item.photos.slice(0, 25).map((photoUrl, index) => (
                        <button
                          key={`${photoUrl}-${index}`}
                          type="button"
                          onClick={() => setEnlargedProgressPhoto(photoUrl)}
                          className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-left shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-brand-blue/30"
                        >
                          <img src={photoUrl} alt="Progress" className="h-24 w-full rounded-lg object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                        </button>
                      ))}
                    </div>
                    {selectedProgressItem.item.photos.length > 25 ? <p className="mt-2 text-xs font-medium text-slate-500">Showing first 25 photos in the grid.</p> : null}
                  </div>
                </div>
              ) : null}
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
