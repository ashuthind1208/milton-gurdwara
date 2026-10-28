import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import siteNavigationService, { DEFAULT_SITE_NAVIGATION } from '../../services/siteNavigationService';

const newLink = () => ({ id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: '', path: '/', children: [] });
const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800';
const actionClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40';
const move = (items, index, direction) => {
  const updated = [...items];
  [updated[index], updated[index + direction]] = [updated[index + direction], updated[index]];
  return updated;
};

const WebsiteNavigationEditor = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState({ type: 'success', message: '' });
  const { data: saved = DEFAULT_SITE_NAVIGATION, isLoading, isError } = useQuery({ queryKey: ['site-navigation'], queryFn: siteNavigationService.get });
  const items = draft || saved;
  const update = (id, patch) => setDraft(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const mutation = useMutation({
    mutationFn: (items) => siteNavigationService.save(items),
    onSuccess: (data) => {
      queryClient.setQueryData(['site-navigation'], data);
      setDraft(null);
      setStatus({ type: 'success', message: 'Website navigation published.' });
    },
    onError: (error) => setStatus({ type: 'error', message: error?.response?.data?.message || 'Unable to save website navigation.' })
  });
  const submit = (event) => { event.preventDefault(); setStatus({ type: 'success', message: '' }); mutation.mutate(items); };

  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-heading text-xl font-bold">Website navigation</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">Keep up to 10 main items. Rename an item to Services offered or Programs, and add links underneath it. Desktop submenus open on hover or focus; mobile submenus expand on tap.</p></div>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-brand-blue">{items.length} / 10 main items</span>
    </div>
    <StatusAlert type={status.type} message={status.message} />
    {isError ? <p role="alert" className="mt-3 text-sm text-rose-700">Unable to load saved navigation. Reload before editing.</p> : null}
    <form onSubmit={submit} className="mt-4 space-y-3">
      <fieldset disabled={isLoading || isError || mutation.isPending} className="space-y-3 disabled:opacity-60">
        {items.map((item, index) => <details key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-800">{index + 1}. {item.label || 'New menu item'} <span className="font-normal text-slate-500">· {item.children?.length || 0} submenu links</span></summary>
          <div className="space-y-3 border-t border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700">Menu label<input required maxLength={50} aria-label={`Menu ${index + 1} label`} value={item.label} onChange={(event) => update(item.id, { label: event.target.value })} className={fieldClass} /></label>
              <label className="text-xs font-bold text-slate-700">Menu link<input required maxLength={1000} aria-label={`Menu ${index + 1} link`} value={item.path} onChange={(event) => update(item.id, { path: event.target.value })} className={fieldClass} /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={actionClass} disabled={index === 0} onClick={() => setDraft(move(items, index, -1))} aria-label={`Move ${item.label || 'item'} up`}>Move up</button>
              <button type="button" className={actionClass} disabled={index === items.length - 1} onClick={() => setDraft(move(items, index, 1))} aria-label={`Move ${item.label || 'item'} down`}>Move down</button>
              <button type="button" className={actionClass} disabled={items.length === 1} onClick={() => setDraft(items.filter((entry) => entry.id !== item.id))} aria-label={`Remove menu ${item.label}`}>Remove main item</button>
            </div>
            <div className="space-y-2 border-l-2 border-amber-300 pl-3">
              {(item.children || []).map((child, childIndex) => <div key={child.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold">Submenu label<input required maxLength={50} aria-label={`${item.label} submenu ${childIndex + 1} label`} value={child.label} onChange={(event) => update(item.id, { children: item.children.map((entry) => entry.id === child.id ? { ...entry, label: event.target.value } : entry) })} className={fieldClass} /></label>
                  <label className="text-xs font-semibold">Submenu link<input required maxLength={1000} aria-label={`${item.label} submenu ${childIndex + 1} link`} value={child.path} onChange={(event) => update(item.id, { children: item.children.map((entry) => entry.id === child.id ? { ...entry, path: event.target.value } : entry) })} className={fieldClass} /></label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={actionClass} disabled={childIndex === 0} onClick={() => update(item.id, { children: move(item.children, childIndex, -1) })} aria-label={`Move ${child.label || 'submenu'} up`}>Up</button><button type="button" className={actionClass} disabled={childIndex === item.children.length - 1} onClick={() => update(item.id, { children: move(item.children, childIndex, 1) })} aria-label={`Move ${child.label || 'submenu'} down`}>Down</button><button type="button" className={actionClass} onClick={() => update(item.id, { children: item.children.filter((entry) => entry.id !== child.id) })} aria-label={`Remove submenu ${child.label}`}>Remove</button></div>
              </div>)}
              <button type="button" className={actionClass} disabled={(item.children?.length || 0) >= 30} onClick={() => update(item.id, { children: [...(item.children || []), newLink()] })}>Add submenu to {item.label || 'this item'}</button>
            </div>
          </div>
        </details>)}
        <p className="text-xs text-slate-500">Use an existing site path such as /bookings or /events, or a full https:// URL. Adding a link does not create a new page.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={items.length >= 10} onClick={() => setDraft([...items, newLink()])} className={actionClass}>Add main item</button>
          <button type="button" disabled={!draft} onClick={() => setDraft(null)} className={actionClass}>Discard changes</button>
          <button type="submit" disabled={!draft} className="ml-auto rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mutation.isPending ? 'Saving…' : 'Save navigation'}</button>
        </div>
      </fieldset>
    </form>
  </Card>;
};

export default WebsiteNavigationEditor;