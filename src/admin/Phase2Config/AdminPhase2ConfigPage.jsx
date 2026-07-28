import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import phase2Service from '../../services/phase2Service';

const DEFAULT_VALUES = {
  whatsAppOptInEnabled: false,
  whatsAppJoinLink: '',
  kioskModeEnabled: false,
  kioskHomeRoute: '/',
  kioskInactivityTimeoutSeconds: 90
};

const AdminPhase2ConfigPage = () => {
  const { setHeaderAction } = useOutletContext();
  const form = useForm({ defaultValues: DEFAULT_VALUES });

  const configQuery = useQuery({
    queryKey: ['phase2-channels-config'],
    queryFn: () => phase2Service.getChannelsConfig().then((res) => res.data || DEFAULT_VALUES)
  });

  useEffect(() => {
    if (!configQuery.data) {
      return;
    }

    form.reset({
      whatsAppOptInEnabled: configQuery.data.whatsAppOptInEnabled === true,
      whatsAppJoinLink: String(configQuery.data.whatsAppJoinLink || ''),
      kioskModeEnabled: configQuery.data.kioskModeEnabled === true,
      kioskHomeRoute: String(configQuery.data.kioskHomeRoute || '/'),
      kioskInactivityTimeoutSeconds: Number(configQuery.data.kioskInactivityTimeoutSeconds || 90)
    });
  }, [configQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        whatsAppOptInEnabled: values.whatsAppOptInEnabled === true,
        whatsAppJoinLink: String(values.whatsAppJoinLink || '').trim(),
        kioskModeEnabled: values.kioskModeEnabled === true,
        kioskHomeRoute: String(values.kioskHomeRoute || '/').trim() || '/',
        kioskInactivityTimeoutSeconds: Math.max(15, Math.min(1800, Number(values.kioskInactivityTimeoutSeconds || 90)))
      };

      return phase2Service.setChannelsConfig(payload).then((res) => res.data || payload);
    },
    onSuccess: (nextValues) => {
      form.reset({
        whatsAppOptInEnabled: nextValues.whatsAppOptInEnabled === true,
        whatsAppJoinLink: String(nextValues.whatsAppJoinLink || ''),
        kioskModeEnabled: nextValues.kioskModeEnabled === true,
        kioskHomeRoute: String(nextValues.kioskHomeRoute || '/'),
        kioskInactivityTimeoutSeconds: Number(nextValues.kioskInactivityTimeoutSeconds || 90)
      });
      window.alert('Phase 2 channel configuration saved.');
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to save Phase 2 channel configuration.');
    }
  });

  useEffect(() => {
    setHeaderAction(
      <AdminHeaderActionButton
        label={saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
        onClick={form.handleSubmit((values) => saveMutation.mutate(values))}
        className={saveMutation.isPending ? 'opacity-70' : ''}
      />
    );

    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, saveMutation.isPending, setHeaderAction]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="sr-only">Phase 2 Configuration</h1>
        <p className="mt-1 text-sm text-slate-600">Manage WhatsApp opt-in and kiosk runtime controls for Phase 2 rollout.</p>
      </div>

      <Card>
        {configQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading Phase 2 configuration...</p>
        ) : null}

        {configQuery.isError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Unable to load configuration. Please refresh.</p>
        ) : null}

        <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
            <h2 className="text-base font-bold text-slate-900">WhatsApp Settings</h2>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" {...form.register('whatsAppOptInEnabled')} className="h-4 w-4 rounded border-slate-300" />
              Enable WhatsApp opt-in for users
            </label>

            <label className="block text-sm font-medium text-slate-800">
              WhatsApp Join Link
              <input
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                {...form.register('whatsAppJoinLink')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-brand-blue/20 bg-blue-50/30 p-4">
            <h2 className="text-base font-bold text-slate-900">Kiosk Settings</h2>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" {...form.register('kioskModeEnabled')} className="h-4 w-4 rounded border-slate-300" />
              Enable kiosk mode behavior
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Kiosk Home Route
              <input
                type="text"
                placeholder="/"
                {...form.register('kioskHomeRoute')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Inactivity Timeout (seconds)
              <input
                type="number"
                min={15}
                max={1800}
                step={1}
                {...form.register('kioskInactivityTimeoutSeconds', { valueAsNumber: true })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminPhase2ConfigPage;
