import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  EyeIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import volunteerService from '../../services/volunteerService';
import contentApiService from '../../services/contentApiService';
import { siteConfig } from '../../constants/siteConfig';
import { downloadRegistrationCsv, downloadRegistrationPdf } from '../../utils/csvExport';
import { formatDate } from '../../utils/formatters';

const actionIconClass = 'h-4 w-4';
const SEVA_IDENTITY_SETTING_KEY = 'settings-seva-allow-custom-name-email';
const quarterMinuteOptions = ['00', '15', '30', '45'];
const hourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));

const formatDisplayDate = (value) => {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return formatDate(parsed);
};

const splitTimeRange = (value) => {
  const text = String(value || '').trim();
  const matches = text.match(/(\d{1,2}):(\d{2})/g) || [];

  const first = matches[0] || '09:00';
  const second = matches[1] || '11:00';

  const [startHourRaw = '09', startMinuteRaw = '00'] = first.split(':');
  const [endHourRaw = '11', endMinuteRaw = '00'] = second.split(':');

  const startHour = hourOptions.includes(startHourRaw.padStart(2, '0')) ? startHourRaw.padStart(2, '0') : '09';
  const endHour = hourOptions.includes(endHourRaw.padStart(2, '0')) ? endHourRaw.padStart(2, '0') : '11';
  const startMinute = quarterMinuteOptions.includes(startMinuteRaw) ? startMinuteRaw : '00';
  const endMinute = quarterMinuteOptions.includes(endMinuteRaw) ? endMinuteRaw : '00';

  return { startHour, startMinute, endHour, endMinute };
};

const toDateInputValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) {
    return dateOnlyMatch[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const normalizeDateKey = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) {
    return dateOnlyMatch[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
};

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

const doesRegistrationMatchOpportunity = (entry, opportunity) => {
  const entryOpportunityId = String(entry?.opportunityId || '').trim();
  const opportunityId = String(opportunity?.id || '').trim();
  if (entryOpportunityId && opportunityId && entryOpportunityId === opportunityId) {
    return true;
  }

  if (entryOpportunityId) {
    return false;
  }

  const entryType = normalizeComparableValue(entry?.sevaType || entry?.area);
  const opportunityType = normalizeComparableValue(opportunity?.sevaType);
  const entryDate = normalizeDateKey(entry?.sevaDate || entry?.date);
  const opportunityDate = normalizeDateKey(opportunity?.date);

  return entryType === opportunityType && entryDate === opportunityDate;
};

const buildTimeRange = ({ startHour, startMinute, endHour, endMinute }) => `${startHour}:${startMinute} - ${endHour}:${endMinute}`;

const toOpportunityPayload = (values) => {
  const startHour = String(values?.startHour || '09').padStart(2, '0');
  const startMinute = String(values?.startMinute || '00').padStart(2, '0');
  const endHour = String(values?.endHour || '11').padStart(2, '0');
  const endMinute = String(values?.endMinute || '00').padStart(2, '0');

  return {
    sevaType: values?.sevaType || '',
    date: values?.date || '',
    expiryDate: values?.expiryDate || values?.date || '',
    totalVolunteersRequired: Number(values?.totalVolunteersRequired || 10),
    time: buildTimeRange({ startHour, startMinute, endHour, endMinute }),
    waitlistEnabled: values?.waitlistEnabled !== false,
    active: true
  };
};

const defaultForm = {
  sevaType: '',
  date: '',
  startHour: '09',
  startMinute: '00',
  endHour: '11',
  endMinute: '00',
  totalVolunteersRequired: 10,
  expiryDate: '',
  waitlistEnabled: true,
  active: true
};

const getStatusPillClasses = (item, clickable) => {
  if (item.status === 'closed') {
    return 'bg-rose-100 text-rose-700';
  }

  if (item.active) {
    return `bg-emerald-100 text-emerald-700 ${clickable ? 'hover:bg-emerald-200' : ''}`.trim();
  }

  return `bg-slate-200 text-slate-700 ${clickable ? 'hover:bg-slate-300' : ''}`.trim();
};

const AdminSevaOpportunitiesPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpportunity, setViewOpportunity] = useState(null);
  const [editing, setEditing] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState('');

  const createForm = useForm({ defaultValues: defaultForm });
  const editForm = useForm({ defaultValues: defaultForm });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['seva-opportunities', 'admin'],
    queryFn: () => volunteerService.getSevaOpportunities({ includeClosed: true, includeInactive: true }).then((res) => res.data)
  });
  const { data: sevaIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [SEVA_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(SEVA_IDENTITY_SETTING_KEY, { enabled: false })
  });
  const updateSevaIdentitySettingMutation = useMutation({
    mutationFn: (enabled) => contentApiService.setSingleton(SEVA_IDENTITY_SETTING_KEY, { enabled: Boolean(enabled) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [SEVA_IDENTITY_SETTING_KEY] })
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data)
  });

  const volunteersByOpportunity = useMemo(() => opportunities.reduce((acc, opportunity) => {
    acc[opportunity.id] = registrations.filter((entry) => doesRegistrationMatchOpportunity(entry, opportunity));
    return acc;
  }, {}), [opportunities, registrations]);

  const selectedVolunteers = useMemo(() => {
    if (!viewOpportunity) {
      return [];
    }

    return registrations.filter((entry) => doesRegistrationMatchOpportunity(entry, viewOpportunity));
  }, [registrations, viewOpportunity]);

  const createMutation = useMutation({
    mutationFn: (values) => volunteerService.createSevaOpportunity(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] });
      createForm.reset(defaultForm);
      setCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => volunteerService.updateSevaOpportunity(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] });
      setEditing(null);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }) => volunteerService.updateSevaOpportunity(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => volunteerService.removeSevaOpportunity(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] });
      setViewOpportunity((prev) => (prev?.id === id ? null : prev));
      setEditing((prev) => (prev?.id === id ? null : prev));
    }
  });

  const removeVolunteerMutation = useMutation({
    mutationFn: (id) => volunteerService.removeApplication(id),
    onSuccess: (_, removedId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] });
      setViewOpportunity((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          registrants: (prev.registrants || []).filter((entry) => entry.id !== removedId)
        };
      });
    }
  });

  const manualReminderMutation = useMutation({
    mutationFn: (opportunity) => volunteerService.sendOpportunityReminderEmails(opportunity.id),
    onSuccess: (result, opportunity) => {
      const sent = Number(result?.data?.sent || result?.sent || 0);
      const skipped = Number(result?.data?.skipped || result?.skipped || 0);
      window.alert(`Reminder email run completed for ${opportunity?.sevaType || 'selected seva'}: ${sent} sent, ${skipped} skipped.`);
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to send reminder emails right now.');
    }
  });

  const openEdit = (item) => {
    const parsedTimes = splitTimeRange(item.time);
    setEditing(item);
    editForm.reset({
      sevaType: item.sevaType,
      date: toDateInputValue(item.date),
      startHour: parsedTimes.startHour,
      startMinute: parsedTimes.startMinute,
      endHour: parsedTimes.endHour,
      endMinute: parsedTimes.endMinute,
      totalVolunteersRequired: item.totalVolunteersRequired || 10,
      expiryDate: toDateInputValue(item.expiryDate),
      waitlistEnabled: item.waitlistEnabled !== false,
      active: typeof item.active === 'boolean' ? item.active : true
    });
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewOpportunity(null);
    setEditing(null);
  };

  const toggleOpportunityStatus = (item) => {
    if (item.status === 'closed') {
      return;
    }
    toggleActiveMutation.mutate({ id: item.id, active: !item.active });
  };

  const getOpportunityVolunteers = (opportunity) => registrations.filter((entry) => doesRegistrationMatchOpportunity(entry, opportunity));

  const exportOpportunityVolunteers = async (opportunity, format) => {
    const volunteers = getOpportunityVolunteers(opportunity);
    if (volunteers.length === 0) {
      return;
    }

    const rows = volunteers.map((entry) => [
      entry.name || '',
      entry.phone || '',
      ''
    ]);

    const safeType = (opportunity?.sevaType || 'seva-opportunity')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const payload = {
      organizationName: siteConfig.name,
      serviceName: opportunity?.sevaType || 'Seva Opportunity',
      serviceDate: opportunity?.date || '-',
      serviceTime: opportunity?.time || '-',
      headers: ['Name', 'Number', 'Arrived'],
      rows
    };

    if (format === 'pdf') {
      await downloadRegistrationPdf({
        ...payload,
        fileName: `${safeType || 'seva-opportunity'}-volunteers.pdf`
      });
      return;
    }

    downloadRegistrationCsv({
      ...payload,
      fileName: `${safeType || 'seva-opportunity'}-volunteers.csv`
    });
  };

  const opportunityActionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md border transition';
  const opportunityActionIconClass = 'h-4 w-4';
  const modalShellClass = 'w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]';
  const modalHeaderClass = 'flex items-start justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-5 py-4 text-white sm:px-6';
  const modalBodyClass = 'px-5 py-5 sm:px-6';
  const slimInputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-5 shadow-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15';
  const slimSelectClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-5 shadow-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15';
  const modalLabelClass = 'text-sm font-semibold text-slate-700';
  const sectionCardClass = 'rounded-2xl border border-slate-200 bg-slate-50/90 p-4';

  useEffect(() => {
    setHeaderAction(
      <AdminHeaderActionButton label="Add New Seva Opportunity" onClick={() => setCreateOpen(true)} />
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Seva Opportunities</h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Website Identity Override</p>
            <p className="text-xs text-slate-600">Allow visitors to edit Name and Email on Seva registration form.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span>{sevaIdentitySettings?.enabled ? 'Enabled' : 'Disabled'}</span>
            <input
              type="checkbox"
              checked={Boolean(sevaIdentitySettings?.enabled)}
              onChange={(event) => updateSevaIdentitySettingMutation.mutate(event.target.checked)}
              disabled={updateSevaIdentitySettingMutation.isPending}
              className="h-4 w-4"
            />
          </label>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Seva Type</th>
                <th className="py-2 pr-3">Date / Time</th>
                <th className="py-2 pr-3">Volunteers</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2.5 font-semibold text-slate-800 lg:py-2 lg:pr-3">
                    <div className="space-y-1 lg:hidden">
                      <p className="text-[13px] font-bold leading-tight text-slate-800">{item.sevaType || '-'}</p>
                      <p className="text-[11px] leading-snug text-slate-600">{formatDisplayDate(item.date)}</p>
                      <p className="text-[11px] leading-snug text-slate-600">{item.time || '-'}</p>
                      <p className="text-[11px] leading-snug text-slate-600">Volunteers: {(volunteersByOpportunity[item.id] || []).length}/{item.totalVolunteersRequired || 10}</p>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleOpportunityStatus(item)}
                          disabled={item.status === 'closed' || toggleActiveMutation.isPending}
                          className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${getStatusPillClasses(item, item.status !== 'closed')}`}
                          title={item.status === 'closed' ? 'Closed opportunities cannot be reactivated until the date is updated.' : (item.active ? 'Set inactive' : 'Set active')}
                          aria-label={item.status === 'closed' ? 'Closed' : (item.active ? 'Set inactive' : 'Set active')}
                        >
                          {item.status === 'closed' ? 'Closed' : item.active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                    <span className="hidden lg:inline">{item.sevaType || '-'}</span>
                  </td>
                  <td className="admin-seva-mobile-hidden py-2 pr-3 align-top">
                    <div className="space-y-0.5 text-left">
                      <p>{formatDisplayDate(item.date)}</p>
                      <p className="text-xs text-slate-600">{item.time || '-'}</p>
                    </div>
                  </td>
                  <td className="admin-seva-mobile-hidden py-2 pr-3">{(volunteersByOpportunity[item.id] || []).length}/{item.totalVolunteersRequired || 10}</td>
                  <td className="admin-seva-mobile-hidden py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleOpportunityStatus(item)}
                      disabled={item.status === 'closed' || toggleActiveMutation.isPending}
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${getStatusPillClasses(item, item.status !== 'closed')}`}
                      title={item.status === 'closed' ? 'Closed opportunities cannot be reactivated until the date is updated.' : (item.active ? 'Set inactive' : 'Set active')}
                      aria-label={item.status === 'closed' ? 'Closed' : (item.active ? 'Set inactive' : 'Set active')}
                    >
                      {item.status === 'closed' ? 'Closed' : item.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-1.5 pr-2.5 lg:py-2 lg:pr-3">
                    <div className="flex items-center justify-end gap-2 lg:hidden">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenActionMenuId((prev) => (prev === item.id ? '' : item.id))}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                          aria-label="More actions"
                          title="More actions"
                        >
                          <EllipsisVerticalIcon className={actionIconClass} />
                        </button>
                        {openActionMenuId === item.id ? (
                          <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setViewOpportunity(item);
                                setOpenActionMenuId('');
                              }}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openEdit(item);
                                setOpenActionMenuId('');
                              }}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportOpportunityVolunteers(item, 'csv');
                                setOpenActionMenuId('');
                              }}
                              disabled={getOpportunityVolunteers(item).length === 0}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Download CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                exportOpportunityVolunteers(item, 'pdf');
                                setOpenActionMenuId('');
                              }}
                              disabled={getOpportunityVolunteers(item).length === 0}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                manualReminderMutation.mutate(item);
                                setOpenActionMenuId('');
                              }}
                              disabled={getOpportunityVolunteers(item).length === 0 || manualReminderMutation.isPending}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Send Email
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                deleteMutation.mutate(item.id);
                                setOpenActionMenuId('');
                              }}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="hidden items-center justify-end gap-2 lg:flex">
                      <button
                        type="button"
                        onClick={() => setViewOpportunity(item)}
                        className={`${opportunityActionButtonClass} border-slate-300 text-slate-700 hover:bg-slate-100`}
                        title="View"
                        aria-label="View"
                      >
                        <EyeIcon className={opportunityActionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className={`${opportunityActionButtonClass} border-blue-200 text-blue-700 hover:bg-blue-50`}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilSquareIcon className={opportunityActionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportOpportunityVolunteers(item, 'csv')}
                        disabled={getOpportunityVolunteers(item).length === 0}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-indigo-200 px-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Download CSV"
                        aria-label="Download CSV"
                      >
                        <ArrowDownTrayIcon className={opportunityActionIconClass} />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportOpportunityVolunteers(item, 'pdf')}
                        disabled={getOpportunityVolunteers(item).length === 0}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-indigo-200 px-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Download PDF"
                        aria-label="Download PDF"
                      >
                        <ArrowDownTrayIcon className={opportunityActionIconClass} />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => manualReminderMutation.mutate(item)}
                        disabled={getOpportunityVolunteers(item).length === 0 || manualReminderMutation.isPending}
                        className={`${opportunityActionButtonClass} border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40`}
                        title="Send Email"
                        aria-label="Send Email"
                      >
                        <EnvelopeIcon className={opportunityActionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(item.id)}
                        className={`${opportunityActionButtonClass} border-red-200 text-red-700 hover:bg-red-50`}
                        title="Delete"
                        aria-label="Delete"
                      >
                        <TrashIcon className={opportunityActionIconClass} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {opportunities.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={5}>No seva opportunities found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-[2px] sm:px-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className={modalShellClass}>
            <div className={modalHeaderClass}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">Seva Opportunities</p>
                <h3 className="mt-1 font-heading text-xl font-semibold sm:text-2xl">Add Seva Opportunity</h3>
              </div>
              <button type="button" onClick={closeModals} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close create seva modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <form className={`${modalBodyClass} grid gap-3 md:grid-cols-2`} onSubmit={createForm.handleSubmit((values) => createMutation.mutate(toOpportunityPayload(values)))}>
              <label className={modalLabelClass}>Seva Type
                <input {...createForm.register('sevaType', { required: true })} className={slimInputClass} />
              </label>
              <div className={`${sectionCardClass} md:col-span-2`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start Date and Time</p>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className={`${modalLabelClass} md:col-span-2`}>Date
                    <input type="date" {...createForm.register('date', { required: true })} className={`${slimInputClass} p-2.5`} />
                  </label>
                  <label className={modalLabelClass}>Start
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <select {...createForm.register('startHour')} className={slimSelectClass}>
                        {hourOptions.map((hour) => <option key={`create-start-hour-${hour}`} value={hour}>{hour}</option>)}
                      </select>
                      <select {...createForm.register('startMinute')} className={slimSelectClass}>
                        {quarterMinuteOptions.map((minute) => <option key={`create-start-minute-${minute}`} value={minute}>{minute}</option>)}
                      </select>
                    </div>
                  </label>
                  <label className={modalLabelClass}>End
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <select {...createForm.register('endHour')} className={slimSelectClass}>
                        {hourOptions.map((hour) => <option key={`create-end-hour-${hour}`} value={hour}>{hour}</option>)}
                      </select>
                      <select {...createForm.register('endMinute')} className={slimSelectClass}>
                        {quarterMinuteOptions.map((minute) => <option key={`create-end-minute-${minute}`} value={minute}>{minute}</option>)}
                      </select>
                    </div>
                  </label>
                </div>
              </div>
              <label className={modalLabelClass}>Total Volunteers Required
                <input type="number" min="1" {...createForm.register('totalVolunteersRequired', { valueAsNumber: true, min: 1 })} className={slimInputClass} />
              </label>
              <label className={modalLabelClass}>Expiry Date
                <input type="date" {...createForm.register('expiryDate', { required: true })} className={slimInputClass} />
              </label>
              <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 md:col-span-2">
                <input type="checkbox" {...createForm.register('waitlistEnabled')} />
                <span>Enable Waitlist</span>
              </label>
              <div className="md:col-span-2 flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create Opportunity'}</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {viewOpportunity ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-[2px] sm:px-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className={modalShellClass}>
            <div className={modalHeaderClass}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">Seva Opportunity</p>
                <h3 className="mt-1 font-heading text-xl font-semibold sm:text-2xl">Opportunity Details</h3>
              </div>
              <button type="button" onClick={closeModals} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close seva details modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className={`${modalBodyClass} space-y-4`}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Seva Type</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{viewOpportunity.sevaType || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{viewOpportunity.status === 'closed' ? 'Closed' : viewOpportunity.active ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDisplayDate(viewOpportunity.date)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Time</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{viewOpportunity.time || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Expiry</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDisplayDate(viewOpportunity.expiryDate)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Volunteers</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedVolunteers.length}/{viewOpportunity.totalVolunteersRequired || 10}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Waitlist</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{viewOpportunity.waitlistEnabled === false ? 'Disabled' : 'Enabled'}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Registered Volunteers</p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {selectedVolunteers.length === 0 ? (
                    <p className="text-sm text-slate-500">No volunteers registered for this opportunity yet.</p>
                  ) : selectedVolunteers.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{entry.name || '-'}</p>
                        <p className="text-xs text-slate-600">{entry.phone || 'No phone'} • {entry.email || 'No email'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVolunteerMutation.mutate(entry.id)}
                        disabled={removeVolunteerMutation.isPending}
                        className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-[2px] sm:px-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className={modalShellClass}>
            <div className={modalHeaderClass}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">Seva Opportunities</p>
                <h3 className="mt-1 font-heading text-xl font-semibold sm:text-2xl">Edit Seva Opportunity</h3>
              </div>
              <button type="button" onClick={closeModals} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close edit seva modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <form className={`${modalBodyClass} grid gap-3 md:grid-cols-2`} onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editing.id, values: toOpportunityPayload(values) }))}>
              <label className={modalLabelClass}>Seva Type
                <input {...editForm.register('sevaType', { required: true })} className={slimInputClass} />
              </label>
              <div className={`${sectionCardClass} md:col-span-2`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start Date and Time</p>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className={`${modalLabelClass} md:col-span-2`}>Date
                    <input type="date" {...editForm.register('date', { required: true })} className={`${slimInputClass} p-2.5`} />
                  </label>
                  <label className={modalLabelClass}>Start
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <select {...editForm.register('startHour')} className={slimSelectClass}>
                        {hourOptions.map((hour) => <option key={`edit-start-hour-${hour}`} value={hour}>{hour}</option>)}
                      </select>
                      <select {...editForm.register('startMinute')} className={slimSelectClass}>
                        {quarterMinuteOptions.map((minute) => <option key={`edit-start-minute-${minute}`} value={minute}>{minute}</option>)}
                      </select>
                    </div>
                  </label>
                  <label className={modalLabelClass}>End
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <select {...editForm.register('endHour')} className={slimSelectClass}>
                        {hourOptions.map((hour) => <option key={`edit-end-hour-${hour}`} value={hour}>{hour}</option>)}
                      </select>
                      <select {...editForm.register('endMinute')} className={slimSelectClass}>
                        {quarterMinuteOptions.map((minute) => <option key={`edit-end-minute-${minute}`} value={minute}>{minute}</option>)}
                      </select>
                    </div>
                  </label>
                </div>
              </div>
              <label className={modalLabelClass}>Total Volunteers Required
                <input type="number" min="1" {...editForm.register('totalVolunteersRequired', { valueAsNumber: true, min: 1 })} className={slimInputClass} />
              </label>
              <label className={modalLabelClass}>Expiry Date
                <input type="date" {...editForm.register('expiryDate', { required: true })} className={slimInputClass} />
              </label>
              <label className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 md:col-span-2">
                <input type="checkbox" {...editForm.register('waitlistEnabled')} />
                <span>Enable Waitlist</span>
              </label>
              <div className="md:col-span-2 flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSevaOpportunitiesPage;
