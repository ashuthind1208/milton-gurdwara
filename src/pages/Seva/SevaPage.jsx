import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  ChevronRightIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import VolunteerForm from '../../components/forms/VolunteerForm';
import Card from '../../components/ui/Card';
import volunteerService from '../../services/volunteerService';
import advertisementService from '../../services/advertisementService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import { useAuth } from '../../context/AuthContext';
import contentApiService from '../../services/contentApiService';
import PhoneNumberRequiredNotice from '../../components/common/PhoneNumberRequiredNotice';

const SEVA_IDENTITY_SETTING_KEY = 'settings-seva-allow-custom-name-email';
const SEVA_PAGE_SIZE = 9;

const toDateKey = (value) => {
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

const parseSevaDate = (value) => {
  const dateKey = toDateKey(value);
  if (!dateKey) {
    return null;
  }

  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const formatDateLabel = (value) => {
  const parsed = parseSevaDate(value);
  if (!parsed) {
    return 'Date TBD';
  }
  return parsed.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (value) => {
  const parsed = parseSevaDate(value);
  if (!parsed) {
    return 'TBD';
  }
  return parsed.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const isEntryActive = (entry) => {
  if (typeof entry?.active === 'boolean') {
    return entry.active;
  }
  if (typeof entry?.isActive === 'boolean') {
    return entry.isActive;
  }
  return true;
};

const getOpportunityStatusMeta = (item) => {
  const registered = Number(item?.confirmedRegistered || 0);
  const totalRequired = Math.max(1, Number(item?.totalRequired || 1));
  const fillRatio = registered / totalRequired;

  if (!item?.isOpen) {
    if (registered >= totalRequired) {
      return { label: 'Full', className: 'bg-rose-100 text-rose-700' };
    }
    return { label: 'Closed', className: 'bg-slate-200 text-slate-700' };
  }

  if (registered >= totalRequired && item?.waitlistEnabled) {
    return { label: 'Waitlist Open', className: 'bg-amber-100 text-amber-800' };
  }

  if (fillRatio >= 0.9) {
    return { label: 'Almost Full', className: 'bg-rose-100 text-rose-700' };
  }

  if (fillRatio >= 0.65) {
    return { label: 'Filling Fast', className: 'bg-amber-100 text-amber-800' };
  }

  return { label: 'Open', className: 'bg-emerald-100 text-emerald-800' };
};

const SevaPage = () => {
  const location = useLocation();
  const meta = useSeoMeta('Seva', 'Volunteer opportunities for langar, parking, teaching, and events.');
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerOpportunityId, setRegisterOpportunityId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const profilePhoneMissing = !String(user?.phone || '').trim();
  const currentUserEmail = String(user?.email || '').trim().toLowerCase();
  const currentUserPhone = String(user?.phone || '').trim().toLowerCase();
  const currentUserName = String(user?.name || '').trim().toLowerCase();

  const { data: registrations = [] } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data),
    refetchInterval: 15000,
    refetchOnWindowFocus: true
  });

  const { data: sevaOpportunities = [] } = useQuery({
    queryKey: ['seva-opportunities'],
    queryFn: () => volunteerService.getSevaOpportunities().then((res) => res.data),
    refetchInterval: 15000,
    refetchOnWindowFocus: true
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });
  const { data: sevaIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [SEVA_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(SEVA_IDENTITY_SETTING_KEY, { enabled: false })
  });
  const allowIdentityOverride = Boolean(sevaIdentitySettings?.enabled);

  const sevaTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Seva Top Banner').slice(0, 2), [ads]);
  const sevaFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Seva Footer Banner').slice(0, 2), [ads]);

  const onSubmit = async (payload) => {
    if (isSubmittingRegistration) {
      return;
    }

    if (!isAuthenticated && !allowIdentityOverride) {
      window.alert('Please sign in before registering for seva.');
      return;
    }
    if (isAuthenticated && profilePhoneMissing) {
      window.alert('Please add your phone number in profile before registering for seva.');
      return;
    }

    setIsSubmittingRegistration(true);
    try {
      const response = await volunteerService.apply({ ...payload, isAuthenticated });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-volunteers'] }),
        queryClient.invalidateQueries({ queryKey: ['volunteers-archive'] }),
        queryClient.invalidateQueries({ queryKey: ['seva-opportunities'] })
      ]);
      setIsRegisterModalOpen(false);
      setRegisterOpportunityId('');
      if (response?.data?.status === 'waitlisted' || response?.data?.waitlisted) {
        window.alert('This seva opportunity is full. You were added to the waitlist.');
        return;
      }
      window.alert('Thank you for registering for seva.');
    } catch (error) {
      window.alert(error?.message || 'Unable to register for seva right now.');
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const registrationsByOpportunity = useMemo(() => registrations.reduce((acc, entry) => {
    if (!entry.opportunityId) {
      return acc;
    }
    if (!acc[entry.opportunityId]) {
      acc[entry.opportunityId] = { confirmed: 0, waitlisted: 0, total: 0 };
    }

    const isWaitlisted = String(entry.status || '').trim().toLowerCase() === 'waitlisted';
    acc[entry.opportunityId].total += 1;
    if (isWaitlisted) {
      acc[entry.opportunityId].waitlisted += 1;
    } else {
      acc[entry.opportunityId].confirmed += 1;
    }

    return acc;
  }, {}), [registrations]);

  const enrichedOpportunities = useMemo(() => {
    const today = toDateKey(new Date());
    return sevaOpportunities.filter((item) => isEntryActive(item)).map((item) => {
      const stats = registrationsByOpportunity[item.id] || { confirmed: 0, waitlisted: 0, total: 0 };
      const confirmedRegistered = Number(stats.confirmed || 0);
      const waitlistCount = Number(stats.waitlisted || 0);
      const totalRequired = Math.max(1, Number(item.totalVolunteersRequired) || 10);
      const expiryDateKey = toDateKey(item.expiryDate);
      const isExpired = Boolean(item.isClosed) || (Boolean(expiryDateKey) && expiryDateKey < today);
      const waitlistEnabled = item.waitlistEnabled !== false;
      const isOpen = !isExpired && (confirmedRegistered < totalRequired || waitlistEnabled);
      const dateKey = toDateKey(item.date);

      return {
        ...item,
        date: dateKey || item.date,
        expiryDate: expiryDateKey || item.expiryDate,
        confirmedRegistered,
        waitlistCount,
        registered: confirmedRegistered,
        totalRequired,
        waitlistEnabled,
        isExpired,
        isOpen
      };
    });
  }, [sevaOpportunities, registrationsByOpportunity]);

  const sevaStats = useMemo(() => {
    if (enrichedOpportunities.length === 0) {
      return {
        totalOpenOpportunities: 0,
        totalVolunteersNeeded: 0,
        totalRegistered: 0,
        totalOpenSpots: 0,
        nextSevaDate: ''
      };
    }

    const totalOpenOpportunities = enrichedOpportunities.filter((item) => item.isOpen).length;
    const totalVolunteersNeeded = enrichedOpportunities.reduce((sum, item) => sum + item.totalRequired, 0);
    const totalRegistered = enrichedOpportunities.reduce((sum, item) => sum + item.registered, 0);
    const totalOpenSpots = Math.max(0, totalVolunteersNeeded - totalRegistered);
    const nextOpen = enrichedOpportunities
      .filter((item) => item.isOpen)
      .sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)))[0];

    return {
      totalOpenOpportunities,
      totalVolunteersNeeded,
      totalRegistered,
      totalOpenSpots,
      nextSevaDate: nextOpen?.date || ''
    };
  }, [enrichedOpportunities]);

  const volunteerRowsByOpportunity = useMemo(() => {
    const rowsById = {};
    enrichedOpportunities.forEach((opportunity) => {
      rowsById[opportunity.id] = registrations.filter((entry) => (
        entry.opportunityId === opportunity.id
        || (
          !entry.opportunityId
          && (entry.sevaType || entry.area) === opportunity.sevaType
          && toDateKey(entry.sevaDate || entry.date) === toDateKey(opportunity.date)
        )
      ));
    });
    return rowsById;
  }, [enrichedOpportunities, registrations]);

  const activeRegisterOpportunity = useMemo(
    () => enrichedOpportunities.find((item) => String(item.id) === String(registerOpportunityId)) || null,
    [enrichedOpportunities, registerOpportunityId]
  );
  const isActiveOpportunityWaitlistOnly = Boolean(
    activeRegisterOpportunity
    && activeRegisterOpportunity.confirmedRegistered >= activeRegisterOpportunity.totalRequired
    && activeRegisterOpportunity.waitlistEnabled
  );

  const isCurrentUserRegisteredForOpportunity = (opportunityId) => {
    const existingRows = volunteerRowsByOpportunity[opportunityId] || [];
    const normalizedUserPhone = String(currentUserPhone || '').replace(/\D/g, '');
    return existingRows.some((entry) => {
      const entryEmail = String(entry.email || '').trim().toLowerCase();
      const entryPhoneRaw = String(entry.phone || entry.whatsapp || '').trim();
      const entryPhoneNormalized = entryPhoneRaw.replace(/\D/g, '');
      const entryName = String(entry.name || '').trim().toLowerCase();
      const hasUserIdentifier = Boolean(currentUserEmail || normalizedUserPhone);
      const hasEntryIdentifier = Boolean(entryEmail || entryPhoneNormalized);

      if (currentUserEmail && entryEmail && entryEmail === currentUserEmail) {
        return true;
      }

      if (normalizedUserPhone && entryPhoneNormalized && normalizedUserPhone === entryPhoneNormalized) {
        return true;
      }

      if (currentUserPhone && entryPhoneRaw && entryPhoneRaw.toLowerCase() === currentUserPhone) {
        return true;
      }

      return !hasUserIdentifier && !hasEntryIdentifier && currentUserName && entryName === currentUserName;
    });
  };

  const formatSevaOpportunityLabel = (item) => `${item.sevaType} • ${formatDateLabel(item.date)}${item.time ? ` • ${item.time}` : ''}`;

  const selectableOptions = useMemo(() => enrichedOpportunities
    .filter((item) => item.isOpen)
    .map((item) => {
      const existingRows = volunteerRowsByOpportunity[item.id] || [];
      const normalizedUserPhone = String(currentUserPhone || '').replace(/\D/g, '');
      const alreadyRegistered = existingRows.some((entry) => {
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const entryPhoneRaw = String(entry.phone || entry.whatsapp || '').trim();
        const entryPhoneNormalized = entryPhoneRaw.replace(/\D/g, '');
        const entryName = String(entry.name || '').trim().toLowerCase();
        const hasUserIdentifier = Boolean(currentUserEmail || normalizedUserPhone);
        const hasEntryIdentifier = Boolean(entryEmail || entryPhoneNormalized);

        if (currentUserEmail && entryEmail && entryEmail === currentUserEmail) {
          return true;
        }

        if (normalizedUserPhone && entryPhoneNormalized && normalizedUserPhone === entryPhoneNormalized) {
          return true;
        }

        if (currentUserPhone && entryPhoneRaw && entryPhoneRaw.toLowerCase() === currentUserPhone) {
          return true;
        }

        return !hasUserIdentifier && !hasEntryIdentifier && currentUserName && entryName === currentUserName;
      });

      return {
        id: item.id,
        label: `${item.sevaType} • ${formatDateLabel(item.date)}${item.time ? ` • ${item.time}` : ''} • ${item.registered}/${item.totalRequired}${alreadyRegistered ? ' • Already registered' : ''}`,
        disabled: alreadyRegistered,
        alreadyRegistered
      };
    }), [currentUserEmail, currentUserName, currentUserPhone, enrichedOpportunities, volunteerRowsByOpportunity]);

  const sevaCategories = useMemo(() => {
    const categories = Array.from(new Set(enrichedOpportunities.map((item) => String(item.sevaType || '').trim()).filter(Boolean)));
    return ['All', ...categories];
  }, [enrichedOpportunities]);

  const filteredOpportunities = useMemo(() => {
    const needle = String(searchText || '').trim().toLowerCase();
    return enrichedOpportunities.filter((item) => {
      const categoryMatches = categoryFilter === 'All' || String(item.sevaType || '') === categoryFilter;
      if (!categoryMatches) {
        return false;
      }
      if (!needle) {
        return true;
      }

      const haystack = [item.sevaType, item.time, item.date, item.expiryDate]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });
  }, [categoryFilter, enrichedOpportunities, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredOpportunities.length / SEVA_PAGE_SIZE));

  const paginatedOpportunities = useMemo(() => {
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * SEVA_PAGE_SIZE;
    return filteredOpportunities.slice(start, start + SEVA_PAGE_SIZE);
  }, [currentPage, filteredOpportunities, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, categoryFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const sevaKpis = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const weekStart = new Date();
    const dayIndex = (weekStart.getDay() + 6) % 7;
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - dayIndex);
    const weekStartKey = toDateKey(weekStart);

    const registrationsBySevaDate = {};
    let totalToday = 0;
    let totalThisWeek = 0;

    registrations.forEach((entry) => {
      const activityDateKey = toDateKey(entry.createdAt || entry.sevaDate || entry.date);
      if (activityDateKey === todayKey) {
        totalToday += 1;
      }
      if (activityDateKey && weekStartKey && activityDateKey >= weekStartKey && activityDateKey <= todayKey) {
        totalThisWeek += 1;
      }

      const sevaDateKey = toDateKey(entry.sevaDate || entry.date);
      if (sevaDateKey) {
        registrationsBySevaDate[sevaDateKey] = (registrationsBySevaDate[sevaDateKey] || 0) + 1;
      }
    });

    const busiestDay = Object.entries(registrationsBySevaDate)
      .sort((left, right) => right[1] - left[1])[0];

    return {
      totalToday,
      totalThisWeek,
      busiestDay: busiestDay ? { date: busiestDay[0], count: busiestDay[1] } : null
    };
  }, [registrations]);

  return (
    <div className="space-y-6">
      <Seo {...meta} />
      {isAuthenticated && profilePhoneMissing ? <PhoneNumberRequiredNotice activityLabel="seva registrations" /> : null}

      <section className="py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-900 md:text-5xl">Seva Opportunities</h1>
        </div>
        <p className="mt-2 max-w-3xl text-slate-700">Join hands in langar, cleaning, parking, teaching, and event support.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-3">
          {!isAuthenticated && !allowIdentityOverride ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Please <Link to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`} state={{ from: { pathname: location.pathname, search: location.search } }} className="font-bold underline">sign in</Link> to register for seva opportunities.
            </p>
          ) : null}
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[7fr_3fr]">
            <label className="text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <MagnifyingGlassIcon className="h-4 w-4 text-brand-blue" />
                Search Opportunities
              </span>
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by seva type, date, or time"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5">
                <FunnelIcon className="h-4 w-4 text-brand-blue" />
                Filter by Category
              </span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {sevaCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>
          {paginatedOpportunities.length > 0 ? (
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {paginatedOpportunities.map((item) => {
                const remaining = Math.max(0, item.totalRequired - item.confirmedRegistered);
                const fillPercent = Math.min(100, Math.round((item.confirmedRegistered / item.totalRequired) * 100));
                const alreadyRegistered = isCurrentUserRegisteredForOpportunity(item.id);
                const statusMeta = getOpportunityStatusMeta(item);
                const joinWaitlist = item.confirmedRegistered >= item.totalRequired && item.waitlistEnabled;
                return (
                  <Card key={item.id} className="flex h-full flex-col border border-slate-200 bg-white p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate whitespace-nowrap text-base font-bold text-slate-900">{item.sevaType}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="mt-1 space-y-1 text-left">
                      <p className="flex items-center gap-1 truncate whitespace-nowrap text-xs text-slate-600"><CalendarDaysIcon className="h-3.5 w-3.5 text-brand-blue" /> {formatDateLabel(item.date)}</p>
                      <p className="flex items-center gap-1 truncate whitespace-nowrap text-xs text-slate-600"><ClockIcon className="h-3.5 w-3.5 text-brand-blue" /> {item.time || 'Time TBD'}</p>
                    </div>
                    <p className="mt-1 truncate whitespace-nowrap text-xs text-slate-500">Registration closes: {formatDateLabel(item.expiryDate)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-blue" style={{ width: `${fillPercent}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-700">
                      <span>{item.confirmedRegistered}/{item.totalRequired} registered</span>
                      <span>{remaining} spots left</span>
                    </div>
                    {item.waitlistCount > 0 ? <p className="mt-1 text-[11px] font-semibold text-amber-700">Waitlisted: {item.waitlistCount}</p> : null}
                    {isAuthenticated || allowIdentityOverride ? (
                      <div className="mt-auto pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isAuthenticated && profilePhoneMissing) {
                              window.alert('Please add your phone number in profile before registering for seva.');
                              return;
                            }
                            if (!item.isOpen || alreadyRegistered) {
                              return;
                            }
                            setRegisterOpportunityId(String(item.id));
                            setIsRegisterModalOpen(true);
                          }}
                          disabled={!item.isOpen || alreadyRegistered || (isAuthenticated && profilePhoneMissing)}
                          className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-blue via-blue-600 to-brand-saffron px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white transition hover:from-amber-200 hover:via-amber-300 hover:to-brand-saffron hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {joinWaitlist ? 'Join Waitlist' : 'Register For This Seva'}
                          <ChevronRightIcon className="h-4 w-4" />
                        </button>
                        {joinWaitlist && !alreadyRegistered && item.isOpen ? (
                          <p className="mt-1 text-xs font-semibold text-amber-700">This seva is full, but waitlist is open.</p>
                        ) : null}
                        {alreadyRegistered && item.isOpen ? (
                          <p className="mt-2 text-xs font-semibold leading-snug text-red-700">You can&apos;t register since you have already registered for this seva.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : (
            <section className="rounded-2xl border-2 border-dashed border-brand-saffron/45 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-4 py-6">
              <p className="text-center text-2xl font-black uppercase tracking-wide text-brand-blue md:text-3xl">No Seva Opportunities Available Right Now</p>
            </section>
          )}
          {filteredOpportunities.length > SEVA_PAGE_SIZE ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <p className="text-sm font-semibold text-slate-700">Page {currentPage} of {totalPages}</p>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-2">
          <Card className="mx-auto w-full max-w-[150px] border border-brand-blue/20 bg-gradient-to-br from-blue-50 to-white p-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-blue"><UserGroupIcon className="h-3.5 w-3.5" /> Today</p>
            <p className="mt-1 text-xl font-black text-slate-900">{sevaKpis.totalToday}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">Sevadars signed up today.</p>
          </Card>
          <Card className="mx-auto w-full max-w-[150px] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white p-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"><UserGroupIcon className="h-3.5 w-3.5" /> This Week</p>
            <p className="mt-1 text-xl font-black text-slate-900">{sevaKpis.totalThisWeek}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">Volunteer signups since Monday.</p>
          </Card>
          <Card className="mx-auto w-full max-w-[150px] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800"><UserGroupIcon className="h-3.5 w-3.5" /> Open Spots</p>
            <p className="mt-1 text-xl font-black text-slate-900">{sevaStats.totalOpenSpots}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">Remaining places for the next seva cycles.</p>
          </Card>
          <Card className="mx-auto w-full max-w-[150px] border border-violet-200/70 bg-gradient-to-br from-violet-50 to-white p-2">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-800"><CalendarDaysIcon className="h-3.5 w-3.5" /> Next Date</p>
            <p className="mt-1 text-lg font-black text-slate-900">{formatShortDate(sevaStats.nextSevaDate)}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">Upcoming open seva opportunity.</p>
          </Card>
        </aside>
      </section>

      {sevaTopAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {sevaTopAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}


      {sevaFooterAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {sevaFooterAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {(isAuthenticated || allowIdentityOverride) && isRegisterModalOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="w-full max-w-5xl rounded-[28px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,_#eff6ff,_#ffffff_45%,_#fff7ed)] p-4 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.6)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-xl font-semibold text-slate-900">Volunteer Registration</h3>
                <p className="overflow-x-auto whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{activeRegisterOpportunity?.sevaType ? formatSevaOpportunityLabel(activeRegisterOpportunity) : 'Quick, signed-in registration'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterModalOpen(false);
                  setRegisterOpportunityId('');
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              <VolunteerForm
                onSubmit={onSubmit}
                options={activeRegisterOpportunity ? [{
                  id: activeRegisterOpportunity.id,
                  label: `${formatSevaOpportunityLabel(activeRegisterOpportunity)} • ${activeRegisterOpportunity.confirmedRegistered}/${activeRegisterOpportunity.totalRequired}${activeRegisterOpportunity.waitlistCount > 0 ? ` • Waitlist ${activeRegisterOpportunity.waitlistCount}` : ''}`,
                  disabled: false,
                  alreadyRegistered: false
                }] : selectableOptions}
                disableSubmit={!activeRegisterOpportunity}
                isSubmitting={isSubmittingRegistration}
                lockedOpportunity={activeRegisterOpportunity ? {
                  id: activeRegisterOpportunity.id,
                  sevaType: activeRegisterOpportunity.sevaType,
                  date: activeRegisterOpportunity.date,
                  time: activeRegisterOpportunity.time,
                  registered: activeRegisterOpportunity.confirmedRegistered,
                  totalRequired: activeRegisterOpportunity.totalRequired,
                  expiryDate: activeRegisterOpportunity.expiryDate
                } : null}
                initialValues={{
                  name: user?.name || '',
                  email: user?.email || '',
                  phone: user?.phone || ''
                }}
                showIdentityFields={!isAuthenticated && allowIdentityOverride}
                submitLabel={isActiveOpportunityWaitlistOnly ? 'Join Waitlist' : 'Register for Seva'}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SevaPage;
