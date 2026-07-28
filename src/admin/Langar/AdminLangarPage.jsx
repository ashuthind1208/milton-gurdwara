import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CheckIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import cmsService from '../../services/cmsService';

const actionIconClass = 'h-4 w-4';
const LANGAR_PAGE_SIZE = 10;

const defaultForm = {
  name: '',
  category: 'Grocery',
  addedOn: new Date().toISOString().slice(0, 10),
  expiryDate: '',
  statusType: 'required_soon',
  customStatusLabel: '',
  customNeeded: 'true'
};

const resolveStatusPreview = (item = {}) => {
  if (item.stockStatus === 'custom' && item.customStatusLabel) {
    return item.customStatusLabel;
  }
  if (item.stockStatus === 'stock_available') {
    return 'Stock Available';
  }
  return 'Required Soon';
};

const buildLangarPayload = (values) => {
  const isCustom = values.statusType === 'custom';
  const needed = isCustom ? values.customNeeded === 'true' : values.statusType === 'required_soon';
  return {
    name: values.name,
    category: values.category,
    addedOn: values.addedOn,
    expiryDate: values.expiryDate,
    needed,
    stockStatus: values.statusType,
    customStatusLabel: isCustom ? (values.customStatusLabel || '').trim() : ''
  };
};

const AdminLangarPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const form = useForm({ defaultValues: defaultForm });
  const editForm = useForm({ defaultValues: defaultForm });
  const createStatusType = form.watch('statusType');
  const editStatusType = editForm.watch('statusType');

  const { data: cmsData } = useQuery({
    queryKey: ['cms-home'],
    queryFn: () => cmsService.getHomeContent().then((res) => res.data)
  });

  const langarItems = useMemo(() => cmsData?.langarItems || [], [cmsData?.langarItems]);

  const categoryOptions = useMemo(() => {
    const categories = langarItems
      .map((item) => String(item?.category || '').trim())
      .filter(Boolean);
    return [...new Set(categories)].sort((a, b) => a.localeCompare(b));
  }, [langarItems]);

  const filteredItems = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return langarItems.filter((item) => {
      const statusOk = statusFilter === 'all'
        ? true
        : statusFilter === 'required_soon'
          ? item.needed === true
          : item.needed !== true;
      const categoryOk = categoryFilter === 'all' ? true : String(item?.category || '') === categoryFilter;

      if (!statusOk || !categoryOk) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [item?.name, item?.category, item?.stockStatus, item?.customStatusLabel]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [categoryFilter, langarItems, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / LANGAR_PAGE_SIZE));
  const visibleItems = useMemo(() => {
    const start = (page - 1) * LANGAR_PAGE_SIZE;
    return filteredItems.slice(start, start + LANGAR_PAGE_SIZE);
  }, [filteredItems, page]);

  const addMutation = useMutation({
    mutationFn: (values) => cmsService.addLangarItem(buildLangarPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      form.reset(defaultForm);
      setCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => cmsService.updateLangarItem(id, buildLangarPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      setEditingItem(null);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, needed }) => cmsService.updateLangarItem(id, { needed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cms-home'] })
  });

  const removeMutation = useMutation({
    mutationFn: (id) => cmsService.removeLangarItem(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      setViewItem((prev) => (prev?.id === id ? null : prev));
      setEditingItem((prev) => (prev?.id === id ? null : prev));
    }
  });

  const openEdit = (item) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      category: item.category || 'Grocery',
      addedOn: item.addedOn || '',
      expiryDate: item.expiryDate || '',
      statusType: item.stockStatus || (item.needed ? 'required_soon' : 'stock_available'),
      customStatusLabel: item.customStatusLabel || '',
      customNeeded: item.needed ? 'true' : 'false'
    });
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewItem(null);
    setEditingItem(null);
  };

  useEffect(() => {
    setHeaderAction(<AdminHeaderActionButton label="Add New Seva Item" onClick={() => setCreateOpen(true)} />);

    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Seva Items</h1>

      <Card>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Search
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item name or category"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              <option value="required_soon">Required Soon</option>
              <option value="stock_available">Stock Available</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Added</th>
                <th className="py-2 pr-3">Expiry</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800">
                    <div className="space-y-1.5 lg:hidden">
                      <p className="text-sm font-bold leading-tight text-slate-800">{item.name || '-'}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{item.category || 'Grocery'}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{item.addedOn || '-'}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{item.expiryDate || '-'}</p>
                      <div className="pt-0.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.needed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                          {resolveStatusPreview(item)}
                        </span>
                      </div>
                    </div>
                    <span className="hidden lg:inline">{item.name || '-'}</span>
                  </td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">{item.category || 'Grocery'}</td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">{item.addedOn || '-'}</td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">{item.expiryDate || '-'}</td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.needed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      {resolveStatusPreview(item)}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate({ id: item.id, needed: !item.needed })}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${item.needed ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                        title={item.needed ? 'Mark inactive' : 'Mark active'}
                        aria-label={item.needed ? 'Mark inactive' : 'Mark active'}
                      >
                        <CheckIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewItem(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        title="View"
                        aria-label="View"
                      >
                        <EyeIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilSquareIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <TrashIcon className={actionIconClass} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>No seva items found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredItems.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Showing {visibleItems.length} of {filteredItems.length} seva items</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((prev) => prev - 1)}
              >
                Prev
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {page} of {totalPages}</span>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-2xl font-semibold text-brand-blue">Add Seva Item</h3>
              <button type="button" className="rounded-md border border-brand-blue/30 bg-white px-2 py-1 text-sm font-semibold text-brand-blue" onClick={closeModals}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
              <label className="text-sm">Item Name
                <input {...form.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Category
                <input {...form.register('category', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Added Date
                <input type="date" {...form.register('addedOn', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...form.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Seva Status Category
                <select {...form.register('statusType')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="required_soon">Required Soon</option>
                  <option value="stock_available">Stock Available</option>
                  <option value="custom">Custom Label</option>
                </select>
              </label>
              {createStatusType === 'custom' ? (
                <>
                  <label className="text-sm md:col-span-2">Custom Status Label
                    <input {...form.register('customStatusLabel', { required: createStatusType === 'custom' })} placeholder="Ex: Seasonal shortage" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                  </label>
                  <label className="text-sm md:col-span-2">Base Status Tone
                    <select {...form.register('customNeeded')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                      <option value="true">Required Soon (orange)</option>
                      <option value="false">Stock Available (green)</option>
                    </select>
                  </label>
                </>
              ) : null}
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? 'Saving...' : 'Create Item'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {viewItem ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-2xl font-semibold text-brand-blue">Seva Item Details</h3>
              <button type="button" className="rounded-md border border-brand-blue/30 bg-white px-2 py-1 text-sm font-semibold text-brand-blue" onClick={closeModals}>Close</button>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-brand-blue/20">
              <table className="min-w-full text-left text-sm">
                <tbody>
                  <tr className="border-b border-slate-200 bg-white/80"><td className="px-3 py-2 font-semibold text-brand-blue">Name</td><td className="px-3 py-2 text-slate-800">{viewItem.name || '-'}</td></tr>
                  <tr className="border-b border-slate-200 bg-amber-50/50"><td className="px-3 py-2 font-semibold text-brand-blue">Category</td><td className="px-3 py-2 text-slate-800">{viewItem.category || '-'}</td></tr>
                  <tr className="border-b border-slate-200 bg-white/80"><td className="px-3 py-2 font-semibold text-brand-blue">Added On</td><td className="px-3 py-2 text-slate-800">{viewItem.addedOn || '-'}</td></tr>
                  <tr className="border-b border-slate-200 bg-amber-50/50"><td className="px-3 py-2 font-semibold text-brand-blue">Expiry</td><td className="px-3 py-2 text-slate-800">{viewItem.expiryDate || '-'}</td></tr>
                  <tr className="bg-white/80"><td className="px-3 py-2 font-semibold text-brand-blue">Status</td><td className="px-3 py-2 text-brand-saffron font-bold">{resolveStatusPreview(viewItem)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-2xl font-semibold text-brand-blue">Edit Seva Item</h3>
              <button type="button" className="rounded-md border border-brand-blue/30 bg-white px-2 py-1 text-sm font-semibold text-brand-blue" onClick={closeModals}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingItem.id, values }))}>
              <label className="text-sm">Item Name
                <input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Category
                <input {...editForm.register('category', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Added Date
                <input type="date" {...editForm.register('addedOn', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...editForm.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Seva Status Category
                <select {...editForm.register('statusType')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="required_soon">Required Soon</option>
                  <option value="stock_available">Stock Available</option>
                  <option value="custom">Custom Label</option>
                </select>
              </label>
              {editStatusType === 'custom' ? (
                <>
                  <label className="text-sm md:col-span-2">Custom Status Label
                    <input {...editForm.register('customStatusLabel', { required: editStatusType === 'custom' })} placeholder="Ex: Limited stock until Friday" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                  </label>
                  <label className="text-sm md:col-span-2">Base Status Tone
                    <select {...editForm.register('customNeeded')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                      <option value="true">Required Soon (orange)</option>
                      <option value="false">Stock Available (green)</option>
                    </select>
                  </label>
                </>
              ) : null}
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLangarPage;
