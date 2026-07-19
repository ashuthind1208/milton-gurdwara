import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const getDefaultOpportunityId = (options = []) => options.find((option) => option?.disabled !== true)?.id || options[0]?.id || '';

const VolunteerForm = ({
  onSubmit,
  options = [],
  disableSubmit = false,
  initialValues = {},
  lockedOpportunity = null,
  showIdentityFields = false,
  submitLabel = 'Register for Seva'
}) => {
  const lockedOpportunityId = String(lockedOpportunity?.id || '').trim();
  const isOpportunityLocked = Boolean(lockedOpportunityId);
  const defaultValues = useMemo(() => ({
    name: String(initialValues?.name || ''),
    email: String(initialValues?.email || ''),
    phone: String(initialValues?.phone || ''),
    contactPreference: 'Email',
    wantsEventEmails: true,
    opportunityId: lockedOpportunityId || getDefaultOpportunityId(options)
  }), [initialValues?.email, initialValues?.name, initialValues?.phone, lockedOpportunityId, options]);

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      ...defaultValues
    }
  });

  const selectedOpportunityId = watch('opportunityId');
  const selectedOption = useMemo(
    () => options.find((option) => String(option.id || '') === String(selectedOpportunityId || '')) || null,
    [options, selectedOpportunityId]
  );
  const selectedOpportunityLabel = isOpportunityLocked
    ? `${lockedOpportunity?.sevaType || 'Seva'} • ${lockedOpportunity?.date ? new Date(`${lockedOpportunity.date}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD'}${lockedOpportunity?.time ? ` • ${lockedOpportunity.time}` : ''}`
    : String(selectedOption?.label || '').trim();
  const lockedOpportunityDateLabel = lockedOpportunity?.date
    ? new Date(`${lockedOpportunity.date}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date TBD';
  const lockedOpportunityTimeLabel = lockedOpportunity?.time || 'Time TBD';
  const alreadyRegistered = Boolean(selectedOption?.alreadyRegistered || selectedOption?.disabled);
  const submitDisabled = disableSubmit || options.length === 0 || alreadyRegistered;

  useEffect(() => {
    reset({
      ...defaultValues,
      opportunityId: lockedOpportunityId || getDefaultOpportunityId(options)
    });
  }, [defaultValues, lockedOpportunityId, options, reset]);

  useEffect(() => {
    if (!lockedOpportunityId) {
      return;
    }
    setValue('opportunityId', lockedOpportunityId, { shouldValidate: true });
    setValue('contactPreference', 'Email', { shouldValidate: false });
  }, [lockedOpportunityId, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Volunteer registration form">
      {!showIdentityFields ? <input type="hidden" {...register('name', { required: true })} /> : null}
      {!showIdentityFields ? <input type="hidden" {...register('email', { required: true })} /> : null}
      {!showIdentityFields ? <input type="hidden" {...register('phone')} /> : null}
      <input type="hidden" value="Email" {...register('contactPreference')} />
      <input type="hidden" value="true" {...register('wantsEventEmails')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-4 shadow-[0_18px_40px_-28px_rgba(10,77,159,0.42)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Personal Details</p>
          <div className="mt-2 h-px w-full bg-brand-blue/20" />
          {showIdentityFields ? (
            <div className="mt-3 grid gap-3">
              <label className="block text-sm font-medium">
                Name
                <input
                  type="text"
                  {...register('name', { required: true })}
                  placeholder="Enter your full name"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm"
                />
              </label>
              <label className="block text-sm font-medium">
                Email
                <input
                  type="email"
                  {...register('email', { required: true })}
                  placeholder="name@example.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm"
                />
              </label>
              <label className="block text-sm font-medium">
                Phone (optional)
                <input
                  type="tel"
                  {...register('phone')}
                  placeholder="Phone number"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm"
                />
              </label>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</p>
                <p className="text-sm font-bold text-slate-900">{defaultValues.name || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                <p className="text-sm font-bold text-slate-900">{defaultValues.phone || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="break-all text-sm font-bold text-slate-900">{defaultValues.email || '-'}</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-brand-saffron/40 bg-gradient-to-br from-amber-50 via-white to-blue-50 p-4 shadow-[0_22px_52px_-34px_rgba(245,166,35,0.55)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Registration Details</p>
            <div className="mt-2 h-px w-full bg-amber-300/45" />
          </div>

          <div className="mt-3 grid gap-3">
            {isOpportunityLocked ? (
              <input type="hidden" {...register('opportunityId', { required: true })} />
            ) : (
              <label className="block text-sm font-medium">
                Seva Opportunity
                <select {...register('opportunityId', { required: true })} disabled={disableSubmit || options.length === 0} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                  {options.length === 0 ? <option value="">No open seva opportunities</option> : options.map((option) => <option key={option.id} value={option.id} disabled={Boolean(option.disabled)}>{option.label}</option>)}
                </select>
              </label>
            )}

            {isOpportunityLocked ? (
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type</p>
                  <p className="font-bold text-slate-900">{lockedOpportunity?.sevaType || 'Seva'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</p>
                  <p className="font-bold text-slate-900">{lockedOpportunityDateLabel}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time</p>
                  <p className="font-bold text-slate-900">{lockedOpportunityTimeLabel}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Seats</p>
                  <p className="font-bold text-slate-900">{Number(lockedOpportunity?.registered || 0)}/{Number(lockedOpportunity?.totalRequired || 0)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Closes</p>
                  <p className="font-bold text-slate-900">{lockedOpportunity?.expiryDate ? new Date(`${lockedOpportunity.expiryDate}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected Opportunity</p>
                <p className="text-sm font-bold leading-snug text-slate-900">{selectedOpportunityLabel || 'Choose a seva opportunity from the list above.'}</p>
              </div>
            )}
          </div>
        </section>
      </div>
      {alreadyRegistered ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">You have already registered for this seva.</p>
      ) : null}
      {!alreadyRegistered ? <Button type="submit" className="w-full" disabled={submitDisabled}>{disableSubmit || options.length === 0 ? 'Registration Closed' : submitLabel}</Button> : null}
    </form>
  );
};

export default VolunteerForm;
