import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import CommunityAnnouncementModerationTable from './CommunityAnnouncementModerationTable';
import { COMMUNITY_ANNOUNCEMENT_CATEGORIES } from '../../constants/communityAnnouncements';
import communityAnnouncementService from '../../services/communityAnnouncementService';
const slugify = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const AdminCommunityAnnouncementsPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [typeLabel, setTypeLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [slideDurationDraft, setSlideDurationDraft] = useState(24);
  const [status, setStatus] = useState({ type: 'success', message: '' });
  const { data: categories = [] } = useQuery({ queryKey: ['community-announcement-categories'], queryFn: communityAnnouncementService.getCategories });
  const { data: boardSettings = { slideDurationSeconds: 24 } } = useQuery({ queryKey: ['community-announcement-board-settings'], queryFn: communityAnnouncementService.getBoardSettings });
  useEffect(() => { setSlideDurationDraft(boardSettings.slideDurationSeconds || 24); }, [boardSettings.slideDurationSeconds]);
  const defaultValues = useMemo(() => new Set(COMMUNITY_ANNOUNCEMENT_CATEGORIES.map((entry) => entry.value)), []);
  const customCategories = categories.filter((entry) => !defaultValues.has(entry.value));
  const [draftCategories, setDraftCategories] = useState(null);
  const activeCategories = draftCategories || customCategories;
  const categoryMutation = useMutation({
    mutationFn: communityAnnouncementService.saveCategories,
    onSuccess: (saved) => {
      setDraftCategories(null);
      setStatus({ type: 'success', message: 'Community notice types saved.' });
      queryClient.setQueryData(['community-announcement-categories'], saved);
    },
    onError: (error) => setStatus({ type: 'error', message: error?.response?.data?.message || 'Unable to save notice types.' })
  });
  const boardSettingsMutation = useMutation({
    mutationFn: communityAnnouncementService.saveBoardSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['community-announcement-board-settings'], saved);
      setStatus({ type: 'success', message: 'Notice board slide timing saved.' });
    },
    onError: (error) => setStatus({ type: 'error', message: error?.response?.data?.message || 'Unable to save notice board timing.' })
  });

  const addType = () => {
    const label = typeLabel.trim();
    const value = slugify(label);
    if (!value || !label || categories.some((entry) => entry.value === value)) return;
    setDraftCategories([...activeCategories, { value, label }]);
    setTypeLabel('');
  };
  const removeType = (value) => setDraftCategories(activeCategories.filter((entry) => entry.value !== value));
  const saveTypes = () => categoryMutation.mutate(activeCategories);

  useEffect(() => {
    setHeaderAction(<AdminHeaderActionButton label="Add notice" onClick={() => setCreating(true)} />);
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-r from-[#123760] to-[#285d82] p-5 text-white shadow-sm sm:p-6">
        <h1 className="font-heading text-2xl font-black sm:text-3xl">Community Notice Administration</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-100">Create and publish official notices, review member requests, manage notice types, and remove expired or inappropriate content. Approved notices automatically appear on the Community Announcements LED board.</p>
      </header>
      <StatusAlert type={status.type} message={status.message} />

      <Card className="border-violet-200 bg-violet-50/40">
        <h2 className="font-heading text-xl font-bold">Manage notice types</h2>
        <p className="mt-1 text-sm text-slate-600">Built-in types remain available; add or remove custom types. Types in use by an active notice cannot be removed.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={typeLabel} onChange={(event) => setTypeLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addType(); } }} maxLength={80} placeholder="e.g. Government services or Housing" aria-label="New notice type name" className="min-h-10 min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
          <button type="button" onClick={addType} disabled={!typeLabel.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><PlusIcon className="h-4 w-4" /> Add type</button>
          {draftCategories ? <button type="button" onClick={saveTypes} disabled={categoryMutation.isPending} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white">{categoryMutation.isPending ? 'Saving…' : 'Save types'}</button> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMUNITY_ANNOUNCEMENT_CATEGORIES.map((entry) => <span key={entry.value} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">{entry.label}</span>)}
          {activeCategories.map((entry) => <span key={entry.value} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{entry.label}<button type="button" onClick={() => removeType(entry.value)} aria-label={`Remove ${entry.label}`} className="rounded-full p-1 text-rose-700 hover:bg-rose-50"><TrashIcon className="h-3.5 w-3.5" /></button></span>)}
        </div>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-heading text-xl font-bold">LED slide timing</h2><p className="mt-1 text-sm text-slate-600">Choose how long each page of up to six notices stays on screen before advancing.</p></div>
          <div className="flex items-center gap-2"><label htmlFor="notice-slide-duration" className="text-sm font-bold text-slate-700">Seconds per slide</label><input id="notice-slide-duration" aria-label="Seconds per notice slide" type="number" min="5" max="120" step="1" value={slideDurationDraft} disabled={boardSettingsMutation.isPending} onChange={(event) => setSlideDurationDraft(Number(event.target.value))} className="w-24 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" /><button type="button" disabled={boardSettingsMutation.isPending || !Number.isInteger(slideDurationDraft) || slideDurationDraft < 5 || slideDurationDraft > 120 || slideDurationDraft === (boardSettings.slideDurationSeconds || 24)} onClick={() => boardSettingsMutation.mutate({ slideDurationSeconds: slideDurationDraft })} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{boardSettingsMutation.isPending ? 'Saving…' : 'Save timing'}</button></div>
        </div>
      </Card>

      <CommunityAnnouncementModerationTable creating={creating} onCreatingChange={setCreating} />
    </div>
  );
};

export default AdminCommunityAnnouncementsPage;
