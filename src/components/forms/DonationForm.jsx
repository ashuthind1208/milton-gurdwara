import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const DonationForm = ({
  onSubmit,
  loading,
  campaigns = [],
  user,
  submitLabel = 'Generate Payment Options',
  preferredCampaignId = '',
  allowNameEmailEdit = false
}) => {
  const defaultCampaign = campaigns[0];
  const identityLocked = !allowNameEmailEdit;
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: {
      donorName: user?.name || '',
      donorEmail: user?.email || '',
      donorPhone: user?.phone || '',
      frequency: 'one-time',
      campaignId: preferredCampaignId || defaultCampaign?.id || '',
      amount: ''
    }
  });

  useEffect(() => {
    if (!campaigns.length) {
      return;
    }

    const normalizedPreferred = String(preferredCampaignId || '');
    if (normalizedPreferred) {
      const exists = campaigns.some((campaign) => String(campaign.id) === normalizedPreferred);
      if (exists) {
        setValue('campaignId', normalizedPreferred, { shouldDirty: false, shouldValidate: true });
        return;
      }
    }

    setValue('campaignId', String(defaultCampaign?.id || ''), { shouldDirty: false, shouldValidate: true });
  }, [campaigns, defaultCampaign?.id, preferredCampaignId, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-label="Donation form">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Daswand</p>
        <p className="mt-1 text-sm text-slate-700">ਦਸਵੰਧ | Contribute your daswand to support langar, seva, and Sikh education.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Full Name
          <input
            {...register('donorName', { required: true })}
            type="text"
            readOnly={identityLocked}
            className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 ${identityLocked ? 'font-extrabold text-base text-slate-900' : ''}`}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Email
          <input
            {...register('donorEmail', { required: true })}
            readOnly={identityLocked}
            className={`mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 ${identityLocked ? 'font-extrabold text-base text-slate-900' : ''}`}
            type="email"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Phone
          <input
            {...register('donorPhone', { required: true })}
            readOnly
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base font-extrabold text-slate-900"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Amount (CAD)
          <input
            {...register('amount', {
              required: true,
              min: 1,
              valueAsNumber: true
            })}
            type="number"
            min="1"
            step="0.01"
            placeholder="e.g. 25"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Frequency
          <select {...register('frequency')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
            <option value="one-time">One Time</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Campaign
          <select {...register('campaignId', { required: true })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>
        </label>
      </div>

      <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
        {loading ? 'Preparing...' : submitLabel}
      </Button>
    </form>
  );
};

export default DonationForm;
