import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const DonationForm = ({ onSubmit, loading }) => {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      amount: 101,
      frequency: 'one-time',
      campaign: 'Langar Fund'
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Donation form">
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
        <select {...register('campaign')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900">
          <option>Langar Fund</option>
          <option>Building Fund</option>
          <option>Education Seva</option>
        </select>
      </label>
      <Button type="submit" variant="secondary" className="w-full" disabled={loading}>{loading ? 'Processing...' : 'Donate Securely'}</Button>
    </form>
  );
};

export default DonationForm;
