import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CheckIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';

const actionIconClass = 'h-4 w-4';

const defaultForm = {
  name: '',
  category: 'Grocery',
  addedOn: new Date().toISOString().slice(0, 10),
  expiryDate: '',
  needed: 'true'
};

const AdminLangarPage = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const form = useForm({ defaultValues: defaultForm });
  const editForm = useForm({ defaultValues: defaultForm });

  const { data: cmsData } = useQuery({
    queryKey: ['cms-home'],
    queryFn: () => cmsService.getHomeContent().then((res) => res.data)
  });

  const addMutation = useMutation({
    mutationFn: (values) => cmsService.addLangarItem({
      name: values.name,
      category: values.category,
      addedOn: values.addedOn,
      expiryDate: values.expiryDate,
      needed: values.needed === 'true'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      form.reset(defaultForm);
      setCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => cmsService.updateLangarItem(id, {
      name: values.name,
      category: values.category,
      addedOn: values.addedOn,
      expiryDate: values.expiryDate,
      needed: values.needed === 'true'
    }),
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
      needed: item.needed ? 'true' : 'false'
    });
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewItem(null);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Seva Items</h1>
        <Button type="button" onClick={() => setCreateOpen(true)}>Add New Seva Item</Button>
      </div>

      <Card>
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
              {(cmsData?.langarItems || []).map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800">{item.name || '-'}</td>
                  <td className="py-2 pr-3">{item.category || 'Grocery'}</td>
                  <td className="py-2 pr-3">{item.addedOn || '-'}</td>
                  <td className="py-2 pr-3">{item.expiryDate || '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.needed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {item.needed ? 'Active' : 'Inactive'}
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
              {(cmsData?.langarItems || []).length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>No seva items found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add Seva Item</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
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
              <label className="text-sm md:col-span-2">Status
                <select {...form.register('needed')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? 'Saving...' : 'Create Item'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewItem ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Seva Item Details</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p><span className="font-semibold">Name:</span> {viewItem.name || '-'}</p>
              <p><span className="font-semibold">Category:</span> {viewItem.category || '-'}</p>
              <p><span className="font-semibold">Added On:</span> {viewItem.addedOn || '-'}</p>
              <p><span className="font-semibold">Expiry:</span> {viewItem.expiryDate || '-'}</p>
              <p><span className="font-semibold">Status:</span> {viewItem.needed ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Seva Item</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
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
              <label className="text-sm md:col-span-2">Status
                <select {...editForm.register('needed')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLangarPage;
