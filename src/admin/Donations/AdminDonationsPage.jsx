import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DocumentArrowDownIcon,
  EnvelopeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  SparklesIcon,
  BuildingLibraryIcon,
  BanknotesIcon,
  PowerIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import donationService from '../../services/donationService';
import { formatCurrency } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import {
  createDonationInvoicePdfBlob,
  downloadCampaignDonationsCsv,
  downloadCampaignDonationsPdf,
  downloadDonationInvoicePdf
} from '../../utils/csvExport';
import { siteConfig } from '../../constants/siteConfig';

const PAGE_SIZE = 10;
const campaignDefaults = {
  name: '',
  description: '',
  raised: 0,
  target: 0,
  isActive: true,
  paymentProvider: 'STRIPE',
  paymentLink: '',
  stripeBuyButtonId: '',
  stripePublishableKey: ''
};

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Amount high to low' },
  { value: 'amount-asc', label: 'Amount low to high' },
  { value: 'donor-asc', label: 'Donor A to Z' },
  { value: 'donor-desc', label: 'Donor Z to A' }
];

const AdminDonationsPage = () => {
  const { setHeaderAction } = useOutletContext();
  const queryClient = useQueryClient();
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [viewingCampaign, setViewingCampaign] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [page, setPage] = useState(1);
  const form = useForm({ defaultValues: campaignDefaults });
  const editForm = useForm({ defaultValues: campaignDefaults });
  const { data: campaigns = [] } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => donationService.getAllCampaigns().then((res) => res.data),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30000
  });
  const { data: donations = [] } = useQuery({
    queryKey: ['admin-donations'],
    queryFn: () => donationService.getDonations().then((res) => res.data),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000
  });

  const campaignMap = useMemo(() => campaigns.reduce((accumulator, campaign) => {
    accumulator[String(campaign.id)] = campaign;
    return accumulator;
  }, {}), [campaigns]);

  const donationBoardUrl = '/donation-board';

  const campaignDonations = useMemo(() => {
    if (!viewingCampaign) {
      return [];
    }

    return donations.filter((donation) => String(donation.campaignId) === String(viewingCampaign.id));
  }, [donations, viewingCampaign]);

  const visibleDonations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = donations
      .map((donation) => ({
        ...donation,
        campaignDescription: campaignMap[String(donation.campaignId)]?.description || ''
      }))
      .filter((donation) => {
        const matchesCampaign = campaignFilter === 'all' || String(donation.campaignId) === campaignFilter || donation.campaignName === campaignFilter;
        const haystack = [donation.donorName, donation.donorEmail, donation.receiptId, donation.campaignName, donation.amount, donation.frequency].join(' ').toLowerCase();
        const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
        return matchesCampaign && matchesSearch;
      })
      .sort((left, right) => {
        if (sortMode === 'amount-desc') return Number(right.amount || 0) - Number(left.amount || 0);
        if (sortMode === 'amount-asc') return Number(left.amount || 0) - Number(right.amount || 0);
        if (sortMode === 'donor-asc') return String(left.donorName || '').localeCompare(String(right.donorName || ''));
        if (sortMode === 'donor-desc') return String(right.donorName || '').localeCompare(String(left.donorName || ''));

        const leftDate = new Date(left.createdAt || 0).getTime();
        const rightDate = new Date(right.createdAt || 0).getTime();
        return sortMode === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
      });

    return filtered;
  }, [campaignFilter, campaignMap, donations, searchTerm, sortMode]);

  const totalPages = Math.max(1, Math.ceil(visibleDonations.length / PAGE_SIZE));
  const pagedDonations = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return visibleDonations.slice(start, start + PAGE_SIZE);
  }, [page, totalPages, visibleDonations]);

  useEffect(() => {
    setPage(1);
  }, [campaignFilter, searchTerm, sortMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const createMutation = useMutation({
    mutationFn: (values) => donationService.createCampaign(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      form.reset(campaignDefaults);
      setCreateCampaignOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => donationService.updateCampaign(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setEditingCampaign(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => donationService.removeCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const openEdit = (campaign) => {
    setEditingCampaign(campaign);
    editForm.reset({
      name: campaign.name,
      description: campaign.description || '',
      raised: campaign.raised,
      target: campaign.target,
      isActive: Boolean(campaign.isActive),
      paymentProvider: campaign.paymentProvider || 'STRIPE',
      paymentLink: campaign.paymentLink || '',
      stripeBuyButtonId: campaign.stripeBuyButtonId || '',
      stripePublishableKey: campaign.stripePublishableKey || ''
    });
  };

  const openCreate = () => {
    form.reset(campaignDefaults);
    setCreateCampaignOpen(true);
  };

  const toggleCampaignStatus = (campaign) => {
    updateMutation.mutate({
      id: campaign.id,
      values: { isActive: !campaign.isActive }
    });
  };

  const handleDownloadInvoice = (entry) => {
    void downloadDonationInvoicePdf({
      fileName: `invoice-${entry.receiptId || entry.id}.pdf`,
      organizationName: siteConfig.name,
      address: siteConfig.contact.address,
      phone: siteConfig.contact.phone,
      donation: entry,
      campaignDescription: campaignMap[String(entry.campaignId)]?.description || ''
    }).catch(() => null);
  };

  const handleEmailInvoice = async (entry) => {
    const donorEmail = String(entry.donorEmail || '').trim();
    if (!donorEmail) {
      return;
    }

    const fileName = `invoice-${entry.receiptId || entry.id}.pdf`;
    const payload = {
      fileName,
      organizationName: siteConfig.name,
      address: siteConfig.contact.address,
      phone: siteConfig.contact.phone,
      donation: entry,
      campaignDescription: campaignMap[String(entry.campaignId)]?.description || ''
    };

    try {
      const blob = await createDonationInvoicePdfBlob(payload);
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const canShareWithFile = typeof navigator !== 'undefined'
        && typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] });

      if (canShareWithFile) {
        await navigator.share({
          files: [file],
          title: `Donation Invoice ${entry.receiptId || entry.id}`,
          text: `Please find your donation invoice attached.\nCampaign: ${entry.campaignName || '-'}`
        });
        return;
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      const subject = encodeURIComponent(`Donation Invoice ${entry.receiptId || entry.id}`);
      const body = encodeURIComponent(`Sat Sri Akal ${entry.donorName || ''},\n\nPlease find your donation invoice attached for ${entry.campaignName || 'your donation'}.\n\nThank you for your support.\n${siteConfig.name}`);
      window.location.href = `mailto:${encodeURIComponent(donorEmail)}?subject=${subject}&body=${body}`;
    } catch {
      // Fallback to plain invoice download if mail/share preparation fails.
      handleDownloadInvoice(entry);
    }
  };

  const handleDownloadCampaignCsv = () => {
    if (!viewingCampaign) {
      return;
    }

    downloadCampaignDonationsCsv({
      fileName: `${viewingCampaign.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-donors.csv`,
      organizationName: siteConfig.name,
      campaignName: viewingCampaign.name,
      donations: campaignDonations
    });
  };

  const handleDownloadCampaignPdf = async () => {
    if (!viewingCampaign) {
      return;
    }

    await downloadCampaignDonationsPdf({
      fileName: `${viewingCampaign.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-donors.pdf`,
      organizationName: siteConfig.name,
      campaignName: viewingCampaign.name,
      donations: campaignDonations
    });
  };

  useEffect(() => {
    setHeaderAction(
      <AdminHeaderActionButton label="Add Campaign" onClick={openCreate} />
    );

    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderAction]);

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Donation Management</h1>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">Campaigns</h2>
          <a
            href={donationBoardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
          >
            <EyeIcon className="h-4 w-4" /> Go To Donation Board
          </a>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-blue-50 to-amber-50 text-slate-600">
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Raised</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr key={campaign.id} className={`border-b border-slate-100 transition hover:bg-blue-50/40 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="py-2 pr-3">
                    <div className="space-y-1.5 lg:hidden">
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold leading-tight text-slate-800">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-amber-100 text-brand-blue">
                          <SparklesIcon className="h-4 w-4" />
                        </span>
                        {campaign.name}
                      </p>
                      {campaign.description ? <p className="text-[12px] leading-snug text-slate-600">{campaign.description}</p> : null}
                      <p className="text-[12px] leading-snug text-slate-600">{campaign.paymentProvider}</p>
                      <p className="text-[12px] leading-snug text-slate-600">Target: {formatCurrency(campaign.target)}</p>
                      <p className="text-[12px] leading-snug text-slate-600">Raised: {formatCurrency(campaign.raised)}</p>
                      <div className="pt-0.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${campaign.isClosed ? 'bg-violet-100 text-violet-800' : campaign.isActive ? 'border border-emerald-300 bg-emerald-100 text-emerald-800' : 'border border-slate-300 bg-slate-100 text-slate-700'}`}>
                          {campaign.isClosed ? 'Closed' : campaign.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <span className="hidden lg:inline">{campaign.name}</span>
                  </td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${campaign.paymentProvider === 'PAYPAL' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                      {campaign.paymentProvider === 'PAYPAL' ? <BanknotesIcon className="h-3.5 w-3.5" /> : <BuildingLibraryIcon className="h-3.5 w-3.5" />}
                      {campaign.paymentProvider}
                    </span>
                  </td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">{formatCurrency(campaign.target)}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">{formatCurrency(campaign.raised)}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {campaign.isClosed ? (
                        <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">Closed</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleCampaignStatus(campaign)}
                        disabled={updateMutation.isPending}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${campaign.isActive ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <PowerIcon className="h-3.5 w-3.5" />
                        {campaign.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setViewingCampaign(campaign)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100" aria-label="View campaign">
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => openEdit(campaign)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100" aria-label="Edit campaign">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => deleteMutation.mutate(campaign.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100" aria-label="Delete campaign">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={6}>No campaigns yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">Donor List</h2>
        </div>
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1.4fr_1fr_1fr]">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search donor, campaign, amount"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <FunnelIcon className="h-4 w-4 text-slate-400" />
            <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)} className="w-full bg-transparent text-sm outline-none">
              <option value="all">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={String(campaign.id)}>{campaign.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {sortMode === 'amount-desc' || sortMode === 'donor-desc' || sortMode === 'oldest' ? <ArrowUpIcon className="h-4 w-4 text-slate-400" /> : <ArrowDownIcon className="h-4 w-4 text-slate-400" />}
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="w-full bg-transparent text-sm outline-none">
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Donor</th>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedDonations.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <div className="space-y-1.5 lg:hidden">
                      <p className="text-sm font-bold leading-tight text-slate-800">{entry.donorName}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{new Date(entry.createdAt).toLocaleDateString()}</p>
                      <p className="text-[12px] leading-snug text-slate-600">{entry.campaignName}</p>
                      {entry.campaignDescription ? <p className="text-[12px] leading-snug text-slate-600">{entry.campaignDescription}</p> : null}
                      <p className="text-[12px] leading-snug text-slate-600">{formatCurrency(entry.amount)}</p>
                    </div>
                    <span className="hidden lg:inline">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3 font-semibold text-slate-800">{entry.donorName}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3">
                    <div>
                      <p className="font-medium text-slate-800">{entry.campaignName}</p>
                      {entry.campaignDescription ? <p className="text-xs text-slate-500">{entry.campaignDescription}</p> : null}
                    </div>
                  </td>
                  <td className="admin-compact-mobile-hidden py-2 pr-3 font-semibold text-slate-800">{formatCurrency(entry.amount)}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(entry)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/20 px-3 py-1.5 text-xs font-semibold text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue hover:text-white"
                        title="Download invoice PDF"
                      >
                        <DocumentArrowDownIcon className="h-4 w-4" /> Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleEmailInvoice(entry)}
                        disabled={!entry.donorEmail}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={entry.donorEmail ? 'Email invoice to donor' : 'Donor email not available'}
                      >
                        <EnvelopeIcon className="h-4 w-4" /> Email Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pagedDonations.length === 0 ? (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>No donations found for the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>
            Showing {pagedDonations.length} of {visibleDonations.length} donations
            {visibleDonations.length > 0 ? ` • Page ${page} of ${totalPages}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {createCampaignOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setCreateCampaignOpen(false)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-semibold">Create Donation Campaign</h3>
                <p className="mt-1 text-xs text-slate-500">Use checkout URL, URL template tokens, or backend endpoint.</p>
              </div>
              <button type="button" onClick={() => setCreateCampaignOpen(false)} className="rounded-full border border-slate-300 p-2 text-slate-600" aria-label="Close create campaign modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
              <label className="text-sm">Campaign Name
                <input {...form.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Payment Provider
                <select {...form.register('paymentProvider')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                </select>
              </label>
              <label className="text-sm">Raised
                <input type="number" min="0" step="0.01" {...form.register('raised', { valueAsNumber: true, min: 0 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Target
                <input type="number" min="0" step="0.01" {...form.register('target', { required: true, valueAsNumber: true, min: 0 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea rows={2} {...form.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Checkout Link (optional)
                <input {...form.register('paymentLink')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="https://buy.stripe.com/... or /api/payments/create-session" />
              </label>
              <label className="text-sm">Stripe Buy Button ID (optional)
                <input {...form.register('stripeBuyButtonId')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="buy_btn_..." />
              </label>
              <label className="text-sm md:col-span-2">Stripe Publishable Key (optional)
                <input {...form.register('stripePublishableKey')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" placeholder="pk_test_... or pk_live_..." />
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-3">
                <input type="checkbox" {...form.register('isActive')} />
                Active campaign
              </label>
              <div className="flex gap-2 md:col-span-3">
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Campaign'}</Button>
                <Button type="button" variant="ghost" onClick={() => setCreateCampaignOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {viewingCampaign ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setViewingCampaign(null)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Campaign Details</h3>
              <button type="button" onClick={() => setViewingCampaign(null)} className="rounded-full border border-slate-300 p-2 text-slate-600" aria-label="Close campaign details modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <p><span className="font-semibold text-slate-900">Name:</span> {viewingCampaign.name}</p>
              <p><span className="font-semibold text-slate-900">Provider:</span> {viewingCampaign.paymentProvider}</p>
              <p><span className="font-semibold text-slate-900">Target:</span> {formatCurrency(viewingCampaign.target)}</p>
              <p><span className="font-semibold text-slate-900">Raised:</span> {formatCurrency(viewingCampaign.raised)}</p>
              <p><span className="font-semibold text-slate-900">Status:</span> {viewingCampaign.isActive ? (viewingCampaign.isClosed ? 'Closed' : 'Active') : 'Inactive'}</p>
              <p className="md:col-span-2 break-all"><span className="font-semibold text-slate-900">Checkout Link:</span> {viewingCampaign.paymentLink || '-'}</p>
              <p className="md:col-span-2"><span className="font-semibold text-slate-900">Description:</span> {viewingCampaign.description || '-'}</p>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Campaign donor list</p>
                  <p className="text-xs text-slate-500">{campaignDonations.length} donation{campaignDonations.length === 1 ? '' : 's'} found for this campaign.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={handleDownloadCampaignCsv} disabled={campaignDonations.length === 0}>Download CSV</Button>
                  <Button type="button" onClick={() => void handleDownloadCampaignPdf()} disabled={campaignDonations.length === 0}>Download PDF</Button>
                </div>
              </div>
              {campaignDonations.length > 0 ? (
                <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Donor</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignDonations.map((donation) => (
                        <tr key={donation.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{donation.donorName || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{donation.donorEmail || '-'}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{formatCurrency(donation.amount || 0)}</td>
                          <td className="px-3 py-2 text-slate-600">{donation.createdAt ? new Date(donation.createdAt).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {editingCampaign ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setEditingCampaign(null)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xl font-semibold">Edit Campaign</h3>
              <button type="button" onClick={() => setEditingCampaign(null)} className="rounded-full border border-slate-300 p-2 text-slate-600" aria-label="Close edit campaign modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingCampaign.id, values }))}>
              <label className="text-sm">Campaign Name
                <input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Payment Provider
                <select {...editForm.register('paymentProvider')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5">
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                </select>
              </label>
              <label className="text-sm">Raised
                <input type="number" min="0" step="0.01" {...editForm.register('raised', { valueAsNumber: true, min: 0 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Target
                <input type="number" min="0" step="0.01" {...editForm.register('target', { required: true, valueAsNumber: true, min: 0 })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea rows={2} {...editForm.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Checkout Link (optional)
                <input {...editForm.register('paymentLink')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm">Stripe Buy Button ID (optional)
                <input {...editForm.register('stripeBuyButtonId')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="text-sm md:col-span-2">Stripe Publishable Key (optional)
                <input {...editForm.register('stripePublishableKey')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...editForm.register('isActive')} />
                Active campaign
              </label>
              <div className="flex gap-2 md:col-span-3">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingCampaign(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminDonationsPage;
