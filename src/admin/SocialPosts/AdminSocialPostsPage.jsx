import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import socialService from '../../services/socialService';
import eventService from '../../services/eventService';

const fieldClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20';

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const STATUS_STYLES = {
  posted: 'bg-emerald-100 text-emerald-700',
  'dry-run': 'bg-slate-200 text-slate-700',
  partial: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-600'
};

const Toggle = ({ label, hint, checked, onChange }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" />
    <span><span className="block text-sm font-semibold text-slate-800">{label}</span>{hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}</span>
  </label>
);

const SetupItem = ({ ok, label }) => (
  <li className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
    <span aria-hidden="true">{ok ? '✔' : '✖'}</span>{label}
  </li>
);

const AdminSocialPostsPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState({ type: '', message: '' });
  const [date, setDate] = useState(todayKey());
  const [previewKey, setPreviewKey] = useState(0);
  const [draft, setDraft] = useState(null);

  const settingsQuery = useQuery({ queryKey: ['social-settings'], queryFn: socialService.getSettings });
  const logQuery = useQuery({ queryKey: ['social-log'], queryFn: socialService.getLog, refetchInterval: 30000 });
  const eventsQuery = useQuery({ queryKey: ['social-events'], queryFn: async () => (await eventService.getEvents()).data });

  const settings = draft || settingsQuery.data?.settings;
  const serverStatus = settingsQuery.data?.status;
  const dirty = Boolean(draft);

  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (Array.isArray(eventsQuery.data) ? eventsQuery.data : [])
      .filter((event) => event.active !== false && new Date(event.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 12);
  }, [eventsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: socialService.saveSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['social-settings'], data);
      setDraft(null);
      setStatus({ type: 'success', message: 'Settings saved.' });
    },
    onError: (error) => setStatus({ type: 'error', message: error?.response?.data?.message || 'Could not save settings.' })
  });

  const postMutation = useMutation({
    mutationFn: socialService.post,
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['social-log'] });
      const failed = (record.results || []).filter((item) => item.status === 'failed');
      setStatus({
        type: record.status === 'posted' || record.status === 'dry-run' ? 'success' : 'error',
        message: record.status === 'dry-run'
          ? 'Dry run complete: the card was created and nothing was posted. See the log below.'
          : failed.length ? `Some posts failed: ${failed.map((item) => `${item.platform}: ${item.message}`).join('; ')}` : `Result: ${record.status}.`
      });
    },
    onError: (error) => setStatus({ type: 'error', message: error?.response?.data?.message || 'Could not create the post.' })
  });

  const update = (patch) => setDraft({ ...settings, ...patch });
  const postNow = (payload) => {
    const live = settings && !settings.dryRun;
    if (live && !window.confirm('This will publish to the connected social accounts now. Continue?')) return;
    postMutation.mutate({ ...payload, dryRun: !live });
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Social Posts</h1>
        <p className="mt-1 text-sm text-slate-600">Daily Hukamnama cards and event posters for Instagram and Facebook.</p>
      </div>
      <StatusAlert type={status.type} message={status.message} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Connection</h2>
          {serverStatus ? (
            <ul className="mt-3 space-y-1.5">
              <SetupItem ok={serverStatus.postingEnabled} label="Live publishing enabled (ENABLE_SOCIAL_CARDS=true)" />
              <SetupItem ok={serverStatus.instagramConfigured} label="Instagram (META_PAGE_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID)" />
              <SetupItem ok={serverStatus.facebookConfigured} label="Facebook Page (META_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID)" />
              <SetupItem ok={serverStatus.publicUrlIsHttps} label={`Public https address (PUBLIC_SITE_URL${serverStatus.publicBaseUrl ? `: ${serverStatus.publicBaseUrl}` : ''})`} />
            </ul>
          ) : <p className="mt-3 text-sm text-slate-500">Loading…</p>}
          <p className="mt-3 text-xs text-slate-500">Times use {serverStatus?.timeZone || 'the server time zone'}. Server settings are changed in the server environment, not here.</p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Automatic posting</h2>
          {settings ? (
            <div className="mt-3 space-y-3">
              <Toggle label="Test mode (dry run)" hint="Creates the card and logs it, but posts nothing. Keep this on until a manual test looks right." checked={settings.dryRun} onChange={(dryRun) => update({ dryRun })} />
              <Toggle label="Post the daily Hukamnama" checked={settings.hukamnamaAuto} onChange={(hukamnamaAuto) => update({ hukamnamaAuto })} />
              <div className="grid grid-cols-1 gap-3">
                <label className="text-sm font-semibold text-slate-700">Post daily Hukamnama at<input type="time" value={settings.hukamnamaTime} onChange={(event) => update({ hukamnamaTime: event.target.value })} className={`${fieldClass} mt-1 w-full`} /></label>
              </div>
              <Toggle label="Post a poster when a new event is added" checked={settings.eventAuto} onChange={(eventAuto) => update({ eventAuto })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle label="Instagram" checked={settings.instagram} onChange={(instagram) => update({ instagram })} />
                <Toggle label="Facebook" checked={settings.facebook} onChange={(facebook) => update({ facebook })} />
              </div>
              <button type="button" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate(settings)} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saveMutation.isPending ? 'Saving…' : 'Save settings'}</button>
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">Loading…</p>}
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Hukamnama card</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">Date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPreviewKey((key) => key + 1); }} className={`${fieldClass} mt-1 block`} /></label>
          <button type="button" onClick={() => postNow({ kind: 'hukamnama', date })} disabled={postMutation.isPending} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{settings && !settings.dryRun ? 'Post now' : 'Test post (dry run)'}</button>
        </div>
        <img key={previewKey} src={socialService.hukamnamaCardUrl(date)} alt="Hukamnama card preview" className="mt-4 w-full max-w-sm rounded-xl border border-slate-200 bg-slate-100" onError={(event) => { event.currentTarget.style.display = 'none'; }} onLoad={(event) => { event.currentTarget.style.display = ''; }} />
        <p className="mt-2 text-xs text-slate-500">If no card appears, no Hukamnama has been posted for that date yet.</p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Event posters</h2>
        {upcoming.length === 0 ? <p className="mt-3 text-sm text-slate-500">No upcoming events.</p> : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                <img src={socialService.eventCardUrl(event.id)} alt={`Poster for ${event.title}`} loading="lazy" className="w-full rounded-lg border border-slate-200 bg-slate-100" />
                <p className="mt-2 truncate text-sm font-semibold text-slate-800" title={event.title}>{event.title}</p>
                <button type="button" onClick={() => postNow({ kind: 'event', eventId: event.id })} disabled={postMutation.isPending} className="mt-2 w-full rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{settings && !settings.dryRun ? 'Post poster' : 'Test post (dry run)'}</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Recent posts</h2>
        {(logQuery.data || []).length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pr-4">When</th><th className="py-2 pr-4">What</th><th className="py-2 pr-4">How</th><th className="py-2 pr-4">Result</th><th className="py-2">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {logQuery.data.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{item.title}</td>
                    <td className="py-2 pr-4 capitalize">{item.mode}</td>
                    <td className="py-2 pr-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[item.status] || STATUS_STYLES.skipped}`}>{item.status}</span></td>
                    <td className="py-2 text-xs text-slate-600">{(item.results || []).map((result) => `${result.platform}: ${result.status}${result.message ? ` (${result.message})` : ''}`).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminSocialPostsPage;
