import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import donationService from '../../services/donationService';
import bookingService from '../../services/bookingService';

const DonationSuccessPage = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const confirmationKeyRef = useRef('');
  const [confirmationState, setConfirmationState] = useState('confirming');

  const confirmMutation = useMutation({
    mutationFn: async ({ pendingId, gatewayTransactionId, amount }) => {
      const confirmation = await donationService.confirmDonationPayment({ pendingId, gatewayTransactionId, amount });
      const result = confirmation?.data || {};
      await bookingService.attachPaymentReceipt({
        pendingId,
        receiptNumber: result.receiptId,
        gatewayTransactionId: result.donation?.gatewayTransactionId || gatewayTransactionId,
        paymentProvider: result.donation?.paymentProvider,
        amount: result.donation?.amount || amount
      }).catch(() => null);
      return confirmation;
    },
    onSuccess: () => {
      setConfirmationState('completed');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: () => setConfirmationState('error')
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
      setConfirmationState('error');
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

  useEffect(() => {
    if (confirmationState !== 'completed') {
      return undefined;
    }

    const closeTimer = window.setTimeout(() => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'ssm:payment-completed' }, window.location.origin);
        return;
      }
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.location.reload();
        } catch {
          // The opener refreshes independently when cross-origin restrictions apply.
        }
        window.close();
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign('/');
      }
    }, 5000);

    return () => window.clearTimeout(closeTimer);
  }, [confirmationState]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-4">
      <section className="w-full max-w-sm rounded-lg bg-white px-6 py-9 text-center shadow-2xl" role="dialog" aria-live="polite" aria-label="Payment status">
        {confirmationState === 'error' ? (
          <>
            <ExclamationCircleIcon className="mx-auto h-16 w-16 text-rose-500" />
            <h1 className="mt-4 font-heading text-2xl font-semibold text-slate-900">Payment could not be confirmed</h1>
          </>
        ) : confirmationState === 'confirming' ? (
          <>
            <span className="mx-auto block h-14 w-14 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
            <h1 className="mt-4 font-heading text-2xl font-semibold text-slate-900">Confirming payment</h1>
          </>
        ) : (
          <>
            <CheckCircleIcon className="mx-auto h-20 w-20 text-emerald-500" />
            <h1 className="mt-4 font-heading text-3xl font-semibold text-slate-900">Payment completed</h1>
            <p className="mt-2 text-sm text-slate-500">This window will close in 5 seconds.</p>
          </>
        )}
      </section>
    </div>
  );
};

export default DonationSuccessPage;
