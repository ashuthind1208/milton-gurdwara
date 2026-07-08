import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const VolunteerForm = ({ onSubmit, options = [], disableSubmit = false }) => {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      opportunityId: options[0]?.id || ''
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Volunteer registration form">
      <label className="block text-sm font-medium">
        Full Name
        <input {...register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input {...register('email', { required: true })} type="email" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Phone Number
        <input {...register('phone')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        WhatsApp Number
        <input {...register('whatsapp')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Seva Opportunity
        <select {...register('opportunityId', { required: true })} disabled={disableSubmit || options.length === 0} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
          {options.length === 0 ? <option value="">No open seva opportunities</option> : options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
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
      <Button type="submit" className="w-full" disabled={disableSubmit || options.length === 0}>{disableSubmit || options.length === 0 ? 'Registration Closed' : 'Register for Seva'}</Button>
    </form>
  );
};

export default VolunteerForm;
