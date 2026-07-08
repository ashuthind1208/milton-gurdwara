import { useForm } from 'react-hook-form';
import Button from '../ui/Button';

const ContactForm = ({ onSubmit }) => {
  const { register, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Contact form">
      <label className="block text-sm font-medium">
        Name
        <input {...register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input {...register('email', { required: true })} type="email" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <label className="block text-sm font-medium">
        Message
        <textarea {...register('message', { required: true })} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
      </label>
      <Button type="submit" className="w-full">Send Message</Button>
    </form>
  );
};

export default ContactForm;
