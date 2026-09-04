import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import PhoneInput from './PhoneInput';
import { formatTenDigitPhone, isTenDigitPhone, TEN_DIGIT_PHONE_ERROR } from '../../utils/phone';

const DonationForm = ({
  onSubmit,
  loading,
  campaigns = [],
  user,
  submitLabel = 'Generate Payment Options',
  preferredCampaignId = '',
  showIdentityFields = false
}) => {
  const defaultCampaign = campaigns[0];
  const { register, handleSubmit, setValue } = useForm({
    defaultValues: {
      donorName: user?.name || '',
      donorEmail: user?.email || '',
      donorPhone: formatTenDigitPhone(user?.phone),
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
      {!showIdentityFields ? <input type="hidden" {...register('donorName', { required: true })} /> : null}
      {!showIdentityFields ? <input type="hidden" {...register('donorEmail', { required: true })} /> : null}
      {!showIdentityFields ? <input type="hidden" {...register('donorPhone', { required: true })} /> : null}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Daswand</p>
        <p className="mt-1 text-sm text-slate-700">ਦਸਵੰਧ | Contribute your daswand to support langar, seva, and Sikh education.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50/90 via-white/95 to-amber-50/90 p-4 shadow-[0_18px_40px_-28px_rgba(10,77,159,0.42)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Personal Details</p>
          <div className="mt-2 h-px w-full bg-brand-blue/20" />
          {showIdentityFields ? (
            <div className="mt-3 grid gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Full Name
                <input
                  type="text"
                  {...register('donorName', { required: true })}
                  required
                  placeholder="Enter your full name"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold shadow-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  {...register('donorEmail', { required: true })}
                  required
                  placeholder="name@example.com"
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold shadow-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Phone
                <PhoneInput
                  {...register('donorPhone', {
                    required: true,
                    validate: (value) => isTenDigitPhone(value) || TEN_DIGIT_PHONE_ERROR
                  })}
                  required
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold shadow-sm"
                />
              </label>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white/90">
              <div className="px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Full Name</p>
                <p className="truncate text-sm font-extrabold text-slate-900">{user?.name || '-'}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="truncate text-sm font-extrabold text-slate-900">{user?.email || '-'}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                <p className="truncate text-sm font-extrabold text-slate-900">{user?.phone || '-'}</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-brand-saffron/40 bg-gradient-to-br from-amber-50/90 via-white/95 to-blue-50/90 p-4 shadow-[0_22px_52px_-34px_rgba(245,166,35,0.55)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Donation Details</p>
          <div className="mt-2 h-px w-full bg-amber-300/45" />
          <div className="mt-3 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
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
                  required
                  placeholder="e.g. 25"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Frequency
                <select {...register('frequency')} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold">
                  <option value="one-time">One Time</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            </div>

            <label className="text-sm font-semibold text-slate-700">
              Campaign
              <select {...register('campaignId', { required: true })} required className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2 text-sm font-bold">
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
        {loading ? 'Preparing...' : submitLabel}
      </Button>
    </form>
  );
};

export default DonationForm;
