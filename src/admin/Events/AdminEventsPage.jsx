import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import eventService from '../../services/eventService';
import { formatDate } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import { siteConfig } from '../../constants/siteConfig';
import { downloadRegistrationCsv, downloadRegistrationPdf } from '../../utils/csvExport';
import uploadService from '../../services/uploadService';
import StatusAlert from '../../components/common/StatusAlert';

const actionIconClass = 'h-4 w-4';
const quarterMinuteOptions = ['00', '15', '30', '45'];

const toInputDateTime = (value) => {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 16);
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const splitDateTime = (value) => {
  const normalized = toInputDateTime(value);
  if (!normalized) {
    return { day: '', hour: '09', minute: '00' };
  }

  const [day, time = '09:00'] = normalized.split('T');
  const [hour = '09', minuteRaw = '00'] = time.split(':');
  const minute = quarterMinuteOptions.includes(minuteRaw) ? minuteRaw : '00';

  return {
    day,
    hour,
    minute
  };
};

const combineDateTime = (day, hour, minute) => {
  if (!day) {
    return '';
  }
  return `${day}T${hour}:${minute}`;
};

const plusOneHour = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  parsed.setHours(parsed.getHours() + 1);
  return toInputDateTime(parsed);
};

const getDatePart = (value) => splitDateTime(value).day;

const applyDayToDateTime = (day, existingDateTime, fallbackHour = '09', fallbackMinute = '00') => {
  const { hour, minute } = splitDateTime(existingDateTime);
  return combineDateTime(day, hour || fallbackHour, minute || fallbackMinute);
};

