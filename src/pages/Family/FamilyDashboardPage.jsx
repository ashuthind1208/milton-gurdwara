import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowDownTrayIcon, CalendarDaysIcon, HandRaisedIcon, BanknotesIcon, DocumentArrowDownIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import { useAuth } from '../../context/AuthContext';
import eventService from '../../services/eventService';
import donationService from '../../services/donationService';
import volunteerService from '../../services/volunteerService';
import { downloadCsv, downloadDonationInvoicePdf } from '../../utils/csvExport';
import { siteConfig } from '../../constants/siteConfig';

const toDateKey = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeTokenToMinutes = (token) => {
  const raw = String(token || '').trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const meridiem = String(match[3] || '').toLowerCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (meridiem === 'am') {
      hour = hour % 12;
    } else {
      hour = (hour % 12) + 12;
    }
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
};

const extractRangeEndMinutes = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const parts = raw.split(/\s*-\s*/);
  if (parts.length < 2) {
    return null;
  }

  const endRaw = parts[parts.length - 1] || '';
  const startRaw = parts[0] || '';
  const endHasMeridiem = /\b(am|pm)\b/i.test(endRaw);
  const startMeridiemMatch = startRaw.match(/\b(am|pm)\b/i);
  const normalizedEnd = endHasMeridiem || !startMeridiemMatch
    ? endRaw
    : `${endRaw} ${startMeridiemMatch[1]}`;

  return parseTimeTokenToMinutes(normalizedEnd);
};

const nowLocalMinutes = () => {
  const now = new Date();
  return (now.getHours() * 60) + now.getMinutes();
};

