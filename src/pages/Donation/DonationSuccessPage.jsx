import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import donationService from '../../services/donationService';

const DonationSuccessPage = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const confirmationKeyRef = useRef('');

  const confirmMutation = useMutation({
    mutationFn: ({ pendingId, gatewayTransactionId, amount }) => donationService.confirmDonationPayment({ pendingId, gatewayTransactionId, amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
    }
  });

  useEffect(() => {
    const pendingIdFromQuery =
      searchParams.get('pending_id') ||
      searchParams.get('pendingId') ||
      searchParams.get('client_reference_id') ||
      searchParams.get('reference') ||
      '';

    const fallbackPendingId = donationService.getLastPendingDonationId() || donationService.getLatestPendingDonation()?.id || '';
    const pendingId = pendingIdFromQuery || fallbackPendingId;
    if (!pendingId) {
      return;
    }

    const sessionId =
      searchParams.get('session_id') ||
      searchParams.get('payment_intent') ||
      searchParams.get('token') ||
      '';
    const pendingDonation = donationService.getPendingDonationById(pendingId) || donationService.getLatestPendingDonation();
    const confirmationKey = `${pendingId}:${sessionId || 'no-session-id'}`;
    if (confirmationKeyRef.current === confirmationKey) {
      return;
    }
    confirmationKeyRef.current = confirmationKey;

    const resolveAmount = async () => {
      try {
        const paymentDetails = await donationService.resolveStripePaymentDetails({
          sessionId: searchParams.get('session_id') || '',
          paymentIntentId: searchParams.get('payment_intent') || ''
        });
        const resolvedAmount = Number(paymentDetails?.amount || 0);
        if (Number.isFinite(resolvedAmount) && resolvedAmount > 0) {
          return resolvedAmount / 100;
        }
      } catch {
        // Fall back to the pending donation record below.
      }

      const storedAmount = Number(pendingDonation?.amount || 0);
      return Number.isFinite(storedAmount) && storedAmount > 0 ? storedAmount : null;
    };

    resolveAmount().then((amount) => {
      confirmMutation.mutate({ pendingId, gatewayTransactionId: sessionId, amount });
    });
  }, [confirmMutation, queryClient, searchParams]);

  const closePopupAndNavigate = (path) => {
    if (window.opener && !window.opener.closed) {
      window.opener.location.assign(path);
      window.close();
      return;
    }
    window.location.assign(path);
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
      <Card className="border border-emerald-200 bg-emerald-50/70 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Donation complete</p>
        <p className="mt-3 text-2xl font-semibold text-emerald-950">Payment successful</p>
        <p className="mt-2 text-sm text-emerald-900/80">Thank you for your daswand. Your payment has been completed successfully.</p>
      </Card>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Next step</p>
        <div className="mt-4 space-y-3">
          <Button type="button" onClick={() => closePopupAndNavigate('/donation?reset=1')} className="w-full">Go to Donation</Button>
          <Button type="button" variant="ghost" onClick={() => closePopupAndNavigate('/')} className="w-full">Go Home</Button>
        </div>
      </Card>
    </div>
  );
};

export default DonationSuccessPage;
