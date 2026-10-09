import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import ledScreenService from '../../services/ledScreenService';

const screenStateClass = {
  online: 'bg-emerald-100 text-emerald-800',
  offline: 'bg-red-100 text-red-800',
  unknown: 'bg-slate-100 text-slate-600'
};

const LedScreenOperationsCard = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [status, setStatus] = useState({ type: '', message: '' });
  const healthQuery = useQuery({ queryKey: ['led-screen-health'], queryFn: ledScreenService.getHealth, refetchInterval: 30000 });
  const overrideQuery = useQuery({ queryKey: ['led-emergency-override'], queryFn: ledScreenService.getOverride, refetchInterval: 10000 });

  const mutation = useMutation({
    mutationFn: ledScreenService.setOverride,
    onSuccess: (override) => {
      queryClient.setQueryData(['led-emergency-override'], override?.active ? override : null);
      setStatus({ type: 'success', message: override?.active ? 'Emergency notice is active on the LED screens.' : 'Emergency override cleared.' });
      if (!override?.active) { setTitle(''); setDetails(''); }
    },
    onError: (error) => setStatus({ type: 'error', message: error?.response?.data?.message || 'Unable to change the emergency override.' })
  });

  const activate = (event) => {
    event.preventDefault();
    if (!window.confirm('This will replace the scheduled content on all LED screens. Activate the emergency notice?')) return;
    mutation.mutate({ active: true, title: title.trim(), details: details.trim(), durationMinutes: Number(durationMinutes) });
  };

  const override = overrideQuery.data;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-heading text-xl font-semibold">Emergency override</h2><p className="mt-1 text-sm text-slate-600">One admin action replaces the regular slideshow across all configured LED screens. It expires automatically.</p></div>
          {override?.active ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase text-red-700">Active</span> : null}
        </div>
        <div className="mt-3"><StatusAlert type={status.type} message={status.message} /></div>
        {override?.active ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-bold text-red-900">{override.title}</p>
            {override.details ? <p className="mt-1 whitespace-pre-wrap text-sm text-red-800">{override.details}</p> : null}
            <p className="mt-2 text-xs text-red-700">Ends {new Date(override.endsAt).toLocaleString()}</p>
            <button type="button" disabled={mutation.isPending} onClick={() => { if (window.confirm('Clear the emergency override on all screens?')) mutation.mutate({ active: false }); }} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Clear override</button>
          </div>
        ) : (
          <form onSubmit={activate} className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Urgent headline<input required minLength={2} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="e.g. Please proceed to the main hall" /></label>
            <label className="block text-sm font-semibold text-slate-700">Instructions (optional)<textarea maxLength={500} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Add clear directions for the sangat." /></label>
            <label className="block text-sm font-semibold text-slate-700">Auto-clear after<select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="mt-1 rounded-lg border border-slate-300 px-3 py-2"><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={240}>4 hours</option></select></label>
            <button type="submit" disabled={mutation.isPending || !title.trim()} className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{mutation.isPending ? 'Activating…' : 'Take over all LED screens'}</button>
          </form>
        )}
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-xl font-semibold">Screen health</h2><p className="mt-1 text-sm text-slate-600">Kiosk heartbeat and last reported slide. Screens go offline after 90 seconds without a ping.</p></div><button type="button" onClick={() => healthQuery.refetch()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Refresh</button></div>
        <div className="mt-4 space-y-2">
          {(healthQuery.data || []).map((screen) => (
            <div key={screen.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0"><p className="font-semibold text-slate-800">{screen.label}</p><p className="truncate text-xs text-slate-500">{screen.currentSlide || (screen.lastSeenAt ? 'No slide detail' : 'No heartbeat received')}</p><p className="text-xs text-slate-500">{screen.lastSeenAt ? `Last seen ${new Date(screen.lastSeenAt).toLocaleString()}` : 'Not yet connected'}</p></div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${screenStateClass[screen.status] || screenStateClass.unknown}`}>{screen.status === 'online' ? `Online · ${screen.ageSeconds}s` : screen.status}</span>
            </div>
          ))}
          {!healthQuery.isLoading && !(healthQuery.data || []).length ? <p className="text-sm text-slate-500">Screen status is unavailable.</p> : null}
        </div>
      </Card>
    </div>
  );
};

export default LedScreenOperationsCard;
