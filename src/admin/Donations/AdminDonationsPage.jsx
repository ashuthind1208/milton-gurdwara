import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DocumentArrowDownIcon,
  EnvelopeIcon,
  EllipsisVerticalIcon,
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
  PowerIcon,
  ArrowPathIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import donationService from '../../services/donationService';
import contentApiService from '../../services/contentApiService';
import uploadService from '../../services/uploadService';
import { formatCurrency } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import AdminHeaderActionButton from '../../components/ui/AdminHeaderActionButton';
import StatusAlert from '../../components/common/StatusAlert';
import {
  createDonationInvoicePdfBlob,
  downloadCampaignDonationsCsv,
  downloadCampaignDonationsPdf,
  downloadDonationInvoicePdf
} from '../../utils/csvExport';
import { siteConfig } from '../../constants/siteConfig';

const DONATIONS_PAGE_SIZE = 6;
const PROGRESS_ITEMS_PAGE_SIZE = 10;
const CAMPAIGN_DONORS_PAGE_SIZE = 8;
const DONATION_IDENTITY_SETTING_KEY = 'settings-donation-allow-custom-name-email';
const campaignDefaults = {
  name: '',
  description: '',
  progressTitle: '',
  progressDescription: '',
  storyBlocksText: '',
  progressPhotosText: '',
  progressUpdatesText: '',
  raised: 0,
  target: 0,
  isActive: true,
  paymentProvider: 'STRIPE',
  paymentLink: '',
  stripeBuyButtonId: '',
  stripePublishableKey: '',
  zeffyApiKey: ''
};

const createCashReceiptId = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const uniquePart = `${now.getTime()}`.slice(-7);
  return `GRC-${datePart}-${uniquePart}`;
};

const createCashDonationDefaults = () => ({
  campaignId: '',
  donorName: '',
  donorEmail: '',
  donorPhone: '',
  amount: 0,
  receiptId: createCashReceiptId(),
  paidAt: new Date().toISOString().slice(0, 10)
});

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Amount high to low' },
  { value: 'amount-asc', label: 'Amount low to high' },
  { value: 'donor-asc', label: 'Donor A to Z' },
  { value: 'donor-desc', label: 'Donor Z to A' }
];

const parseProgressPhotosText = (value = '') => {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const formatProgressPhotosText = (photos = []) => {
  return (Array.isArray(photos) ? photos : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join('\n');
};

const parseProgressUpdatesText = (value = '') => {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [date = '', title = '', description = '', amount = ''] = line.split('|').map((segment) => segment.trim());
      const parsedAmount = Number(amount);
      return {
        date,
        title,
        description,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0
      };
    })
    .filter((entry) => entry.title || entry.description || entry.date);
};

const formatProgressUpdatesText = (updates = []) => {
  return (Array.isArray(updates) ? updates : [])
    .map((entry) => {
      const date = String(entry?.date || '').trim();
      const title = String(entry?.title || '').trim();
      const description = String(entry?.description || '').trim();
      const amount = Number(entry?.amount);
      const amountText = Number.isFinite(amount) && amount > 0 ? String(amount) : '';
      return [date, title, description, amountText].join('|');
    })
    .filter(Boolean)
    .join('\n');
};

const parseStoryBlocksText = (value = '') => {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title = '', summary = '', quote = '', beneficiary = '', impactMetric = '', imageUrl = ''] = line.split('|').map((segment) => segment.trim());
      return {
        id: `story-${Date.now()}-${index}`,
        title,
        summary,
        quote,
        beneficiary,
        impactMetric,
        imageUrl,
        isActive: true
      };
    })
    .filter((entry) => entry.title || entry.summary || entry.quote);
};

const formatStoryBlocksText = (items = []) => {
  return (Array.isArray(items) ? items : [])
    .map((entry) => ([
      String(entry?.title || '').trim(),
      String(entry?.summary || '').trim(),
      String(entry?.quote || '').trim(),
      String(entry?.beneficiary || '').trim(),
      String(entry?.impactMetric || '').trim(),
      String(entry?.imageUrl || '').trim()
    ].join('|')))
    .filter(Boolean)
    .join('\n');
};

const toCampaignPayload = (values = {}) => {
  return {
    name: String(values.name || '').trim(),
    description: String(values.description || '').trim(),
    progressTitle: String(values.progressTitle || '').trim(),
    progressDescription: String(values.progressDescription || '').trim(),
    storyBlocks: parseStoryBlocksText(values.storyBlocksText || ''),
    progressPhotos: parseProgressPhotosText(values.progressPhotosText || ''),
    progressUpdates: parseProgressUpdatesText(values.progressUpdatesText || ''),
    raised: Number(values.raised || 0),
    target: Number(values.target || 0),
    isActive: values.isActive !== false,
    paymentProvider: ['STRIPE', 'PAYPAL', 'ZEFFY'].includes(String(values.paymentProvider || '').toUpperCase())
      ? String(values.paymentProvider).toUpperCase()
      : 'STRIPE',
    paymentLink: String(values.paymentLink || '').trim(),
    stripeBuyButtonId: String(values.stripeBuyButtonId || '').trim(),
    stripePublishableKey: String(values.stripePublishableKey || '').trim(),
    zeffyApiKey: String(values.zeffyApiKey || '').trim()
  };
};

const progressItemDefaults = {
  title: '',
  description: '',
  details: '',
  date: '',
  isActive: true,
  photosText: ''
};

const progressOverviewDefaults = {
  progressTitle: '',
  progressDescription: '',
  storyBlocksText: '',
  progressPhotosText: '',
  progressUpdatesText: ''
};

