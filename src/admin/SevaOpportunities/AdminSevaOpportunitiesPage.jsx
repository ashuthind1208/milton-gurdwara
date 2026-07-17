import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import volunteerService from '../../services/volunteerService';
import contentApiService from '../../services/contentApiService';
import { siteConfig } from '../../constants/siteConfig';
import { downloadRegistrationCsv, downloadRegistrationPdf } from '../../utils/csvExport';

const actionIconClass = 'h-4 w-4';
const SEVA_IDENTITY_SETTING_KEY = 'settings-seva-allow-custom-name-email';

const defaultForm = {
  sevaType: '',
  date: '',
  time: '',
  totalVolunteersRequired: 10,
  expiryDate: '',
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
    queryFn: () => volunteerService.getSevaOpportunities({ includeClosed: true }).then((res) => res.data)
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

  const volunteersByOpportunity = useMemo(() => registrations.reduce((acc, entry) => {
    if (!entry.opportunityId) {
      return acc;
    }
    if (!acc[entry.opportunityId]) {
      acc[entry.opportunityId] = [];
    }
    acc[entry.opportunityId].push(entry);
    return acc;
  }, {}), [registrations]);

  const selectedVolunteers = useMemo(() => {
    if (!viewOpportunity) {
      return [];
    }

    return registrations.filter((entry) => (
      entry.opportunityId === viewOpportunity.id ||
      (!entry.opportunityId && (entry.sevaType || entry.area) === viewOpportunity.sevaType && entry.sevaDate === viewOpportunity.date)
    ));
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
    setEditing(item);
    editForm.reset({
      sevaType: item.sevaType,
      date: item.date,
      time: item.time || '',
      totalVolunteersRequired: item.totalVolunteersRequired || 10,
      expiryDate: item.expiryDate || '',
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

  const getOpportunityVolunteers = (opportunity) => registrations.filter((entry) => (
    entry.opportunityId === opportunity.id ||
    (!entry.opportunityId && (entry.sevaType || entry.area) === opportunity.sevaType && entry.sevaDate === opportunity.date)
  ));

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
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Time</th>
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
                      <p className="text-[11px] leading-snug text-slate-600">{item.date || '-'} • {item.time || '-'}</p>
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
                  <td className="admin-seva-mobile-hidden py-2 pr-3">{item.date || '-'}</td>
                  <td className="admin-seva-mobile-hidden py-2 pr-3">{item.time || '-'}</td>
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
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenActionMenuId((prev) => (prev === item.id ? '' : item.id))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 lg:h-8 lg:w-8 lg:rounded-lg"
                        aria-label="More actions"
                        title="More actions"
                      >
                        <EllipsisVerticalIcon className={actionIconClass} />
                      </button>
                      {openActionMenuId === item.id ? (
                        <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg lg:top-9">
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

                  </td>
                </tr>
              ))}
              {opportunities.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={6}>No seva opportunities found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {createOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Add Seva Opportunity</h3>
              <button type="button" onClick={closeModals} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
              <label className="text-sm">Seva Type
                <input {...createForm.register('sevaType', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Date
                <input type="date" {...createForm.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Time
                <input {...createForm.register('time')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Total Volunteers Required
                <input type="number" min="1" {...createForm.register('totalVolunteersRequired', { valueAsNumber: true, min: 1 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...createForm.register('expiryDate', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 mt-6">
                <input type="checkbox" {...createForm.register('active')} />
                <span>Active</span>
              </label>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create Opportunity'}</Button>
                <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {viewOpportunity ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Opportunity Details</h3>
              <button type="button" onClick={closeModals} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold">Seva Type:</span> {viewOpportunity.sevaType || '-'}</p>
              <p><span className="font-semibold">Date:</span> {viewOpportunity.date || '-'}</p>
              <p><span className="font-semibold">Time:</span> {viewOpportunity.time || '-'}</p>
              <p><span className="font-semibold">Expiry:</span> {viewOpportunity.expiryDate || '-'}</p>
              <p><span className="font-semibold">Status:</span> {viewOpportunity.status === 'closed' ? 'Closed' : viewOpportunity.active ? 'Active' : 'Inactive'}</p>
              <p><span className="font-semibold">Volunteers:</span> {selectedVolunteers.length}/{viewOpportunity.totalVolunteersRequired || 10}</p>
            </div>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {selectedVolunteers.length === 0 ? (
                <p className="text-sm text-slate-500">No volunteers registered for this opportunity yet.</p>
              ) : selectedVolunteers.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{entry.name || '-'}</p>
                  <p className="text-xs text-slate-600">{entry.phone || 'No phone'} • {entry.email || 'No email'}</p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Seva Opportunity</h3>
              <button type="button" onClick={closeModals} className="rounded-md border border-slate-300 px-2 py-1 text-sm">Close</button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editing.id, values }))}>
              <label className="text-sm">Seva Type
                <input {...editForm.register('sevaType', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Date
                <input type="date" {...editForm.register('date', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Time
                <input {...editForm.register('time')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Total Volunteers Required
                <input type="number" min="1" {...editForm.register('totalVolunteersRequired', { valueAsNumber: true, min: 1 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Expiry Date
                <input type="date" {...editForm.register('expiryDate', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
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
        </div>
      ) : null}
    </div>
  );
};

export default AdminSevaOpportunitiesPage;
