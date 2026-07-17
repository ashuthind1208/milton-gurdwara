import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const getDefaultOpportunityId = (options = []) => options.find((option) => option?.disabled !== true)?.id || options[0]?.id || '';

const VolunteerForm = ({
  onSubmit,
  options = [],
  disableSubmit = false,
  initialValues = {},
  allowNameEmailEdit = false
}) => {
  const identityLocked = !allowNameEmailEdit;
  const defaultValues = useMemo(() => ({
    name: String(initialValues?.name || ''),
    email: String(initialValues?.email || ''),
    phone: String(initialValues?.phone || ''),
    whatsapp: String(initialValues?.whatsapp || ''),
    contactPreference: 'Email',
    wantsEventEmails: true,
    opportunityId: getDefaultOpportunityId(options)
  }), [initialValues?.email, initialValues?.name, initialValues?.phone, initialValues?.whatsapp, options]);

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      ...defaultValues
    }
  });

  const selectedOpportunityId = watch('opportunityId');
  const selectedOption = useMemo(
    () => options.find((option) => String(option.id || '') === String(selectedOpportunityId || '')) || null,
    [options, selectedOpportunityId]
  );
  const alreadyRegistered = Boolean(selectedOption?.alreadyRegistered || selectedOption?.disabled);
  const submitDisabled = disableSubmit || options.length === 0 || alreadyRegistered;

  useEffect(() => {
    reset({
      ...defaultValues,
      opportunityId: getDefaultOpportunityId(options)
    });
  }, [defaultValues, options, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Volunteer registration form">
      <label className="block text-sm font-medium">
        Full Name
        <input
          {...register('name', { required: true })}
          readOnly={identityLocked}
          className={`mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900 ${identityLocked ? 'font-extrabold text-base text-slate-900' : ''}`}
        />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input
          {...register('email', { required: true })}
          readOnly={identityLocked}
          type="email"
          className={`mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900 ${identityLocked ? 'font-extrabold text-base text-slate-900' : ''}`}
        />
      </label>
      <label className="block text-sm font-medium">
        Phone Number
        <input {...register('phone', { required: true })} readOnly className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-base font-extrabold text-slate-900 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        WhatsApp Number
        <input {...register('whatsapp')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Seva Opportunity
        <select {...register('opportunityId', { required: true })} disabled={disableSubmit || options.length === 0} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
          {options.length === 0 ? <option value="">No open seva opportunities</option> : options.map((option) => <option key={option.id} value={option.id} disabled={Boolean(option.disabled)}>{option.label}</option>)}
        </select>
      </label>
      {alreadyRegistered ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">You have already registered for this.</p>
      ) : null}
      <label className="block text-sm font-medium">
        Preferred Contact Method
        <select {...register('contactPreference')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <option>Email</option>
          <option>Phone</option>
          <option>WhatsApp</option>
        </select>
      </label>
      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
        <input type="checkbox" {...register('wantsEventEmails')} className="mt-1" />
        <span>Send me event and seva notifications by email.</span>
      </label>
      <Button type="submit" className="w-full" disabled={submitDisabled}>{disableSubmit || options.length === 0 ? 'Registration Closed' : (alreadyRegistered ? 'You have already registered for this' : 'Register for Seva')}</Button>
    </form>
  );
};

export default VolunteerForm;
