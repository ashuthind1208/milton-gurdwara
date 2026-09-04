import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { DEFAULT_GURDWARA_BRANDING } from '../../context/BrandingContext';
import brandingService from '../../services/brandingService';
import uploadService from '../../services/uploadService';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';

const AdminGurdwaraBrandingPage = () => {
  const queryClient = useQueryClient();
  const [uploadState, setUploadState] = useState({ pending: false, progress: 0, error: '' });
  const form = useForm({ defaultValues: DEFAULT_GURDWARA_BRANDING });
  const { data, error: brandingLoadError } = useQuery({
    queryKey: ['gurdwara-branding'],
    queryFn: () => brandingService.getBranding().then((response) => response.data)
  });

  useEffect(() => {
    if (data) form.reset({ ...DEFAULT_GURDWARA_BRANDING, ...data });
  }, [data, form]);

  const saveMutation = useMutation({
    mutationFn: (values) => brandingService.saveBranding({
      organizationName: String(values.organizationName || '').trim(),
      shortName: String(values.shortName || '').trim(),
      logoUrl: String(values.logoUrl || '').trim(),
      primaryColor: String(values.primaryColor || '').trim().toUpperCase(),
      accentColor: String(values.accentColor || '').trim().toUpperCase(),
      surfaceColor: String(values.surfaceColor || '').trim().toUpperCase()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gurdwara-branding'] });
      queryClient.invalidateQueries({ queryKey: ['ask-granthi-board'] });
    }
  });

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploadState({ pending: true, progress: 0, error: '' });
    try {
      const uploaded = await uploadService.uploadFile({
        service: 'cms',
        file,
        allowedMimeTypes: ['image/*'],
        maxSizeMB: 5,
        onProgress: (progress) => setUploadState({ pending: true, progress, error: '' })
      });
      form.setValue('logoUrl', String(uploaded?.url || ''), { shouldDirty: true, shouldValidate: true });
      setUploadState({ pending: false, progress: 0, error: '' });
    } catch (error) {
      setUploadState({ pending: false, progress: 0, error: error.message || 'Unable to upload logo.' });
    }
  };

  const values = form.watch();
  const logoSrc = values.logoUrl || gurdwaraLogo;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Super Admin only</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-slate-900">Gurdwara Branding</h1>
        <p className="mt-1 text-sm text-slate-600">Configure the name, logo, and theme used across the public website, admin portal, displays, and mobile pages.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="rounded-lg hover:translate-y-0">
          <form onSubmit={form.handleSubmit((payload) => saveMutation.mutate(payload))} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Gurdwara name
              <input {...form.register('organizationName', { required: true, minLength: 2, maxLength: 120 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Short name
              <input {...form.register('shortName', { required: true, minLength: 2, maxLength: 80 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Logo URL
              <input {...form.register('logoUrl')} placeholder="https://... or /uploads/..." className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-2 block w-full text-xs font-normal" onChange={(event) => uploadLogo(event.target.files?.[0])} />
              <p className="mt-1 text-xs font-normal text-slate-500">Paste a URL or upload PNG, JPEG, WebP, or GIF up to 5 MB.</p>
              {uploadState.pending ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-blue transition-all" style={{ width: `${uploadState.progress}%` }} /></div> : null}
              {uploadState.error ? <p className="mt-2 text-xs font-semibold text-red-700">{uploadState.error}</p> : null}
            </label>

            <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
              <legend className="px-1 text-sm font-semibold text-slate-700">Application theme</legend>
              {[
                ['primaryColor', 'Primary'],
                ['accentColor', 'Accent'],
                ['surfaceColor', 'Surface']
              ].map(([field, label]) => (
                <label key={field} className="text-xs font-semibold text-slate-600">{label}
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={values[field] || '#000000'} onChange={(event) => form.setValue(field, event.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })} className="h-10 w-12 rounded border border-slate-300 bg-white p-1" />
                    <input {...form.register(field, { required: true, pattern: /^#[0-9a-f]{6}$/i })} maxLength={7} className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 font-mono text-xs" />
                  </div>
                </label>
              ))}
            </fieldset>

            {brandingLoadError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Unable to load saved branding. The defaults are shown until the API is available.</p> : null}
            {saveMutation.isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveMutation.error?.message || 'Unable to save branding. Check the name, logo URL, and six-digit colors.'}</p> : null}
            {saveMutation.isSuccess ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Branding saved and published across the application.</p> : null}
            <Button type="submit" disabled={saveMutation.isPending || uploadState.pending}>{saveMutation.isPending ? 'Saving...' : 'Save branding'}</Button>
          </form>
        </Card>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-5" style={{ backgroundColor: values.primaryColor }}>
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="Brand preview" className="h-16 w-16 rounded-full border-2 bg-white object-cover" style={{ borderColor: values.accentColor }} />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold uppercase tracking-wider" style={{ color: values.accentColor }}>{values.shortName || 'Short name'}</p>
                <h2 className="mt-1 truncate font-heading text-2xl font-bold text-white">{values.organizationName || 'Gurdwara name'}</h2>
              </div>
            </div>
          </div>
          <div className="m-5 rounded-lg p-5" style={{ backgroundColor: values.surfaceColor }}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Application preview</p>
            <p className="mt-3 font-heading text-xl font-bold" style={{ color: values.primaryColor }}>Welcome to {values.shortName || 'your Gurdwara'}</p>
            <div className="mt-4 h-1 w-20" style={{ backgroundColor: values.accentColor }} />
            <p className="mt-4 text-sm leading-6 text-slate-700">These settings apply to shared navigation, footers, admin screens, display boards, and brand-colored controls throughout the application.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminGurdwaraBrandingPage;