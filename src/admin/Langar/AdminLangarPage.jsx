import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  ClockIcon,
  EyeIcon,
  FunnelIcon,
  PencilSquareIcon,
  PowerIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import cmsService from '../../services/cmsService';
import langarService, { LANGAR_CONTRIBUTIONS_RESOURCE, resolveGroceryImage } from '../../services/langarService';
import contentApiService from '../../services/contentApiService';
import { downloadLangarReceivedReportCsv, downloadLangarReceivedReportPdf } from '../../utils/csvExport';
import { siteConfig } from '../../constants/siteConfig';

const actionIconClass = 'h-4 w-4';
const LANGAR_PAGE_SIZE = 10;
const COMMITMENTS_PAGE_SIZE = 10;
const VIEW_CONTRIBUTORS_PAGE_SIZE = 10;
const LANGAR_UNIT_OPTIONS = ['items', 'kg', 'gm', 'lb', 'unit'];
const REPORT_PRESETS = [
  { value: 'week', label: '7 Days', days: 7 },
  { value: 'month', label: '30 Days', days: 30 },
  { value: 'year', label: '365 Days', days: 365 }
];

const toDateInputValue = (date) => date.toISOString().slice(0, 10);
const defaultReportDates = () => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
  return { start: toDateInputValue(weekAgo), end: toDateInputValue(today) };
};

const defaultForm = {
  name: '',
  category: 'Grocery',
  addedOn: new Date().toISOString().slice(0, 10),
  expiryDate: '',
  quantityRequired: 0,
  quantityReceived: 0,
  unit: 'items'
};

const resolveStatusPreview = (item = {}) => (item.needed === false ? 'Stock Available' : 'Required Soon');

const buildLangarPayload = (values) => {
  const quantityRequired = Number(values.quantityRequired || 0);
  const quantityReceived = Number(values.quantityReceived || 0);
  const needed = quantityReceived < quantityRequired;
  return {
    name: values.name,
    category: values.category,
    addedOn: values.addedOn,
    expiryDate: values.expiryDate,
    needed,
    stockStatus: needed ? 'required_soon' : 'stock_available',
    customStatusLabel: '',
    quantityRequired,
    quantityReceived,
    unit: String(values.unit || 'items').trim() || 'items',
    imageUrl: resolveGroceryImage(values.name)
  };
};

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20';
const labelClass = 'text-xs font-bold uppercase tracking-wide text-slate-500';
const formatShortDate = (value) => (value ? new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '-');

