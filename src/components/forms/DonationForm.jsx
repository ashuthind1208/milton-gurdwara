import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const stripeScriptSrc = 'https://js.stripe.com/v3/buy-button.js';

const withPayPalParams = (url, values) => {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set('amount', String(values.amount || ''));
    parsed.searchParams.set('currency_code', 'CAD');
    if (values.campaignName) {
      parsed.searchParams.set('item_name', values.campaignName);
    }
    if (values.donorEmail) {
      parsed.searchParams.set('email', values.donorEmail);
    }
    if (values.donorName) {
      parsed.searchParams.set('first_name', values.donorName);
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

const DonationForm = ({ onSubmit, onRecordPayment, loading, campaigns = [], user, submitLabel = 'Donate Securely' }) => {
  const defaultCampaign = campaigns[0];

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      donorName: user?.name || '',
      donorEmail: user?.email || '',
      amount: 101,
      frequency: 'one-time',
      campaignId: defaultCampaign?.id || ''
    }
  });

  const values = watch();
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => String(campaign.id) === String(values.campaignId)) || null,
    [campaigns, values.campaignId]
  );

  const hasStripeBuyButton = Boolean(
    selectedCampaign?.paymentProvider === 'STRIPE'
    && selectedCampaign?.stripeBuyButtonId
    && selectedCampaign?.stripePublishableKey
  );

  useEffect(() => {
    if (!hasStripeBuyButton) {
      return;
    }

    const existing = document.querySelector(`script[src="${stripeScriptSrc}"]`);
    if (existing) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = stripeScriptSrc;
    document.body.appendChild(script);
  }, [hasStripeBuyButton]);

  const paypalCheckoutUrl = withPayPalParams(selectedCampaign?.paymentProvider === 'PAYPAL' ? selectedCampaign?.paymentLink : '', {
    amount: values.amount,
    donorEmail: values.donorEmail,
    donorName: values.donorName,
    campaignName: selectedCampaign?.name
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Donation form">
      <label className="block text-sm font-medium">
        Full Name
        <input {...register('donorName', { required: true })} type="text" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input {...register('donorEmail', { required: true })} type="email" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Amount (CAD)
        <input {...register('amount', { required: true, min: 1 })} type="number" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Frequency
        <select {...register('frequency')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <option value="one-time">One Time</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Campaign
        <select {...register('campaignId', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900">
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>
      </label>

      {hasStripeBuyButton ? (
        <div className="space-y-3">
          <stripe-buy-button
            buy-button-id={selectedCampaign.stripeBuyButtonId}
            publishable-key={selectedCampaign.stripePublishableKey}
            customer-email={values.donorEmail || ''}
            client-reference-id={`${selectedCampaign.id}-${values.amount || '0'}-${Date.now()}`}
          />
          <p className="text-xs text-slate-500">Complete Stripe payment in popup, then click below to update donation totals and send receipt.</p>
          <Button type="button" variant="secondary" className="w-full" onClick={handleSubmit(onRecordPayment || onSubmit)} disabled={loading}>{loading ? 'Processing...' : 'I Have Completed Stripe Payment'}</Button>
        </div>
      ) : selectedCampaign?.paymentProvider === 'PAYPAL' && paypalCheckoutUrl ? (
        <div className="space-y-3">
          <a href={paypalCheckoutUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-xl bg-[#FFC439] px-5 py-2.5 font-medium text-slate-900 transition hover:bg-[#f5bc29]">
            Pay with PayPal
          </a>
          <p className="text-xs text-slate-500">Complete PayPal payment in popup, then click below to update donation totals and send receipt.</p>
          <Button type="button" variant="secondary" className="w-full" onClick={handleSubmit(onRecordPayment || onSubmit)} disabled={loading}>{loading ? 'Processing...' : 'I Have Completed PayPal Payment'}</Button>
        </div>
      ) : (
        <Button type="submit" variant="secondary" className="w-full" disabled={loading}>{loading ? 'Processing...' : submitLabel}</Button>
      )}
    </form>
  );
};

export default DonationForm;
