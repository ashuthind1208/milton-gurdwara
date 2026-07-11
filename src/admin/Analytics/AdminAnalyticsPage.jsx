import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import Card from '../../components/ui/Card';
import userService from '../../services/userService';
import donationService from '../../services/donationService';
import eventService from '../../services/eventService';
import volunteerService from '../../services/volunteerService';
import { formatCurrency } from '../../utils/formatters';

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

const buildDailySeries = ({ users, donations, events, volunteerApplications }) => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = toDateKey(date);
    return {
      key,
      name: date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      userRegistrations: 0,
      volunteerSignups: 0,
      eventRegistrations: 0
    };
  });

  const dayMap = days.reduce((acc, row) => {
    acc[row.key] = row;
    return acc;
  }, {});

  users.forEach((user) => {
    const key = toValidDateKey(user.createdAt || user.updatedAt);
    if (dayMap[key]) {
      dayMap[key].userRegistrations += 1;
    }
  });

  volunteerApplications.forEach((entry) => {
    const key = toValidDateKey(entry.createdAt || entry.updatedAt);
    if (dayMap[key]) {
      dayMap[key].volunteerSignups += 1;
    }
  });

  events.forEach((event) => {
    const registrants = Array.isArray(event.registrants) ? event.registrants : [];
    registrants.forEach((registrant) => {
      const key = toValidDateKey(registrant.createdAt);
      if (dayMap[key]) {
        dayMap[key].eventRegistrations += 1;
      }
    });
  });

  donations.forEach((donation) => {
    const key = toValidDateKey(donation.createdAt || donation.updatedAt);
    if (dayMap[key]) {
      dayMap[key].donationAmount = (dayMap[key].donationAmount || 0) + Number(donation.amount || 0);
    }
  });

  return days;
};

const AdminAnalyticsPage = () => {
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => userService.getUsers().then((res) => res.data) });
  const { data: donations = [] } = useQuery({ queryKey: ['admin-donations'], queryFn: () => donationService.getDonations().then((res) => res.data) });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => eventService.getEvents().then((res) => res.data) });
  const { data: volunteerApplications = [] } = useQuery({ queryKey: ['admin-volunteers'], queryFn: () => volunteerService.getApplications().then((res) => res.data) });

  const trend = useMemo(
    () => buildDailySeries({ users, donations, events, volunteerApplications }),
    [donations, events, users, volunteerApplications]
  );

  const totalDonationAmount = useMemo(
    () => donations.reduce((sum, donation) => sum + Number(donation.amount || 0), 0),
    [donations]
  );

  const approvedUsers = useMemo(
    () => users.filter((user) => String(user.approvalStatus || '').toLowerCase() === 'approved'),
    [users]
  );

  const pendingUsers = useMemo(
    () => users.filter((user) => String(user.approvalStatus || '').toLowerCase() === 'pending'),
    [users]
  );

  const activeVolunteers = useMemo(
    () => users.filter((user) => String(user.role || '').toLowerCase() === 'volunteer' && String(user.approvalStatus || '').toLowerCase() === 'approved'),
    [users]
  );

  const upcomingEvents = useMemo(
    () => events.filter((event) => Boolean(event.active) && new Date(event.date).getTime() >= Date.now()),
    [events]
  );

  const averageDonation = donations.length > 0 ? totalDonationAmount / donations.length : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold">Analytics and KPIs</h1>
        <p className="text-sm text-slate-600">Live operational numbers from users, donations, events, and volunteer applications.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Registered Users</p>
          <p className="mt-3 font-heading text-3xl font-bold text-brand-blue">{users.length}</p>
          <p className="mt-2 text-sm text-slate-500">{approvedUsers.length} approved, {pendingUsers.length} awaiting review</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active Volunteers</p>
          <p className="mt-3 font-heading text-3xl font-bold text-emerald-600">{activeVolunteers.length}</p>
          <p className="mt-2 text-sm text-slate-500">Users with volunteer access and approved status</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Donation Total</p>
          <p className="mt-3 font-heading text-3xl font-bold text-amber-600">{formatCurrency(totalDonationAmount)}</p>
          <p className="mt-2 text-sm text-slate-500">Average donation: {formatCurrency(averageDonation)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Upcoming Events</p>
          <p className="mt-3 font-heading text-3xl font-bold text-violet-600">{upcomingEvents.length}</p>
          <p className="mt-2 text-sm text-slate-500">{events.length} total event records</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-heading text-xl font-semibold">Seven Day Activity Trend</h2>
        <p className="mt-1 text-sm text-slate-500">User registrations, volunteer signups, and event registrations pulled from live records.</p>
        <div className="mt-4 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="userRegistrations" name="User registrations" stroke="#0B4EA2" strokeWidth={2.5} />
              <Line type="monotone" dataKey="volunteerSignups" name="Volunteer signups" stroke="#10b981" strokeWidth={2.5} />
              <Line type="monotone" dataKey="eventRegistrations" name="Event registrations" stroke="#F4A300" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <p className="text-sm">This page now summarizes actual app data: registrations, approvals, volunteer signups, event participation, and donation totals. It no longer relies on seeded visitor/donation mock rows.</p>
        <button className="mt-3 rounded-lg bg-brand-blue px-4 py-2 text-white">Download CSV Report</button>
      </Card>
    </div>
  );
};

export default AdminAnalyticsPage;
