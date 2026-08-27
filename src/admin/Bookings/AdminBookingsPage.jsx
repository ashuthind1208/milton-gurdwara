import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  ArrowsRightLeftIcon,
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  EnvelopeIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import RichTextEditor from '../../components/forms/RichTextEditor';
import bookingService from '../../services/bookingService';
import donationService from '../../services/donationService';
import eventService from '../../services/eventService';
import contentApiService from '../../services/contentApiService';

const BOOKINGS_PAGE_SIZE = 10;
const DUTY_PAGE_PATH = '/admin/booking-duties';
const FULL_ACCESS_ROLES = new Set(['admin', 'super admin']);
const CATEGORY_COLORS = ['#1d4ed8', '#0f766e', '#b45309', '#b91c1c', '#7c3aed', '#334155'];
const BOOKING_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { value, label: new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) };
});

const emptyCategory = {
  id: '',
  name: '',
  color: '',
  feeAmount: 0,
  paymentRequired: false,
  active: true
};

const emptyPayment = {
  paymentProvider: 'STRIPE',
  paymentLink: '',
  stripeBuyButtonId: '',
  stripePublishableKey: '',
  zeffyApiKey: ''
};

const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

const toDateKey = (value) => {
  const dateOnly = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) {
    return dateOnly[1];
  }
  const date = value instanceof Date ? value : new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const toCalendarDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : new Date();
};

const eachDateKey = (startValue, endValue = startValue) => {
  const start = toCalendarDate(startValue);
  const end = toCalendarDate(endValue || startValue);
  if (!toDateKey(startValue) || !toDateKey(endValue || startValue) || end < start) {
    return [];
  }
  const keys = [];
  const cursor = new Date(start);
  while (cursor <= end && keys.length < 3660) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const getBookingIntervals = (booking = {}) => eachDateKey(booking.date, booking.toDate || booking.date)
  .map((dateKey) => ({
    start: new Date(`${dateKey}T${booking.startTime || '00:00'}:00`),
    end: new Date(`${dateKey}T${booking.endTime || '00:00'}:00`)
  }))
  .filter((interval) => !Number.isNaN(interval.start.getTime()) && !Number.isNaN(interval.end.getTime()) && interval.end > interval.start);

const getEventIntervals = (event = {}) => {
  const start = new Date(event.date || '');
  const parsedEnd = new Date(event.endDate || '');
  const end = Number.isNaN(parsedEnd.getTime()) ? new Date(start.getTime() + (60 * 60 * 1000)) : parsedEnd;
  return Number.isNaN(start.getTime()) || end <= start ? [] : [{ start, end }];
};

const intervalsOverlap = (first, second) => first.some((left) => second.some((right) => left.start < right.end && right.start < left.end));

const findScheduleConflict = (candidate, bookings, events) => {
  const candidateIntervals = getBookingIntervals(candidate);
  const bookingConflict = bookings.find((entry) => (
    String(entry.id || '') !== String(candidate.id || '')
    && String(entry.status || '').toLowerCase() !== 'cancelled'
    && intervalsOverlap(candidateIntervals, getBookingIntervals(entry))
  ));
  if (bookingConflict) return bookingConflict.categoryName || bookingConflict.title || 'another booking';
  const eventConflict = events.find((entry) => (
    entry.active !== false && intervalsOverlap(candidateIntervals, getEventIntervals(entry))
  ));
  return eventConflict ? eventConflict.title || 'an event' : '';
};

const monthKeyFromDate = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const statusBadgeClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'confirmed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'cancelled') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const paymentBadgeClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'partial') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (normalized === 'refunded') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-600';
};

const refundBadgeClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'processed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-600';
};

