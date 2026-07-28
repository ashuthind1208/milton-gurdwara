import { useEffect, useMemo, useRef, useState } from 'react';
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
const OPPORTUNITIES_PAGE_SIZE = 10;
const VOLUNTEERS_MODAL_PAGE_SIZE = 8;

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

const getDaysRemainingMeta = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { label: 'Expiry unknown', tone: 'neutral' };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Expiry unknown', tone: 'neutral' };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`,
      tone: 'overdue'
    };
  }

  return {
    label: `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`,
    tone: 'remaining'
  };
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
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [opportunityStatusFilter, setOpportunityStatusFilter] = useState('all');
  const [opportunitiesPage, setOpportunitiesPage] = useState(1);
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [volunteerPage, setVolunteerPage] = useState(1);
  const [marqueePills, setMarqueePills] = useState([]);
  const marqueeRailRef = useRef(null);

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

  const filteredVolunteers = useMemo(() => {
    const query = String(volunteerSearch || '').trim().toLowerCase();
    if (!query) {
      return selectedVolunteers;
    }

    return selectedVolunteers.filter((entry) => {
      const haystack = [
        entry?.name,
        entry?.email,
        entry?.phone,
        entry?.status,
        entry?.contactPreference
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [selectedVolunteers, volunteerSearch]);

  const volunteerTotalPages = Math.max(1, Math.ceil(filteredVolunteers.length / VOLUNTEERS_MODAL_PAGE_SIZE));
  const visibleVolunteers = useMemo(() => {
    const start = (volunteerPage - 1) * VOLUNTEERS_MODAL_PAGE_SIZE;
    return filteredVolunteers.slice(start, start + VOLUNTEERS_MODAL_PAGE_SIZE);
  }, [filteredVolunteers, volunteerPage]);

  const confirmedVolunteersCount = useMemo(
    () => selectedVolunteers.filter((entry) => String(entry?.status || 'confirmed').toLowerCase() !== 'waitlisted').length,
    [selectedVolunteers]
  );

  const totalRequiredVolunteers = Number(viewOpportunity?.totalVolunteersRequired || 10);
  const remainingVolunteers = Math.max(0, totalRequiredVolunteers - confirmedVolunteersCount);
  const expiryMeta = useMemo(
    () => getDaysRemainingMeta(viewOpportunity?.expiryDate || viewOpportunity?.date),
    [viewOpportunity?.date, viewOpportunity?.expiryDate]
  );

  const viewHeaderPills = useMemo(() => {
    if (!viewOpportunity) {
      return [];
    }

    return [
      {
        key: 'status',
        text: `Status: ${viewOpportunity.status === 'closed' ? 'Closed' : viewOpportunity.active ? 'Active' : 'Inactive'}`,
        className: viewOpportunity.status === 'closed'
          ? 'border-rose-200/80 bg-rose-500/20 text-rose-50'
          : viewOpportunity.active
            ? 'border-emerald-200/80 bg-emerald-500/20 text-emerald-50'
            : 'border-slate-200/80 bg-slate-500/20 text-slate-100'
      },
      {
        key: 'datetime',
        text: `Date & Time: ${formatDisplayDate(viewOpportunity.date)} | ${viewOpportunity.time || '-'}`,
        className: 'border-sky-200/80 bg-sky-500/20 text-sky-50'
      },
      {
        key: 'waitlist',
        text: `Waitlist: ${viewOpportunity.waitlistEnabled === false ? 'Disabled' : 'Enabled'}`,
        className: viewOpportunity.waitlistEnabled === false
          ? 'border-slate-200/80 bg-slate-500/20 text-slate-100'
          : 'border-emerald-200/80 bg-emerald-500/20 text-emerald-50'
      },
      {
        key: 'expiry',
        text: `Expiry: ${expiryMeta.label}`,
        className: expiryMeta.tone === 'overdue'
          ? 'border-rose-200/80 bg-rose-500/20 text-rose-50'
          : expiryMeta.tone === 'remaining'
            ? 'border-amber-200/80 bg-amber-500/20 text-amber-50'
            : 'border-slate-200/80 bg-slate-500/20 text-slate-100'
      }
    ];
  }, [expiryMeta.label, expiryMeta.tone, viewOpportunity]);

  useEffect(() => {
    setMarqueePills(viewHeaderPills);
  }, [viewHeaderPills]);

  const filteredOpportunities = useMemo(() => {
    const query = String(opportunitySearch || '').trim().toLowerCase();
    return opportunities.filter((item) => {
      const statusOk = opportunityStatusFilter === 'all'
        ? true
        : opportunityStatusFilter === 'closed'
          ? item.status === 'closed'
          : opportunityStatusFilter === 'active'
            ? item.status !== 'closed' && item.active !== false
            : item.status !== 'closed' && item.active === false;

      if (!statusOk) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item?.sevaType,
        item?.date,
        item?.time,
        item?.expiryDate
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(query);
    });
  }, [opportunities, opportunitySearch, opportunityStatusFilter]);

  const opportunitiesTotalPages = Math.max(1, Math.ceil(filteredOpportunities.length / OPPORTUNITIES_PAGE_SIZE));
  const visibleOpportunities = useMemo(() => {
    const start = (opportunitiesPage - 1) * OPPORTUNITIES_PAGE_SIZE;
    return filteredOpportunities.slice(start, start + OPPORTUNITIES_PAGE_SIZE);
  }, [filteredOpportunities, opportunitiesPage]);

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
      const skippedByReason = result?.data?.skippedByReason || result?.skippedByReason || {};
      const ineligible = Number(skippedByReason?.ineligible || 0);
      const deliveryFailed = Number(skippedByReason?.deliveryFailed || 0);
      const details = skipped > 0
        ? ` (ineligible: ${ineligible}, delivery failed: ${deliveryFailed})`
        : '';
      window.alert(`Reminder email run completed for ${opportunity?.sevaType || 'selected seva'}: ${sent} sent, ${skipped} skipped${details}.`);
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
  const modalShellClass = 'w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]';
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

  useEffect(() => {
    setOpportunitiesPage(1);
  }, [opportunitySearch, opportunityStatusFilter]);

  useEffect(() => {
    if (opportunitiesPage > opportunitiesTotalPages) {
      setOpportunitiesPage(opportunitiesTotalPages);
    }
  }, [opportunitiesPage, opportunitiesTotalPages]);

  useEffect(() => {
    setVolunteerPage(1);
  }, [volunteerSearch, viewOpportunity?.id]);

  useEffect(() => {
    if (volunteerPage > volunteerTotalPages) {
      setVolunteerPage(volunteerTotalPages);
    }
  }, [volunteerPage, volunteerTotalPages]);

  useEffect(() => {
    if (!viewOpportunity || viewHeaderPills.length === 0) {
      return undefined;
    }

    if (!window.matchMedia('(max-width: 639px)').matches) {
      return undefined;
    }

    const railElement = marqueeRailRef.current;

    if (!railElement) {
      return undefined;
    }

    let animationFrameId = 0;
    let lastTimestamp = 0;
    let offset = 0;
    const speedPixelsPerSecond = 46;

    const animate = (timestamp) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const deltaSeconds = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const firstPillElement = railElement.firstElementChild;
      if (firstPillElement) {
        const computedRailStyles = window.getComputedStyle(railElement);
        const railGap = Number.parseFloat(computedRailStyles.columnGap || computedRailStyles.gap || '0') || 0;
        const firstPillWidth = firstPillElement.getBoundingClientRect().width + railGap;

        offset -= speedPixelsPerSecond * deltaSeconds;

        if (firstPillWidth > 0 && offset <= -firstPillWidth) {
          offset += firstPillWidth;
          setMarqueePills((prev) => {
            if (!prev || prev.length <= 1) {
              return prev;
            }
            return [...prev.slice(1), prev[0]];
          });
        }

        railElement.style.transform = `translate3d(${offset}px, 0, 0)`;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    railElement.style.transform = 'translate3d(0, 0, 0)';
    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [viewHeaderPills, viewOpportunity]);

  return (
    <div className="space-y-6">
      {manualReminderMutation.isPending ? (
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
            <p className="mt-3 text-sm font-bold text-slate-900">Please wait, sending emails...</p>
            <p className="mt-1 text-xs text-slate-600">Sending reminders for {manualReminderMutation.variables?.sevaType || 'selected seva opportunity'}.</p>
          </div>
        </div>
      ) : null}

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
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Search
            <input
              type="search"
              value={opportunitySearch}
              onChange={(event) => setOpportunitySearch(event.target.value)}
              placeholder="Search seva type, date, or time"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={opportunityStatusFilter}
              onChange={(event) => setOpportunityStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
        <div className="space-y-3 md:hidden">
          {visibleOpportunities.map((item) => (
            <article key={`mobile-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-slate-800">{item.sevaType || '-'}</p>
                  <p className="text-[11px] leading-snug text-slate-600">{formatDisplayDate(item.date)}</p>
                  <p className="text-[11px] leading-snug text-slate-600">{item.time || '-'}</p>
                  <p className="text-[11px] leading-snug text-slate-600">Volunteers: {(volunteersByOpportunity[item.id] || []).length}/{item.totalVolunteersRequired || 10}</p>
                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getStatusPillClasses(item, false)}`}>
                    {item.status === 'closed' ? 'Closed' : item.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      const itemMenuId = String(item.id || '');
                      setOpenActionMenuId((prev) => (prev === itemMenuId ? '' : itemMenuId));
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                    aria-label="More actions"
                    title="More actions"
                  >
                    <EllipsisVerticalIcon className={actionIconClass} />
                  </button>

                  {openActionMenuId === String(item.id || '') ? (
                    <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          toggleOpportunityStatus(item);
                          setOpenActionMenuId('');
                        }}
                        disabled={item.status === 'closed' || toggleActiveMutation.isPending}
                        className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {item.status === 'closed' ? 'Closed' : item.active ? 'Set Inactive' : 'Set Active'}
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
              </div>
            </article>
          ))}

          {filteredOpportunities.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">No seva opportunities found.</div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto overflow-y-visible md:block">
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
              {visibleOpportunities.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800">
                    {item.sevaType || '-'}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <div className="space-y-0.5 text-left">
                      <p>{formatDisplayDate(item.date)}</p>
                      <p className="text-xs text-slate-600">{item.time || '-'}</p>
                    </div>
                  </td>
                  <td className="py-2 pr-3">{(volunteersByOpportunity[item.id] || []).length}/{item.totalVolunteersRequired || 10}</td>
                  <td className="py-2 pr-3">
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
                  <td className="py-2 pr-3">
                    <div className="relative xl:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const itemMenuId = String(item.id || '');
                          setOpenActionMenuId((prev) => (prev === itemMenuId ? '' : itemMenuId));
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
                        aria-label="More actions"
                        title="More actions"
                      >
                        <EllipsisVerticalIcon className={actionIconClass} />
                      </button>

                      {openActionMenuId === String(item.id || '') ? (
                        <div className="absolute right-0 top-8 z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              toggleOpportunityStatus(item);
                              setOpenActionMenuId('');
                            }}
                            disabled={item.status === 'closed' || toggleActiveMutation.isPending}
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {item.status === 'closed' ? 'Closed' : item.active ? 'Set Inactive' : 'Set Active'}
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

                    <div className="hidden items-center justify-end gap-2 xl:flex">
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
              {filteredOpportunities.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={5}>No seva opportunities found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredOpportunities.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Showing {visibleOpportunities.length} of {filteredOpportunities.length} opportunities</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                disabled={opportunitiesPage <= 1}
                onClick={() => setOpportunitiesPage((prev) => prev - 1)}
              >
                Prev
              </button>
              <span className="text-xs font-semibold text-slate-600">Page {opportunitiesPage} of {opportunitiesTotalPages}</span>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                disabled={opportunitiesPage >= opportunitiesTotalPages}
                onClick={() => setOpportunitiesPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
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
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">Seva Opportunity</p>
                    <h3 className="mt-1 font-heading text-2xl font-extrabold tracking-tight text-brand-saffron sm:text-3xl">
                      {viewOpportunity.sevaType || 'Opportunity Details'}
                    </h3>
                  </div>
                  <button type="button" onClick={closeModals} className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close seva details modal">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 border-t border-white/15 pt-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <div className="min-w-0 w-full overflow-hidden pb-1">
                    <div className="seva-pill-marquee-track sm:hidden">
                      <div ref={marqueeRailRef} className="seva-pill-marquee-rail">
                        {marqueePills.map((pill) => (
                          <span key={`pill-${pill.key}`} className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${pill.className}`}>
                            {pill.text}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="hidden flex-wrap items-center gap-2 sm:flex">
                      {viewHeaderPills.map((pill) => (
                        <span key={`pill-static-${pill.key}`} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${pill.className}`}>
                          {pill.text}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden shrink-0 self-end text-right leading-tight sm:block sm:self-auto">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/90">Remaining</p>
                    <p className="mt-0.5 text-2xl font-extrabold text-brand-saffron">{remainingVolunteers}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className={modalBodyClass}>
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Registered Volunteers</p>
                    <p className="text-xs text-slate-500">Minimal table view for quick management.</p>
                    <div className="mt-2 border-t border-slate-200" />
                  </div>
                  <input
                    type="search"
                    value={volunteerSearch}
                    onChange={(event) => setVolunteerSearch(event.target.value)}
                    placeholder="Search name, email, phone"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 sm:w-64"
                  />
                </div>

                {selectedVolunteers.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">No volunteers registered for this opportunity yet.</p>
                ) : filteredVolunteers.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">No volunteers match your search.</p>
                ) : (
                  <>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">Phone</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleVolunteers.map((entry, index) => (
                            <tr key={entry.id} className={`border-b border-slate-100 last:border-b-0 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                              <td className="px-3 py-2 font-medium text-slate-800">{entry.name || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{entry.email || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{entry.phone || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{entry.status || 'confirmed'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeVolunteerMutation.mutate(entry.id)}
                                  disabled={removeVolunteerMutation.isPending}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600">Showing {visibleVolunteers.length} of {filteredVolunteers.length} matched</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          disabled={volunteerPage <= 1}
                          onClick={() => setVolunteerPage((prev) => prev - 1)}
                        >
                          Prev
                        </button>
                        <span className="text-xs font-semibold text-slate-600">Page {volunteerPage} of {volunteerTotalPages}</span>
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
                          disabled={volunteerPage >= volunteerTotalPages}
                          onClick={() => setVolunteerPage((prev) => prev + 1)}
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
