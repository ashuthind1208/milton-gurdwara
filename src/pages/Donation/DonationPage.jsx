import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import PageHero from '../../components/common/PageHero';
import SectionTitle from '../../components/common/SectionTitle';
import DonationForm from '../../components/forms/DonationForm';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import donationService from '../../services/donationService';
import { formatCurrency } from '../../utils/formatters';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';

const DonationPage = () => {
  const queryClient = useQueryClient();
  const meta = useSeoMeta('Donation', 'One-time and monthly donation options with campaign-based contribution support.');
  const { user } = useAuth();
  const [statusMessage, setStatusMessage] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const { data: campaigns = [] } = useQuery({ queryKey: ['campaigns'], queryFn: () => donationService.getCampaigns().then((res) => res.data) });
  const openCampaigns = campaigns.filter((campaign) => !campaign.isClosed);

  const initiateDonationMutation = useMutation({
    mutationFn: (payload) => donationService.initiateDonation(payload),
    onSuccess: (response) => {
      const pending = response.data;
      setPendingCheckout(pending);
      setStatusMessage('Checkout opened. Complete payment and then click "I have completed payment" below.');

      if (pending.checkoutUrl) {
        window.open(pending.checkoutUrl, 'donation_checkout', 'popup=yes,width=540,height=760');
      }
    },
    onError: (error) => {
      setStatusMessage(error?.message || 'Unable to process donation.');
    }
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (payload) => donationService.confirmDonationPayment(payload),
    onSuccess: (response) => {
      setPendingCheckout(null);
      setStatusMessage(`Donation successful. Receipt: ${response.data.receiptId}${response.data.emailSent ? ' • Receipt email sent.' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
    },
    onError: (error) => {
      setStatusMessage(error?.message || 'Payment confirmation failed.');
    }
  });

  const recordCompletedMutation = useMutation({
    mutationFn: (payload) => donationService.recordCompletedDonation(payload),
    onSuccess: (response) => {
      setPendingCheckout(null);
      setStatusMessage(`Donation successful. Receipt: ${response.data.receiptId}${response.data.emailSent ? ' • Receipt email sent.' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
    },
    onError: (error) => {
      setStatusMessage(error?.message || 'Unable to record payment.');
    }
  });

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Support Through Donation" description="Secure one-time and recurring contributions for langar, infrastructure, and Sikh education." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Campaigns" />
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <h3 className="font-heading text-lg font-semibold">{campaign.name}</h3>
                {campaign.description ? <p className="mt-1 text-xs text-slate-500">{campaign.description}</p> : null}
                <p className="mt-2 text-sm">Raised {formatCurrency(campaign.raised)} of {formatCurrency(campaign.target)}</p>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-2 rounded-full bg-brand-saffron" style={{ width: `${Math.min((campaign.raised / campaign.target) * 100, 100)}%` }} />
                </div>
                {campaign.isClosed ? <p className="mt-2 text-xs font-semibold text-red-600">Target achieved. Donations closed.</p> : null}
              </Card>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle title="Donation Form" subtitle="Sign-in required. Configure Stripe/PayPal checkout URL in admin. Dynamic amount requires checkout endpoint or URL placeholders." />
          <Card>
            {statusMessage ? <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{statusMessage}</p> : null}
            {openCampaigns.length === 0 ? <p className="text-sm text-slate-600">All campaigns have reached target or are inactive.</p> : (
              <DonationForm
                onSubmit={(values) => {
                  setStatusMessage('');
                  initiateDonationMutation.mutate(values);
                }}
                onRecordPayment={(values) => {
                  setStatusMessage('');
                  recordCompletedMutation.mutate(values);
                }}
                loading={initiateDonationMutation.isPending || confirmPaymentMutation.isPending || recordCompletedMutation.isPending}
                campaigns={openCampaigns}
                user={user}
                submitLabel="Proceed to Secure Payment"
              />
            )}

            {pendingCheckout ? (
              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-700">If payment popup was blocked, use the button below.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => window.open(pendingCheckout.checkoutUrl, 'donation_checkout', 'popup=yes,width=540,height=760')}>
                    Open Checkout
                  </Button>
                  <Button type="button" onClick={() => confirmPaymentMutation.mutate({ pendingId: pendingCheckout.pendingId })} disabled={confirmPaymentMutation.isPending}>
                    {confirmPaymentMutation.isPending ? 'Confirming...' : 'I Have Completed Payment'}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </section>
      </div>
    </div>
  );
};

export default DonationPage;
