import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellAlertIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  XMarkIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import eventService from '../../services/eventService';
import volunteerService from '../../services/volunteerService';
import userService from '../../services/userService';
import donationService from '../../services/donationService';
import cmsService from '../../services/cmsService';
import newsService from '../../services/newsService';
import sponsorService from '../../services/sponsorService';
import advertisementService from '../../services/advertisementService';
import phase2Service from '../../services/phase2Service';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend);

const TREND_RANGE_OPTIONS = [
  { value: '7d', label: '7D', unit: 'day', amount: 7, heading: 'Last 7 days' },
  { value: '30d', label: '30D', unit: 'day', amount: 30, heading: 'Last 30 days' },
  { value: '60d', label: '60D', unit: 'day', amount: 60, heading: 'Last 60 days' },
  { value: '90d', label: '90D', unit: 'day', amount: 90, heading: 'Last 90 days' },
  { value: '6m', label: '6M', unit: 'month', amount: 6, heading: 'Last 6 months' },
  { value: '1y', label: '1Y', unit: 'month', amount: 12, heading: 'Last 1 year' }
];

const toDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getExactEventRegistrationCount = (event = {}) => {
  if (Array.isArray(event.registrants)) {
    return event.registrants.length;
  }
  return 0;
};

const toValidDateKey = (value) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return toDateKey(parsed);
};

const toMonthKey = (value) => {
  if (!value) {
    return '';
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildTrendBuckets = (rangeOption) => {
  const now = new Date();
  if (rangeOption.unit === 'month') {
    return Array.from({ length: rangeOption.amount }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (rangeOption.amount - 1 - index), 1);
      const key = toMonthKey(date);
      const label = date.toLocaleDateString('en-CA', {
        month: 'short',
        ...(rangeOption.amount > 6 ? { year: '2-digit' } : {})
      });
      return { key, label };
    });
  }

  return Array.from({ length: rangeOption.amount }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (rangeOption.amount - 1 - index));
    const key = toDateKey(date);
    const label = date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    return { key, label };
  });
};

const getTickStrideForRange = (rangeOption) => {
  if (!rangeOption || rangeOption.unit !== 'day' || rangeOption.amount <= 30) {
    return 1;
  }

  return Math.max(2, Math.ceil(rangeOption.amount / 15));
};

const EmptyState = ({ text }) => <p className="text-sm text-slate-500">{text}</p>;

const ROLE_COLORS = {
  Family: '#0ea5e9',
  'Super Admin': '#0B4EA2',
  Admin: '#1d4ed8',
  Member: '#f4a300',
  Volunteer: '#10b981'
};

const TREND_LINE_COLORS = [
  '#0B4EA2',
  '#F4A300',
  '#10b981',
  '#f97316',
  '#7c3aed',
  '#06b6d4',
  '#ef4444',
  '#84cc16'
];

const WHATSAPP_EDIT_ROLES = new Set(['Super Admin', 'Admin']);