const AdminBookingsPage = () => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [guidelinesDraft, setGuidelinesDraft] = useState({ guidelines: '', donationCampaignId: '', showCreateBookingButton: true });
  const [guidelinesConfirmationOpen, setGuidelinesConfirmationOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState({ open: false, mode: 'add', category: emptyCategory });
  const [bookingModal, setBookingModal] = useState({ open: false, mode: 'view', booking: null });
  const [statusModal, setStatusModal] = useState({ open: false, booking: null, status: 'pending' });
  const [refundModal, setRefundModal] = useState({ open: false, booking: null, refundStatus: 'pending', refundAmount: 0, refundMethod: 'original-payment-method', refundReference: '', refundDate: '', refundNotes: '' });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState(emptyPayment);
  const [paymentError, setPaymentError] = useState('');
  const [bookingFormError, setBookingFormError] = useState('');
  const [bookingCalendarOpen, setBookingCalendarOpen] = useState(false);
  const [bookingFilters, setBookingFilters] = useState({ search: '', status: '', paymentStatus: '', categoryId: '', sort: 'newest' });

  const { data: bookings = [], isLoading: bookingsLoading, error: bookingsError } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingService.getBookings().then((res) => res.data)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['booking-categories'],
    queryFn: () => bookingService.getBookingCategories().then((res) => res.data)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventService.getEvents().then((res) => res.data)
  });

  const { data: roleDefinitions = [] } = useQuery({
    queryKey: ['admin-role-definitions'],
    queryFn: () => contentApiService.getSingleton('admin_roles', [])
  });

  const { data: adminUsers = [] } = useQuery({
    queryKey: ['admin-users', 'booking-assignees'],
    queryFn: () => contentApiService.list('users')
  });

  const dutyAssignees = useMemo(() => {
    const dutyRoles = new Set((Array.isArray(roleDefinitions) ? roleDefinitions : [])
      .filter((entry) => Array.isArray(entry?.adminPageAccess) && entry.adminPageAccess.includes(DUTY_PAGE_PATH))
      .map((entry) => String(entry?.name || '').trim().toLowerCase())
      .filter(Boolean));
    return adminUsers.filter((entry) => {
      const role = String(entry.role || '').trim().toLowerCase();
      return !FULL_ACCESS_ROLES.has(role)
        && (dutyRoles.has(role) || (Array.isArray(entry.adminPageAccess) && entry.adminPageAccess.includes(DUTY_PAGE_PATH)))
        && entry.isActive !== false
        && String(entry.approvalStatus || 'approved').toLowerCase() === 'approved';
    }).sort((first, second) => String(first.name || first.email || '').localeCompare(String(second.name || second.email || '')));
  }, [adminUsers, roleDefinitions]);

  const { data: bookingPageSettings } = useQuery({
    queryKey: ['booking-page-settings'],
    queryFn: () => bookingService.getBookingPageSettings().then((res) => res.data)
  });

  const { data: donationCampaigns = [] } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () => donationService.getAllCampaigns().then((res) => res.data)
  });

  useEffect(() => {
    if (bookingPageSettings) {
      setGuidelinesDraft(bookingPageSettings);
    }
  }, [bookingPageSettings]);

  const selectedCampaign = useMemo(
    () => donationCampaigns.find((campaign) => String(campaign.id) === String(guidelinesDraft.donationCampaignId)),
    [donationCampaigns, guidelinesDraft.donationCampaignId]
  );

  const filteredBookings = useMemo(() => {
    const search = bookingFilters.search.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (bookingFilters.status && booking.status !== bookingFilters.status) {
        return false;
      }
      if (bookingFilters.paymentStatus && booking.paymentStatus !== bookingFilters.paymentStatus) {
        return false;
      }
      if (bookingFilters.categoryId && booking.categoryId !== bookingFilters.categoryId) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [
        booking.id,
        booking.requesterName,
        booking.requesterEmail,
        booking.requesterPhone,
        booking.categoryName,
        booking.date,
        booking.receiptNumber,
        booking.paymentReference
      ].some((value) => String(value || '').toLowerCase().includes(search));
    });
  }, [bookingFilters, bookings]);

  const sortedBookings = useMemo(
    () => [...filteredBookings].sort((first, second) => {
      const sort = bookingFilters.sort;
      if (sort === 'name-asc' || sort === 'name-desc') {
        const comparison = String(first.requesterName || '').localeCompare(String(second.requesterName || ''), 'en', { sensitivity: 'base' });
        return sort === 'name-desc' ? -comparison : comparison;
      }
      if (sort === 'booking-latest' || sort === 'booking-earliest') {
        const firstValue = `${first.date || ''}T${first.startTime || '00:00'}`;
        const secondValue = `${second.date || ''}T${second.startTime || '00:00'}`;
        return sort === 'booking-earliest' ? firstValue.localeCompare(secondValue) : secondValue.localeCompare(firstValue);
      }
      const firstCreated = new Date(first.createdAt || 0).getTime();
      const secondCreated = new Date(second.createdAt || 0).getTime();
      return sort === 'oldest' ? firstCreated - secondCreated : secondCreated - firstCreated;
    }),
    [bookingFilters.sort, filteredBookings]
  );

  const totalPages = Math.max(1, Math.ceil(sortedBookings.length / BOOKINGS_PAGE_SIZE));
  const pagedBookings = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * BOOKINGS_PAGE_SIZE;
    return sortedBookings.slice(start, start + BOOKINGS_PAGE_SIZE);
  }, [currentPage, sortedBookings, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [bookingFilters]);

  const kpis = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((entry) => entry.status === 'pending').length;
    const confirmed = bookings.filter((entry) => entry.status === 'confirmed').length;
    const cancelled = bookings.filter((entry) => entry.status === 'cancelled').length;
    const refunded = bookings.filter((entry) => (
      entry.paymentStatus === 'refunded'
      || String(entry.refundStatus || '').toLowerCase() === 'processed'
    )).length;
    const revenue = bookings
      .filter((entry) => entry.status === 'confirmed' && entry.paymentStatus === 'paid')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    return { total, pending, confirmed, cancelled, refunded, revenue };
  }, [bookings]);

  const trendRows = useMemo(() => {
    const byMonth = new Map();
    bookings.forEach((entry) => {
      const key = monthKeyFromDate(entry.date || entry.createdAt);
      const existing = byMonth.get(key) || { month: key, bookings: 0, revenue: 0 };
      existing.bookings += 1;
      if (entry.status === 'confirmed' && entry.paymentStatus === 'paid') {
        existing.revenue += Number(entry.amount || 0);
      }
      byMonth.set(key, existing);
    });
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [bookings]);

  const occupiedDates = useMemo(() => {
    const dates = new Map();
    const addRange = (start, end, kind) => {
      eachDateKey(start, end).forEach((dateKey) => {
        const kinds = dates.get(dateKey) || new Set();
        kinds.add(kind);
        dates.set(dateKey, kinds);
      });
    };
    bookings
      .filter((booking) => String(booking.status || '').toLowerCase() !== 'cancelled')
      .forEach((booking) => addRange(booking.date, booking.toDate || booking.date, 'booking'));
    events
      .filter((event) => event.active !== false)
      .forEach((event) => addRange(event.date, event.endDate || event.date, 'event'));
    return dates;
  }, [bookings, events]);

  const occupiedEntriesByDate = useMemo(() => {
    const entriesByDate = new Map();
    const addEntry = (entry, kind) => {
      eachDateKey(entry.date, entry.toDate || entry.endDate || entry.date).forEach((dateKey) => {
        const entries = entriesByDate.get(dateKey) || [];
        entries.push({
          id: `${kind}-${entry.id}-${dateKey}`,
          kind,
          title: entry.categoryName || entry.title || (kind === 'booking' ? 'Booking' : 'Event'),
          startTime: entry.startTime || (entry.date?.includes('T') ? new Date(entry.date).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : ''),
          endTime: entry.endTime || (entry.endDate?.includes('T') ? new Date(entry.endDate).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }) : '')
        });
        entriesByDate.set(dateKey, entries);
      });
    };
    bookings.filter((booking) => String(booking.status || '').toLowerCase() !== 'cancelled').forEach((booking) => addEntry(booking, 'booking'));
    events.filter((event) => event.active !== false).forEach((event) => addEntry(event, 'event'));
    return entriesByDate;
  }, [bookings, events]);

  const settingsMutation = useMutation({
    mutationFn: (settings) => bookingService.setBookingPageSettings(settings).then((res) => res.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['booking-page-settings'] });
      setGuidelinesConfirmationOpen(true);
    }
  });

  const categoriesMutation = useMutation({
    mutationFn: (rows) => bookingService.setBookingCategories(rows).then((res) => res.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['booking-categories'] });
      setCategoryModal({ open: false, mode: 'add', category: emptyCategory });
    }
  });

  const bookingMutation = useMutation({
    mutationFn: ({ id, payload }) => bookingService.updateBooking(id, payload).then((res) => res.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setBookingModal({ open: false, mode: 'view', booking: null });
      setStatusModal({ open: false, booking: null, status: 'pending' });
      setRefundModal({ open: false, booking: null, refundStatus: 'pending', refundAmount: 0, refundMethod: 'original-payment-method', refundReference: '', refundDate: '', refundNotes: '' });
    },
    onError: (error) => setBookingFormError(error?.message || 'Unable to update this booking.')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => bookingService.removeBooking(id).then((res) => res.data),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['bookings'] })
  });

  const emailMutation = useMutation({
    mutationFn: (booking) => bookingService.sendBookingConfirmationEmail(booking).then((res) => res.data),
    onSuccess: (_, booking) => {
      window.alert(`Booking receipt emailed to ${booking?.requesterEmail || booking?.requesterName || 'the requester'}.`);
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to email the booking receipt right now.');
    }
  });

  const paymentMutation = useMutation({
    mutationFn: async (values) => {
      const provider = String(values.paymentProvider || '').toUpperCase();
      if (provider === 'ZEFFY' && !String(values.paymentLink || '').trim()) {
        throw new Error('A Zeffy form link is required.');
      }

      const payload = {
        name: selectedCampaign?.name || 'Booking Payments',
        description: 'Online payment configuration for all booking types.',
        target: 0,
        raised: Number(selectedCampaign?.raised || 0),
        isActive: true,
        paymentProvider: provider,
        paymentLink: String(values.paymentLink || '').trim(),
        stripeBuyButtonId: String(values.stripeBuyButtonId || '').trim(),
        stripePublishableKey: String(values.stripePublishableKey || '').trim(),
        ...(String(values.zeffyApiKey || '').trim() ? { zeffyApiKey: String(values.zeffyApiKey).trim() } : {})
      };

      const campaign = selectedCampaign
        ? await donationService.updateCampaign(selectedCampaign.id, payload).then((res) => res.data)
        : await donationService.createCampaign(payload).then((res) => res.data);
      const settings = await bookingService.setBookingPageSettings({
        ...guidelinesDraft,
        donationCampaignId: String(campaign.id)
      }).then((res) => res.data);
      return { campaign, settings };
    },
    onSuccess: async ({ settings }) => {
      setGuidelinesDraft(settings);
      setPaymentError('');
      setPaymentModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['booking-page-settings'] })
      ]);
    },
    onError: (error) => setPaymentError(error?.message || 'Unable to save booking payment settings.')
  });

  const createBookingMutation = useMutation({
    mutationFn: (payload) => bookingService.createBooking(payload).then((res) => res.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setBookingFormError('');
      setBookingModal({ open: false, mode: 'view', booking: null });
    },
    onError: (error) => setBookingFormError(error?.message || 'Unable to create this booking.')
  });

  const openCategoryModal = (mode, category = emptyCategory) => {
    setCategoryModal({ open: true, mode, category: { ...emptyCategory, ...category } });
  };

  const saveCategory = () => {
    const draft = categoryModal.category;
    const name = String(draft.name || '').trim();
    if (!name) {
      return;
    }
    const normalized = {
      ...draft,
      id: draft.id || `booking-category-${Date.now()}`,
      color: draft.color || CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
      name,
      feeAmount: Number(draft.feeAmount || 0)
    };
    const nextCategories = categoryModal.mode === 'add'
      ? [...categories, normalized]
      : categories.map((entry) => entry.id === normalized.id ? normalized : entry);
    categoriesMutation.mutate(nextCategories);
  };

  const removeCategory = (category) => {
    if (window.confirm(`Delete booking type “${category.name}”?`)) {
      categoriesMutation.mutate(categories.filter((entry) => entry.id !== category.id));
    }
  };

  const openPaymentModal = () => {
    setPaymentError('');
    setPaymentDraft({
      paymentProvider: selectedCampaign?.paymentProvider === 'ZEFFY' ? 'ZEFFY' : 'STRIPE',
      paymentLink: selectedCampaign?.paymentLink || '',
      stripeBuyButtonId: selectedCampaign?.stripeBuyButtonId || '',
      stripePublishableKey: selectedCampaign?.stripePublishableKey || '',
      zeffyApiKey: ''
    });
    setPaymentModalOpen(true);
  };

  const updateBookingDraft = (field, value) => {
    setBookingModal((current) => ({
      ...current,
      booking: {
        ...current.booking,
        [field]: value,
        ...(field === 'paymentStatus' && value === 'paid' && current.booking.source === 'admin-manual' ? { status: 'confirmed' } : {})
      }
    }));
  };

  const openStatusModal = (booking) => {
    setStatusModal({ open: true, booking: { ...booking }, status: booking.status || 'pending' });
  };

  const openRefundModal = (booking) => {
    setRefundModal({
      open: true,
      booking: { ...booking },
      refundStatus: booking.refundStatus || 'pending',
      refundAmount: Number(booking.refundAmount || booking.amount || 0),
      refundMethod: booking.refundMethod || 'original-payment-method',
      refundReference: booking.refundReference || '',
      refundDate: booking.refundDate || '',
      refundNotes: booking.refundNotes || ''
    });
  };

  const saveStatus = (event) => {
    event.preventDefault();
    const booking = statusModal.booking;
    if (!booking?.id) {
      return;
    }
    const needsRefundDetails = statusModal.status === 'cancelled'
      && ['paid', 'partial'].includes(String(booking.paymentStatus || '').toLowerCase())
      && String(booking.refundStatus || '').toLowerCase() !== 'processed';
    if (needsRefundDetails) {
      setStatusModal({ open: false, booking: null, status: 'pending' });
      openRefundModal(booking);
      return;
    }
    const cancellationDetails = statusModal.status === 'cancelled'
      ? { refundStatus: booking.refundStatus || 'not-required', refundAmount: Number(booking.refundAmount || 0) }
      : { refundStatus: '', refundAmount: 0, refundMethod: '', refundReference: '', refundDate: '', refundNotes: '' };
    bookingMutation.mutate({ id: booking.id, payload: { ...booking, ...cancellationDetails, status: statusModal.status } });
  };

  const saveCancellationRefund = (event) => {
    event.preventDefault();
    const booking = refundModal.booking;
    if (!booking?.id) {
      return;
    }
    const refundAmount = Number(refundModal.refundAmount || 0);
    if (refundAmount <= 0 || (refundModal.refundStatus === 'processed' && !String(refundModal.refundReference || '').trim())) {
      return;
    }
    bookingMutation.mutate({
      id: booking.id,
      payload: {
        ...booking,
        status: 'cancelled',
        paymentStatus: refundModal.refundStatus === 'processed' ? 'refunded' : booking.paymentStatus,
        refundStatus: refundModal.refundStatus,
        refundAmount,
        refundMethod: refundModal.refundMethod,
        refundReference: String(refundModal.refundReference || '').trim(),
        refundDate: refundModal.refundStatus === 'processed'
          ? refundModal.refundDate || new Date().toISOString().slice(0, 10)
          : refundModal.refundDate,
        refundNotes: String(refundModal.refundNotes || '').trim()
      }
    });
  };

  const saveBooking = (event) => {
    event.preventDefault();
    const booking = bookingModal.booking;
    if (!booking) {
      return;
    }
    const requiredFields = [
      ['date', 'From date'],
      ['toDate', 'To date'],
      ['startTime', 'Start time'],
      ['endTime', 'End time'],
      ['categoryId', 'Booking type'],
      ['bookingLocation', 'Booking location'],
      ['requesterName', 'Name'],
      ['requesterEmail', 'Email'],
      ['requesterPhone', 'Phone'],
      ['requesterAddress', 'Address'],
      ['dutyAssigneeId', 'Duty performer'],
      ['paymentStatus', 'Payment status'],
      ['paymentMethod', 'Payment method']
    ];
    const missingField = requiredFields.find(([field]) => !String(booking[field] || '').trim());
    if (missingField) {
      setBookingFormError(`${missingField[1]} is required.`);
      return;
    }
    if (booking.toDate < booking.date) {
      setBookingFormError('To date cannot be earlier than the from date.');
      return;
    }
    if (booking.endTime <= booking.startTime) {
      setBookingFormError('End time must be later than start time.');
      return;
    }
    const conflictTitle = findScheduleConflict(booking, bookings, events);
    if (conflictTitle) {
      setBookingFormError(`This date and time overlaps with ${conflictTitle}. Choose a different time.`);
      return;
    }
    if (Number(booking.amount) < 0) {
      setBookingFormError('Amount cannot be negative.');
      return;
    }
    setBookingFormError('');
    if (bookingModal.mode === 'create') {
      createBookingMutation.mutate({
        ...booking,
        id: '',
        amount: Number(booking.amount || 0),
        source: 'admin-manual'
      });
      return;
    }
    if (!booking.id) {
      return;
    }
    bookingMutation.mutate({ id: booking.id, payload: { ...booking, amount: Number(booking.amount || 0) } });
  };

  const openManualBooking = () => {
    const category = categories.find((entry) => entry.active !== false) || categories[0] || { id: 'cat-other', name: 'Other', color: '#475569' };
    setBookingModal({
      open: true,
      mode: 'create',
      booking: {
        categoryId: category.id,
        categoryName: category.name,
        title: category.name,
        color: category.color,
        date: toDateKey(new Date()),
        toDate: toDateKey(new Date()),
        startTime: '10:00',
        endTime: '11:00',
        bookingLocation: 'Gurdwara Singh Sabha Milton, 7035 Sixth Line, Milton, ON',
        requesterName: '',
        requesterEmail: '',
        requesterPhone: '',
        requesterAddress: '',
        dutyAssigneeId: '',
        dutyAssigneeName: '',
        dutyAssigneeEmail: '',
        status: 'confirmed',
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paymentProvider: '',
        amount: 0,
        receiptNumber: '',
        notes: '',
        source: 'admin-manual'
      }
    });
    setBookingFormError('');
    setBookingCalendarOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {emailMutation.isPending ? (
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
            <p className="mt-1 text-xs text-slate-600">Generating the booking receipt and delivering it to {emailMutation.variables?.requesterName || 'the requester'}.</p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-slate-900">Bookings Management</h1>
          <p className="mt-1 text-sm text-slate-600">Track requests, payment status, schedules, and booking types.</p>
        </div>
        <button type="button" onClick={openManualBooking} className="inline-flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-blue-50">
          <PlusIcon className="h-4 w-4" /> Manual Booking
        </button>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Total bookings', kpis.total, 'text-slate-900'],
            ['Pending', kpis.pending, 'text-amber-700'],
            ['Confirmed', kpis.confirmed, 'text-emerald-700'],
            ['Cancelled', kpis.cancelled, 'text-rose-700'],
            ['Refunded', kpis.refunded, 'text-cyan-700'],
            ['Revenue (CAD)', kpis.revenue.toFixed(2), 'text-slate-900']
          ].map(([label, value, valueClass]) => (
            <article key={label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
            </article>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">Bookings Trend (last 12 months)</p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="bookings" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} name="Bookings" />
                <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Bookings</h2>
          <p className="mt-0.5 text-xs text-slate-500">Live records from the bookings backend resource.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(140px,auto))]">
            <label className="relative">
              <span className="sr-only">Search bookings</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="search" value={bookingFilters.search} onChange={(event) => setBookingFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, email, phone, ID, receipt..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
            </label>
            <select aria-label="Filter by booking status" value={bookingFilters.status} onChange={(event) => setBookingFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select>
            <select aria-label="Filter by payment status" value={bookingFilters.paymentStatus} onChange={(event) => setBookingFilters((current) => ({ ...current, paymentStatus: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All payments</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="refunded">Refunded</option></select>
            <select aria-label="Filter by booking type" value={bookingFilters.categoryId} onChange={(event) => setBookingFilters((current) => ({ ...current, categoryId: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All booking types</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select aria-label="Sort bookings" value={bookingFilters.sort} onChange={(event) => setBookingFilters((current) => ({ ...current, sort: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="newest">Newest requests first</option><option value="oldest">Oldest requests first</option><option value="name-asc">Name A to Z</option><option value="name-desc">Name Z to A</option><option value="booking-latest">Latest booking date</option><option value="booking-earliest">Earliest booking date</option></select>
          </div>
        </div>
        {bookingsError ? <p className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Unable to load bookings: {bookingsError.message}</p> : null}
        <div className="overflow-x-hidden">
          <table className="admin-bookings-table min-w-[1020px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Refund</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookingsLoading ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={9}>Loading bookings…</td></tr> : null}
              {pagedBookings.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2">{row.date || '-'}{row.toDate && row.toDate !== row.date ? ` to ${row.toDate}` : ''}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.requesterName || '-'}</td>
                  <td className="px-3 py-2">{row.categoryName || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.startTime || '-'} - {row.endTime || '-'}</td>
                  <td className="px-3 py-2"><button type="button" onClick={() => openStatusModal(row)} className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold transition hover:brightness-95 ${statusBadgeClass(row.status)}`} title="Update booking status">{row.status || 'pending'}</button></td>
                  <td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${paymentBadgeClass(row.paymentStatus)}`}>{row.paymentStatus || 'pending'}</span></td>
                  <td className="px-3 py-2">{row.status === 'cancelled' && row.refundStatus ? <button type="button" onClick={() => openRefundModal(row)} className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold transition hover:brightness-95 ${refundBadgeClass(row.refundStatus)}`} title="Update refund status">{row.refundStatus === 'processed' ? 'released' : row.refundStatus}</button> : <span className="text-slate-400">-</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2">${Number(row.amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-2"><div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => { setBookingFormError(''); setBookingModal({ open: true, mode: 'view', booking: { ...row, toDate: row.toDate || row.date } }); }} className={iconButtonClass} title="View booking" aria-label="View booking"><EyeIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => { setBookingFormError(''); setBookingModal({ open: true, mode: 'edit', booking: { ...row, toDate: row.toDate || row.date } }); }} className={iconButtonClass} title="Edit booking" aria-label="Edit booking"><PencilSquareIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => openStatusModal(row)} className={iconButtonClass} title="Update status" aria-label="Update booking status"><ArrowsRightLeftIcon className="h-4 w-4" /></button>
                    {row.status === 'cancelled' && (row.refundStatus || ['paid', 'partial', 'refunded'].includes(String(row.paymentStatus || '').toLowerCase())) ? <button type="button" onClick={() => openRefundModal(row)} className={`${iconButtonClass} text-emerald-700`} title="Update refund status" aria-label="Update refund status"><ArrowUturnLeftIcon className="h-4 w-4" /></button> : null}
                    <button type="button" onClick={() => bookingService.downloadInvoice(row)} className={iconButtonClass} title="Download invoice" aria-label="Download invoice"><ArrowDownTrayIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => emailMutation.mutate(row)} disabled={emailMutation.isPending} className={iconButtonClass} title="Email receipt" aria-label="Email receipt"><EnvelopeIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => window.confirm('Delete this booking?') && deleteMutation.mutate(row.id)} className={`${iconButtonClass} text-rose-600`} title="Delete booking" aria-label="Delete booking"><TrashIcon className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
              {!bookingsLoading && !bookingsError && pagedBookings.length === 0 ? <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={9}>No bookings found yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Page {Math.min(currentPage, totalPages)} of {totalPages} · {filteredBookings.length} of {bookings.length} bookings</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1} className={iconButtonClass} aria-label="Previous page" title="Previous page"><ChevronLeftIcon className="h-4 w-4" /></button>
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className={iconButtonClass} aria-label="Next page" title="Next page"><ChevronRightIcon className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-slate-900">Booking Page Settings</h2>
            <p className="mt-1 text-sm text-slate-600">Edit public guidelines and configure the payment provider used by every paid booking type.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openPaymentModal} className="inline-flex items-center gap-2 rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-blue-50"><CreditCardIcon className="h-4 w-4" /> Payment Setup</button>
            <button type="button" onClick={() => settingsMutation.mutate(guidelinesDraft)} disabled={settingsMutation.isPending} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{settingsMutation.isPending ? 'Saving...' : 'Save Guidelines'}</button>
          </div>
        </div>
        <div className="mt-4">
          <RichTextEditor value={guidelinesDraft.guidelines || ''} onChange={(guidelines) => setGuidelinesDraft((current) => ({ ...current, guidelines }))} minHeight={150} />
        </div>
        <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <span><span className="block text-sm font-semibold text-slate-800">Website booking requests</span><span className="block text-xs text-slate-500">Show the Create Booking Request button on the public bookings page.</span></span>
          <input type="checkbox" checked={guidelinesDraft.showCreateBookingButton !== false} onChange={(event) => setGuidelinesDraft((current) => ({ ...current, showCreateBookingButton: event.target.checked }))} className="h-5 w-5 shrink-0 accent-brand-blue" />
        </label>
        <p className="mt-3 text-sm text-slate-600">Payment provider: <strong>{selectedCampaign?.paymentProvider || 'Not configured'}</strong></p>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-slate-900">Booking Types and Payments</h2>
            <p className="mt-0.5 text-xs text-slate-500">All paid types use the booking provider configured in Payment Setup.</p>
          </div>
          <button type="button" onClick={() => openCategoryModal('add')} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white"><PlusIcon className="h-4 w-4" /> Add Type</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="px-3 py-2">Type</th><th className="px-3 py-2">Fee</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>{categories.map((category) => (
              <tr key={category.id} className="border-t border-slate-200">
                <td className="px-3 py-2 font-semibold text-slate-900">{category.name}</td>
                <td className="px-3 py-2">${Number(category.feeAmount || 0).toFixed(2)}</td>
                <td className="px-3 py-2">{category.paymentRequired ? 'Required' : 'Not required'}</td>
                <td className="px-3 py-2">{category.active ? 'Active' : 'Inactive'}</td>
                <td className="px-3 py-2"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => openCategoryModal('view', category)} className={iconButtonClass} title="View type" aria-label="View type"><EyeIcon className="h-4 w-4" /></button><button type="button" onClick={() => openCategoryModal('edit', category)} className={iconButtonClass} title="Edit type" aria-label="Edit type"><PencilSquareIcon className="h-4 w-4" /></button><button type="button" onClick={() => removeCategory(category)} className={`${iconButtonClass} text-rose-600`} title="Delete type" aria-label="Delete type"><TrashIcon className="h-4 w-4" /></button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {bookingModal.open && bookingModal.booking ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-x-hidden bg-slate-950/65 p-3 sm:p-4" onClick={() => setBookingModal({ open: false, mode: 'view', booking: null })}>
          <form className="max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-x-hidden overflow-y-auto rounded-lg bg-slate-50 shadow-2xl sm:max-h-[calc(100vh-2rem)]" onSubmit={saveBooking} onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-blue-200 bg-gradient-to-r from-blue-50 via-white to-amber-50 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white"><CalendarDaysIcon className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase text-brand-blue">Booking Record</p><h3 className="font-heading text-xl font-semibold text-slate-900">{bookingModal.mode === 'create' ? 'Manual' : bookingModal.mode === 'edit' ? 'Edit' : 'View'} Booking</h3></div></div>
              <button type="button" onClick={() => setBookingModal({ open: false, mode: 'view', booking: null })} className={iconButtonClass} aria-label="Close booking"><XMarkIcon className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              {bookingFormError ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{bookingFormError}</div> : null}
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2"><CalendarDaysIcon className="h-5 w-5 text-brand-blue" /><h4 className="font-heading text-base font-semibold text-slate-900">Programme Details</h4></div>
                  <div className="relative ml-auto">
                    <button type="button" onClick={() => setBookingCalendarOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-full border border-brand-blue bg-brand-blue px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800" aria-expanded={bookingCalendarOpen}>
                      <CalendarDaysIcon className="h-4 w-4" /> Booking Calendar
                    </button>
                    {bookingCalendarOpen ? (
                      <div className="fixed inset-x-3 top-24 z-30 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-blue-200 bg-white p-3 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[390px]">
                        <div className="mb-2 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">Availability</p><p className="text-xs text-slate-600">Highlighted dates contain bookings or events. Select a date or range.</p></div><button type="button" onClick={() => setBookingCalendarOpen(false)} className={iconButtonClass} aria-label="Close booking calendar"><XMarkIcon className="h-4 w-4" /></button></div>
                        <Calendar className="booking-admin-calendar" selectRange value={[toCalendarDate(bookingModal.booking.date), toCalendarDate(bookingModal.booking.toDate || bookingModal.booking.date)]} onChange={(value) => { if (bookingModal.mode === 'view' || !Array.isArray(value)) return; updateBookingDraft('date', toDateKey(value[0])); updateBookingDraft('toDate', toDateKey(value[1] || value[0])); }} tileClassName={({ date, view }) => { if (view !== 'month') return ''; const kinds = occupiedDates.get(toDateKey(date)); return kinds ? `booking-admin-calendar-occupied ${kinds.has('booking') ? 'booking-admin-calendar-booked' : ''} ${kinds.has('event') ? 'booking-admin-calendar-event' : ''}` : ''; }} tileContent={({ date, view }) => { const kinds = view === 'month' ? occupiedDates.get(toDateKey(date)) : null; return kinds ? <span className="booking-admin-calendar-markers" aria-hidden="true">{kinds.has('booking') ? <span className="bg-brand-blue" /> : null}{kinds.has('event') ? <span className="bg-brand-saffron" /> : null}</span> : null; }} />
                        <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700">Selected: {bookingModal.booking.date || 'Choose a date'}{bookingModal.booking.toDate && bookingModal.booking.toDate !== bookingModal.booking.date ? ` to ${bookingModal.booking.toDate}` : ' (single day)'}</p>
                        <div className="mt-2 space-y-1.5">{(occupiedEntriesByDate.get(bookingModal.booking.date) || []).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-2.5 py-2 text-xs"><span className="min-w-0 truncate font-semibold text-slate-800">{entry.title}</span><span className="shrink-0 text-slate-600">{entry.startTime || 'Time TBD'}{entry.endTime ? ` - ${entry.endTime}` : ''}</span></div>)}{(occupiedEntriesByDate.get(bookingModal.booking.date) || []).length === 0 ? <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700">No booking or event occupies this date.</p> : <p className="text-xs text-slate-500">Other non-overlapping times on this date can still be booked.</p>}</div>
                        <div className="flex flex-wrap gap-3 pt-2 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-blue" />Booking</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-saffron" />Event</span></div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid content-start gap-3 sm:grid-cols-4">
                    {[
                      ['date', 'From Date', 'date'],
                      ['toDate', 'To Date', 'date'],
                      ['startTime', 'Start Time', 'time'],
                      ['endTime', 'End Time', 'time']
                    ].map(([field, label, type]) => (
                      <label key={field} className="min-w-0 text-sm font-semibold text-slate-700">{label} <span className="text-rose-600">*</span>{type === 'time' ? <select required disabled={bookingModal.mode === 'view'} value={bookingModal.booking[field] || ''} onChange={(event) => updateBookingDraft(field, event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"><option value="">Select time</option>{BOOKING_TIME_OPTIONS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select> : <input required type={type} disabled={bookingModal.mode === 'view'} value={bookingModal.booking[field] || ''} min={field === 'toDate' ? bookingModal.booking.date || undefined : undefined} onChange={(event) => updateBookingDraft(field, event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />}</label>
                    ))}
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Booking Type <span className="text-rose-600">*</span><select required disabled={bookingModal.mode === 'view'} value={bookingModal.booking.categoryId || ''} onChange={(event) => { const category = categories.find((entry) => entry.id === event.target.value); setBookingModal((current) => ({ ...current, booking: { ...current.booking, categoryId: event.target.value, categoryName: category?.name || '', title: category?.name || '', color: category?.color || '' } })); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Booking Location <span className="text-rose-600">*</span><input required disabled={bookingModal.mode === 'view'} value={bookingModal.booking.bookingLocation || ''} onChange={(event) => updateBookingDraft('bookingLocation', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Duty Performer <span className="text-rose-600">*</span><select required disabled={bookingModal.mode === 'view'} value={bookingModal.booking.dutyAssigneeId || ''} onChange={(event) => { const assignee = dutyAssignees.find((entry) => String(entry.id) === event.target.value); setBookingModal((current) => ({ ...current, booking: { ...current.booking, dutyAssigneeId: String(assignee?.id || ''), dutyAssigneeName: String(assignee?.name || assignee?.email || ''), dutyAssigneeEmail: String(assignee?.email || '').toLowerCase() } })); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"><option value="">Select duty performer</option>{bookingModal.booking.dutyAssigneeId && !dutyAssignees.some((entry) => String(entry.id) === String(bookingModal.booking.dutyAssigneeId)) ? <option value={bookingModal.booking.dutyAssigneeId}>{bookingModal.booking.dutyAssigneeName || 'Previously assigned user'}</option> : null}{dutyAssignees.map((entry) => <option key={entry.id} value={entry.id}>{entry.name || entry.email}{entry.role ? ` (${entry.role})` : ''}</option>)}</select></label>
                </div>
              </section>
              <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="border-b border-slate-200 pb-3 font-heading text-base font-semibold text-slate-900">Contact Details</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {[
                    ['requesterName', 'Name', 'text'],
                    ['requesterEmail', 'Email', 'email'],
                    ['requesterPhone', 'Phone', 'text'],
                    ['requesterAddress', 'Address', 'text']
                  ].map(([field, label, type]) => (
                    <label key={field} className="text-sm font-semibold text-slate-700">{label} <span className="text-rose-600">*</span><input required type={type} disabled={bookingModal.mode === 'view'} value={bookingModal.booking[field] || ''} onChange={(event) => updateBookingDraft(field, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                <h4 className="border-b border-blue-200 pb-3 font-heading text-base font-semibold text-slate-900">Payment Details</h4>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Payment Status <span className="text-rose-600">*</span><select required disabled={bookingModal.mode === 'view'} value={bookingModal.booking.paymentStatus || 'pending'} onChange={(event) => updateBookingDraft('paymentStatus', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"><option value="pending">Pending</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="refunded">Refunded</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Payment Method <span className="text-rose-600">*</span><select required disabled={bookingModal.mode === 'view'} value={bookingModal.booking.paymentMethod || ''} onChange={(event) => updateBookingDraft('paymentMethod', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">{bookingModal.booking.source !== 'admin-manual' && bookingModal.booking.paymentMethod && !['cash', 'credit-card', 'interac'].includes(bookingModal.booking.paymentMethod) ? <option value={bookingModal.booking.paymentMethod}>{bookingModal.booking.paymentMethod}</option> : null}<option value="cash">Cash</option><option value="credit-card">Credit Card</option><option value="interac">Interac</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Amount (CAD) <span className="text-rose-600">*</span><input required type="number" min="0" step="0.01" disabled={bookingModal.mode === 'view'} value={bookingModal.booking.amount ?? ''} onChange={(event) => updateBookingDraft('amount', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
              <label className="text-sm font-semibold text-slate-700">Receipt Number<input disabled={bookingModal.mode === 'view'} value={bookingModal.booking.receiptNumber || ''} onChange={(event) => updateBookingDraft('receiptNumber', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
                </div>
              </section>
              </div>
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="border-b border-slate-200 pb-3 font-heading text-base font-semibold text-slate-900">Additional Notes</h4>
                <label className="mt-3 block text-sm font-semibold text-slate-700">Notes<textarea disabled={bookingModal.mode === 'view'} value={bookingModal.booking.notes || ''} onChange={(event) => updateBookingDraft('notes', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
              </section>
            </div>
            {bookingModal.mode !== 'view' ? <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:px-6"><button type="button" onClick={() => setBookingModal({ open: false, mode: 'view', booking: null })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={bookingMutation.isPending || createBookingMutation.isPending} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{bookingMutation.isPending || createBookingMutation.isPending ? 'Saving…' : bookingModal.mode === 'create' ? 'Create Booking' : 'Save Booking'}</button></div> : null}
          </form>
        </div>
      ) : null}

      {statusModal.open && statusModal.booking ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/65 p-4" onClick={() => setStatusModal({ open: false, booking: null, status: 'pending' })}>
          <form className="w-full max-w-sm rounded-lg bg-white shadow-2xl" onSubmit={saveStatus} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase text-brand-blue">Status Action</p><h3 className="font-heading text-xl font-semibold text-slate-900">Update Booking Status</h3></div><button type="button" onClick={() => setStatusModal({ open: false, booking: null, status: 'pending' })} className={iconButtonClass} aria-label="Close status action"><XMarkIcon className="h-4 w-4" /></button></div>
            <div className="p-5"><label className="text-sm font-semibold text-slate-700">Status<select autoFocus value={statusModal.status} onChange={(event) => setStatusModal((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></label></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setStatusModal({ open: false, booking: null, status: 'pending' })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Close</button><button type="submit" disabled={bookingMutation.isPending} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{bookingMutation.isPending ? 'Saving…' : 'Update Status'}</button></div>
          </form>
        </div>
      ) : null}

      {refundModal.open && refundModal.booking ? (
        <div className="fixed inset-0 z-[155] flex items-center justify-center bg-slate-950/65 p-4" onClick={() => setRefundModal((current) => ({ ...current, open: false }))}>
          <form className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-2xl" onSubmit={saveCancellationRefund} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase text-rose-700">{refundModal.booking.status === 'cancelled' ? 'Cancelled Booking' : 'Cancellation'}</p><h3 className="font-heading text-xl font-semibold text-slate-900">{refundModal.booking.status === 'cancelled' ? 'Update Refund Status' : 'Record Refund Details'}</h3></div><button type="button" onClick={() => setRefundModal((current) => ({ ...current, open: false }))} className={iconButtonClass} aria-label="Close refund details"><XMarkIcon className="h-4 w-4" /></button></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">Complete the refund with the payment provider, then mark it Released. The member will receive a separate refund-release email with an updated PDF attachment.</p>
              <label className="text-sm font-semibold text-slate-700">Refund Status<select value={refundModal.refundStatus} onChange={(event) => setRefundModal((current) => ({ ...current, refundStatus: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="pending">Pending</option><option value="processed">Refunded / Released</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Refund Amount (CAD)<input required type="number" min="0.01" max={Number(refundModal.booking.amount || 0) || undefined} step="0.01" value={refundModal.refundAmount} onChange={(event) => setRefundModal((current) => ({ ...current, refundAmount: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-semibold text-slate-700">Refund Method<select value={refundModal.refundMethod} onChange={(event) => setRefundModal((current) => ({ ...current, refundMethod: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="original-payment-method">Original payment method</option><option value="cash">Cash</option><option value="credit-card">Credit Card</option><option value="interac">Interac</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
              <label className="text-sm font-semibold text-slate-700">Refund Date<input type="date" required={refundModal.refundStatus === 'processed'} value={refundModal.refundDate} onChange={(event) => setRefundModal((current) => ({ ...current, refundDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Refund Reference{refundModal.refundStatus === 'processed' ? ' (required)' : ''}<input required={refundModal.refundStatus === 'processed'} value={refundModal.refundReference} onChange={(event) => setRefundModal((current) => ({ ...current, refundReference: event.target.value }))} placeholder="Provider refund ID or transaction reference" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Refund Notes<textarea rows={3} value={refundModal.refundNotes} onChange={(event) => setRefundModal((current) => ({ ...current, refundNotes: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setRefundModal((current) => ({ ...current, open: false }))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Back</button><button type="submit" disabled={bookingMutation.isPending} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{bookingMutation.isPending ? 'Saving…' : refundModal.booking.status === 'cancelled' ? 'Save Refund Status' : 'Cancel & Save Refund'}</button></div>
          </form>
        </div>
      ) : null}

      {guidelinesConfirmationOpen ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/65 p-4" onClick={() => setGuidelinesConfirmationOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="guidelines-saved-title" className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-600" />
            <h3 id="guidelines-saved-title" className="mt-3 font-heading text-xl font-semibold text-slate-900">Guidelines Updated</h3>
            <p className="mt-2 text-sm text-slate-600">The booking guidelines have been updated successfully.</p>
            <button type="button" autoFocus onClick={() => setGuidelinesConfirmationOpen(false)} className="mt-5 rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white">Done</button>
          </div>
        </div>
      ) : null}

      {categoryModal.open ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/65 p-4" onClick={() => setCategoryModal((current) => ({ ...current, open: false }))}>
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h3 className="font-heading text-lg font-semibold text-slate-900">{categoryModal.mode === 'add' ? 'Add' : categoryModal.mode === 'edit' ? 'Edit' : 'View'} Booking Type</h3><button type="button" onClick={() => setCategoryModal((current) => ({ ...current, open: false }))} className={iconButtonClass} aria-label="Close booking type"><XMarkIcon className="h-4 w-4" /></button></div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Name<input disabled={categoryModal.mode === 'view'} value={categoryModal.category.name || ''} onChange={(event) => setCategoryModal((current) => ({ ...current, category: { ...current.category, name: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
              <label className="text-sm font-semibold text-slate-700">Fee (CAD)<input disabled={categoryModal.mode === 'view'} type="number" min="0" step="0.01" value={categoryModal.category.feeAmount || 0} onChange={(event) => setCategoryModal((current) => ({ ...current, category: { ...current.category, feeAmount: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></label>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input disabled={categoryModal.mode === 'view'} type="checkbox" checked={categoryModal.category.paymentRequired === true} onChange={(event) => setCategoryModal((current) => ({ ...current, category: { ...current.category, paymentRequired: event.target.checked } }))} /> Payment required</label>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input disabled={categoryModal.mode === 'view'} type="checkbox" checked={categoryModal.category.active !== false} onChange={(event) => setCategoryModal((current) => ({ ...current, category: { ...current.category, active: event.target.checked } }))} /> Active</label>
            </div>
            {categoryModal.mode !== 'view' ? <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setCategoryModal((current) => ({ ...current, open: false }))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={saveCategory} disabled={categoriesMutation.isPending || !String(categoryModal.category.name || '').trim()} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{categoriesMutation.isPending ? 'Saving…' : 'Save Type'}</button></div> : null}
          </div>
        </div>
      ) : null}

      {paymentModalOpen ? (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/65 p-4" onClick={() => setPaymentModalOpen(false)}>
          <form className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl" onSubmit={(event) => { event.preventDefault(); paymentMutation.mutate(paymentDraft); }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-heading text-xl font-semibold text-slate-900">Booking Payment Setup</h3><p className="mt-1 text-sm text-slate-600">One provider is used for every paid booking type.</p></div><button type="button" onClick={() => setPaymentModalOpen(false)} className={iconButtonClass} aria-label="Close payment setup"><XMarkIcon className="h-4 w-4" /></button></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {paymentError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{paymentError}</p> : null}
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Payment Provider<select value={paymentDraft.paymentProvider} onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentProvider: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="STRIPE">Stripe</option><option value="ZEFFY">Zeffy</option></select></label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{paymentDraft.paymentProvider === 'ZEFFY' ? 'Zeffy Form Link' : 'Stripe Checkout Link (optional)'}<input type="url" required={paymentDraft.paymentProvider === 'ZEFFY'} value={paymentDraft.paymentLink} onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentLink: event.target.value }))} placeholder={paymentDraft.paymentProvider === 'ZEFFY' ? 'https://www.zeffy.com/en-CA/donation-form/...' : 'https://...'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              {paymentDraft.paymentProvider === 'STRIPE' ? <><label className="text-sm font-semibold text-slate-700">Stripe Buy Button ID (optional)<input value={paymentDraft.stripeBuyButtonId} onChange={(event) => setPaymentDraft((current) => ({ ...current, stripeBuyButtonId: event.target.value }))} placeholder="buy_btn_..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Stripe Publishable Key (optional)<input value={paymentDraft.stripePublishableKey} onChange={(event) => setPaymentDraft((current) => ({ ...current, stripePublishableKey: event.target.value }))} placeholder="pk_test_... or pk_live_..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label></> : null}
              {paymentDraft.paymentProvider === 'ZEFFY' ? <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Zeffy API Key {selectedCampaign?.hasZeffyApiKey ? <span className="ml-2 text-xs text-emerald-700">Configured</span> : null}<input type="password" autoComplete="new-password" required={!selectedCampaign?.hasZeffyApiKey} value={paymentDraft.zeffyApiKey} onChange={(event) => setPaymentDraft((current) => ({ ...current, zeffyApiKey: event.target.value }))} placeholder={selectedCampaign?.hasZeffyApiKey ? 'Leave blank to keep the saved key' : ''} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setPaymentModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={paymentMutation.isPending} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{paymentMutation.isPending ? 'Saving…' : 'Save Payment Setup'}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default AdminBookingsPage;