import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import volunteerService from '../../services/volunteerService';
import { siteConfig } from '../../constants/siteConfig';
import { downloadRegistrationCsv, downloadRegistrationPdf } from '../../utils/csvExport';

const actionIconClass = 'h-4 w-4';

const defaultForm = {
  sevaType: '',
  date: '',
  time: '',
  totalVolunteersRequired: 10,
  expiryDate: '',
  active: true
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
      <Button type="button" onClick={() => setCreateOpen(true)} className="h-8 px-2.5 py-1 text-xs font-semibold">
        Add New Seva Opportunity
      </Button>
    );

    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Seva Opportunities</h1>

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
                  <td className="py-2 pr-3 font-semibold text-slate-800">{item.sevaType || '-'}</td>
                  <td className="py-2 pr-3">{item.date || '-'}</td>
                  <td className="py-2 pr-3">{item.time || '-'}</td>
                  <td className="py-2 pr-3">{(volunteersByOpportunity[item.id] || []).length}/{item.totalVolunteersRequired || 10}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === 'closed' ? 'bg-rose-100 text-rose-700' : item.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                      {item.status === 'closed' ? 'Closed' : item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="relative lg:hidden">
                      <button
                        type="button"
                        onClick={() => setOpenActionMenuId((prev) => (prev === item.id ? '' : item.id))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                        aria-label="More actions"
                        title="More actions"
                      >
                        <EllipsisVerticalIcon className={actionIconClass} />
                      </button>
                      {openActionMenuId === item.id ? (
                        <div className="absolute right-0 top-9 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              toggleActiveMutation.mutate({ id: item.id, active: !item.active });
                              setOpenActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {item.active ? 'Mark inactive' : 'Mark active'}
                          </button>
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

                    <div className="hidden items-center gap-2 lg:flex">
                      <button
                        type="button"
                        onClick={() => toggleActiveMutation.mutate({ id: item.id, active: !item.active })}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${item.active ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                        title={item.active ? 'Mark inactive' : 'Mark active'}
                        aria-label={item.active ? 'Mark inactive' : 'Mark active'}
                      >
                        <CheckIcon className={actionIconClass} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewOpportunity(item)}
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
                        onClick={() => exportOpportunityVolunteers(item, 'csv')}
                        disabled={getOpportunityVolunteers(item).length === 0}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Download CSV"
                        aria-label="Download CSV"
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => exportOpportunityVolunteers(item, 'pdf')}
                        disabled={getOpportunityVolunteers(item).length === 0}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Download PDF"
                        aria-label="Download PDF"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => manualReminderMutation.mutate(item)}
                        disabled={getOpportunityVolunteers(item).length === 0 || manualReminderMutation.isPending}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-amber-200 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Send reminder emails"
                        aria-label="Send reminder emails"
                      >
                        <EnvelopeIcon className="h-3.5 w-3.5" />
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(item.id)}
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
