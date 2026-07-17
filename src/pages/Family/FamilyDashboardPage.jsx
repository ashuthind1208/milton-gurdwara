import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Seo from '../../components/common/Seo';
import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import { useAuth } from '../../context/AuthContext';
import eventService from '../../services/eventService';
import donationService from '../../services/donationService';
import volunteerService from '../../services/volunteerService';

const FamilyDashboardPage = () => {
  const meta = useSeoMeta('Family Dashboard', 'Track your family event RSVPs, waitlists, seva applications, and donations in one view.');
  const { user, isAuthenticated } = useAuth();
  const [donationPage, setDonationPage] = useState(1);
  const donationsPerPage = 6;

  const email = String(user?.email || '').toLowerCase();
  const userName = String(user?.name || '').trim().toLowerCase();

  const { data: events = [] } = useQuery({
    queryKey: ['family-dashboard-events'],
    queryFn: () => eventService.getEvents().then((res) => res.data),
    enabled: isAuthenticated
  });

  const { data: sevaApplications = [] } = useQuery({
    queryKey: ['family-dashboard-seva'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data),
    enabled: isAuthenticated
  });

  const { data: donations = [] } = useQuery({
    queryKey: ['family-dashboard-donations'],
    queryFn: () => donationService.getDonations().then((res) => res.data),
    enabled: isAuthenticated
  });

  const familyEventRegistrations = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const rows = [];
    events.forEach((event) => {
      const registrants = Array.isArray(event.registrants) ? event.registrants : [];
      registrants.forEach((entry) => {
        const entryName = String(entry.name || '').trim().toLowerCase();
        const entryContact = String(entry.contact || '').trim().toLowerCase();
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const belongsToUser = (email && (entryEmail === email || entryContact === email)) || (userName && entryName === userName);
        if (!belongsToUser) {
          return;
        }

        rows.push({
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date,
          location: event.location,
          contact: entry.contact || entry.email || '',
          createdAt: entry.createdAt || ''
        });
      });
    });

    return rows.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }, [events, isAuthenticated, email, userName]);

  const familySevaApplications = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    return sevaApplications.filter((entry) => {
      const entryEmail = String(entry.email || '').trim().toLowerCase();
      const entryName = String(entry.name || '').trim().toLowerCase();
      return (email && entryEmail === email) || (userName && entryName === userName);
    });
  }, [sevaApplications, isAuthenticated, email, userName]);

  const familyDonations = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    return donations
      .filter((entry) => String(entry.donorEmail || '').trim().toLowerCase() === email)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [donations, isAuthenticated, email]);

  const donationTotal = useMemo(
    () => familyDonations.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [familyDonations]
  );

  const totalDonationPages = Math.max(1, Math.ceil(familyDonations.length / donationsPerPage));
  const safeDonationPage = Math.min(donationPage, totalDonationPages);
  const paginatedDonations = useMemo(() => {
    const startIndex = (safeDonationPage - 1) * donationsPerPage;
    return familyDonations.slice(startIndex, startIndex + donationsPerPage);
  }, [familyDonations, safeDonationPage]);

  useEffect(() => {
    if (donationPage > totalDonationPages) {
      setDonationPage(totalDonationPages);
    }
  }, [donationPage, totalDonationPages]);

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Seo {...meta} />
        <PageHero title="Family Dashboard" description="Please sign in to view your family activity." />
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <p>You need to sign in before accessing the family dashboard.</p>
          <Link to="/login" className="mt-3 inline-flex rounded-lg bg-brand-blue px-3 py-2 font-semibold text-white">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Seo {...meta} />
      <PageHero title="Family Dashboard" description="One place to view your RSVPs, waitlist entries, seva applications, and donation history." />

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <article className="rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-blue-100 p-5">
            <h2 className="text-2xl font-black text-brand-blue">Event Registrations</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Total RSVPs: {familyEventRegistrations.length}</p>
            <div className="mt-3 space-y-2">
              {familyEventRegistrations.map((entry, index) => (
                <div key={`${entry.eventId}-${index}`} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">{entry.eventTitle}</p>
                  <p className="text-xs text-slate-600">{entry.location || 'Location TBD'} • {format(new Date(entry.eventDate), 'EEE, MMM d yyyy, h:mm a')}</p>
                </div>
              ))}
              {familyEventRegistrations.length === 0 ? <p className="text-sm text-slate-500">No event registrations found for your profile yet.</p> : null}
            </div>
          </article>

          <article className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-amber-100 p-5">
            <h2 className="text-2xl font-black text-brand-blue">Seva Applications</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Total applications: {familySevaApplications.length}</p>
            <div className="mt-3 space-y-2">
              {familySevaApplications.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-800">{entry.sevaType || entry.area || 'Seva'}</p>
                  <p className="text-xs text-slate-600">{entry.sevaDate || '-'} • {entry.sevaTime || '-'}</p>
                </div>
              ))}
              {familySevaApplications.length === 0 ? <p className="text-sm text-slate-500">No seva applications found for your profile yet.</p> : null}
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-5">
            <h2 className="text-2xl font-black text-brand-blue">Donations</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Records: {familyDonations.length}</p>
            <p className="mt-2 text-[2rem] font-black leading-none text-emerald-700 md:text-[2.4rem]">${donationTotal.toFixed(2)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Total contributed</p>
          </article>
        </div>

        <article className="rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-100 p-5">
          <h2 className="text-2xl font-black text-brand-blue">Donation History</h2>
          <div className="mt-3 space-y-2">
            {paginatedDonations.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{entry.campaignName || 'General Donation'}</p>
                    <p className="text-xs text-slate-600">{entry.createdAt ? format(new Date(entry.createdAt), 'EEE, MMM d yyyy, h:mm a') : '-'}</p>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-700">${Number(entry.amount || 0).toFixed(2)}</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-700">Status: {entry.paymentStatus || 'PAID'}</p>
              </div>
            ))}
            {familyDonations.length === 0 ? <p className="text-sm text-slate-500">No donations found for your profile yet.</p> : null}
          </div>
          {familyDonations.length > donationsPerPage ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Page {safeDonationPage} of {totalDonationPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDonationPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeDonationPage === 1}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setDonationPage((prev) => Math.min(totalDonationPages, prev + 1))}
                  disabled={safeDonationPage === totalDonationPages}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
};

export default FamilyDashboardPage;
