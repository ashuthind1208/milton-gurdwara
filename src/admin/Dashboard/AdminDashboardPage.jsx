import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowTrendingUpIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  UserGroupIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import analyticsService from '../../services/analyticsService';
import eventService from '../../services/eventService';
import volunteerService from '../../services/volunteerService';
import userService from '../../services/userService';
import donationService from '../../services/donationService';
import cmsService from '../../services/cmsService';
import newsService from '../../services/newsService';
import { formatCurrency } from '../../utils/formatters';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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

const SummaryCard = ({ label, value, sublabel, tone = 'text-slate-900', icon: Icon, href }) => {
  const content = (
    <Card className="border border-slate-200 bg-white/95 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className={`mt-3 font-heading text-3xl font-bold ${tone}`}>{value}</p>
          {sublabel ? <p className="mt-2 text-sm text-slate-500">{sublabel}</p> : null}
        </div>
        {Icon ? (
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </Card>
  );

  if (!href) {
    return content;
  }

  return <Link to={href}>{content}</Link>;
};

const EmptyState = ({ text }) => <p className="text-sm text-slate-500">{text}</p>;

const AdminDashboardPage = () => {
  const todayDateKey = toDateKey(new Date());

  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: () => analyticsService.getMetrics().then((res) => res.data) });
  const { data: trend = [] } = useQuery({ queryKey: ['trend'], queryFn: () => analyticsService.getTrend().then((res) => res.data) });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => eventService.getEvents().then((res) => res.data) });
  const { data: donations = [] } = useQuery({ queryKey: ['admin-donations'], queryFn: () => donationService.getDonations().then((res) => res.data) });
  const { data: campaigns = [] } = useQuery({ queryKey: ['admin-campaigns'], queryFn: () => donationService.getAllCampaigns().then((res) => res.data) });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => userService.getUsers().then((res) => res.data) });
  const { data: volunteerApplications = [] } = useQuery({ queryKey: ['admin-volunteers'], queryFn: () => volunteerService.getApplications().then((res) => res.data) });
  const { data: cmsData } = useQuery({ queryKey: ['cms-home'], queryFn: () => cmsService.getHomeContent().then((res) => res.data) });
  const { data: newsArticles = [] } = useQuery({ queryKey: ['news-articles'], queryFn: () => newsService.getArticles().then((res) => res.data) });

  const pendingUsers = useMemo(
    () => users.filter((user) => String(user.approvalStatus || 'pending').toLowerCase() === 'pending'),
    [users]
  );

  const inactiveUsers = useMemo(
    () => users.filter((user) => user.isActive === false),
    [users]
  );

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

  const roleBreakdown = useMemo(() => {
    const counts = { 'Super Admin': 0, Admin: 0, Member: 0, Volunteer: 0 };
    users.forEach((user) => {
      const role = String(user.role || 'Member');
      if (counts[role] == null) {
        counts.Member += 1;
        return;
      }
      counts[role] += 1;
    });
    return counts;
  }, [users]);

  const campaignBreakdown = useMemo(() => {
    const map = {};
    donations.forEach((donation) => {
      const key = donation.campaignName || 'General Donation';
      map[key] = (map[key] || 0) + Number(donation.amount || 0);
    });
    return map;
  }, [donations]);

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

  const chartData = {
    labels: trend.map((item) => item.name),
    datasets: [
      {
        label: 'Visitors',
        data: trend.map((item) => item.visitors),
        backgroundColor: '#0B4EA2',
        borderRadius: 8
      },
      {
        label: 'Donations',
        data: trend.map((item) => item.donations),
        backgroundColor: '#F4A300',
        borderRadius: 8
      }
    ]
  };

  const roleChartData = {
    labels: Object.keys(roleBreakdown),
    datasets: [
      {
        data: Object.values(roleBreakdown),
        backgroundColor: ['#0B4EA2', '#1d4ed8', '#f4a300', '#10b981'],
        borderWidth: 0
      }
    ]
  };

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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#eff6ff,_#ffffff_40%,_#fff7ed)] p-6 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.55)]">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin Command Center</p>
            <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-slate-900">Busy, clear, and ready for daily seva operations.</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">Track donations, approvals, schedule changes, volunteer demand, and upcoming programs from one place. This dashboard is built to tell you what needs attention first.</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={() => window.location.assign('/admin/schedule')}>Update Today&apos;s Schedule</Button>
              <Button type="button" variant="ghost" onClick={() => window.location.assign('/admin/donations')}>Review Donations</Button>
              <Button type="button" variant="ghost" onClick={() => window.location.assign('/admin/users')}>Open User Queue</Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Today&apos;s Schedule</p>
              <p className="mt-3 font-heading text-3xl font-bold text-slate-900">{todayScheduleCount}</p>
              <p className="mt-1 text-sm text-slate-500">items active for {resolvedScheduleDay?.dateKey === 'default' ? 'default day' : todayDateKey}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Attention Needed</p>
              <p className="mt-3 font-heading text-3xl font-bold text-rose-600">{pendingUsers.length + pendingVolunteers.length}</p>
              <p className="mt-1 text-sm text-slate-500">pending users and volunteer applications</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Live Notes</p>
              {resolvedScheduleDay?.highlightTitle || resolvedScheduleDay?.highlightNoteEn ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{resolvedScheduleDay?.highlightTitle || 'Schedule change noted'}</p>
                  <p className="mt-1 text-sm text-slate-600">{resolvedScheduleDay?.highlightNoteEn || 'A highlighted daily schedule note is active.'}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No active special-day note right now.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Donation Total" value={formatCurrency(donationTotal || metrics?.donationAmount || 0)} sublabel={`${donations.length} recorded donations`} tone="text-emerald-600" icon={CurrencyDollarIcon} href="/admin/donations" />
        <SummaryCard label="People Access" value={users.length} sublabel={`${inactiveUsers.length} inactive accounts`} tone="text-brand-blue" icon={UsersIcon} href="/admin/users" />
        <SummaryCard label="Volunteer Demand" value={volunteerApplications.length} sublabel={`${pendingVolunteers.length} still pending review`} tone="text-amber-600" icon={UserGroupIcon} href="/admin/seva-opportunities" />
        <SummaryCard label="Upcoming Events" value={upcomingEvents.length} sublabel={`${events.filter((event) => event.active).length} active total`} tone="text-violet-600" icon={CalendarDaysIcon} href="/admin/events" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Traffic and Giving</p>
              <h2 className="font-heading text-2xl font-semibold text-slate-900">Weekly movement</h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> Positive weekly trend
            </span>
          </div>
          <div className="mt-5 h-[320px]">
            <Bar
              data={chartData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, ticks: { precision: 0 } }
                }
              }}
            />
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role Distribution</p>
                <h2 className="font-heading text-xl font-semibold text-slate-900">Access mix</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{users.length} users</span>
            </div>
            <div className="mt-4 h-[250px]">
              <Doughnut
                data={roleChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } },
                  cutout: '62%'
                }}
              />
            </div>
          </Card>

          <Card className="border border-slate-200 bg-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Quick Queue</p>
            <h2 className="mt-1 font-heading text-xl font-semibold text-slate-900">Pending review</h2>
            <div className="mt-4 space-y-3">
              {pendingUsers.length === 0 && pendingVolunteers.length === 0 ? (
                <EmptyState text="No pending approvals right now." />
              ) : null}
              {pendingUsers.slice(0, 3).map((user) => (
                <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.email} • {user.role}</p>
                </div>
              ))}
              {pendingVolunteers.slice(0, 2).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">{entry.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Volunteer • {entry.sevaType || entry.area}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <Card className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Campaign Momentum</p>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Donation spread</h2>
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

        <Card className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent Donations</p>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Latest donor activity</h2>
            </div>
            <BellAlertIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {latestDonations.length === 0 ? (
              <EmptyState text="No donations recorded yet." />
            ) : latestDonations.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.donorName || 'Anonymous'}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.campaignName || 'General Donation'}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(entry.amount || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Publishing Overview</p>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Content pulse</h2>
            </div>
            <SparklesIcon className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">News Articles</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{newsArticles.length}</p>
              <p className="text-sm text-slate-500">{newsArticles.filter((item) => item.active).length} live right now</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active Campaigns</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{campaigns.filter((item) => item.isActive).length}</p>
              <p className="text-sm text-slate-500">{campaigns.length} total campaigns configured</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Highlighted Schedule Items</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{highlightedScheduleItems.length}</p>
              <p className="text-sm text-slate-500">special notes or one-off changes visible on homepage</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Upcoming Calendar</p>
              <h2 className="font-heading text-xl font-semibold text-slate-900">What&apos;s next</h2>
            </div>
            <Link to="/admin/events" className="text-sm font-semibold text-brand-blue hover:underline">Manage events</Link>
          </div>
          <div className="mt-4 space-y-3">
            {upcomingEvents.length === 0 ? (
              <EmptyState text="No upcoming events available." />
            ) : upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(event.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} • {event.location}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{event.registrations || 0} registrations</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-slate-200 bg-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operational Snapshot</p>
          <h2 className="mt-1 font-heading text-xl font-semibold text-slate-900">Today at a glance</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Visitors Today</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{metrics?.visitorsToday || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Event Registrations</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{metrics?.eventRegistrations || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Volunteer Metric</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{metrics?.volunteers || volunteerApplications.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg Session</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{metrics?.avgSession || '-'}</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