const FamilyDashboardPage = () => {
  const meta = useSeoMeta('Family Dashboard', 'Track your family event RSVPs, waitlists, seva applications, and donations in one view.');
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [donationPage, setDonationPage] = useState(1);
  const [calendarNotice, setCalendarNotice] = useState({ type: '', message: '' });
  const donationsPerPage = 6;
  const userDisplayName = String(user?.name || 'Member').trim() || 'Member';
  const userAvatarUrl = String(user?.avatarUrl || user?.picture || user?.photoURL || user?.imageUrl || user?.profileImageUrl || '').trim();

  const email = String(user?.email || '').toLowerCase();
  const userName = String(user?.name || '').trim().toLowerCase();
  const userPhone = String(user?.phone || '').trim().toLowerCase();
  const userPhoneDigits = userPhone.replace(/\D/g, '');

  const { data: events = [] } = useQuery({
    queryKey: ['events', 'family-dashboard'],
    queryFn: () => eventService.getEvents({ includeInactive: true }).then((res) => res.data),
    enabled: isAuthenticated
  });

  const { data: sevaApplications = [] } = useQuery({
    queryKey: ['admin-volunteers', 'family-dashboard'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data),
    enabled: isAuthenticated
  });

  const { data: allSevaOpportunities = [] } = useQuery({
    queryKey: ['seva-opportunities', 'family-dashboard', 'all-statuses'],
    queryFn: () => volunteerService.getSevaOpportunities({ includeInactive: true, includeClosed: true }).then((res) => res.data),
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
        const entryContact = String(entry.contact || entry.phone || entry.whatsapp || '').trim().toLowerCase();
        const entryContactDigits = entryContact.replace(/\D/g, '');
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const hasEntryIdentifier = Boolean(entryEmail || entryContactDigits || entryContact);

        let belongsToUser = false;

        if (email && (entryEmail === email || entryContact === email)) {
          belongsToUser = true;
        }

        if (!belongsToUser && userPhoneDigits && entryContactDigits && userPhoneDigits === entryContactDigits) {
          belongsToUser = true;
        }

        if (!belongsToUser && userPhone && entryContact && userPhone === entryContact) {
          belongsToUser = true;
        }

        if (!belongsToUser && !hasEntryIdentifier) {
          belongsToUser = Boolean(userName && entryName === userName);
        }

        if (!belongsToUser) {
          return;
        }

        rows.push({
          registrantId: entry.id,
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date,
          location: event.location,
          contact: entry.contact || entry.email || '',
          createdAt: entry.createdAt || ''
        });
      });
    });

    return rows.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
  }, [events, isAuthenticated, email, userName, userPhone, userPhoneDigits]);

  const familySevaApplications = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const todayDateKey = toDateKey(Date.now());
    const opportunitiesById = new Map(
      allSevaOpportunities.map((item) => [String(item?.id || ''), item])
    );

    return sevaApplications.filter((entry) => {
      const entryEmail = String(entry.email || '').trim().toLowerCase();
      const entryPhoneRaw = String(entry.phone || entry.whatsapp || '').trim().toLowerCase();
      const entryPhoneDigits = entryPhoneRaw.replace(/\D/g, '');
      const entryName = String(entry.name || '').trim().toLowerCase();
      const hasUserIdentifier = Boolean(email || userPhoneDigits || userPhone);
      const hasEntryIdentifier = Boolean(entryEmail || entryPhoneDigits || entryPhoneRaw);

      let belongsToUser = false;

      if (email && entryEmail === email) {
        belongsToUser = true;
      }

      if (!belongsToUser && userPhoneDigits && entryPhoneDigits && userPhoneDigits === entryPhoneDigits) {
        belongsToUser = true;
      }

      if (!belongsToUser && userPhone && entryPhoneRaw && userPhone === entryPhoneRaw) {
        belongsToUser = true;
      }

      if (!belongsToUser) {
        belongsToUser = !hasUserIdentifier && !hasEntryIdentifier && userName && entryName === userName;
      }

      if (!belongsToUser) {
        return false;
      }

      const linkedOpportunity = opportunitiesById.get(String(entry.opportunityId || ''));
      if (linkedOpportunity) {
        return !linkedOpportunity.isClosed && linkedOpportunity.active !== false;
      }

      const sevaDateKey = toDateKey(entry.sevaDate || entry.date);
      if (!sevaDateKey) {
        return true;
      }

      if (sevaDateKey === todayDateKey) {
        const endMinutes = extractRangeEndMinutes(entry.sevaTime || entry.time);
        if (Number.isFinite(endMinutes) && nowLocalMinutes() > endMinutes) {
          return false;
        }
      }

      return sevaDateKey >= todayDateKey;
    });
  }, [sevaApplications, isAuthenticated, email, userName, userPhone, userPhoneDigits, allSevaOpportunities]);

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

  const exportFamilyEventsCsv = () => {
    downloadCsv({
      fileName: 'family-event-registrations.csv',
      headers: ['Event', 'Date', 'Location', 'Contact', 'Registered At'],
      rows: familyEventRegistrations.map((entry) => ([
        entry.eventTitle || '',
        entry.eventDate ? format(new Date(entry.eventDate), 'yyyy-MM-dd HH:mm') : '',
        entry.location || '',
        entry.contact || '',
        entry.createdAt ? format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm') : ''
      ]))
    });
  };

  const exportFamilySevaCsv = () => {
    downloadCsv({
      fileName: 'family-seva-applications.csv',
      headers: ['Seva Type', 'Date', 'Time', 'Status', 'Submitted'],
      rows: familySevaApplications.map((entry) => ([
        entry.sevaType || entry.area || '',
        entry.sevaDate || '',
        entry.sevaTime || '',
        entry.status || '',
        entry.createdAt ? format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm') : (entry.date || '')
      ]))
    });
  };

  const exportFamilyDonationsCsv = () => {
    downloadCsv({
      fileName: 'family-donations.csv',
      headers: ['Campaign', 'Amount', 'Status', 'Frequency', 'Date'],
      rows: familyDonations.map((entry) => ([
        entry.campaignName || 'General Donation',
        Number(entry.amount || 0).toFixed(2),
        entry.paymentStatus || 'PAID',
        entry.frequency || 'one-time',
        entry.createdAt ? format(new Date(entry.createdAt), 'yyyy-MM-dd HH:mm') : ''
      ]))
    });
  };

  const handleDownloadInvoice = (entry) => {
    void downloadDonationInvoicePdf({
      fileName: `invoice-${entry.receiptId || entry.id}.pdf`,
      organizationName: siteConfig.name,
      address: siteConfig.contact.address,
      phone: siteConfig.contact.phone,
      donation: entry,
      campaignDescription: ''
    }).catch(() => null);
  };

  const removeEventRegistrationMutation = useMutation({
    mutationFn: ({ eventId, registrantId }) => eventService.removeEventRegistrant({ eventId, registrantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to remove this registration right now.');
    }
  });

  const removeSevaApplicationMutation = useMutation({
    mutationFn: ({ id }) => volunteerService.removeApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['family-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['navbar-family-events'] });
      queryClient.invalidateQueries({ queryKey: ['navbar-family-donations'] });
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to remove this seva application right now.');
    }
  });

  const handleNotGoing = (entry) => {
    if (!entry?.eventId || !entry?.registrantId) {
      window.alert('Unable to remove this registration because details are missing.');
      return;
    }

    const confirmed = window.confirm(`Remove your registration for ${entry.eventTitle || 'this event'}?`);
    if (!confirmed) {
      return;
    }

    removeEventRegistrationMutation.mutate({
      eventId: entry.eventId,
      registrantId: entry.registrantId
    });
  };

  const handleNotAttendingSeva = (entry) => {
    if (!entry?.id) {
      window.alert('Unable to remove this seva application because details are missing.');
      return;
    }

    const confirmed = window.confirm(`Remove your seva application for ${entry.sevaType || entry.area || 'this opportunity'}?`);
    if (!confirmed) {
      return;
    }

    removeSevaApplicationMutation.mutate({ id: entry.id });
  };

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

  useEffect(() => {
    if (!calendarNotice.message) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setCalendarNotice({ type: '', message: '' });
    }, 4200);

    return () => window.clearTimeout(timerId);
  }, [calendarNotice]);

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

  const formatSevaDateLabel = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value || '-');
    }
    return format(parsed, 'EEE, MMM d yyyy');
  };

  const handleAddEventToCalendar = async (entry) => {
    if (!entry?.eventId) {
      setCalendarNotice({ type: 'error', message: 'Unable to add this event to calendar right now.' });
      return;
    }

    try {
      const response = await eventService.downloadEventCalendar(entry.eventId);
      const source = response?.data;
      const blob = source instanceof Blob
        ? source
        : new Blob([source], { type: 'text/calendar;charset=utf-8' });
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      const safeTitle = String(entry.eventTitle || 'event')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'event';
      link.download = `${safeTitle}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(fileUrl), 1200);

      setCalendarNotice({ type: 'success', message: 'Calendar file downloaded. Open it to add the event.' });
    } catch {
      setCalendarNotice({ type: 'error', message: 'Unable to download calendar file. Please try again.' });
    }
  };

  const exportButtons = (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={exportFamilyEventsCsv}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-saffron hover:text-brand-navy"
      >
        <CalendarDaysIcon className="h-3.5 w-3.5" />
        <span>Export Events CSV</span>
      </button>
      <button
        type="button"
        onClick={exportFamilySevaCsv}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-saffron hover:text-brand-navy"
      >
        <HandRaisedIcon className="h-3.5 w-3.5" />
        <span>Export Seva CSV</span>
      </button>
      <button
        type="button"
        onClick={exportFamilyDonationsCsv}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-saffron hover:text-brand-navy"
      >
        <BanknotesIcon className="h-3.5 w-3.5" />
        <span>Export Donations CSV</span>
        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Seo {...meta} />
      <PageHero
        title="Family Dashboard"
        description=""
        containerClassName="w-full"
        titleActions={exportButtons}
      />

      <section className="rounded-2xl border border-brand-blue/20 bg-gradient-to-r from-blue-50 via-white to-amber-50 p-4 md:p-5">
        <div className="flex flex-wrap items-start gap-4 md:gap-5">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border-2 border-brand-saffron bg-brand-blue/10 md:h-24 md:w-24">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={userDisplayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-black text-brand-blue md:text-3xl">
                {String(userDisplayName.charAt(0) || 'M').toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-[220px] flex-1">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-blue/80">Sat Sri Akal,</p>
            <h2 className="text-2xl font-black text-slate-900 md:text-3xl">{userDisplayName}</h2>
            <p className="mt-1 text-sm text-slate-700">
              You currently have {familyEventRegistrations.length} event RSVP{familyEventRegistrations.length === 1 ? '' : 's'}, {familySevaApplications.length} seva application{familySevaApplications.length === 1 ? '' : 's'}, and {familyDonations.length} donation record{familyDonations.length === 1 ? '' : 's'}.
            </p>
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick Links</p>
              <div className="mt-2 grid auto-rows-fr gap-2 sm:grid-cols-2">
                <Link to="/events" className="flex h-full min-h-[88px] flex-col justify-between rounded-lg border border-slate-200 bg-white/90 px-3 py-2 transition hover:border-brand-blue/40 hover:bg-blue-50">
                  <p className="text-sm font-bold text-brand-blue">View Events</p>
                  <p className="text-xs text-slate-600">Check upcoming programs and register your family.</p>
                </Link>
                <Link to="/seva" className="flex h-full min-h-[88px] flex-col justify-between rounded-lg border border-slate-200 bg-white/90 px-3 py-2 transition hover:border-brand-blue/40 hover:bg-blue-50">
                  <p className="text-sm font-bold text-brand-blue">Explore Seva</p>
                  <p className="text-xs text-slate-600">Find seva opportunities and apply in a few steps.</p>
                </Link>
                <Link to="/donation" className="flex h-full min-h-[88px] flex-col justify-between rounded-lg border border-slate-200 bg-white/90 px-3 py-2 transition hover:border-brand-blue/40 hover:bg-blue-50">
                  <p className="text-sm font-bold text-brand-blue">Give Donation</p>
                  <p className="text-xs text-slate-600">Support active campaigns and continue your contribution.</p>
                </Link>
                <Link to="/contact" className="flex h-full min-h-[88px] flex-col justify-between rounded-lg border border-slate-200 bg-white/90 px-3 py-2 transition hover:border-brand-blue/40 hover:bg-blue-50">
                  <p className="text-sm font-bold text-brand-blue">Contact Committee</p>
                  <p className="text-xs text-slate-600">Reach out for membership, seva, or donation help.</p>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <article className="rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-blue-100 p-5">
            <h2 className="text-2xl font-black text-brand-blue">Event Registrations</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Total RSVPs: {familyEventRegistrations.length}</p>
            {calendarNotice.message ? (
              <p className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${calendarNotice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {calendarNotice.message}
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              {familyEventRegistrations.map((entry, index) => (
                <div key={`${entry.eventId}-${index}`} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800">{entry.eventTitle}</p>
                    <button
                      type="button"
                      onClick={() => handleNotGoing(entry)}
                      disabled={removeEventRegistrationMutation.isPending}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-300 px-2 py-0.5 text-[11px] font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircleIcon className="h-3.5 w-3.5" />
                      <span>
                        {removeEventRegistrationMutation.isPending && removeEventRegistrationMutation.variables?.registrantId === entry.registrantId
                          ? 'Removing...'
                          : 'Not Going'}
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">{entry.location || 'Location TBD'} • {format(new Date(entry.eventDate), 'EEE, MMM d yyyy, h:mm a')}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    {entry.eventId ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleAddEventToCalendar(entry);
                        }}
                        className="inline-flex text-[11px] font-semibold text-brand-blue underline underline-offset-2"
                      >
                        Add to calendar
                      </button>
                    ) : null}
                  </div>
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{entry.sevaType || entry.area || 'Seva'}</p>
                      <p className="text-xs text-slate-600">{formatSevaDateLabel(entry.sevaDate || entry.date)} • {entry.sevaTime || '-'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNotAttendingSeva(entry)}
                      disabled={removeSevaApplicationMutation.isPending}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-300 px-2 py-0.5 text-[11px] font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircleIcon className="h-3.5 w-3.5" />
                      <span>
                        {removeSevaApplicationMutation.isPending && removeSevaApplicationMutation.variables?.id === entry.id
                          ? 'Removing...'
                          : 'Not Attending'}
                      </span>
                    </button>
                  </div>
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
              <div key={entry.id} className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-1.5 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{entry.campaignName || 'General Donation'}</p>
                    <p className="text-xs text-slate-600">{entry.createdAt ? format(new Date(entry.createdAt), 'EEE, MMM d yyyy, h:mm a') : '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-extrabold text-emerald-700">${Number(entry.amount || 0).toFixed(2)}</p>
                    <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {String(entry.paymentStatus || 'PAID')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(entry)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/20 px-2 py-1 text-[11px] font-semibold text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue hover:text-white sm:px-3 sm:text-xs"
                      title="Download invoice PDF"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      <span>Invoice</span>
                    </button>
                  </div>
                </div>
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