const parseProgressItemPhotosText = (value = '') => {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const formatProgressItemPhotosText = (photos = []) => {
  return (Array.isArray(photos) ? photos : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join('\n');
};

const normalizeProgressItems = (items = []) => {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: String(item?.id || `progress-${Date.now()}-${index}`),
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim(),
      details: String(item?.details || '').trim(),
      date: String(item?.date || '').trim(),
      isActive: item?.isActive !== false,
      photos: parseProgressItemPhotosText(formatProgressItemPhotosText(item?.photos || []))
    }))
    .filter((item) => item.title);
};

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
  const [uploadStatus, setUploadStatus] = useState({ type: 'success', message: '' });
  const [progressManagerOpen, setProgressManagerOpen] = useState(false);
  const [progressManagerCampaign, setProgressManagerCampaign] = useState(null);
  const [progressItemsDraft, setProgressItemsDraft] = useState([]);
  const [progressManagerPage, setProgressManagerPage] = useState(1);
  const [progressItemModalState, setProgressItemModalState] = useState({ open: false, mode: 'create', index: -1 });
  const [progressItemUploadPending, setProgressItemUploadPending] = useState(false);
  const [progressItemUploadProgress, setProgressItemUploadProgress] = useState(0);
  const [progressManagerStatus, setProgressManagerStatus] = useState({ type: 'success', message: '' });
  const [progressOverviewUploadPending, setProgressOverviewUploadPending] = useState(false);
  const [progressOverviewUploadProgress, setProgressOverviewUploadProgress] = useState(0);
  const [campaignDonorPage, setCampaignDonorPage] = useState(1);
  const [campaignDonorSearchTerm, setCampaignDonorSearchTerm] = useState('');
  const [cashDonationOpen, setCashDonationOpen] = useState(false);
  const [cashDonationError, setCashDonationError] = useState('');
  const [cashDonationSuccess, setCashDonationSuccess] = useState('');
  const [invoiceEmailStatus, setInvoiceEmailStatus] = useState({ type: 'success', message: '' });
  const [invoiceEmailSendingId, setInvoiceEmailSendingId] = useState('');
  const [openCampaignActionMenuId, setOpenCampaignActionMenuId] = useState('');
  const [openDonorActionMenuId, setOpenDonorActionMenuId] = useState('');
  const form = useForm({ defaultValues: campaignDefaults });
  const editForm = useForm({ defaultValues: campaignDefaults });
  const progressItemForm = useForm({ defaultValues: progressItemDefaults });
  const progressOverviewForm = useForm({ defaultValues: progressOverviewDefaults });
  const cashDonationForm = useForm({ defaultValues: createCashDonationDefaults() });
  const createPaymentProvider = form.watch('paymentProvider');
  const editPaymentProvider = editForm.watch('paymentProvider');
  const { data: campaigns = [] } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => donationService.getAllCampaigns().then((res) => res.data),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30000
  });
  const { data: donationIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [DONATION_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(DONATION_IDENTITY_SETTING_KEY, { enabled: false })
  });
  const updateDonationIdentitySettingMutation = useMutation({
    mutationFn: (enabled) => contentApiService.setSingleton(DONATION_IDENTITY_SETTING_KEY, { enabled: Boolean(enabled) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [DONATION_IDENTITY_SETTING_KEY] })
  });
  const { data: donations = [] } = useQuery({
    queryKey: ['admin-donations'],
    queryFn: () => donationService.getDonations().then((res) => res.data),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000
  });

  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign?.isActive !== false),
    [campaigns]
  );

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

  const filteredCampaignDonations = useMemo(() => {
    const query = String(campaignDonorSearchTerm || '').trim().toLowerCase();
    if (!query) {
      return campaignDonations;
    }

    return campaignDonations.filter((donation) => {
      const haystack = [
        donation.donorName,
        donation.donorEmail,
        donation.receiptId,
        donation.amount,
        donation.createdAt
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      return haystack.includes(query);
    });
  }, [campaignDonations, campaignDonorSearchTerm]);

  const campaignDonorTotalPages = Math.max(1, Math.ceil(filteredCampaignDonations.length / CAMPAIGN_DONORS_PAGE_SIZE));
  const pagedCampaignDonations = useMemo(() => {
    const safePage = Math.min(campaignDonorPage, campaignDonorTotalPages);
    const start = (safePage - 1) * CAMPAIGN_DONORS_PAGE_SIZE;
    return filteredCampaignDonations.slice(start, start + CAMPAIGN_DONORS_PAGE_SIZE);
  }, [filteredCampaignDonations, campaignDonorPage, campaignDonorTotalPages]);

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

  const totalPages = Math.max(1, Math.ceil(visibleDonations.length / DONATIONS_PAGE_SIZE));
  const pagedDonations = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * DONATIONS_PAGE_SIZE;
    return visibleDonations.slice(start, start + DONATIONS_PAGE_SIZE);
  }, [page, totalPages, visibleDonations]);
  const progressManagerTotalPages = Math.max(1, Math.ceil(progressItemsDraft.length / PROGRESS_ITEMS_PAGE_SIZE));
  const pagedProgressItems = useMemo(() => {
    const safePage = Math.min(progressManagerPage, progressManagerTotalPages);
    const start = (safePage - 1) * PROGRESS_ITEMS_PAGE_SIZE;

    return progressItemsDraft.slice(start, start + PROGRESS_ITEMS_PAGE_SIZE).map((item, index) => ({
      item,
      index: start + index
    }));
  }, [progressItemsDraft, progressManagerPage, progressManagerTotalPages]);

  useEffect(() => {
    setPage(1);
  }, [campaignFilter, searchTerm, sortMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (progressManagerPage > progressManagerTotalPages) {
      setProgressManagerPage(progressManagerTotalPages);
    }
  }, [progressManagerPage, progressManagerTotalPages]);

  useEffect(() => {
    setCampaignDonorPage(1);
    setCampaignDonorSearchTerm('');
  }, [viewingCampaign?.id]);

  useEffect(() => {
    setCampaignDonorPage(1);
  }, [campaignDonorSearchTerm]);

  useEffect(() => {
    if (campaignDonorPage > campaignDonorTotalPages) {
      setCampaignDonorPage(campaignDonorTotalPages);
    }
  }, [campaignDonorPage, campaignDonorTotalPages]);

  const createMutation = useMutation({
    mutationFn: (values) => donationService.createCampaign(toCampaignPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      form.reset(campaignDefaults);
      setCreateCampaignOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => donationService.updateCampaign(id, toCampaignPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setEditingCampaign(null);
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }) => donationService.updateCampaign(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const saveProgressItemsMutation = useMutation({
    mutationFn: ({ campaignId, progressItems }) => donationService.updateCampaign(campaignId, { progressItems }),
    onSuccess: (response, variables) => {
      const updatedCampaign = response?.data || null;
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      if (updatedCampaign) {
        setProgressManagerCampaign(updatedCampaign);
        setProgressItemsDraft(normalizeProgressItems(updatedCampaign.progressItems));
      }
      setProgressManagerStatus({
        type: 'success',
        message: variables?.successMessage || 'Progress updates saved successfully.'
      });
    },
    onError: (error, variables) => {
      setProgressManagerStatus({
        type: 'error',
        message: variables?.errorMessage || error?.message || 'Unable to save progress updates.'
      });
    }
  });

  const saveProgressOverviewMutation = useMutation({
    mutationFn: ({ campaignId, values }) => donationService.updateCampaign(campaignId, {
      progressTitle: String(values.progressTitle || '').trim(),
      progressDescription: String(values.progressDescription || '').trim(),
      storyBlocks: parseStoryBlocksText(values.storyBlocksText || ''),
      progressPhotos: parseProgressPhotosText(values.progressPhotosText || ''),
      progressUpdates: parseProgressUpdatesText(values.progressUpdatesText || '')
    }),
    onSuccess: (response) => {
      const updatedCampaign = response?.data || null;
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      if (updatedCampaign) {
        setProgressManagerCampaign(updatedCampaign);
      }
      setProgressManagerStatus({ type: 'success', message: 'Progress overview saved successfully.' });
    },
    onError: (error) => {
      setProgressManagerStatus({ type: 'error', message: error?.message || 'Unable to save the progress overview.' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => donationService.removeCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const addCashDonationMutation = useMutation({
    onMutate: () => {
      setCashDonationError('');
      setCashDonationSuccess('');
    },
    mutationFn: async (values) => {
      const campaign = campaigns.find((entry) => String(entry.id) === String(values.campaignId));
      if (!campaign) {
        throw new Error('Select a valid campaign.');
      }

      await donationService.addCashDonation({
        campaign,
        amount: Number(values.amount || 0),
        receiptId: String(values.receiptId || '').trim(),
        donorName: String(values.donorName || '').trim(),
        donorEmail: String(values.donorEmail || '').trim(),
        donorPhone: String(values.donorPhone || '').trim(),
        paidAt: values.paidAt
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      cashDonationForm.reset(createCashDonationDefaults());
      setCashDonationError('');
      setCashDonationSuccess('Cash donation saved successfully.');
    },
    onError: (error) => {
      setCashDonationError(String(error?.message || 'Unable to save this cash donation.'));
    }
  });

  const openEdit = (campaign) => {
    setUploadStatus({ type: 'success', message: '' });
    setEditingCampaign(campaign);
    editForm.reset({
      name: campaign.name,
      description: campaign.description || '',
      progressTitle: campaign.progressTitle || '',
      progressDescription: campaign.progressDescription || '',
      storyBlocksText: formatStoryBlocksText(campaign.storyBlocks),
      progressPhotosText: formatProgressPhotosText(campaign.progressPhotos),
      progressUpdatesText: formatProgressUpdatesText(campaign.progressUpdates),
      raised: campaign.raised,
      target: campaign.target,
      isActive: Boolean(campaign.isActive),
      paymentProvider: campaign.paymentProvider || 'STRIPE',
      paymentLink: campaign.paymentLink || '',
      stripeBuyButtonId: campaign.stripeBuyButtonId || '',
      stripePublishableKey: campaign.stripePublishableKey || '',
      zeffyApiKey: ''
    });
  };

  const openCreate = () => {
    setUploadStatus({ type: 'success', message: '' });
    form.reset(campaignDefaults);
    setCreateCampaignOpen(true);
  };

  const openCashDonation = () => {
    cashDonationForm.reset(createCashDonationDefaults());
    setCashDonationError('');
    setCashDonationSuccess('');
    setCashDonationOpen(true);
  };

  const openProgressManager = (campaign) => {
    setProgressManagerCampaign(campaign);
    setProgressItemsDraft(normalizeProgressItems(campaign?.progressItems));
    setProgressManagerPage(1);
    setProgressItemModalState({ open: false, mode: 'create', index: -1 });
    progressItemForm.reset(progressItemDefaults);
    progressOverviewForm.reset({
      progressTitle: campaign?.progressTitle || '',
      progressDescription: campaign?.progressDescription || '',
      storyBlocksText: formatStoryBlocksText(campaign?.storyBlocks),
      progressPhotosText: formatProgressPhotosText(campaign?.progressPhotos),
      progressUpdatesText: formatProgressUpdatesText(campaign?.progressUpdates)
    });
    setProgressManagerStatus({ type: 'success', message: '' });
    setProgressManagerOpen(true);
  };

  const closeProgressManager = () => {
    setProgressManagerOpen(false);
    setProgressManagerCampaign(null);
    setProgressItemsDraft([]);
    setProgressManagerPage(1);
    setProgressItemModalState({ open: false, mode: 'create', index: -1 });
    progressItemForm.reset(progressItemDefaults);
    progressOverviewForm.reset(progressOverviewDefaults);
    setProgressOverviewUploadPending(false);
    setProgressOverviewUploadProgress(0);
    setProgressManagerStatus({ type: 'success', message: '' });
  };

  const persistProgressItems = async (nextItems, messages = {}) => {
    if (!progressManagerCampaign?.id) {
      return;
    }

    await saveProgressItemsMutation.mutateAsync({
      campaignId: progressManagerCampaign.id,
      progressItems: nextItems,
      successMessage: messages.successMessage,
      errorMessage: messages.errorMessage
    });
  };

  const openProgressItemModal = ({ mode, item = null, index = -1 }) => {
    if (mode === 'create') {
      progressItemForm.reset(progressItemDefaults);
      setProgressItemModalState({ open: true, mode, index: -1 });
      return;
    }

    const nextItem = item || progressItemsDraft[index] || null;
    if (!nextItem) {
      return;
    }

    progressItemForm.reset({
      title: nextItem.title || '',
      description: nextItem.description || '',
      details: nextItem.details || '',
      date: nextItem.date || '',
      isActive: nextItem.isActive !== false,
      photosText: formatProgressItemPhotosText(nextItem.photos || [])
    });
    setProgressItemModalState({ open: true, mode, index });
  };

  const closeProgressItemModal = () => {
    setProgressItemModalState({ open: false, mode: 'create', index: -1 });
    progressItemForm.reset(progressItemDefaults);
    setProgressItemUploadPending(false);
    setProgressItemUploadProgress(0);
  };

  const handleSaveProgressItem = async (values) => {
    const nextItem = {
      id: progressItemModalState.mode === 'edit' ? (progressItemsDraft[progressItemModalState.index]?.id || `progress-${Date.now()}`) : `progress-${Date.now()}`,
      title: String(values.title || '').trim(),
      description: String(values.description || '').trim(),
      details: String(values.details || '').trim(),
      date: String(values.date || '').trim(),
      isActive: values.isActive !== false,
      photos: parseProgressItemPhotosText(values.photosText || '')
    };

    if (!nextItem.title) {
      setProgressManagerStatus({ type: 'error', message: 'Progress title is required.' });
      return;
    }

    const nextItems = progressItemModalState.mode === 'edit' && progressItemModalState.index >= 0
      ? progressItemsDraft.map((item, index) => (index === progressItemModalState.index ? nextItem : item))
      : [nextItem, ...progressItemsDraft];

    setProgressItemsDraft(nextItems);

    setProgressManagerPage(1);
    closeProgressItemModal();

    try {
      await persistProgressItems(nextItems, {
        successMessage: progressItemModalState.mode === 'edit' ? 'Progress update edited and saved.' : 'Progress update added and saved.'
      });
    } catch {
      // Error message is set in mutation handler.
    }
  };

  const handleDeleteProgressItem = async (indexToDelete) => {
    const nextItems = progressItemsDraft.filter((_, index) => index !== indexToDelete);
    setProgressItemsDraft(nextItems);

    try {
      await persistProgressItems(nextItems, {
        successMessage: 'Progress update deleted and saved.'
      });
    } catch {
      // Error message is set in mutation handler.
    }
  };

  const toggleProgressItemStatus = async (indexToToggle) => {
    const nextItems = progressItemsDraft.map((item, index) => (
      index === indexToToggle ? { ...item, isActive: item.isActive === false } : item
    ));
    setProgressItemsDraft(nextItems);

    try {
      await persistProgressItems(nextItems, {
        successMessage: 'Progress status updated and saved.'
      });
    } catch {
      // Error message is set in mutation handler.
    }
  };

  const selectedProgressItem = progressItemModalState.mode === 'view'
    ? (progressItemsDraft[progressItemModalState.index] || progressItemForm.getValues())
    : null;

  const appendPhotosToProgressItemForm = async (files) => {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (selectedFiles.length === 0) {
      return;
    }

    try {
      setProgressItemUploadPending(true);
      setProgressItemUploadProgress(0);
      const uploadedUrls = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const uploaded = await uploadService.uploadFile({
          service: 'donations',
          file,
          allowedMimeTypes: ['image/*'],
          maxSizeMB: 15,
          onProgress: (percent) => {
            const overall = Math.round(((index + (percent / 100)) / selectedFiles.length) * 100);
            setProgressItemUploadProgress(overall);
          }
        });

        const nextUrl = String(uploaded?.url || '').trim();
        if (nextUrl) {
          uploadedUrls.push(nextUrl);
        }
      }

      const existingPhotos = parseProgressItemPhotosText(progressItemForm.getValues('photosText') || '');
      const merged = Array.from(new Set([...existingPhotos, ...uploadedUrls]));
      progressItemForm.setValue('photosText', formatProgressItemPhotosText(merged), {
        shouldDirty: true,
        shouldValidate: true
      });
      setProgressManagerStatus({
        type: 'success',
        message: `${uploadedUrls.length} progress photo${uploadedUrls.length === 1 ? '' : 's'} uploaded.`
      });
    } catch (error) {
      setProgressManagerStatus({ type: 'error', message: error?.message || 'Unable to upload progress photos.' });
    } finally {
      setProgressItemUploadPending(false);
      setProgressItemUploadProgress(0);
    }
  };

  const appendPhotosToProgressOverview = async (files) => {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (selectedFiles.length === 0) {
      return;
    }

    try {
      setProgressManagerStatus({ type: 'success', message: '' });
      setProgressOverviewUploadPending(true);
      setProgressOverviewUploadProgress(0);
      const uploadedUrls = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const uploaded = await uploadService.uploadFile({
          service: 'donations',
          file: selectedFiles[index],
          allowedMimeTypes: ['image/*'],
          maxSizeMB: 15,
          onProgress: (percent) => {
            setProgressOverviewUploadProgress(Math.round(((index + (percent / 100)) / selectedFiles.length) * 100));
          }
        });
        const uploadedUrl = String(uploaded?.url || '').trim();
        if (uploadedUrl) {
          uploadedUrls.push(uploadedUrl);
        }
      }

      const existingUrls = parseProgressPhotosText(progressOverviewForm.getValues('progressPhotosText') || '');
      progressOverviewForm.setValue(
        'progressPhotosText',
        formatProgressPhotosText(Array.from(new Set([...existingUrls, ...uploadedUrls]))),
        { shouldDirty: true, shouldValidate: true }
      );
      setProgressManagerStatus({
        type: 'success',
        message: `${uploadedUrls.length} progress photo${uploadedUrls.length === 1 ? '' : 's'} uploaded.`
      });
    } catch (error) {
      setProgressManagerStatus({ type: 'error', message: error?.message || 'Unable to upload progress photos.' });
    } finally {
      setProgressOverviewUploadPending(false);
      setProgressOverviewUploadProgress(0);
    }
  };

  const toggleCampaignStatus = (campaign) => {
    toggleStatusMutation.mutate({
      id: campaign.id,
      isActive: !campaign.isActive
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
      setInvoiceEmailSendingId(String(entry.id || ''));
      setInvoiceEmailStatus({ type: 'success', message: '' });

      const blob = await createDonationInvoicePdfBlob(payload);
      const attachmentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const content = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
          if (!content) {
            reject(new Error('Unable to encode invoice attachment.'));
            return;
          }
          resolve(content);
        };
        reader.onerror = () => reject(new Error('Unable to read invoice attachment.'));
        reader.readAsDataURL(blob);
      });

      await donationService.emailDonationInvoice({
        donation: entry,
        campaignDescription: campaignMap[String(entry.campaignId)]?.description || '',
        organizationName: siteConfig.name,
        address: siteConfig.contact.address,
        phone: siteConfig.contact.phone,
        fileName,
        attachmentBase64
      });

      setInvoiceEmailStatus({
        type: 'success',
        message: `Invoice emailed to ${donorEmail}.`
      });
      window.alert(`Invoice emailed successfully to ${donorEmail}.`);
    } catch (error) {
      setInvoiceEmailStatus({
        type: 'error',
        message: error?.message || 'Unable to email invoice right now.'
      });
    } finally {
      setInvoiceEmailSendingId('');
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
      {invoiceEmailSendingId ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-brand-blue/20 bg-white p-5 text-center shadow-2xl">
            <div className="donation-email-send-loader" aria-hidden="true">
              <span className="donation-email-send-orb donation-email-send-orb-saffron" />
              <span className="donation-email-send-orb donation-email-send-orb-blue" />
              <span className="donation-email-send-orb donation-email-send-orb-gold" />
              <div className="donation-email-send-envelope-wrap">
                <EnvelopeIcon className="h-7 w-7" />
              </div>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900">Please wait, sending email...</p>
            <p className="mt-1 text-xs text-slate-600">Generating invoice and delivering it to the donor inbox.</p>
          </div>
        </div>
      ) : null}

      <h1 className="sr-only">Donation Management</h1>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Website Identity Override</p>
            <p className="text-xs text-slate-600">Allow visitors to edit Name and Email on Donation form.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span>{donationIdentitySettings?.enabled ? 'Enabled' : 'Disabled'}</span>
            <input
              type="checkbox"
              checked={Boolean(donationIdentitySettings?.enabled)}
              onChange={(event) => updateDonationIdentitySettingMutation.mutate(event.target.checked)}
              disabled={updateDonationIdentitySettingMutation.isPending}
              className="h-4 w-4"
            />
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">Campaigns</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCashDonation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
            >
              <BanknotesIcon className="h-4 w-4" /> Add Cash Donation
            </button>
            <a
              href={donationBoardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <EyeIcon className="h-4 w-4" /> Go To Donation Board
            </a>
          </div>
        </div>
        <div className="mt-3">
          <StatusAlert type={invoiceEmailStatus.type} message={invoiceEmailStatus.message} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-blue-50 to-amber-50 text-slate-600">
                <th className="w-[28%] py-2 pr-3">Campaign</th>
                <th className="w-[14%] py-2 pr-3">Provider</th>
                <th className="w-[14%] py-2 pr-3">Target</th>
                <th className="w-[14%] py-2 pr-3">Raised</th>
                <th className="w-[14%] py-2 pr-3">Status</th>
                <th className="w-[16%] py-2 pr-3 text-right">Actions</th>
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
                  <td className="admin-compact-mobile-hidden py-2 pr-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${campaign.paymentProvider === 'PAYPAL' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                      {campaign.paymentProvider === 'PAYPAL' ? <BanknotesIcon className="h-3.5 w-3.5" /> : <BuildingLibraryIcon className="h-3.5 w-3.5" />}
                      {campaign.paymentProvider}
                    </span>
                  </td>
                  <td className="admin-compact-mobile-hidden py-2 pr-2 font-medium text-slate-800">{formatCurrency(campaign.target)}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-2 font-medium text-slate-800">{formatCurrency(campaign.raised)}</td>
                  <td className="admin-compact-mobile-hidden py-2 pr-2">
                    {campaign.isClosed ? (
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">Closed</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleCampaignStatus(campaign)}
                        disabled={toggleStatusMutation.isPending}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition ${campaign.isActive ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400' : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <PowerIcon className="h-3.5 w-3.5" />
                        {campaign.isActive ? 'Active' : 'Inactive'}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <div className="relative xl:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const actionMenuId = String(campaign.id || '');
                          setOpenCampaignActionMenuId((prev) => (prev === actionMenuId ? '' : actionMenuId));
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                        aria-label="More actions"
                        title="More actions"
                      >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                      </button>

                      {openCampaignActionMenuId === String(campaign.id || '') ? (
                        <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              openProgressManager(campaign);
                              setOpenCampaignActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Manage Progress
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingCampaign(campaign);
                              setOpenCampaignActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openEdit(campaign);
                              setOpenCampaignActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteMutation.mutate(campaign.id);
                              setOpenCampaignActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="hidden items-center justify-end gap-1.5 xl:flex">
                      <button type="button" onClick={() => openProgressManager(campaign)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100" aria-label="Manage campaign progress" title="Manage campaign progress">
                        <SparklesIcon className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setViewingCampaign(campaign)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 transition hover:border-sky-300 hover:bg-sky-100" aria-label="View campaign">
                        <EyeIcon className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => openEdit(campaign)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100" aria-label="Edit campaign">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => deleteMutation.mutate(campaign.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100" aria-label="Delete campaign">
                        <TrashIcon className="h-3.5 w-3.5" />
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

      {progressManagerOpen && progressManagerCampaign ? (
        <div className="fixed inset-0 z-[98] overflow-y-auto bg-slate-900/55 px-4 py-6" onClick={closeProgressManager}>
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-5xl rounded-xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading text-xl font-semibold">Campaign Progress Manager</h3>
                  <p className="mt-1 text-xs text-slate-500">{progressManagerCampaign.name}</p>
                </div>
                <button type="button" onClick={closeProgressManager} className="rounded-full border border-brand-blue/40 bg-blue-50 p-2 text-brand-blue transition hover:border-brand-saffron hover:bg-amber-100 hover:text-amber-700" aria-label="Close progress manager">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <StatusAlert type={progressManagerStatus.type} message={progressManagerStatus.message} />
                {saveProgressItemsMutation.isPending ? <p className="text-xs font-medium text-slate-500">Saving...</p> : null}
              </div>

              <form
                className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                onSubmit={progressOverviewForm.handleSubmit((values) => saveProgressOverviewMutation.mutate({
                  campaignId: progressManagerCampaign.id,
                  values
                }))}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Progress Overview</p>
                    <p className="text-xs text-slate-500">Campaign story, gallery, and milestone summary.</p>
                  </div>
                  <Button type="submit" disabled={saveProgressOverviewMutation.isPending}>
                    {saveProgressOverviewMutation.isPending ? 'Saving...' : 'Save Overview'}
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Progress Title
                    <input {...progressOverviewForm.register('progressTitle')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Progress Description
                    <textarea rows={2} {...progressOverviewForm.register('progressDescription')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Story Blocks <span className="font-normal text-slate-500">(title|summary|quote|beneficiary|impact metric|image URL)</span>
                    <textarea rows={3} {...progressOverviewForm.register('storyBlocksText')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Progress Photos <span className="font-normal text-slate-500">(one URL per line)</span>
                    <textarea rows={3} {...progressOverviewForm.register('progressPhotosText')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-normal" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Upload Progress Photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={progressOverviewUploadPending}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold"
                      onChange={(event) => {
                        void appendPhotosToProgressOverview(event.target.files);
                        event.target.value = '';
                      }}
                    />
                    <p className="mt-1 text-xs font-normal text-slate-500">{progressOverviewUploadPending ? `Uploading photos... ${progressOverviewUploadProgress}%` : 'Upload one or more images (max 15MB each).'}</p>
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Progress Updates <span className="font-normal text-slate-500">(date|title|description|amount)</span>
                    <textarea rows={3} {...progressOverviewForm.register('progressUpdatesText')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-normal" />
                  </label>
                </div>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">Progress Details</p>
                  <p className="text-xs text-slate-500">Individual dated updates shown on the donation page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => openProgressItemModal({ mode: 'create' })}
                  className="inline-flex items-center rounded-full border border-brand-blue/30 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue transition hover:border-brand-blue hover:bg-blue-100"
                >
                  Add Progress Update
                </button>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProgressItems.map(({ item, index }) => (
                      <tr key={item.id || index} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{item.title || 'Untitled progress'}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{item.date || '-'}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleProgressItemStatus(index)}
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                          >
                            {item.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openProgressItemModal({ mode: 'view', item, index })} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700" title="View progress item">
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openProgressItemModal({ mode: 'edit', item, index })} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700" title="Edit progress item">
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDeleteProgressItem(index)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700" title="Delete progress item">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {progressItemsDraft.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-500" colSpan={4}>No progress updates yet. Add your first item.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {progressItemsDraft.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <p>
                    Showing {pagedProgressItems.length} of {progressItemsDraft.length} updates
                    {progressItemsDraft.length > 0 ? ` • Page ${Math.min(progressManagerPage, progressManagerTotalPages)} of ${progressManagerTotalPages}` : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProgressManagerPage((current) => Math.max(1, current - 1))}
                      disabled={progressManagerPage <= 1}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgressManagerPage((current) => Math.min(progressManagerTotalPages, current + 1))}
                      disabled={progressManagerPage >= progressManagerTotalPages}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}

              {progressItemModalState.open ? (
                <div className="fixed inset-0 z-[99] overflow-y-auto bg-slate-900/55 px-4 py-6" onClick={closeProgressItemModal}>
                  <div className="mx-auto flex min-h-full items-center justify-center">
                    <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2 rounded-t-3xl border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-4 py-4 text-white sm:px-6">
                        <h4 className="font-heading text-lg font-semibold text-white">
                          {progressItemModalState.mode === 'create' ? 'Add Progress Update' : progressItemModalState.mode === 'edit' ? 'Edit Progress Update' : 'View Progress Update'}
                        </h4>
                        <button
                          type="button"
                          onClick={closeProgressItemModal}
                          className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
                          aria-label="Close progress update modal"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {progressItemModalState.mode === 'view' ? (
                        <div className="mt-4 space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                              <div className="mt-1 space-y-3">
                                <div>
                                  <div className="flex justify-end gap-2">
                                    <span className="inline-flex rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue">{selectedProgressItem?.date || 'No date'}</span>
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selectedProgressItem?.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                                      {selectedProgressItem?.isActive !== false ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Title</p>
                                  <p className="mt-0.5 text-xl font-semibold text-slate-900 break-words">{selectedProgressItem?.title || 'Untitled progress'}</p>
                                </div>
                                <div className="h-px bg-slate-200" />
                                {selectedProgressItem?.description ? (
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                                    <p className="mt-1 text-[11px] leading-5 text-slate-700">{selectedProgressItem.description}</p>
                                  </div>
                                ) : null}
                                {selectedProgressItem?.details ? (
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Details</p>
                                    <p className="mt-1 leading-6 text-slate-700">{selectedProgressItem.details}</p>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Image Gallery</p>
                                  <p className="text-xs text-slate-500">Responsive grid for progress photos.</p>
                                </div>
                              </div>
                              {(Array.isArray(selectedProgressItem?.photos) && selectedProgressItem.photos.length > 0) ? (
                                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                                  {selectedProgressItem.photos.map((photoUrl, index) => (
                                    <a
                                      key={`${photoUrl}-${index}`}
                                      href={photoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
                                    >
                                      <img src={photoUrl} alt={`Progress ${index + 1}`} className="aspect-square h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                  No progress photos attached.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <Button type="button" variant="ghost" onClick={closeProgressItemModal}>Close</Button>
                          </div>
                        </div>
                      ) : (
                        <form className="mt-4 grid gap-3 px-4 pb-4 sm:px-6 sm:pb-6 md:grid-cols-2" onSubmit={progressItemForm.handleSubmit(handleSaveProgressItem)}>
                          <label className="text-sm md:col-span-2">Title
                            <input disabled={progressItemModalState.mode === 'view'} {...progressItemForm.register('title', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                          </label>
                          <label className="text-sm md:col-span-2">Date
                            <input type="date" disabled={progressItemModalState.mode === 'view'} {...progressItemForm.register('date')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                          </label>
                          <label className="text-sm md:col-span-2">Description
                            <textarea rows={2} disabled={progressItemModalState.mode === 'view'} {...progressItemForm.register('description')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                          </label>
                          <label className="text-sm md:col-span-2">Photos (one URL per line)
                            <textarea rows={3} disabled={progressItemModalState.mode === 'view'} {...progressItemForm.register('photosText')} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 disabled:bg-slate-50" />
                          </label>
                          {progressItemModalState.mode !== 'view' ? (
                            <label className="text-sm md:col-span-2">Upload Photos (multiple)
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={progressItemUploadPending}
                                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold"
                                onChange={(event) => {
                                  void appendPhotosToProgressItemForm(event.target.files);
                                  event.target.value = '';
                                }}
                              />
                              <p className="mt-1 text-xs text-slate-500">{progressItemUploadPending ? `Uploading photos... ${progressItemUploadProgress}%` : 'Upload one or more images (max 15MB each).'}</p>
                              {progressItemUploadPending ? (
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                  <div className="h-full bg-brand-blue transition-all" style={{ width: `${progressItemUploadProgress}%` }} />
                                </div>
                              ) : null}
                            </label>
                          ) : null}
                          <label className="flex items-center gap-2 text-sm md:col-span-2">
                            <input type="checkbox" disabled={progressItemModalState.mode === 'view'} {...progressItemForm.register('isActive')} />
                            Active progress item
                          </label>
                          <div className="md:col-span-2 h-px bg-slate-200" />
                          <div className="md:col-span-2 flex gap-2 pt-1">
                            {progressItemModalState.mode !== 'view' ? <Button type="submit">Save Progress Item</Button> : null}
                            <Button type="button" variant="ghost" onClick={closeProgressItemModal}>Close</Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">Donor</th>
                <th className="py-1.5 pr-3">Campaign</th>
                <th className="py-1.5 pr-3">Amount</th>
                <th className="py-1.5 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedDonations.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 align-top">
                    <div className="space-y-1 lg:hidden">
                      <p className="text-xs font-bold leading-tight text-slate-800">{entry.donorName}</p>
                      <p className="text-[11px] leading-snug text-slate-600">{new Date(entry.createdAt).toLocaleDateString()}</p>
                      <p className="text-[11px] leading-snug text-slate-600">{entry.campaignName}</p>
                      <p className="text-[11px] leading-snug font-semibold text-slate-700">{formatCurrency(entry.amount)}</p>
                    </div>
                    <span className="hidden lg:inline text-xs">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="admin-compact-mobile-hidden py-1.5 pr-3 text-xs font-semibold text-slate-800">{entry.donorName}</td>
                  <td className="admin-compact-mobile-hidden py-1.5 pr-3">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{entry.campaignName}</p>
                    </div>
                  </td>
                  <td className="admin-compact-mobile-hidden py-1.5 pr-3 text-xs font-semibold text-slate-800">{formatCurrency(entry.amount)}</td>
                  <td className="py-1.5 pr-3 text-right align-top">
                    <div className="relative xl:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const actionMenuId = String(entry.id || '');
                          setOpenDonorActionMenuId((prev) => (prev === actionMenuId ? '' : actionMenuId));
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                        aria-label="More actions"
                        title="More actions"
                      >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                      </button>

                      {openDonorActionMenuId === String(entry.id || '') ? (
                        <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadInvoice(entry);
                              setOpenDonorActionMenuId('');
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Download Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleEmailInvoice(entry);
                              setOpenDonorActionMenuId('');
                            }}
                            disabled={!entry.donorEmail || invoiceEmailSendingId === String(entry.id || '')}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {invoiceEmailSendingId === String(entry.id || '') ? 'Sending...' : 'Email Invoice'}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="hidden flex-row flex-nowrap items-center justify-end gap-1.5 xl:flex">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(entry)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue hover:text-white"
                        title="Download invoice PDF"
                      >
                        <DocumentArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleEmailInvoice(entry)}
                        disabled={!entry.donorEmail || invoiceEmailSendingId === String(entry.id || '')}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/70 bg-emerald-50 text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={entry.donorEmail ? 'Email invoice to donor' : 'Donor email not available'}
                      >
                        <EnvelopeIcon className="h-4 w-4" />
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
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-5 py-5 text-white sm:px-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">Campaign Setup</p>
                <h3 className="mt-1 font-heading text-2xl font-semibold">Create Donation Campaign</h3>
              </div>
              <button type="button" onClick={() => setCreateCampaignOpen(false)} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close create campaign modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <form className="px-5 py-5 sm:px-7" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
              <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              <section>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Campaign Details</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Campaign Name
                    <input {...form.register('name', { required: true })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description
                    <textarea rows={3} {...form.register('description')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" />
                  </label>
                </div>
              </section>

              <section className="mt-5 border-t border-slate-200 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Funding Goal</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Target Amount (CAD)
                    <input type="number" min="0" step="0.01" {...form.register('target', { required: true, valueAsNumber: true, min: 0 })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">Starting Amount Raised (CAD)
                    <input type="number" min="0" step="0.01" {...form.register('raised', { valueAsNumber: true, min: 0 })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" />
                  </label>
                </div>
              </section>

              <section className="mt-5 border-t border-slate-200 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Payment Setup</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Payment Provider
                    <select {...form.register('paymentProvider')} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100">
                      <option value="STRIPE">Stripe</option>
                      <option value="PAYPAL">PayPal</option>
                      <option value="ZEFFY">Zeffy</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{createPaymentProvider === 'ZEFFY' ? 'Zeffy Donation Form Link' : createPaymentProvider === 'PAYPAL' ? 'PayPal Checkout Link' : 'Stripe Checkout Link (optional)'}
                    <input
                      type="url"
                      required={createPaymentProvider === 'ZEFFY' || createPaymentProvider === 'PAYPAL'}
                      {...form.register('paymentLink')}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100"
                      placeholder={createPaymentProvider === 'ZEFFY' ? 'https://www.zeffy.com/en-CA/donation-form/...' : 'https://...'}
                    />
                  </label>
                  {createPaymentProvider === 'ZEFFY' ? (
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Zeffy API Key
                      <input type="password" autoComplete="new-password" required {...form.register('zeffyApiKey')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" />
                    </label>
                  ) : null}
                  {createPaymentProvider === 'STRIPE' ? (
                    <>
                      <label className="text-sm font-semibold text-slate-700">Stripe Buy Button ID (optional)
                        <input {...form.register('stripeBuyButtonId')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" placeholder="buy_btn_..." />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">Stripe Publishable Key (optional)
                        <input {...form.register('stripePublishableKey')} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100" placeholder="pk_test_... or pk_live_..." />
                      </label>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="mt-5 border-t border-slate-200 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-blue">Campaign Status</p>
                <label className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" {...form.register('isActive')} />
                  Active campaign
                </label>
              </section>

              <div className="mt-5 flex gap-2 border-t border-slate-200 pt-5">
                <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Campaign'}</Button>
                <Button type="button" variant="ghost" onClick={() => setCreateCampaignOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
          </div>
        </div>
      ) : null}

      {cashDonationOpen ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setCashDonationOpen(false)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 rounded-t-3xl border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-4 py-4 text-white sm:px-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">Admin Entry</p>
                  <h3 className="mt-1 font-heading text-xl font-semibold">Add Cash Donation</h3>
                </div>
                <button type="button" onClick={() => setCashDonationOpen(false)} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close cash donation modal">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <form
                className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6"
                onSubmit={cashDonationForm.handleSubmit((values) => addCashDonationMutation.mutate(values))}
              >
                <label className="text-sm sm:col-span-2">Campaign
                  <select {...cashDonationForm.register('campaignId', { required: true })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue">
                    <option value="">Select campaign</option>
                    {activeCampaigns.map((campaign) => (
                      <option key={campaign.id} value={String(campaign.id)}>{campaign.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">Amount
                  <input type="number" min="0" step="0.01" {...cashDonationForm.register('amount', { required: true, valueAsNumber: true, min: 0.01 })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                </label>
                <label className="text-sm">Gurdwara Receipt Number
                  <input {...cashDonationForm.register('receiptId', { required: true })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" placeholder="e.g. GRC-2026-0043" />
                </label>
                <label className="text-sm">Date
                  <input type="date" {...cashDonationForm.register('paidAt', { required: true })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                </label>
                <label className="text-sm">Payment Mode
                  <input value="Cash" disabled className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" />
                </label>
                <label className="text-sm sm:col-span-2">Donor Name
                  <input {...cashDonationForm.register('donorName', { required: true })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                </label>
                <label className="text-sm">Donor Email (optional)
                  <input type="email" {...cashDonationForm.register('donorEmail')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                </label>
                <label className="text-sm">Donor Phone (optional)
                  <input type="tel" {...cashDonationForm.register('donorPhone')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                </label>
                {cashDonationError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 sm:col-span-2" role="alert">
                    {cashDonationError}
                  </p>
                ) : null}
                {cashDonationSuccess ? (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 sm:col-span-2" role="status">
                    <CheckCircleIcon className="h-5 w-5 shrink-0" />
                    {cashDonationSuccess}
                  </p>
                ) : null}
                <div className="h-px bg-slate-200 sm:col-span-2" />
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={addCashDonationMutation.isPending}>
                    {addCashDonationMutation.isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        Saving...
                      </span>
                    ) : 'Save Cash Donation'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCashDonationOpen(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {viewingCampaign ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setViewingCampaign(null)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-4 py-4 text-white sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">Campaign Overview</p>
                <h3 className="mt-1 font-heading text-xl font-semibold sm:text-2xl">{viewingCampaign.name}</h3>
              </div>
              <button type="button" onClick={() => setViewingCampaign(null)} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close campaign details modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-brand-blue/10 bg-white px-3 py-1 text-xs font-semibold text-brand-blue">{viewingCampaign.paymentProvider}</span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${viewingCampaign.isClosed ? 'bg-violet-100 text-violet-800' : viewingCampaign.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                    {viewingCampaign.isClosed ? 'Closed' : viewingCampaign.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Raised</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{formatCurrency(viewingCampaign.raised)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{formatCurrency(viewingCampaign.target)}</p>
                  </div>
                </div>

                <div className="my-4 h-px bg-slate-200" />

                <div className="space-y-3 text-sm text-slate-700">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Campaign name</p>
                    <p className="mt-1 font-medium text-slate-900">{viewingCampaign.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</p>
                    <p className="mt-1 leading-6 text-slate-700">{viewingCampaign.description || 'No description provided.'}</p>
                  </div>
                </div>

              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Campaign donations</p>
                      <p className="text-xs text-slate-500">{filteredCampaignDonations.length} of {campaignDonations.length} donation{campaignDonations.length === 1 ? '' : 's'} shown.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={handleDownloadCampaignCsv} disabled={campaignDonations.length === 0} className="px-3 py-1.5 text-xs">CSV</Button>
                      <Button type="button" onClick={() => void handleDownloadCampaignPdf()} disabled={campaignDonations.length === 0} className="px-3 py-1.5 text-xs">PDF</Button>
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <MagnifyingGlassIcon className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      value={campaignDonorSearchTerm}
                      onChange={(event) => setCampaignDonorSearchTerm(event.target.value)}
                      placeholder="Search donor or receipt"
                      className="w-full bg-transparent text-xs outline-none"
                    />
                  </label>
                  {filteredCampaignDonations.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50">
                      <table className="min-w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Donor</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedCampaignDonations.map((donation) => (
                            <tr key={donation.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-800">{donation.donorName || '-'}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{formatCurrency(donation.amount || 0)}</td>
                              <td className="px-3 py-2 text-slate-600">{donation.createdAt ? new Date(donation.createdAt).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
                      No donations match your search.
                    </div>
                  )}
                  {filteredCampaignDonations.length > 0 ? (
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-600">
                      <p>Page {Math.min(campaignDonorPage, campaignDonorTotalPages)} of {campaignDonorTotalPages}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCampaignDonorPage((current) => Math.max(1, current - 1))}
                          disabled={campaignDonorPage <= 1}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setCampaignDonorPage((current) => Math.min(campaignDonorTotalPages, current + 1))}
                          disabled={campaignDonorPage >= campaignDonorTotalPages}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {editingCampaign ? (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-900/45 px-4 py-6" onClick={() => setEditingCampaign(null)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-brand-blue px-4 py-4 text-white sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/65">Campaign Update</p>
                <h3 className="mt-1 font-heading text-xl font-semibold">Edit Campaign</h3>
              </div>
              <button type="button" onClick={() => setEditingCampaign(null)} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close edit campaign modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <form className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6" onSubmit={editForm.handleSubmit((values) => updateMutation.mutate({ id: editingCampaign.id, values }))}>
              <StatusAlert type={uploadStatus.type} message={uploadStatus.message} />
              <label className="text-sm sm:col-span-2">Campaign Name
                <input {...editForm.register('name', { required: true })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
              </label>
              <label className="text-sm">Payment Provider
                <select {...editForm.register('paymentProvider')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue">
                  <option value="STRIPE">Stripe</option>
                  <option value="PAYPAL">PayPal</option>
                  <option value="ZEFFY">Zeffy</option>
                </select>
              </label>
              <label className="text-sm">Raised
                <input type="number" min="0" step="0.01" disabled {...editForm.register('raised', { valueAsNumber: true, min: 0 })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm" />
              </label>
              <label className="text-sm">Target
                <input type="number" min="0" step="0.01" {...editForm.register('target', { required: true, valueAsNumber: true, min: 0 })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
              </label>
              <label className="text-sm sm:col-span-2">Description
                <textarea rows={2} {...editForm.register('description')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
              </label>
              <label className="text-sm sm:col-span-2">{editPaymentProvider === 'ZEFFY' ? 'Zeffy Donation Form Link' : editPaymentProvider === 'PAYPAL' ? 'PayPal Checkout Link' : 'Stripe Checkout Link (optional)'}
                <input type="url" required={editPaymentProvider === 'ZEFFY' || editPaymentProvider === 'PAYPAL'} {...editForm.register('paymentLink')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
              </label>
              {editPaymentProvider === 'STRIPE' ? (
                <>
                  <label className="text-sm">Stripe Buy Button ID (optional)
                    <input {...editForm.register('stripeBuyButtonId')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                  </label>
                  <label className="text-sm">Stripe Publishable Key (optional)
                    <input {...editForm.register('stripePublishableKey')} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue" />
                  </label>
                </>
              ) : null}
              {editPaymentProvider === 'ZEFFY' ? (
                <label className="text-sm sm:col-span-2">Zeffy API Key {editingCampaign.hasZeffyApiKey ? <span className="ml-2 text-xs font-semibold text-emerald-700">Configured</span> : null}
                  <input
                    type="password"
                    autoComplete="new-password"
                    required={!editingCampaign.hasZeffyApiKey}
                    {...editForm.register('zeffyApiKey')}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand-blue"
                    placeholder={editingCampaign.hasZeffyApiKey ? 'Leave blank to keep the saved key' : ''}
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" {...editForm.register('isActive')} />
                Active campaign
              </label>
              <div className="h-px bg-slate-200 sm:col-span-2" />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                <button type="button" onClick={() => setEditingCampaign(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Cancel</button>
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