const StatusPill = ({ isReceived, onToggle, disabled }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition ${isReceived ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-60`}
  >
    <PowerIcon className="h-3.5 w-3.5" />
    {isReceived ? 'Received' : 'Pending'}
  </button>
);

const AdminLangarPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [viewContributorsPage, setViewContributorsPage] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [commitmentStatusFilter, setCommitmentStatusFilter] = useState('all');
  const [commitmentItemFilter, setCommitmentItemFilter] = useState('all');
  const [commitmentPage, setCommitmentPage] = useState(1);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportDates, setReportDates] = useState(defaultReportDates);

  const form = useForm({ defaultValues: defaultForm });
  const editForm = useForm({ defaultValues: defaultForm });
  const createName = form.watch('name');
  const editName = editForm.watch('name');

  const { data: cmsData } = useQuery({
    queryKey: ['cms-home'],
    queryFn: () => cmsService.getHomeContent().then((res) => res.data)
  });
  const { data: contributions = [] } = useQuery({
    queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE, 'admin'],
    queryFn: () => langarService.getContributions().then((res) => res.data),
    refetchInterval: 15000
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

  const sortedContributions = useMemo(
    () => [...contributions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [contributions]
  );

  const filteredCommitments = useMemo(() => sortedContributions.filter((entry) => {
    const statusOk = commitmentStatusFilter === 'all' ? true : String(entry.status || 'pending') === commitmentStatusFilter;
    const itemOk = commitmentItemFilter === 'all' ? true : String(entry.itemName || '') === commitmentItemFilter;
    return statusOk && itemOk;
  }), [sortedContributions, commitmentStatusFilter, commitmentItemFilter]);

  const commitmentItemOptions = useMemo(
    () => [...new Set(sortedContributions.map((entry) => entry.itemName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [sortedContributions]
  );

  const totalCommitmentPages = Math.max(1, Math.ceil(filteredCommitments.length / COMMITMENTS_PAGE_SIZE));
  const visibleCommitments = useMemo(() => {
    const start = (commitmentPage - 1) * COMMITMENTS_PAGE_SIZE;
    return filteredCommitments.slice(start, start + COMMITMENTS_PAGE_SIZE);
  }, [filteredCommitments, commitmentPage]);

  const viewItemContributions = useMemo(() => {
    if (!viewItem) return [];
    return sortedContributions.filter((entry) => String(entry.itemId || '') === String(viewItem.id));
  }, [sortedContributions, viewItem]);
  const totalViewContributorPages = Math.max(1, Math.ceil(viewItemContributions.length / VIEW_CONTRIBUTORS_PAGE_SIZE));
  const visibleViewContributions = useMemo(() => {
    const start = (viewContributorsPage - 1) * VIEW_CONTRIBUTORS_PAGE_SIZE;
    return viewItemContributions.slice(start, start + VIEW_CONTRIBUTORS_PAGE_SIZE);
  }, [viewItemContributions, viewContributorsPage]);

  const reportRows = useMemo(() => {
    const startTime = reportDates.start ? new Date(`${reportDates.start}T00:00:00`).getTime() : -Infinity;
    const endTime = reportDates.end ? new Date(`${reportDates.end}T23:59:59`).getTime() : Infinity;
    return sortedContributions.filter((entry) => {
      if (String(entry.status || '').toLowerCase() !== 'received') return false;
      const createdTime = new Date(entry.createdAt || 0).getTime();
      return createdTime >= startTime && createdTime <= endTime;
    });
  }, [sortedContributions, reportDates]);

  const reportGrandTotal = useMemo(() => reportRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0), [reportRows]);

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

  const removeMutation = useMutation({
    mutationFn: (id) => cmsService.removeLangarItem(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
      setViewItem((prev) => (prev?.id === id ? null : prev));
      setEditingItem((prev) => (prev?.id === id ? null : prev));
    }
  });

  const contributionStatusMutation = useMutation({
    mutationFn: ({ id, status }) => contentApiService.update(LANGAR_CONTRIBUTIONS_RESOURCE, id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE, 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
    }
  });

  const contributionDeleteMutation = useMutation({
    mutationFn: (id) => langarService.deleteContribution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LANGAR_CONTRIBUTIONS_RESOURCE, 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['cms-home'] });
    }
  });

  const openEdit = (item) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      category: item.category || 'Grocery',
      addedOn: item.addedOn || '',
      expiryDate: item.expiryDate || '',
      quantityRequired: item.quantityRequired || 0,
      quantityReceived: item.quantityReceived || 0,
      unit: item.unit || 'items'
    });
  };

  const openView = (item) => {
    setViewItem(item);
    setViewContributorsPage(1);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setViewItem(null);
    setEditingItem(null);
  };

  const applyReportPreset = (days) => {
    const today = new Date();
    const from = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
    setReportDates({ start: toDateInputValue(from), end: toDateInputValue(today) });
  };

  const buildReportRowsForExport = () => reportRows.map((entry) => ({
    itemName: entry.itemName || '-',
    donorName: entry.anonymous ? 'Anonymous' : (entry.donorName || 'Member'),
    quantity: entry.quantity,
    unit: entry.unit,
    createdDate: entry.createdAt ? formatShortDate(entry.createdAt) : '-',
    expectedDate: entry.expectedDeliveryDate ? formatShortDate(entry.expectedDeliveryDate) : '-'
  }));

  const downloadReport = async (format) => {
    const periodLabel = `${formatShortDate(reportDates.start)} – ${formatShortDate(reportDates.end)}`;
    const rows = buildReportRowsForExport();
    if (format === 'pdf') {
      await downloadLangarReceivedReportPdf({ organizationName: siteConfig.name, periodLabel, rows, fileName: `langar-items-received-${reportDates.start}-to-${reportDates.end}.pdf` });
      return;
    }
    downloadLangarReceivedReportCsv({ organizationName: siteConfig.name, periodLabel, rows, fileName: `langar-items-received-${reportDates.start}-to-${reportDates.end}.csv` });
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

  useEffect(() => {
    setCommitmentPage(1);
  }, [commitmentStatusFilter, commitmentItemFilter]);

  useEffect(() => {
    if (commitmentPage > totalCommitmentPages) {
      setCommitmentPage(totalCommitmentPages);
    }
  }, [commitmentPage, totalCommitmentPages]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Seva Items</h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-brand-blue">Langar Commitments</h2>
            <p className="mt-1 text-xs text-slate-500">Review contributor commitments and mark supplies received.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{filteredCommitments.length} of {contributions.length} total</span>
            <Button type="button" onClick={() => setReportOpen(true)} className="bg-brand-blue text-white hover:bg-blue-800">
              <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" /> Download Report
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className={labelClass}>Status
            <select value={commitmentStatusFilter} onChange={(event) => setCommitmentStatusFilter(event.target.value)} className={inputClass}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className={labelClass}>Item
            <select value={commitmentItemFilter} onChange={(event) => setCommitmentItemFilter(event.target.value)} className={inputClass}>
              <option value="all">All items</option>
              {commitmentItemOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Contributed For</th>
                <th className="py-2 pr-3">Quantity</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Expected Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCommitments.map((entry) => {
                const isReceived = String(entry.status || 'pending') === 'received';
                return (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-800">{entry.anonymous ? 'Anonymous' : entry.donorName}</td>
                    <td className="py-2 pr-3 text-slate-700">{entry.itemName}</td>
                    <td className="py-2 pr-3 text-slate-700">{entry.quantity} {entry.unit}</td>
                    <td className="py-2 pr-3 text-slate-700">{entry.createdAt ? formatShortDate(entry.createdAt) : '-'}</td>
                    <td className="py-2 pr-3 text-slate-700">{entry.expectedDeliveryDate || '-'}</td>
                    <td className="py-2 pr-3">
                      <StatusPill
                        isReceived={isReceived}
                        disabled={contributionStatusMutation.isPending}
                        onToggle={() => contributionStatusMutation.mutate({ id: entry.id, status: isReceived ? 'pending' : 'received' })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => { if (window.confirm('Delete this Langar commitment?')) contributionDeleteMutation.mutate(entry.id); }}
                        disabled={contributionDeleteMutation.isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        title="Delete commitment"
                        aria-label="Delete commitment"
                      >
                        <TrashIcon className={actionIconClass} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredCommitments.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={7}>No Langar commitments found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredCommitments.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Showing {visibleCommitments.length} of {filteredCommitments.length} commitments</p>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={commitmentPage <= 1} onClick={() => setCommitmentPage((prev) => prev - 1)}>Prev</button>
              <span className="text-xs font-semibold text-slate-600">Page {commitmentPage} of {totalCommitmentPages}</span>
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={commitmentPage >= totalCommitmentPages} onClick={() => setCommitmentPage((prev) => prev + 1)}>Next</button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Search
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item name or category"
              className={inputClass}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
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
              className={inputClass}
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
                <th className="py-2 pr-3">Received</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <img src={item.imageUrl || resolveGroceryImage(item.name)} alt="" className="hidden h-9 w-9 shrink-0 rounded-lg object-cover sm:block" />
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
                    </div>
                  </td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">{item.category || 'Grocery'}</td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">{item.addedOn || '-'}</td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">{item.expiryDate || '-'}</td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">
                    {Number(item.quantityReceived || 0)} / {Number(item.quantityRequired || 0)} {item.unit || 'items'}
                  </td>
                  <td className="admin-langar-mobile-hidden py-2 pr-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.needed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                      {resolveStatusPreview(item)}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openView(item)}
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
                  <td className="py-4 text-center text-slate-500" colSpan={7}>No seva items found.</td>
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
            <div className="w-full max-w-xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-brand-blue to-blue-700 px-5 py-4">
                <h3 className="font-heading text-xl font-semibold text-white">Add Seva Item</h3>
                <button type="button" className="rounded-full border border-white/40 p-1.5 text-white hover:bg-white/10" onClick={closeModals} aria-label="Close">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <form className="space-y-4 p-5" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <img src={resolveGroceryImage(createName) || undefined} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} onLoad={(event) => { event.currentTarget.style.visibility = 'visible'; }} />
                  <p className="text-xs text-slate-500">The item image is fetched automatically from the item name.</p>
                </div>
                <label className={labelClass}>Item Name
                  <input {...form.register('name', { required: true })} required className={inputClass} />
                </label>
                <label className={labelClass}>Category
                  <input {...form.register('category', { required: true })} required className={inputClass} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>Added Date
                    <input type="date" {...form.register('addedOn', { required: true })} required className={inputClass} />
                  </label>
                  <label className={labelClass}>Expiry Date <span className="font-normal normal-case text-slate-400">(optional)</span>
                    <input type="date" {...form.register('expiryDate')} className={inputClass} />
                  </label>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <label className={labelClass}>Quantity Needed
                    <input type="number" min="0" step="0.01" {...form.register('quantityRequired', { valueAsNumber: true })} className={inputClass} />
                  </label>
                  <label className={`${labelClass} w-28`}>Unit
                    <select {...form.register('unit')} className={inputClass}>
                      {LANGAR_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
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
            <div className="w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-brand-blue to-blue-700 px-5 py-4">
                <h3 className="font-heading text-xl font-semibold text-white">Seva Item Details</h3>
                <button type="button" className="rounded-full border border-white/40 p-1.5 text-white hover:bg-white/10" onClick={closeModals} aria-label="Close">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-3">
                    <img src={viewItem.imageUrl || resolveGroceryImage(viewItem.name)} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover" />
                    <div>
                      <p className="font-heading text-lg font-bold text-slate-900">{viewItem.name || '-'}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${viewItem.needed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{resolveStatusPreview(viewItem)}</span>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <tbody>
                        <tr className="border-b border-slate-200 bg-white"><td className="px-3 py-2 font-semibold text-brand-blue">Category</td><td className="px-3 py-2 text-slate-800">{viewItem.category || '-'}</td></tr>
                        <tr className="border-b border-slate-200 bg-slate-50"><td className="px-3 py-2 font-semibold text-brand-blue">Added On</td><td className="px-3 py-2 text-slate-800">{viewItem.addedOn || '-'}</td></tr>
                        <tr className="border-b border-slate-200 bg-white"><td className="px-3 py-2 font-semibold text-brand-blue">Expiry</td><td className="px-3 py-2 text-slate-800">{viewItem.expiryDate || '-'}</td></tr>
                        <tr className="border-b border-slate-200 bg-slate-50"><td className="px-3 py-2 font-semibold text-brand-blue">Quantity</td><td className="px-3 py-2 text-slate-800">{Number(viewItem.quantityReceived || 0)} / {Number(viewItem.quantityRequired || 0)} {viewItem.unit || 'items'}</td></tr>
                        <tr className="bg-white"><td className="px-3 py-2 font-semibold text-brand-blue">Status</td><td className="px-3 py-2 font-bold text-brand-saffron">{resolveStatusPreview(viewItem)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <p className="font-heading text-lg font-bold text-slate-900">Contributors</p>
                  <p className="text-xs text-slate-500">People who committed to this item.</p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Contributed</th>
                          <th className="px-3 py-2">When</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleViewContributions.map((entry) => (
                          <tr key={entry.id} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-semibold text-slate-800">{entry.anonymous ? 'Anonymous' : entry.donorName}</td>
                            <td className="px-3 py-2 text-slate-700">{entry.quantity} {entry.unit}</td>
                            <td className="px-3 py-2 text-slate-700">{entry.createdAt ? formatShortDate(entry.createdAt) : '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${entry.status === 'received' ? 'bg-emerald-100 text-emerald-700' : entry.status === 'cancelled' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>{entry.status === 'received' ? 'Received' : entry.status === 'cancelled' ? 'Cancelled' : 'Pending'}</span>
                            </td>
                          </tr>
                        ))}
                        {viewItemContributions.length === 0 ? (
                          <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={4}>No contributions yet for this item.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  {viewItemContributions.length > 0 ? (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={viewContributorsPage <= 1} onClick={() => setViewContributorsPage((prev) => prev - 1)}>Prev</button>
                      <span className="text-xs font-semibold text-slate-600">Page {viewContributorsPage} of {totalViewContributorPages}</span>
                      <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={viewContributorsPage >= totalViewContributorPages} onClick={() => setViewContributorsPage((prev) => prev + 1)}>Next</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-brand-blue to-blue-700 px-5 py-4">
                <h3 className="font-heading text-xl font-semibold text-white">Edit Seva Item</h3>
                <button type="button" className="rounded-full border border-white/40 p-1.5 text-white hover:bg-white/10" onClick={closeModals} aria-label="Close">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <form className="space-y-4 p-5" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingItem.id, values }))}>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <img src={resolveGroceryImage(editName) || undefined} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} onLoad={(event) => { event.currentTarget.style.visibility = 'visible'; }} />
                  <p className="text-xs text-slate-500">The item image is fetched automatically from the item name.</p>
                </div>
                <label className={labelClass}>Item Name
                  <input {...editForm.register('name', { required: true })} required className={inputClass} />
                </label>
                <label className={labelClass}>Category
                  <input {...editForm.register('category', { required: true })} required className={inputClass} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>Added Date
                    <input type="date" {...editForm.register('addedOn', { required: true })} required className={inputClass} />
                  </label>
                  <label className={labelClass}>Expiry Date <span className="font-normal normal-case text-slate-400">(optional)</span>
                    <input type="date" {...editForm.register('expiryDate')} className={inputClass} />
                  </label>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <label className={labelClass}>Quantity Needed
                    <input type="number" min="0" step="0.01" {...editForm.register('quantityRequired', { valueAsNumber: true })} className={inputClass} />
                  </label>
                  <label className={`${labelClass} w-28`}>Unit
                    <select {...editForm.register('unit')} className={inputClass}>
                      {LANGAR_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <label className={labelClass}>Quantity Received <span className="font-normal normal-case text-slate-400">(updates automatically as commitments are marked received)</span>
                  <input type="number" readOnly disabled {...editForm.register('quantityReceived', { valueAsNumber: true })} className={`${inputClass} cursor-not-allowed bg-slate-100 text-slate-500`} />
                </label>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                  <Button type="button" variant="ghost" onClick={closeModals}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen ? (
        <div className="fixed inset-0 z-[96] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setReportOpen(false)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-brand-blue/20 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-brand-blue to-blue-700 px-5 py-4">
                <div className="flex items-center gap-2 text-white">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  <h3 className="font-heading text-xl font-semibold">Langar Items Received Report</h3>
                </div>
                <button type="button" className="rounded-full border border-white/40 p-1.5 text-white hover:bg-white/10" onClick={() => setReportOpen(false)} aria-label="Close">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <FunnelIcon className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick range:</span>
                  {REPORT_PRESETS.map((preset) => (
                    <button key={preset.value} type="button" onClick={() => applyReportPreset(preset.days)} className="rounded-full border border-brand-blue/30 bg-blue-50 px-3 py-1 text-xs font-bold text-brand-blue hover:bg-blue-100">
                      Past {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}><CalendarDaysIcon className="mr-1 inline h-3.5 w-3.5" />Start Date
                    <input type="date" value={reportDates.start} onChange={(event) => setReportDates((prev) => ({ ...prev, start: event.target.value }))} className={inputClass} />
                  </label>
                  <label className={labelClass}><CalendarDaysIcon className="mr-1 inline h-3.5 w-3.5" />End Date
                    <input type="date" value={reportDates.end} onChange={(event) => setReportDates((prev) => ({ ...prev, end: event.target.value }))} className={inputClass} />
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-slate-600">
                  <ClockIcon className="h-4 w-4 shrink-0 text-brand-blue" />
                  Showing {reportRows.length} received commitment{reportRows.length === 1 ? '' : 's'} totaling <strong className="text-brand-blue">{reportGrandTotal}</strong> units between {formatShortDate(reportDates.start)} and {formatShortDate(reportDates.end)}.
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0">
                      <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2">Contributor</th>
                        <th className="px-3 py-2">Quantity</th>
                        <th className="px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((entry, index) => (
                        <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-semibold text-slate-800">{entry.itemName}</td>
                          <td className="px-3 py-2 text-slate-700">{entry.anonymous ? 'Anonymous' : entry.donorName}</td>
                          <td className="px-3 py-2 text-slate-700">{entry.quantity} {entry.unit}</td>
                          <td className="px-3 py-2 text-slate-700">{entry.createdAt ? formatShortDate(entry.createdAt) : '-'}</td>
                        </tr>
                      ))}
                      {reportRows.length === 0 ? (
                        <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={4}>No items received in this period.</td></tr>
                      ) : null}
                    </tbody>
                    {reportRows.length > 0 ? (
                      <tfoot>
                        <tr className="border-t-2 border-slate-300 bg-slate-100">
                          <td className="px-3 py-2 font-bold text-brand-blue" colSpan={2}>Grand Total</td>
                          <td className="px-3 py-2 font-bold text-brand-blue" colSpan={2}>{reportGrandTotal} units</td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => downloadReport('pdf')} disabled={reportRows.length === 0} className="bg-brand-blue text-white hover:bg-blue-800">
                    <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" /> Download PDF
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => downloadReport('csv')} disabled={reportRows.length === 0}>
                    <ArrowDownTrayIcon className="mr-1.5 h-4 w-4" /> Download CSV
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLangarPage;