const getRoleColor = (role = '', index = 0) => {
  const normalizedRole = String(role || '').trim();
  if (ROLE_COLORS[normalizedRole]) {
    return ROLE_COLORS[normalizedRole];
  }

  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue} 72% 46%)`;
};

const AdminDashboardPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const todayDateKey = toDateKey(new Date());
  const [selectedDonationTrendRange, setSelectedDonationTrendRange] = useState('7d');
  const [selectedEventTrendRange, setSelectedEventTrendRange] = useState('7d');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppDraftLink, setWhatsAppDraftLink] = useState('');
  const [whatsAppModalError, setWhatsAppModalError] = useState('');
  const liveQueryOptions = {
    staleTime: 8 * 1000,
    refetchInterval: 12 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  };

  const { data: events = [] } = useQuery({ queryKey: ['events', 'admin'], queryFn: () => eventService.getEvents({ includeInactive: true }).then((res) => res.data), ...liveQueryOptions });
  const { data: donations = [] } = useQuery({ queryKey: ['admin-donations'], queryFn: () => donationService.getDonations().then((res) => res.data), ...liveQueryOptions });
  const { data: campaigns = [] } = useQuery({ queryKey: ['admin-campaigns'], queryFn: () => donationService.getAllCampaigns().then((res) => res.data), ...liveQueryOptions });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => userService.getUsers().then((res) => res.data), ...liveQueryOptions });
  const { data: volunteerApplications = [] } = useQuery({ queryKey: ['admin-volunteers'], queryFn: () => volunteerService.getApplications().then((res) => res.data), ...liveQueryOptions });
  const { data: cmsData } = useQuery({ queryKey: ['cms-home'], queryFn: () => cmsService.getHomeContent().then((res) => res.data), ...liveQueryOptions });
  const { data: newsArticles = [] } = useQuery({ queryKey: ['news-articles'], queryFn: () => newsService.getArticles().then((res) => res.data), ...liveQueryOptions });
  const { data: sponsors = [] } = useQuery({ queryKey: ['admin-sponsors'], queryFn: () => sponsorService.getSponsors().then((res) => res.data), ...liveQueryOptions });
  const { data: advertisements = [] } = useQuery({ queryKey: ['admin-advertisements'], queryFn: () => advertisementService.getAds().then((res) => res.data), ...liveQueryOptions });
  const { data: phase2ChannelsConfig } = useQuery({
    queryKey: ['phase2-channels-config-admin-dashboard'],
    queryFn: () => phase2Service.getChannelsConfig().then((res) => res.data || null),
    staleTime: 60 * 1000,
    retry: false
  });

  const whatsAppJoinLink = String(phase2ChannelsConfig?.whatsAppJoinLink || '').trim();
  const showWhatsAppPill = phase2ChannelsConfig?.whatsAppOptInEnabled === true && whatsAppJoinLink.length > 0;
  const canEditWhatsAppLink = WHATSAPP_EDIT_ROLES.has(String(user?.role || '').trim());

  const updateWhatsAppLinkMutation = useMutation({
    mutationFn: async (nextLink) => {
      const normalizedLink = String(nextLink || '').trim();
      if (!normalizedLink) {
        throw new Error('Please enter a WhatsApp invite link.');
      }

      const currentConfig = phase2ChannelsConfig && typeof phase2ChannelsConfig === 'object' ? phase2ChannelsConfig : {};
      const payload = {
        ...currentConfig,
        whatsAppOptInEnabled: true,
        whatsAppJoinLink: normalizedLink
      };

      return phase2Service.setChannelsConfig(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['phase2-channels-config-admin-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['phase2-channels-config-footer'] })
      ]);
      setIsWhatsAppModalOpen(false);
      setWhatsAppModalError('');
    },
    onError: (error) => {
      setWhatsAppModalError(String(error?.message || 'Unable to save WhatsApp link right now.'));
    }
  });

  const openWhatsAppModal = () => {
    if (!canEditWhatsAppLink) {
      return;
    }
    setWhatsAppDraftLink(whatsAppJoinLink);
    setWhatsAppModalError('');
    setIsWhatsAppModalOpen(true);
  };

  const handleSaveWhatsAppLink = (event) => {
    event.preventDefault();
    setWhatsAppModalError('');
    updateWhatsAppLinkMutation.mutate(whatsAppDraftLink);
  };

  const pendingUsers = useMemo(
    () => users.filter((user) => String(user.approvalStatus || 'pending').toLowerCase() === 'pending'),
    [users]
  );

  const familyJoinKpi = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const families = users.filter((entry) => String(entry.role || '').trim().toLowerCase() === 'family');

    let joinedThisMonth = 0;
    let joinedThisYear = 0;

    families.forEach((entry) => {
      const created = new Date(entry.createdAt || 0);
      if (Number.isNaN(created.getTime())) {
        return;
      }

      if (created.getFullYear() === year) {
        joinedThisYear += 1;
        if (created.getMonth() === month) {
          joinedThisMonth += 1;
        }
      }
    });

    return {
      totalFamilies: families.length,
      joinedThisMonth,
      joinedThisYear
    };
  }, [users]);

  const pendingVolunteers = useMemo(
    () => volunteerApplications.filter((entry) => String(entry.status || 'pending').toLowerCase() === 'pending'),
    [volunteerApplications]
  );

  const upcomingEvents = useMemo(() => {
    return [...events]
      .filter((event) => Boolean(event.active))
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
      .slice(0, 4);
  }, [events]);

  const latestDonations = useMemo(() => {
    return [...donations]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
      .slice(0, 5);
  }, [donations]);

  const donationTotal = useMemo(
    () => donations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0),
    [donations]
  );

  const averageDonation = useMemo(
    () => (donations.length > 0 ? donationTotal / donations.length : 0),
    [donationTotal, donations.length]
  );

  const thisMonthDonationAmount = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return donations.reduce((sum, donation) => {
      const date = new Date(donation.createdAt || donation.updatedAt || Date.now());
      if (Number.isNaN(date.getTime()) || date.getMonth() !== month || date.getFullYear() !== year) {
        return sum;
      }
      return sum + Number(donation.amount || 0);
    }, 0);
  }, [donations]);

  const exactEventRegistrations = useMemo(
    () => events.reduce((sum, event) => sum + getExactEventRegistrationCount(event), 0),
    [events]
  );

  const activeEventCount = useMemo(
    () => events.filter((event) => Boolean(event.active)).length,
    [events]
  );

  const approvedUsersCount = useMemo(
    () => users.filter((user) => String(user.approvalStatus || '').toLowerCase() === 'approved').length,
    [users]
  );

  const approvedVolunteerApplications = useMemo(
    () => volunteerApplications.filter((entry) => String(entry.status || '').toLowerCase() === 'approved').length,
    [volunteerApplications]
  );

  const volunteerApprovalRate = useMemo(
    () => (volunteerApplications.length > 0 ? (approvedVolunteerApplications / volunteerApplications.length) * 100 : 0),
    [approvedVolunteerApplications, volunteerApplications.length]
  );

  const pendingApprovalsCount = useMemo(
    () => pendingUsers.length + pendingVolunteers.length,
    [pendingUsers.length, pendingVolunteers.length]
  );

  const activeCampaignCount = useMemo(
    () => campaigns.filter((item) => item.isActive).length,
    [campaigns]
  );

  const liveNewsCount = useMemo(
    () => newsArticles.filter((item) => item.active).length,
    [newsArticles]
  );

  const donationsLast24Hours = useMemo(() => {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    return donations.filter((entry) => {
      const created = new Date(entry.createdAt || entry.updatedAt || 0).getTime();
      return Number.isFinite(created) && created >= cutoff;
    }).length;
  }, [donations]);

  const registrationsLast24Hours = useMemo(() => {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    return events.reduce((sum, event) => {
      const registrants = Array.isArray(event.registrants) ? event.registrants : [];
      const count = registrants.filter((entry) => {
        const created = new Date(entry.createdAt || 0).getTime();
        return Number.isFinite(created) && created >= cutoff;
      }).length;
      return sum + count;
    }, 0);
  }, [events]);

  const newUsersLast7Days = useMemo(() => {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return users.filter((entry) => {
      const created = new Date(entry.createdAt || 0).getTime();
      return Number.isFinite(created) && created >= cutoff;
    }).length;
  }, [users]);

  const latestActivityLabel = useMemo(() => {
    const timestamps = [
      ...donations.map((entry) => new Date(entry.updatedAt || entry.createdAt || 0).getTime()),
      ...users.map((entry) => new Date(entry.updatedAt || entry.createdAt || 0).getTime()),
      ...volunteerApplications.map((entry) => new Date(entry.updatedAt || entry.createdAt || 0).getTime()),
      ...events.map((entry) => new Date(entry.updatedAt || entry.createdAt || entry.date || 0).getTime())
    ].filter((value) => Number.isFinite(value) && value > 0);

    if (timestamps.length === 0) {
      return 'No recent backend activity';
    }

    const latest = new Date(Math.max(...timestamps));
    return `Latest backend update: ${latest.toLocaleString()}`;
  }, [donations, events, users, volunteerApplications]);

  const roleBreakdown = useMemo(() => {
    const counts = {};
    users.forEach((user) => {
      const role = String(user.role || '').trim() || 'Member';
      counts[role] = (counts[role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const orderedRoleEntries = useMemo(
    () => Object.entries(roleBreakdown).sort((left, right) => right[1] - left[1]),
    [roleBreakdown]
  );

  const campaignBreakdown = useMemo(() => {
    const map = {};
    donations.forEach((donation) => {
      const key = donation.campaignName || 'General Donation';
      map[key] = (map[key] || 0) + Number(donation.amount || 0);
    });
    return map;
  }, [donations]);

  const selectedDonationTrendRangeOption = useMemo(
    () => TREND_RANGE_OPTIONS.find((entry) => entry.value === selectedDonationTrendRange) || TREND_RANGE_OPTIONS[0],
    [selectedDonationTrendRange]
  );

  const selectedEventTrendRangeOption = useMemo(
    () => TREND_RANGE_OPTIONS.find((entry) => entry.value === selectedEventTrendRange) || TREND_RANGE_OPTIONS[0],
    [selectedEventTrendRange]
  );

  const donationTrendBuckets = useMemo(
    () => buildTrendBuckets(selectedDonationTrendRangeOption),
    [selectedDonationTrendRangeOption]
  );

  const eventTrendBuckets = useMemo(
    () => buildTrendBuckets(selectedEventTrendRangeOption),
    [selectedEventTrendRangeOption]
  );

  const donationCampaignTrend = useMemo(() => {
    const indexByBucketKey = donationTrendBuckets.reduce((acc, bucket, index) => {
      acc[bucket.key] = index;
      return acc;
    }, {});

    const seriesByCampaign = {};
    donations.forEach((donation) => {
      const createdAt = donation.createdAt || donation.updatedAt || '';
      const key = selectedDonationTrendRangeOption.unit === 'month'
        ? toMonthKey(createdAt)
        : toValidDateKey(createdAt);
      const bucketIndex = indexByBucketKey[key];
      if (bucketIndex === undefined) {
        return;
      }

      const campaignName = String(
        donation.campaignName
        || campaigns.find((campaign) => String(campaign.id) === String(donation.campaignId))?.name
        || 'General Donation'
      );

      if (!seriesByCampaign[campaignName]) {
        seriesByCampaign[campaignName] = Array.from({ length: donationTrendBuckets.length }, () => 0);
      }

      seriesByCampaign[campaignName][bucketIndex] += Number(donation.amount || 0);
    });

    const entries = Object.entries(seriesByCampaign)
      .sort((left, right) => right[1].reduce((sum, value) => sum + value, 0) - left[1].reduce((sum, value) => sum + value, 0));

    return {
      labels: donationTrendBuckets.map((bucket) => bucket.label),
      datasets: entries.map(([campaignName, values], index) => ({
        label: campaignName,
        data: values,
        backgroundColor: `${TREND_LINE_COLORS[index % TREND_LINE_COLORS.length]}CC`,
        borderColor: TREND_LINE_COLORS[index % TREND_LINE_COLORS.length],
        borderWidth: 1,
        borderRadius: 3,
        categoryPercentage: 0.62,
        barPercentage: 0.5,
        maxBarThickness: 10
      }))
    };
  }, [campaigns, donationTrendBuckets, donations, selectedDonationTrendRangeOption]);

  const eventRegistrationsTrend = useMemo(() => {
    const buckets = eventTrendBuckets.map((bucket) => ({ ...bucket, registrations: 0 }));

    const bucketMap = buckets.reduce((acc, row) => {
      acc[row.key] = row;
      return acc;
    }, {});

    events.forEach((event) => {
      const registrants = Array.isArray(event.registrants) ? event.registrants : [];
      registrants.forEach((registrant) => {
        const key = selectedEventTrendRangeOption.unit === 'month'
          ? toMonthKey(registrant.createdAt)
          : toValidDateKey(registrant.createdAt);
        if (!bucketMap[key]) {
          return;
        }
        bucketMap[key].registrations += 1;
      });
    });

    return {
      labels: buckets.map((bucket) => bucket.label),
      values: buckets.map((bucket) => bucket.registrations)
    };
  }, [eventTrendBuckets, events, selectedEventTrendRangeOption]);

  const resolvedScheduleDay = useMemo(() => {
    const scheduleDays = Array.isArray(cmsData?.scheduleDays) ? cmsData.scheduleDays : [];
    return scheduleDays.find((day) => day.dateKey === todayDateKey)
      || scheduleDays.find((day) => day.dateKey === 'default')
      || null;
  }, [cmsData, todayDateKey]);

  const todayScheduleCount = Array.isArray(resolvedScheduleDay?.entries) ? resolvedScheduleDay.entries.length : 0;
  const highlightedScheduleItems = Array.isArray(resolvedScheduleDay?.entries)
    ? resolvedScheduleDay.entries.filter((entry) => entry.isHighlighted)
    : [];
  const activeSponsorsCount = useMemo(
    () => sponsors.filter((entry) => entry.active).length,
    [sponsors]
  );
  const activeAdvertisements = useMemo(
    () => advertisements.filter((entry) => entry.active),
    [advertisements]
  );
  const activeAdPlacementCount = useMemo(
    () => new Set(activeAdvertisements.map((entry) => String(entry.placement || '').trim()).filter(Boolean)).size,
    [activeAdvertisements]
  );

  const eventChartData = {
    labels: eventRegistrationsTrend.labels,
    datasets: [
      {
        label: 'Event Registrations',
        data: eventRegistrationsTrend.values,
        borderColor: '#0B4EA2',
        backgroundColor: 'rgba(11,78,162,0.24)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
        stack: 'events'
      }
    ]
  };

  const donationTickStride = getTickStrideForRange(selectedDonationTrendRangeOption);
  const eventTickStride = getTickStrideForRange(selectedEventTrendRangeOption);

  const roleChartData = {
    labels: orderedRoleEntries.map(([role]) => role),
    datasets: [
      {
        data: orderedRoleEntries.map(([, count]) => count),
        backgroundColor: orderedRoleEntries.map(([role], index) => getRoleColor(role, index)),
        borderWidth: 0
      }
    ]
  };

  const roleLegendItems = orderedRoleEntries.map(([role, count], index) => ({
    role,
    count,
    color: getRoleColor(role, index)
  }));

  const campaignChartData = {
    labels: Object.keys(campaignBreakdown),
    datasets: [
      {
        label: 'Raised',
        data: Object.values(campaignBreakdown),
        backgroundColor: ['#0B4EA2', '#F4A300', '#14b8a6', '#ef4444', '#8b5cf6'],
        borderRadius: 10
      }
    ]
  };

  return (
    <div className="admin-dashboard-shell space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#eff6ff,_#ffffff_40%,_#fff7ed)] p-6 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.55)]">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin Command Center</p>
            <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-900">Busy, clear, and ready for daily seva operations.</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">Track donations, approvals, schedule changes, volunteer demand, and upcoming programs from one place. This dashboard is built to tell you what needs attention first.</p>
            <p className="mt-2 inline-flex rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 text-[11px] font-semibold text-brand-blue">{latestActivityLabel}</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" className="px-3 py-1.5 text-xs" onClick={() => window.location.assign('/admin/schedule')}>Update Today&apos;s Schedule</Button>
              <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => window.location.assign('/admin/donations')}>Review Donations</Button>
              <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => window.location.assign('/admin/users')}>Open User Queue</Button>
            </div>

            {canEditWhatsAppLink ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={openWhatsAppModal}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-500 bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/25 transition hover:-translate-y-0.5"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5" />
                  <span>{showWhatsAppPill ? 'Join WhatsApp Sangat Group' : 'Set WhatsApp Sangat Group Link'}</span>
                  <PencilSquareIcon className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Link to="/admin/events" className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Manage Events</Link>
              <Link to="/admin/seva-opportunities" className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Review Seva Applications</Link>
              <Link to="/admin/news" className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Publish News and Updates</Link>
              <Link to="/admin/library" className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Update Library Resources</Link>
              <Link to="/admin/roles-access" className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Tune Role Access Controls</Link>
              <Link to="/admin/audit-trail" className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Inspect Activity Timeline</Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operations Snapshot</p>
              <div className="mt-3 border-y border-slate-200">
                <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
                  <span className="text-slate-500">Today&apos;s Schedule Items</span>
                  <span className="font-semibold text-slate-900">{todayScheduleCount}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Attention Needed</span>
                  <span className="font-semibold text-rose-600">{pendingApprovalsCount}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Event Registrations</span>
                  <span className="font-semibold text-slate-900">{exactEventRegistrations}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Active Events</span>
                  <span className="font-semibold text-slate-900">{activeEventCount}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Registrations in Last 24h</span>
                  <span className="font-semibold text-brand-blue">{registrationsLast24Hours}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Donations in Last 24h</span>
                  <span className="font-semibold text-emerald-700">{donationsLast24Hours}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">New Users in Last 7d</span>
                  <span className="font-semibold text-violet-700">{newUsersLast7Days}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Live News Articles</span>
                  <span className="font-semibold text-slate-900">{liveNewsCount}</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
                  <span className="text-slate-500">Active Donation Campaigns</span>
                  <span className="font-semibold text-slate-900">{activeCampaignCount}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {resolvedScheduleDay?.highlightTitle || resolvedScheduleDay?.highlightNoteEn
                  ? `${resolvedScheduleDay?.highlightTitle || 'Schedule update'}: ${resolvedScheduleDay?.highlightNoteEn || 'Highlighted daily note is active.'}`
                  : 'No active special-day note right now.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {canEditWhatsAppLink && isWhatsAppModalOpen ? (
        <div className="fixed inset-0 z-[160] bg-slate-900/45 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-lg font-bold text-slate-900">WhatsApp Sangat Group Link</h3>
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="rounded-full border border-slate-300 p-1 text-slate-600 hover:bg-slate-100"
                  aria-label="Close WhatsApp link modal"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <form className="mt-3 space-y-3" onSubmit={handleSaveWhatsAppLink}>
                <label className="block text-sm font-semibold text-slate-700">
                  Invite Link
                  <input
                    type="url"
                    value={whatsAppDraftLink}
                    onChange={(event) => setWhatsAppDraftLink(event.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                {whatsAppModalError ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{whatsAppModalError}</p>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsWhatsAppModalOpen(false)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateWhatsAppLinkMutation.isPending}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {updateWhatsAppLinkMutation.isPending ? 'Saving...' : 'Save Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-emerald-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Finance</p>
              <h2 className="mt-1 truncate font-heading text-xl font-semibold text-slate-900">Donation Health</h2>
            </div>
            <Link to="/admin/donations" className="text-xs font-semibold text-brand-blue hover:underline">Open</Link>
          </div>
          <div className="mt-3 border-y border-slate-200">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="text-slate-500">Total Raised</span>
              <span className="font-semibold text-emerald-700">{formatCurrency(donationTotal)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">This Month</span>
              <span className="font-semibold text-slate-900">{formatCurrency(thisMonthDonationAmount)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Avg Donation</span>
              <span className="font-semibold text-slate-900">{formatCurrency(averageDonation)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Active Campaigns</span>
              <span className="font-semibold text-slate-900">{activeCampaignCount}</span>
            </div>
          </div>
        </Card>

        <Card className="border border-blue-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">People</p>
              <h2 className="mt-1 truncate font-heading text-xl font-semibold text-slate-900">Users &amp; Seva Queue</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-semibold leading-tight sm:text-xs">
              <Link to="/admin/users" className="text-brand-blue hover:underline">Users</Link>
              <Link to="/admin/seva-opportunities" className="text-brand-blue hover:underline">Seva</Link>
            </div>
          </div>
          <div className="mt-3 border-y border-slate-200">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="text-slate-500">Approved Users</span>
              <span className="font-semibold text-slate-900">{approvedUsersCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Pending User Approval</span>
              <span className="font-semibold text-amber-700">{pendingUsers.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Volunteer Applications</span>
              <span className="font-semibold text-slate-900">{volunteerApplications.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Volunteer Approval Rate</span>
              <span className="font-semibold text-slate-900">{volunteerApprovalRate.toFixed(0)}%</span>
            </div>
          </div>
        </Card>

        <Card className="border border-amber-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Programs</p>
              <h2 className="mt-1 truncate font-heading text-xl font-semibold text-slate-900">Events &amp; Schedule</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-semibold leading-tight sm:text-xs">
              <Link to="/admin/events" className="text-brand-blue hover:underline">Events</Link>
              <Link to="/admin/schedule" className="text-brand-blue hover:underline">Schedule</Link>
            </div>
          </div>
          <div className="mt-3 border-y border-slate-200">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="text-slate-500">Active Events</span>
              <span className="font-semibold text-slate-900">{activeEventCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Upcoming Events</span>
              <span className="font-semibold text-slate-900">{upcomingEvents.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Event Registrations</span>
              <span className="font-semibold text-slate-900">{exactEventRegistrations}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Today&apos;s Schedule</span>
              <span className="font-semibold text-slate-900">{todayScheduleCount} ({highlightedScheduleItems.length} highlighted)</span>
            </div>
          </div>
        </Card>

        <Card className="border border-violet-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Content &amp; Partners</p>
              <h2 className="mt-1 truncate font-heading text-xl font-semibold text-slate-900">Publishing Pipeline</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-semibold leading-tight sm:text-xs">
              <Link to="/admin/news" className="text-brand-blue hover:underline">News</Link>
              <Link to="/admin/sponsors" className="text-brand-blue hover:underline">Sponsors</Link>
            </div>
          </div>
          <div className="mt-3 border-y border-slate-200">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="text-slate-500">Live News Articles</span>
              <span className="font-semibold text-slate-900">{liveNewsCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Active Sponsors</span>
              <span className="font-semibold text-slate-900">{activeSponsorsCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Active Advertisers</span>
              <span className="font-semibold text-slate-900">{activeAdvertisements.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Ad Placements In Use</span>
              <span className="font-semibold text-slate-900">{activeAdPlacementCount}</span>
            </div>
          </div>
          <div className="mt-2 text-right">
            <Link to="/admin/advertisements" className="text-xs font-semibold text-brand-blue hover:underline">Manage advertisements</Link>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border border-brand-blue/15 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Family KPI</p>
          <p className="mt-3 font-heading text-3xl font-bold text-brand-blue">{familyJoinKpi.totalFamilies}</p>
          <p className="mt-2 text-sm text-slate-500">Total family accounts in the system</p>
        </Card>
        <Card className="border border-emerald-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Families Joined This Month</p>
          <p className="mt-3 font-heading text-3xl font-bold text-emerald-700">{familyJoinKpi.joinedThisMonth}</p>
          <p className="mt-2 text-sm text-slate-500">New family registrations this month</p>
        </Card>
        <Card className="border border-amber-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Families Joined This Year</p>
          <p className="mt-3 font-heading text-3xl font-bold text-amber-700">{familyJoinKpi.joinedThisYear}</p>
          <p className="mt-2 text-sm text-slate-500">Family registrations recorded this year</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <Card className="admin-dashboard-card border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Donations by Campaign</p>
                <h2 className="truncate font-heading text-2xl font-semibold text-slate-900">{selectedDonationTrendRangeOption.heading} (actual records)</h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {TREND_RANGE_OPTIONS.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setSelectedDonationTrendRange(entry.value)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${selectedDonationTrendRange === entry.value ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 h-[320px]">
              {donationCampaignTrend.datasets.length > 0 ? (
                <Bar
                  data={donationCampaignTrend}
                  options={{
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: {
                        position: 'bottom',
                        align: 'center'
                      }
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        stacked: false,
                        ticks: {
                          callback: (value, index) => (index % donationTickStride === 0 ? donationCampaignTrend.labels[index] : '')
                        }
                      },
                      y: {
                        beginAtZero: true,
                        stacked: false
                      }
                    }
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-slate-500">No donation records available yet.</div>
              )}
            </div>
          </Card>

          <Card className="admin-dashboard-card border border-slate-200 bg-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Event Registrations</p>
              <h2 className="truncate font-heading text-2xl font-semibold text-slate-900">{selectedEventTrendRangeOption.heading} (actual records)</h2>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {TREND_RANGE_OPTIONS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setSelectedEventTrendRange(entry.value)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${selectedEventTrendRange === entry.value ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="mt-5 h-[260px]">
              <Line
                data={eventChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      grid: { display: false },
                      stacked: true,
                      ticks: {
                        callback: (value, index) => (index % eventTickStride === 0 ? eventChartData.labels[index] : '')
                      }
                    },
                    y: {
                      beginAtZero: true,
                      stacked: true,
                      ticks: { precision: 0 }
                    }
                  }
                }}
              />
            </div>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="admin-dashboard-card border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role Distribution</p>
                <h2 className="truncate font-heading text-xl font-semibold text-slate-900">Type of Users</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{users.length} users</span>
            </div>
            <div className="mx-auto mt-4 h-[200px] w-full max-w-[220px]">
              <Doughnut
                data={roleChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  cutout: '68%'
                }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {roleLegendItems.map((item) => (
                <span key={item.role} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.role}</span>
                  <span className="text-slate-500">{item.count}</span>
                </span>
              ))}
            </div>
          </Card>

          <Card className="admin-dashboard-card border border-slate-200 bg-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Queue</p>
            <h2 className="mt-1 truncate font-heading text-xl font-semibold text-slate-900">Pending review</h2>
            <div className="mt-4 border-y border-slate-200">
              {pendingUsers.length === 0 && pendingVolunteers.length === 0 ? (
                <div className="py-3"><EmptyState text="No pending approvals right now." /></div>
              ) : null}
              {pendingUsers.slice(0, 3).map((user) => (
                <div key={user.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 first:border-t-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{user.role}</p>
                </div>
              ))}
              {pendingVolunteers.slice(0, 2).map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 first:border-t-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.sevaType || entry.area || 'Volunteer'}</p>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Volunteer</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <Card className="admin-dashboard-card border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Campaign Momentum</p>
              <h2 className="truncate font-heading text-xl font-semibold text-slate-900">Donation spread</h2>
            </div>
            <Link to="/admin/donations" className="text-sm font-semibold text-brand-blue hover:underline">Open Donations</Link>
          </div>
          <div className="mt-4 h-[260px]">
            {Object.keys(campaignBreakdown).length > 0 ? (
              <Bar
                data={campaignChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true }
                  }
                }}
              />
            ) : (
              <EmptyState text="No donation records available yet." />
            )}
          </div>
        </Card>

        <Card className="admin-dashboard-card border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent Donations</p>
              <h2 className="truncate font-heading text-xl font-semibold text-slate-900">Latest donor activity</h2>
            </div>
            <BellAlertIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 border-y border-slate-200">
            {latestDonations.length === 0 ? (
              <div className="py-3"><EmptyState text="No donations recorded yet." /></div>
            ) : latestDonations.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-200 py-2 first:border-t-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{entry.donorName || 'Anonymous'}</p>
                  <p className="mt-1 text-xs text-slate-500">{entry.campaignName || 'General Donation'}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(entry.amount || 0)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="admin-dashboard-card border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Publishing Overview</p>
              <h2 className="truncate font-heading text-xl font-semibold text-slate-900">Content pulse</h2>
            </div>
            <SparklesIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 border-y border-slate-200">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="text-slate-500">News Articles Live / Total</span>
              <span className="font-semibold text-slate-900">{liveNewsCount} / {newsArticles.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Active Campaigns / Total</span>
              <span className="font-semibold text-slate-900">{activeCampaignCount} / {campaigns.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Highlighted Schedule Items</span>
              <span className="font-semibold text-slate-900">{highlightedScheduleItems.length}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="admin-dashboard-card border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Upcoming Calendar</p>
              <h2 className="truncate font-heading text-xl font-semibold text-slate-900">What&apos;s next</h2>
            </div>
            <Link to="/admin/events" className="text-sm font-semibold text-brand-blue hover:underline">Manage events</Link>
          </div>
          <div className="mt-4 border-y border-slate-200">
            {upcomingEvents.length === 0 ? (
              <div className="py-3"><EmptyState text="No upcoming events available." /></div>
            ) : upcomingEvents.map((event) => (
              <div key={event.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-200 py-2 first:border-t-0">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(event.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} • {event.location}</p>
                </div>
                <span className="text-xs font-semibold text-slate-600">{getExactEventRegistrationCount(event)} registrations</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="admin-dashboard-card border border-slate-200 bg-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operational Snapshot</p>
          <h2 className="mt-1 truncate font-heading text-xl font-semibold text-slate-900">Live backend values</h2>
          <div className="mt-4 border-y border-slate-200">
            <div className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="text-slate-500">Event Registrations</span>
              <span className="font-semibold text-slate-900">{exactEventRegistrations}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Donations Received</span>
              <span className="font-semibold text-slate-900">{formatCurrency(donationTotal)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Donation Records</span>
              <span className="font-semibold text-slate-900">{donations.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Volunteer Applications</span>
              <span className="font-semibold text-slate-900">{volunteerApplications.length}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Pending Approvals</span>
              <span className="font-semibold text-slate-900">{pendingApprovalsCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Active Events</span>
              <span className="font-semibold text-slate-900">{activeEventCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Active Campaigns</span>
              <span className="font-semibold text-slate-900">{activeCampaignCount}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-200 py-2 text-sm">
              <span className="text-slate-500">Live News Articles</span>
              <span className="font-semibold text-slate-900">{liveNewsCount}</span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
