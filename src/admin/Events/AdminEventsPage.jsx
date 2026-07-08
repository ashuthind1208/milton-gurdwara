import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import eventService from '../../services/eventService';
import { formatDate } from '../../utils/formatters';
import Button from '../../components/ui/Button';

const AdminEventsPage = () => {
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState(null);
  const [registrationsEvent, setRegistrationsEvent] = useState(null);
  const createForm = useForm({ defaultValues: { title: '', date: '', location: '', category: 'Paath', registrations: 0 } });
  const editForm = useForm({ defaultValues: { title: '', date: '', location: '', category: 'Paath', registrations: 0 } });

  const { data: events = [] } = useQuery({ queryKey: ['admin-events'], queryFn: () => eventService.getEvents().then((res) => res.data) });

  const createMutation = useMutation({
    mutationFn: (values) => eventService.createEvent(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      createForm.reset({ title: '', date: '', location: '', category: 'Paath', registrations: 0 });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => eventService.updateEvent(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setEditingEvent(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => eventService.removeEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const removeRegistrantMutation = useMutation({
    mutationFn: ({ eventId, registrantId }) => eventService.removeEventRegistrant({ eventId, registrantId }),
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setRegistrationsEvent(updatedEvent || null);
    }
  });

  const openEdit = (event) => {
    setEditingEvent(event);
    editForm.reset({
      title: event.title,
      date: event.date ? event.date.slice(0, 16) : '',
      location: event.location,
      category: event.category,
      registrations: event.registrations
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold">Event Management</h1>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Create Event</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="text-sm">Title
            <input {...createForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Date and Time
            <input type="datetime-local" {...createForm.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Location
            <input {...createForm.register('location', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <label className="text-sm">Category
            <select {...createForm.register('category')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
              <option>Paath</option>
              <option>Workshop</option>
              <option>Seva</option>
              <option>Kirtan</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">Expected Registrations
            <input type="number" min="0" {...createForm.register('registrations')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Event'}</Button>
          </div>
        </form>
      </Card>
      <div className="space-y-3">
        {events.map((event) => (
          <Card key={event.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{formatDate(event.date)} | {event.category}</p>
              <p className="text-xs text-slate-500">{event.location}</p>
              <p className="text-xs font-semibold text-brand-blue">Registered: {event.registrations || (event.registrants || []).length || 0}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRegistrationsEvent(event)} className="rounded-lg border border-brand-blue/30 px-3 py-1.5 text-sm font-semibold text-brand-blue">Registrations</button>
              <button type="button" onClick={() => openEdit(event)} className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm dark:bg-slate-700">Edit</button>
              <button type="button" onClick={() => deleteMutation.mutate(event.id)} className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 dark:bg-red-900/30">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {editingEvent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Event</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => setEditingEvent(null)}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingEvent.id, values }))}>
              <label className="text-sm">Title
                <input {...editForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Date and Time
                <input type="datetime-local" {...editForm.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Location
                <input {...editForm.register('location', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Category
                <select {...editForm.register('category')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option>Paath</option>
                  <option>Workshop</option>
                  <option>Seva</option>
                  <option>Kirtan</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2">Registrations
                <input type="number" min="0" {...editForm.register('registrations')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={() => setEditingEvent(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {registrationsEvent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Registrations • {registrationsEvent.title}</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => setRegistrationsEvent(null)}>Close</button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Total: {registrationsEvent.registrations || 0}</p>
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {(registrationsEvent.registrants || []).length === 0 ? (
                <p className="text-sm text-slate-500">No registrations captured yet.</p>
              ) : (registrationsEvent.registrants || []).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{entry.name || 'Anonymous'}</p>
                      <p className="text-xs text-slate-600">{entry.contact || 'No contact provided'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRegistrantMutation.mutate({ eventId: registrationsEvent.id, registrantId: entry.id })}
                      className="rounded-md border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminEventsPage;
