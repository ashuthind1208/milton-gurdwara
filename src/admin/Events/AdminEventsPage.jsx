import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EllipsisVerticalIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import eventService from '../../services/eventService';
import { formatDate } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import { siteConfig } from '../../constants/siteConfig';
import { downloadRegistrationCsv, downloadRegistrationPdf } from '../../utils/csvExport';
import uploadService from '../../services/uploadService';
import StatusAlert from '../../components/common/StatusAlert';
import contentApiService from '../../services/contentApiService';

const EVENTS_IDENTITY_SETTING_KEY = 'settings-events-allow-custom-name-email';

const actionIconClass = 'h-4 w-4';
const quarterMinuteOptions = ['00', '15', '30', '45'];
const VIEW_REGISTRANTS_PAGE_SIZE = 10;
const EVENTS_PAGE_SIZE = 10;

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

const truncateWords = (value, maxWords = 50) => {
  const text = String(value || '').trim();
  if (!text) {
    return '-';
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text;
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
};

const formatTimeLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return '-';
  }
  return parsed.toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const splitMediaUrls = (value) => String(value || '')
  .split(/[\n,]+/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const isImageMediaUrl = (value) => String(value || '').match(/\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i);

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
  description: '',
  date: '',
  endDate: '',
  location: '',
  category: 'Paath',
  mediaUrl: '',
  capacity: 0,
  waitlistEnabled: true,
  registrations: 0,
  active: true
};

const AdminEventsPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewEvent, setViewEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [createUploadPending, setCreateUploadPending] = useState(false);
  const [editUploadPending, setEditUploadPending] = useState(false);
  const [createUploadProgress, setCreateUploadProgress] = useState(0);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });
  const [viewRegistrantsPage, setViewRegistrantsPage] = useState(1);
  const [registrantSearch, setRegistrantSearch] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('all');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('all');
  const [eventsPage, setEventsPage] = useState(1);

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
    queryFn: () => eventService.getEvents({ includeInactive: true }).then((res) => res.data)
  });
  const { data: eventsIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [EVENTS_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(EVENTS_IDENTITY_SETTING_KEY, { enabled: false })
  });
  const updateEventsIdentitySettingMutation = useMutation({
    mutationFn: (enabled) => contentApiService.setSingleton(EVENTS_IDENTITY_SETTING_KEY, { enabled: Boolean(enabled) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EVENTS_IDENTITY_SETTING_KEY] })
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (result?.data?.id) {
        setViewEvent(result.data);
      }
    }
  });

  const confirmRegistrantMutation = useMutation({
    mutationFn: ({ eventId, registrantId }) => eventService.updateRegistrantStatus({ eventId, registrantId, status: 'confirmed' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (result?.data?.id) {
        setViewEvent(result.data);
      }
    },
    onError: (error) => window.alert(error?.response?.data?.message || error?.message || 'Unable to confirm this registration.')
  });

  const openEdit = (event) => {
    setEditingEvent(event);
    const startValue = toInputDateTime(event.date);
    const endValue = toInputDateTime(event.endDate || plusOneHour(event.date));

    editForm.reset({
      title: event.title,
      description: event.description || '',
      date: startValue,
      endDate: endValue,
      location: event.location,
      category: event.category,
      mediaUrl: event.mediaUrl || '',
      capacity: Number(event.capacity || 0),
      waitlistEnabled: event.waitlistEnabled !== false,
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

  const registrants = useMemo(() => viewEvent?.registrants || [], [viewEvent]);
  const normalizedRegistrantSearch = registrantSearch.trim().toLowerCase();
  const filteredRegistrants = useMemo(() => {
    if (!normalizedRegistrantSearch) {
      return registrants;
    }

    return registrants.filter((entry) => {
      const name = String(entry?.name || '').toLowerCase();
      const contact = String(entry?.contact || '').toLowerCase();
      const status = String(entry?.status || 'confirmed').toLowerCase();
      return name.includes(normalizedRegistrantSearch)
        || contact.includes(normalizedRegistrantSearch)
        || status.includes(normalizedRegistrantSearch);
    });
  }, [registrants, normalizedRegistrantSearch]);
  const registrantsTotalPages = Math.max(1, Math.ceil(filteredRegistrants.length / VIEW_REGISTRANTS_PAGE_SIZE));
  const visibleRegistrants = useMemo(() => {
    const start = (viewRegistrantsPage - 1) * VIEW_REGISTRANTS_PAGE_SIZE;
    return filteredRegistrants.slice(start, start + VIEW_REGISTRANTS_PAGE_SIZE);
  }, [filteredRegistrants, viewRegistrantsPage]);
  const viewMediaUrls = useMemo(() => splitMediaUrls(viewEvent?.mediaUrl), [viewEvent?.mediaUrl]);
  const viewImageMediaUrls = useMemo(() => viewMediaUrls.filter((entry) => isImageMediaUrl(entry)), [viewMediaUrls]);
  const viewOtherMediaUrls = useMemo(() => viewMediaUrls.filter((entry) => !isImageMediaUrl(entry)), [viewMediaUrls]);
  const eventCapacity = Number(viewEvent?.capacity || 0);
  const registrationSummary = eventCapacity > 0 ? `${registrants.length}/${eventCapacity}` : `${registrants.length}/∞`;

  const eventCategoryOptions = useMemo(() => {
    const categories = events
      .map((entry) => String(entry?.category || '').trim())
      .filter(Boolean);
    return [...new Set(categories)].sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = String(eventSearch || '').trim().toLowerCase();
    return events.filter((event) => {
      const statusOk = eventStatusFilter === 'all'
        ? true
        : eventStatusFilter === 'active'
          ? event.active !== false
          : event.active === false;

      const categoryOk = eventCategoryFilter === 'all'
        ? true
        : String(event?.category || '').trim() === eventCategoryFilter;

      if (!statusOk || !categoryOk) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        event?.title,
        event?.location,
        event?.category,
        event?.description
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [events, eventCategoryFilter, eventSearch, eventStatusFilter]);

  const eventsTotalPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PAGE_SIZE));
  const visibleEvents = useMemo(() => {
    const start = (eventsPage - 1) * EVENTS_PAGE_SIZE;
    return filteredEvents.slice(start, start + EVENTS_PAGE_SIZE);
  }, [eventsPage, filteredEvents]);

  useEffect(() => {
    setViewRegistrantsPage(1);
    setRegistrantSearch('');
  }, [viewEvent?.id]);

  useEffect(() => {
    setViewRegistrantsPage(1);
  }, [normalizedRegistrantSearch]);

  useEffect(() => {
    if (viewRegistrantsPage > registrantsTotalPages) {
      setViewRegistrantsPage(registrantsTotalPages);
    }
  }, [viewRegistrantsPage, registrantsTotalPages]);

  useEffect(() => {
    setOpenActionMenuId('');
  }, [events.length]);

  useEffect(() => {
    setEventsPage(1);
  }, [eventSearch, eventStatusFilter, eventCategoryFilter]);

  useEffect(() => {
    if (eventsPage > eventsTotalPages) {
      setEventsPage(eventsTotalPages);
    }
  }, [eventsPage, eventsTotalPages]);

  useEffect(() => {
    setHeaderAction(<AdminHeaderActionButton label="Add New Event" onClick={openCreateModal} />);

    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Events</h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Website Identity Override</p>
            <p className="text-xs text-slate-600">Allow visitors to edit Name and Email on Events registration form.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span>{eventsIdentitySettings?.enabled ? 'Enabled' : 'Disabled'}</span>
            <input
              type="checkbox"
              checked={Boolean(eventsIdentitySettings?.enabled)}
              onChange={(event) => updateEventsIdentitySettingMutation.mutate(event.target.checked)}
              disabled={updateEventsIdentitySettingMutation.isPending}
              className="h-4 w-4"
            />
          </label>
        </div>
      </Card>

      <Card>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Search
            <input
              type="search"
              value={eventSearch}
              onChange={(event) => setEventSearch(event.target.value)}
              placeholder="Search title, category, or location"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={eventStatusFilter}
              onChange={(event) => setEventStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
            <select
              value={eventCategoryFilter}
              onChange={(event) => setEventCategoryFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              {eventCategoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
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
              {visibleEvents.map((event) => (
                <tr key={event.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <div className="space-y-1.5 lg:hidden">
                      <p className="text-sm font-bold leading-tight text-slate-800">{event.title || 'Untitled'}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{event.location || '-'}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{formatDate(event.date)}</p>
                      <p className="text-[12px] leading-snug text-slate-600">to {formatDate(event.endDate || plusOneHour(event.date))}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{event.category || '-'}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{event.registrations || (event.registrants || []).length || 0} registrations</p>
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleActiveMutation.mutate({ id: event.id, active: event.active === false })}
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${event.active === false ? 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400' : 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:border-emerald-300'}`}
                          title={event.active === false ? 'Set active' : 'Set inactive'}
                          aria-label={event.active === false ? 'Set active' : 'Set inactive'}
                        >
                          {event.active === false ? 'Inactive' : 'Active'}
                        </button>
                      </div>
                    </div>
                    <span className="hidden lg:inline font-semibold text-slate-800">{event.title || 'Untitled'}</span>
                  </td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">{formatDate(event.date)}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">{event.category || '-'}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">{event.registrations || (event.registrants || []).length || 0}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleActiveMutation.mutate({ id: event.id, active: event.active === false })}
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold transition ${event.active === false ? 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400' : 'border-emerald-200 bg-emerald-100 text-emerald-700 hover:border-emerald-300'}`}
                      title={event.active === false ? 'Set active' : 'Set inactive'}
                      aria-label={event.active === false ? 'Set active' : 'Set inactive'}
                    >
                      {event.active === false ? 'Inactive' : 'Active'}
                    </button>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="relative lg:hidden">
                      <button
                        type="button"
                        onClick={() => setOpenActionMenuId((prev) => (prev === event.id ? '' : event.id))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        aria-label="More actions"
                        title="More actions"
                      >
                        <EllipsisVerticalIcon className={actionIconClass} />
                      </button>
                      {openActionMenuId === event.id ? (
                        <div className="absolute right-0 top-9 z-20 min-w-[150px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setViewEvent(event);
                              setOpenActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openEdit(event);
                              setOpenActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportEventRegistrations(event, 'csv');
                              setOpenActionMenuId('');
                            }}
                            disabled={(event.registrants || []).length === 0}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Download CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportEventRegistrations(event, 'pdf');
                              setOpenActionMenuId('');
                            }}
                            disabled={(event.registrants || []).length === 0}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteMutation.mutate(event.id);
                              setOpenActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="hidden items-center gap-2 lg:flex">
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
              {filteredEvents.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>No events found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredEvents.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Showing {visibleEvents.length} of {filteredEvents.length} events</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                disabled={eventsPage <= 1}
                onClick={() => setEventsPage((prev) => prev - 1)}
              >
                Prev
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {eventsPage} of {eventsTotalPages}</span>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                disabled={eventsPage >= eventsTotalPages}
                onClick={() => setEventsPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add Event</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm">Title
                <input {...createForm.register('title', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea
                  {...createForm.register('description')}
                  rows={3}
                  placeholder="Add event details for attendees"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
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
                <input {...createForm.register('location', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
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
              <label className="text-sm">Capacity (0 = unlimited)
                <input type="number" min="0" {...createForm.register('capacity', { valueAsNumber: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 mt-6">
                <input type="checkbox" {...createForm.register('waitlistEnabled')} />
                <span>Enable Waitlist</span>
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
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Event</h3>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={closeModals}>Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingEvent.id, values }))}>
              <div className="md:col-span-2">
                <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              </div>
              <label className="text-sm">Title
                <input {...editForm.register('title', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea
                  {...editForm.register('description')}
                  rows={3}
                  placeholder="Add event details for attendees"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5"
                />
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
                <input {...editForm.register('location', { required: true })} required className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
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
              <label className="text-sm">Capacity (0 = unlimited)
                <input type="number" min="0" {...editForm.register('capacity', { valueAsNumber: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 mt-6">
                <input type="checkbox" {...editForm.register('waitlistEnabled')} />
                <span>Enable Waitlist</span>
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-[0_30px_100px_-35px_rgba(15,23,42,0.75)]">
            <div className="flex items-start justify-between gap-3 bg-[linear-gradient(115deg,#0b4ea2_0%,#1e3a8a_48%,#0f172a_100%)] px-5 py-4 text-white sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Admin Event View</p>
                <h3 className="mt-1 font-heading text-2xl font-bold leading-tight text-white">{viewEvent.title || 'Event Details'}</h3>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-lg leading-none text-white transition hover:bg-white/20"
                onClick={closeModals}
                aria-label="Close event details"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">Start Date: {formatDate(viewEvent.date)}</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">Start Time: {formatTimeLabel(viewEvent.date)}</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">End Date: {formatDate(viewEvent.endDate || plusOneHour(viewEvent.date))}</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">End Time: {formatTimeLabel(viewEvent.endDate || plusOneHour(viewEvent.date))}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-2.5 py-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Status: {viewEvent.active === false ? 'Inactive' : 'Active'}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Category: {viewEvent.category || 'General'}</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Location: {viewEvent.location || 'Location TBD'}</span>
                </div>

                {viewMediaUrls.length > 0 ? (
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gallery</p>
                    {viewImageMediaUrls.length > 0 ? (
                      <div className={`mt-2 grid gap-2 ${viewImageMediaUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {viewImageMediaUrls.map((url, index) => (
                          <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <img src={url} alt={`${viewEvent.title || 'Event'} media ${index + 1}`} className="h-44 w-full object-cover" loading="lazy" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {viewOtherMediaUrls.length > 0 ? (
                      <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</p>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {viewOtherMediaUrls.map((url, index) => (
                            <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-blue hover:underline">Open media {index + 1}</a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{truncateWords(viewEvent.description, 80)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-brand-blue">Registrants <span className="ml-1 align-middle text-[11px] font-bold text-slate-500">{registrationSummary}</span></h4>
                    <p className="text-xs text-slate-500">Manage participants for this event.</p>
                  </div>
                  <input
                    type="search"
                    value={registrantSearch}
                    onChange={(event) => setRegistrantSearch(event.target.value)}
                    placeholder="Search name, contact, or status"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 sm:w-72"
                  />
                </div>

                {registrants.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">No registrations captured yet.</p>
                ) : filteredRegistrants.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">No registrants match your search.</p>
                ) : (
                  <>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Contact</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRegistrants.map((entry, index) => (
                            <tr key={entry.id} className={`border-b border-slate-100 last:border-b-0 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                              <td className="px-3 py-2 font-medium text-slate-800">{entry.name || 'Anonymous'}</td>
                              <td className="px-3 py-2 text-slate-700">{entry.contact || 'No contact provided'}</td>
                              <td className="px-3 py-2 text-slate-700">{entry.status || 'confirmed'}</td>
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex items-center gap-2">
                                  {String(entry.status || '').toLowerCase() === 'waitlisted' ? (
                                    <button
                                      type="button"
                                      onClick={() => confirmRegistrantMutation.mutate({ eventId: viewEvent.id, registrantId: entry.id })}
                                      disabled={confirmRegistrantMutation.isPending}
                                      className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Confirm
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => removeRegistrantMutation.mutate({ eventId: viewEvent.id, registrantId: entry.id })}
                                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">Showing {visibleRegistrants.length} of {filteredRegistrants.length} matched</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          disabled={viewRegistrantsPage <= 1}
                          onClick={() => setViewRegistrantsPage((prev) => prev - 1)}
                        >
                          Prev
                        </button>
                        <span className="text-xs font-semibold text-slate-600">Page {viewRegistrantsPage} of {registrantsTotalPages}</span>
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          disabled={viewRegistrantsPage >= registrantsTotalPages}
                          onClick={() => setViewRegistrantsPage((prev) => prev + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminEventsPage;
