import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import volunteerService from '../../services/volunteerService';

const AdminSevaOpportunitiesPage = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [volunteerModalOpportunity, setVolunteerModalOpportunity] = useState(null);
  const createForm = useForm({ defaultValues: { sevaType: '', date: '', time: '', totalVolunteersRequired: 10, expiryDate: '' } });
  const editForm = useForm({ defaultValues: { sevaType: '', date: '', time: '', totalVolunteersRequired: 10, expiryDate: '' } });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['seva-opportunities'],
    queryFn: () => volunteerService.getSevaOpportunities().then((res) => res.data)
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => volunteerService.createSevaOpportunity(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] });
      createForm.reset({ sevaType: '', date: '', time: '', totalVolunteersRequired: 10, expiryDate: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => volunteerService.updateSevaOpportunity(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] });
      setEditing(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => volunteerService.removeSevaOpportunity(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] })
  });

  const openEdit = (item) => {
    setEditing(item);
    editForm.reset({
      sevaType: item.sevaType,
      date: item.date,
      time: item.time || '',
      totalVolunteersRequired: item.totalVolunteersRequired || 10,
      expiryDate: item.expiryDate || ''
    });
  };

  const volunteersByOpportunity = registrations.reduce((acc, entry) => {
    if (!entry.opportunityId) {
      return acc;
    }
    if (!acc[entry.opportunityId]) {
      acc[entry.opportunityId] = [];
    }
    acc[entry.opportunityId].push(entry);
    return acc;
  }, {});

  const selectedVolunteers = volunteerModalOpportunity
    ? registrations.filter((entry) => (
      entry.opportunityId === volunteerModalOpportunity.id ||
      (!entry.opportunityId && (entry.sevaType || entry.area) === volunteerModalOpportunity.sevaType && entry.sevaDate === volunteerModalOpportunity.date)
    ))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Volunteer Opportunities</h1>

      <Card>
        <h2 className="font-heading text-xl font-semibold">Add Opportunity</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="text-sm">Seva Type
            <input {...createForm.register('sevaType', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="Langar" />
          </label>
          <label className="text-sm">Date
            <input type="date" {...createForm.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Time (Optional)
            <input {...createForm.register('time')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="10:00 AM - 1:00 PM" />
          </label>
          <label className="text-sm">Total Volunteers Required
            <input type="number" min="1" {...createForm.register('totalVolunteersRequired', { valueAsNumber: true, min: 1 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Expiry Date
            <input type="date" {...createForm.register('expiryDate', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <div className="md:col-span-3">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Adding...' : 'Add Opportunity'}</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {opportunities.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800">{item.sevaType}</p>
              <p className="text-sm text-slate-600">{item.date}{item.time ? ` • ${item.time}` : ''} • {((volunteersByOpportunity[item.id] || []).length)}/{item.totalVolunteersRequired || 10}</p>
              <p className="text-xs text-slate-500">Expiry: {item.expiryDate || 'Not set'}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setVolunteerModalOpportunity(item)} className="rounded-lg border border-brand-blue/30 px-3 py-1.5 text-xs font-semibold text-brand-blue">Volunteers</button>
              <button type="button" onClick={() => openEdit(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Edit</button>
              <button type="button" onClick={() => deleteMutation.mutate(item.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Opportunity</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => setEditing(null)}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editing.id, values }))}>
              <label className="text-sm">Seva Type
                <input {...editForm.register('sevaType', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Date
                <input type="date" {...editForm.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Time
                <input {...editForm.register('time')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Total Volunteers Required
                <input type="number" min="1" {...editForm.register('totalVolunteersRequired', { valueAsNumber: true, min: 1 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...editForm.register('expiryDate', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {volunteerModalOpportunity ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Volunteers • {volunteerModalOpportunity.sevaType}</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => setVolunteerModalOpportunity(null)}>Close</button>
            </div>
            <p className="mt-1 text-sm text-slate-600">{volunteerModalOpportunity.date}{volunteerModalOpportunity.time ? ` • ${volunteerModalOpportunity.time}` : ''} • {selectedVolunteers.length}/{volunteerModalOpportunity.totalVolunteersRequired || 10}</p>
            <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {selectedVolunteers.length === 0 ? (
                <p className="text-sm text-slate-500">No volunteers registered for this opportunity yet.</p>
              ) : selectedVolunteers.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{entry.name}</p>
                  <p className="text-xs text-slate-600">{entry.phone || 'No phone'} • {entry.email || 'No email'}{entry.whatsapp ? ` • WhatsApp: ${entry.whatsapp}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSevaOpportunitiesPage;