const EventTimeField = ({ label, triggerLabel, value, onCommit, required = false }) => {
  const parsed = useMemo(() => splitDateTime(value), [value]);
  const [draftHour, setDraftHour] = useState(parsed.hour);
  const [draftMinute, setDraftMinute] = useState(parsed.minute);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    if (!timePickerOpen) {
      setDraftHour(parsed.hour);
      setDraftMinute(parsed.minute);
    }
  }, [parsed.hour, parsed.minute, timePickerOpen]);

  return (
    <div className="text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </p>
      <button
        type="button"
        onClick={() => setTimePickerOpen((prev) => !prev)}
        className="mt-1 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        {triggerLabel || 'Set Time'} ({draftHour}:{draftMinute})
      </button>

      {timePickerOpen ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Hour
              <select
                value={draftHour}
                onChange={(event) => setDraftHour(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2"
              >
                {Array.from({ length: 24 }, (_, hour) => {
                  const valueHour = String(hour).padStart(2, '0');
                  return <option key={valueHour} value={valueHour}>{valueHour}</option>;
                })}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Minute
              <select
                value={draftMinute}
                onChange={(event) => setDraftMinute(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2"
              >
                {quarterMinuteOptions.map((minute) => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftHour(parsed.hour);
                setDraftMinute(parsed.minute);
                setTimePickerOpen(false);
              }}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onCommit({ hour: draftHour, minute: draftMinute });
                setTimePickerOpen(false);
              }}
              className="rounded-md bg-brand-blue px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const defaultForm = {
  title: '',
  date: '',
  endDate: '',
  location: '',
  category: 'Paath',
  mediaUrl: '',
  registrations: 0,
  active: true
};

const AdminEventsPage = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewEvent, setViewEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [createUploadPending, setCreateUploadPending] = useState(false);
  const [editUploadPending, setEditUploadPending] = useState(false);
  const [createUploadProgress, setCreateUploadProgress] = useState(0);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });

  const createForm = useForm({ defaultValues: defaultForm });
  const editForm = useForm({ defaultValues: defaultForm });

  const createStartValue = createForm.watch('date');
  const createEndValue = createForm.watch('endDate');
  const editStartValue = editForm.watch('date');
  const editEndValue = editForm.watch('endDate');

  const createDay = getDatePart(createStartValue);
  const editDay = getDatePart(editStartValue);

  const { data: events = [] } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => eventService.getEvents().then((res) => res.data)
  });

  const createMutation = useMutation({
    mutationFn: (values) => eventService.createEvent(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      createForm.reset(defaultForm);
      setCreateOpen(false);
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

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => eventService.updateEvent(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => eventService.removeEvent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setViewEvent((prev) => (prev?.id === id ? null : prev));
      setEditingEvent((prev) => (prev?.id === id ? null : prev));
    }
  });

  const removeRegistrantMutation = useMutation({
    mutationFn: ({ eventId, registrantId }) => eventService.removeEventRegistrant({ eventId, registrantId }),
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (updatedEvent?.id) {
        setViewEvent(updatedEvent);
      }
    }
  });

  const openEdit = (event) => {
    setEditingEvent(event);
    const startValue = toInputDateTime(event.date);
    const endValue = toInputDateTime(event.endDate || plusOneHour(event.date));

    editForm.reset({
      title: event.title,
      date: startValue,
      endDate: endValue,
      location: event.location,
      category: event.category,
      mediaUrl: event.mediaUrl || '',
      registrations: event.registrations || 0,
      active: typeof event.active === 'boolean' ? event.active : true
    });
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewEvent(null);
    setEditingEvent(null);
  };

  const openCreateModal = () => {
    const now = new Date();
    now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
    const start = toInputDateTime(now);
    const end = plusOneHour(start);

    createForm.reset({
      ...defaultForm,
      date: start,
      endDate: end
    });
    setCreateOpen(true);
  };

  const uploadEventFileToForm = async ({ file, mode }) => {
    if (!file) {
      return;
    }

    try {
      if (mode === 'create') {
        setCreateUploadPending(true);
        setCreateUploadProgress(0);
      } else {
        setEditUploadPending(true);
        setEditUploadProgress(0);
      }

      const uploaded = await uploadService.uploadFile({
        service: 'events',
        file,
        allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
        maxSizeMB: 15,
        onProgress: (percent) => {
          if (mode === 'create') {
            setCreateUploadProgress(percent);
            return;
          }

          setEditUploadProgress(percent);
        }
      });
      const nextUrl = uploaded?.url || '';
      if (!nextUrl) {
        throw new Error('Upload did not return a file URL.');
      }

      if (mode === 'create') {
        createForm.setValue('mediaUrl', nextUrl, { shouldDirty: true, shouldValidate: true });
      } else {
        editForm.setValue('mediaUrl', nextUrl, { shouldDirty: true, shouldValidate: true });
      }
      setUploadStatus({ type: 'success', message: 'File uploaded successfully.' });
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Unable to upload file for this event.' });
    } finally {
      if (mode === 'create') {
        setCreateUploadPending(false);
        setCreateUploadProgress(0);
      } else {
        setEditUploadPending(false);
        setEditUploadProgress(0);
      }
    }
  };

  const exportEventRegistrations = async (event, format) => {
    const registrants = event?.registrants || [];
    if (registrants.length === 0) {
      return;
    }

    const rows = registrants.map((entry) => [
      entry.name || 'Anonymous',
      entry.phone || entry.contact || '',
      ''
    ]);

    const safeTitle = (event?.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const eventDate = event?.date ? new Date(event.date) : null;
    const serviceDate = eventDate && !Number.isNaN(eventDate.getTime())
      ? eventDate.toLocaleDateString('en-CA')
      : '-';
    const serviceTime = eventDate && !Number.isNaN(eventDate.getTime())
      ? eventDate.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
      : '-';
    const payload = {
      organizationName: siteConfig.name,
      serviceName: event?.title || 'Event Registration',
      serviceDate,
      serviceTime,
      headers: ['Name', 'Number', 'Arrived'],
      rows
    };

    if (format === 'pdf') {
      await downloadRegistrationPdf({
        ...payload,
        fileName: `${safeTitle || 'event'}-registrations.pdf`
      });
      return;
    }

    downloadRegistrationCsv({
      ...payload,
      fileName: `${safeTitle || 'event'}-registrations.csv`
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Events</h1>
        <Button type="button" onClick={openCreateModal}>Add New Event</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Registrations</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-800">{event.title || 'Untitled'}</p>
                    <p className="text-xs text-slate-500">{event.location || '-'}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <p>{formatDate(event.date)}</p>
                    <p className="text-xs text-slate-500">to {formatDate(event.endDate || plusOneHour(event.date))}</p>
                  </td>
                  <td className="py-2 pr-3">{event.category || '-'}</td>
                  <td className="py-2 pr-3">{event.registrations || (event.registrants || []).length || 0}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${event.active === false ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {event.active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActiveMutation.mutate({ id: event.id, active: event.active === false })}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${event.active === false ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                        title={event.active === false ? 'Mark active' : 'Mark inactive'}
                        aria-label={event.active === false ? 'Mark active' : 'Mark inactive'}
                      >
                        <CheckIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewEvent(event)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        title="View"
                        aria-label="View"
                      >
                        <EyeIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(event)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilSquareIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportEventRegistrations(event, 'csv')}
                        disabled={(event.registrants || []).length === 0}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Download CSV"
                        aria-label="Download CSV"
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => exportEventRegistrations(event, 'pdf')}
                        disabled={(event.registrants || []).length === 0}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Download PDF"
                        aria-label="Download PDF"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(event.id)}
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
              {events.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>No events found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add Event</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm">Title
                <input {...createForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <input type="hidden" {...createForm.register('date', { required: true })} />
              <input type="hidden" {...createForm.register('endDate', { required: true })} />
              <label className="text-sm md:col-span-2">Event Date
                <input
                  type="date"
                  required
                  value={createDay}
                  onChange={(event) => {
                    const nextDay = event.target.value;
                    createForm.setValue('date', applyDayToDateTime(nextDay, createStartValue, '09', '00'), { shouldDirty: true, shouldValidate: true });
                    createForm.setValue('endDate', applyDayToDateTime(nextDay, createEndValue, '10', '00'), { shouldDirty: true, shouldValidate: true });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
              </label>
              <div className="md:col-span-2 -mt-1 flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <EventTimeField
                  label="Start Time"
                  triggerLabel="Set Start Time"
                  required
                  value={createStartValue}
                  onCommit={({ hour, minute }) => {
                    createForm.setValue('date', combineDateTime(createDay, hour, minute), { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <EventTimeField
                  label="End Time"
                  triggerLabel="Set End Time"
                  required
                  value={createEndValue}
                  onCommit={({ hour, minute }) => {
                    createForm.setValue('endDate', combineDateTime(createDay, hour, minute), { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </div>
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
              <label className="text-sm">Media URL
                <input {...createForm.register('mediaUrl')} placeholder="https://example.com/event-media.jpg" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => uploadEventFileToForm({ file: event.target.files?.[0], mode: 'create' })}
                />
                <p className="mt-1 text-xs text-slate-500">{createUploadPending ? `Uploading file... ${createUploadProgress}%` : 'Paste a URL or upload file (image/video/pdf, max 15MB).'}</p>
                {createUploadPending ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-blue transition-all" style={{ width: `${createUploadProgress}%` }} />
                  </div>
                ) : null}
              </label>
              <label className="text-sm">Expected Registrations
                <input type="number" min="0" {...createForm.register('registrations')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 mt-6">
                <input type="checkbox" {...createForm.register('active')} />
                <span>Active</span>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create Event'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingEvent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Event</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingEvent.id, values }))}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm">Title
                <input {...editForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <input type="hidden" {...editForm.register('date', { required: true })} />
              <input type="hidden" {...editForm.register('endDate', { required: true })} />
              <label className="text-sm md:col-span-2">Event Date
                <input
                  type="date"
                  required
                  value={editDay}
                  onChange={(event) => {
                    const nextDay = event.target.value;
                    editForm.setValue('date', applyDayToDateTime(nextDay, editStartValue, '09', '00'), { shouldDirty: true, shouldValidate: true });
                    editForm.setValue('endDate', applyDayToDateTime(nextDay, editEndValue, '10', '00'), { shouldDirty: true, shouldValidate: true });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
              </label>
              <div className="md:col-span-2 -mt-1 flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <EventTimeField
                  label="Start Time"
                  triggerLabel="Set Start Time"
                  required
                  value={editStartValue}
                  onCommit={({ hour, minute }) => {
                    editForm.setValue('date', combineDateTime(editDay, hour, minute), { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <EventTimeField
                  label="End Time"
                  triggerLabel="Set End Time"
                  required
                  value={editEndValue}
                  onCommit={({ hour, minute }) => {
                    editForm.setValue('endDate', combineDateTime(editDay, hour, minute), { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </div>
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
              <label className="text-sm">Media URL
                <input {...editForm.register('mediaUrl')} placeholder="https://example.com/event-media.jpg" className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => uploadEventFileToForm({ file: event.target.files?.[0], mode: 'edit' })}
                />
                <p className="mt-1 text-xs text-slate-500">{editUploadPending ? `Uploading file... ${editUploadProgress}%` : 'Paste a URL or upload file (image/video/pdf, max 15MB).'}</p>
                {editUploadPending ? (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-blue transition-all" style={{ width: `${editUploadProgress}%` }} />
                  </div>
                ) : null}
              </label>
              <label className="text-sm">Registrations
                <input type="number" min="0" {...editForm.register('registrations')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 mt-6">
                <input type="checkbox" {...editForm.register('active')} />
                <span>Active</span>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewEvent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Event Details</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold">Title:</span> {viewEvent.title || '-'}</p>
              <p><span className="font-semibold">Date:</span> {formatDate(viewEvent.date)}</p>
              <p><span className="font-semibold">End Date:</span> {formatDate(viewEvent.endDate || plusOneHour(viewEvent.date))}</p>
              <p><span className="font-semibold">Category:</span> {viewEvent.category || '-'}</p>
              <p><span className="font-semibold">Location:</span> {viewEvent.location || '-'}</p>
              <p><span className="font-semibold">Media:</span> {viewEvent.mediaUrl ? <a href={viewEvent.mediaUrl} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">Open media</a> : '-'}</p>
              <p><span className="font-semibold">Status:</span> {viewEvent.active === false ? 'Inactive' : 'Active'}</p>
              <p><span className="font-semibold">Total Registrations:</span> {viewEvent.registrations || (viewEvent.registrants || []).length || 0}</p>
            </div>
            <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {(viewEvent.registrants || []).length === 0 ? (
                <p className="text-sm text-slate-500">No registrations captured yet.</p>
              ) : (viewEvent.registrants || []).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{entry.name || 'Anonymous'}</p>
                      <p className="text-xs text-slate-600">{entry.contact || 'No contact provided'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRegistrantMutation.mutate({ eventId: viewEvent.id, registrantId: entry.id })}
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
