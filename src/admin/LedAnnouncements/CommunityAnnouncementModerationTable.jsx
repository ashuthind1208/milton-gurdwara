import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, PencilSquareIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import { COMMUNITY_ANNOUNCEMENT_CATEGORIES } from '../../constants/communityAnnouncements';
import communityAnnouncementService from '../../services/communityAnnouncementService';
import CommunityNoticeFormDialog from './CommunityNoticeFormDialog';

const getCategoryLabel = (value, customCategories) => customCategories.find((entry) => entry.value === value)?.label || COMMUNITY_ANNOUNCEMENT_CATEGORIES.find((entry) => entry.value === value)?.label || value || 'Community notice';
const getFormatLabel = (entry) => (entry.noticeFormat || (entry.imageUrl ? 'poster' : 'text')) === 'poster' ? 'Poster' : 'Text';
const toDate = (value) => String(value || '').slice(0, 10);
const statusClass = { pending: 'bg-amber-100 text-amber-900', approved: 'bg-emerald-100 text-emerald-900', rejected: 'bg-rose-100 text-rose-900' };
const CommunityAnnouncementModerationTable = ({ creating = false, onCreatingChange }) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState({ type: 'success', message: '' });
  const { data: entries = [], isLoading, isError, error } = useQuery({
    queryKey: ['community-announcement-submissions-admin'], queryFn: communityAnnouncementService.listForReview,
    refetchInterval: 15000, refetchOnWindowFocus: true
  });
  const { data: customCategories = [] } = useQuery({ queryKey: ['community-announcement-categories'], queryFn: communityAnnouncementService.getCategories });
  const rows = useMemo(() => entries.filter((entry) => filter === 'all' || entry.status === filter), [entries, filter]);
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['community-announcement-submissions-admin'] }),
    queryClient.invalidateQueries({ queryKey: ['community-announcements-public'] })
  ]);
  const closeDialog = () => { setEditing(null); createMutation.reset(); onCreatingChange?.(false); };
  const mutation = useMutation({
    mutationFn: ({ id, payload }) => communityAnnouncementService.review(id, payload),
    onSuccess: () => { setStatus({ type: 'success', message: 'Community notice saved.' }); setEditing(null); void refresh(); },
    onError: (cause) => setStatus({ type: 'error', message: cause?.response?.data?.message || 'Unable to save the community notice.' })
  });
  const createMutation = useMutation({
    mutationFn: (values) => communityAnnouncementService.createForAdmin(values),
    onSuccess: () => { setStatus({ type: 'success', message: 'Notice created and approved.' }); closeDialog(); void refresh(); }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => communityAnnouncementService.remove(id),
    onSuccess: () => { setDeleting(null); setStatus({ type: 'success', message: 'Community notice deleted.' }); void refresh(); },
    onError: (cause) => setStatus({ type: 'error', message: cause?.response?.data?.message || 'Unable to delete the notice.' })
  });
  const toggleApproval = (entry) => mutation.mutate({ id: entry.id, payload: {
    status: entry.status === 'approved' ? 'pending' : 'approved', publishUntil: entry.publishUntil,
    featured: entry.featured === true, showContact: entry.showContact === true
  } });
  const saveNotice = (values) => {
    if (editing) mutation.mutate({ id: editing.id, payload: { ...values, status: editing.status, featured: editing.featured === true } });
    else createMutation.mutate(values);
  };
  const formError = editing ? mutation.error : createMutation.error;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-heading text-xl font-bold text-slate-900">Community Notices</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">All notices are listed here. Use the approval switch to publish or hide them. Member notices require review; admin-created notices are auto-approved.</p></div>
        <div className="ml-auto flex flex-wrap items-center gap-3"><label className="text-xs font-bold text-slate-600">Filter<select aria-label="Filter community notices" value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">All notices</option><option value="pending">Needs review</option><option value="approved">Approved</option><option value="rejected">Declined</option></select></label></div>
      </div>
      <div className="mt-3"><StatusAlert type={status.type} message={status.message} /></div>
      {isLoading ? <p className="mt-4 text-sm text-slate-500">Loading notices…</p> : null}
      {isError ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error?.response?.data?.message || error?.message || 'Unable to load community notices.'}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[910px] divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Notice</th><th className="px-3 py-3">Posted by</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Display dates</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Approved</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((entry) => <tr key={entry.id} className="align-middle hover:bg-slate-50/70">
              <td className="max-w-[260px] px-3 py-3"><div className="flex items-center gap-2">{entry.imageUrl ? <img src={entry.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded border border-slate-200 object-cover" /> : null}<div className="min-w-0"><p className="truncate font-bold text-slate-800">{entry.titleEnglish || entry.titlePunjabi || 'Poster notice'}</p><p className="truncate font-gurmukhi text-xs text-slate-500">{entry.titleEnglish && entry.titlePunjabi ? entry.titlePunjabi : getCategoryLabel(entry.category, customCategories)}</p></div></div></td>
              <td className="max-w-[170px] truncate px-3 py-3 text-slate-700">{entry.publisherName || entry.submitterName || 'Sangat member'}</td>
              <td className="px-3 py-3 text-slate-700">{getFormatLabel(entry)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{toDate(entry.publishFrom)} – {toDate(entry.publishUntil)}</td>
              <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${statusClass[entry.status] || statusClass.pending}`}>{entry.status}</span></td>
              <td className="px-3 py-3"><button type="button" role="switch" aria-checked={entry.status === 'approved'} aria-label={`Approve ${entry.titleEnglish || entry.titlePunjabi || 'community notice'}`} disabled={mutation.isPending} onClick={() => toggleApproval(entry)} className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${entry.status === 'approved' ? 'bg-emerald-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${entry.status === 'approved' ? 'translate-x-[22px]' : 'translate-x-0.5'}`} /></button></td>
              <td className="px-3 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => setViewing(entry)} aria-label={`View ${entry.titleEnglish || entry.titlePunjabi || 'notice'}`} title="View" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"><EyeIcon className="h-4 w-4" /></button><button type="button" onClick={() => { mutation.reset(); setEditing(entry); }} aria-label={`Edit ${entry.titleEnglish || entry.titlePunjabi || 'notice'}`} title="Edit" className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"><PencilSquareIcon className="h-4 w-4" /></button><button type="button" disabled={deleteMutation.isPending} onClick={() => { deleteMutation.reset(); setDeleting(entry); }} aria-label={`Delete ${entry.titleEnglish || entry.titlePunjabi || 'notice'}`} title="Delete" className="rounded-md border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"><TrashIcon className="h-4 w-4" /></button></div></td>
            </tr>)}
            {!isLoading && !isError && rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">No notices match this filter.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {editing || creating ? <CommunityNoticeFormDialog key={editing?.id || 'new'} notice={editing} categories={customCategories} onSave={saveNotice} onClose={closeDialog} isPending={mutation.isPending || createMutation.isPending} error={formError?.response?.data?.message || formError?.message || ''} /> : null}

      {viewing ? createPortal(<div className="fixed inset-0 z-[281] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}><section role="dialog" aria-modal="true" aria-labelledby="community-notice-view-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h3 id="community-notice-view-title" className="font-heading text-xl font-bold">Community notice details</h3><button type="button" onClick={() => setViewing(null)} aria-label="Close notice details" className="rounded-lg p-2 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button></div><p className="mt-3 text-sm text-slate-500">Posted by {viewing.publisherName || viewing.submitterName || 'Sangat member'} · {getCategoryLabel(viewing.category, customCategories)} · {viewing.status}</p>{viewing.imageUrl && (viewing.noticeFormat || 'poster') === 'poster' ? <img src={viewing.imageUrl} alt="Community poster" className="mt-4 max-h-[60vh] w-full rounded-xl bg-slate-900 object-contain" /> : <div className="mt-4 space-y-3">{viewing.titlePunjabi ? <h4 lang="pa" className="font-gurmukhi text-xl font-bold">{viewing.titlePunjabi}</h4> : null}<h4 className="text-xl font-bold">{viewing.titleEnglish}</h4>{viewing.descriptionPunjabi ? <p lang="pa" className="font-gurmukhi leading-7">{viewing.descriptionPunjabi}</p> : null}<p className="whitespace-pre-line leading-7">{viewing.descriptionEnglish}</p></div>}<p className="mt-4 text-sm text-slate-600">{toDate(viewing.publishFrom)} – {toDate(viewing.publishUntil)}{viewing.contactValue ? ` · ${viewing.contactPreference}: ${viewing.contactValue}` : ''}</p></section></div>, document.body) : null}
      {deleting ? createPortal(<div className="fixed inset-0 z-[281] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteMutation.isPending) setDeleting(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="community-notice-delete-title" onKeyDown={(event) => { if (event.key === 'Escape' && !deleteMutation.isPending) setDeleting(null); }} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <h3 id="community-notice-delete-title" className="font-heading text-xl font-bold">Delete community notice?</h3>
          <p className="mt-3 text-sm text-slate-600">Permanently delete “{deleting.titleEnglish || deleting.titlePunjabi || 'poster notice'}”? This cannot be undone.</p>
          {deleteMutation.isError ? <p role="alert" className="mt-3 text-sm text-rose-700">{deleteMutation.error?.response?.data?.message || 'Unable to delete the notice. Please try again.'}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button autoFocus type="button" disabled={deleteMutation.isPending} onClick={() => setDeleting(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">Cancel</button>
            <button type="button" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.id)} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{deleteMutation.isPending ? 'Deleting…' : 'Delete notice'}</button>
          </div>
        </section>
      </div>, document.body) : null}
    </Card>
  );
};

export default CommunityAnnouncementModerationTable;
