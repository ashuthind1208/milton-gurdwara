import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import PageHero from '../../components/common/PageHero';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const LoginPage = () => {
  const meta = useSeoMeta('Admin Login', 'Secure admin login for dashboard and content management.');
  const { register, handleSubmit } = useForm({ defaultValues: { email: 'admin@singhsabhamilton.org', password: 'password123' } });
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (values) => {
    setError('');
    try {
      await login(values);
      navigate('/admin');
    } catch (err) {
      setError('Invalid credentials.');
    }
  };

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Admin Login" description="Sign in to manage CMS, events, donations, volunteers, users, and analytics." />
      <Card className="mx-auto max-w-md">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <label className="block text-sm font-medium">Email
            <input type="email" {...register('email', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          <label className="block text-sm font-medium">Password
            <input type="password" {...register('password', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-900" />
          </label>
          {error ? <p className="text-sm text-brand-error">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
