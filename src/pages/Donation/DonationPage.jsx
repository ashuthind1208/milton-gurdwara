import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import PageHero from '../../components/common/PageHero';
import DonationForm from '../../components/forms/DonationForm';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import donationService from '../../services/donationService';
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

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => donationService.getCampaigns().then((res) => res.data)
  });

  const openCampaigns = useMemo(() => campaigns.filter((campaign) => !campaign.isClosed), [campaigns]);

  const openStripePopup = (checkoutUrl) => {
    if (!checkoutUrl) {
      return false;
    }

    const popup = window.open(checkoutUrl, 'donation_checkout', 'popup=yes,width=560,height=780');
    return Boolean(popup);
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

      const opened = openStripePopup(pending.checkoutUrl);
      setPopupBlocked(!opened);

      if (opened) {
        setStatusMessage('Stripe checkout opened in popup. Complete payment there.');
      } else {
        setStatusMessage('Popup was blocked. Click "Open Stripe Payment" below.');
      }
    },
    onError: (error) => {
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
                    initiateDonationMutation.mutate(values);
                  }}
                  loading={initiateDonationMutation.isPending}
                  campaigns={openCampaigns}
                  user={user}
                  submitLabel="Prepare Secure Payment"
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
            const progress = campaign.target > 0 ? Math.min((campaign.raised / campaign.target) * 100, 100) : 0;
            return (
              <Card key={campaign.id} className="border border-slate-200 bg-white">
                <h3 className="font-heading text-lg font-semibold text-slate-900">{campaign.name}</h3>
                {campaign.description ? <p className="mt-1 text-sm text-slate-600">{campaign.description}</p> : null}
                <p className="mt-3 text-sm text-slate-700">{formatCurrency(campaign.raised)} raised of {formatCurrency(campaign.target)}</p>
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
    </div>
  );
};

export default DonationPage;
