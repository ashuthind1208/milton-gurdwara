import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';

const AdminLangarPage = () => {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const form = useForm({
    defaultValues: {
      name: '',
      category: 'Grocery',
      addedOn: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      needed: 'true'
    }
  });
  const editForm = useForm({ defaultValues: { name: '', category: 'Grocery', addedOn: '', expiryDate: '', needed: 'true' } });

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
      form.reset({ name: '', category: 'Grocery', addedOn: new Date().toISOString().slice(0, 10), expiryDate: '', needed: 'true' });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, needed }) => cmsService.updateLangarItem(id, { needed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cms-home'] })
  });

  const removeMutation = useMutation({
    mutationFn: (id) => cmsService.removeLangarItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cms-home'] })
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

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Seva Items</h1>
      <Card>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
          <label className="text-sm">Item Name<input {...form.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          <label className="text-sm">Category<input {...form.register('category', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="Grocery" /></label>
          <label className="text-sm">Status<select {...form.register('needed')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option value="true">Needed</option><option value="false">Not Needed</option></select></label>
          <label className="text-sm">Added Date<input type="date" {...form.register('addedOn', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          <label className="text-sm">Expiry Date<input type="date" {...form.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
          <div className="md:col-span-3"><Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? 'Adding...' : 'Add Item'}</Button></div>
        </form>
      </Card>

      <div className="space-y-3">
        {(cmsData?.langarItems || []).map((item) => (
          <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-800">{item.name}</p>
              <p className="text-sm text-slate-500">Category: {item.category || 'Grocery'} • Added: {item.addedOn}</p>
              <p className="text-xs text-slate-500">Expiry: {item.expiryDate || 'Not set'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openEdit(item)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">Edit</button>
              <button type="button" onClick={() => toggleMutation.mutate({ id: item.id, needed: !item.needed })} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.needed ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{item.needed ? 'Needed' : 'Not Needed'}</button>
              <button type="button" onClick={() => removeMutation.mutate(item.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600">Remove</button>
            </div>
          </Card>
        ))}
      </div>

      {editingItem ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Seva Item</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => setEditingItem(null)}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingItem.id, values }))}>
              <label className="text-sm">Item Name<input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm">Category<input {...editForm.register('category', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm">Added Date<input type="date" {...editForm.register('addedOn', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm">Expiry Date<input type="date" {...editForm.register('expiryDate')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
              <label className="text-sm md:col-span-2">Status<select {...editForm.register('needed')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"><option value="true">Needed</option><option value="false">Not Needed</option></select></label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingItem(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLangarPage;
