import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowsPointingOutIcon,
  CalendarDaysIcon,
  MapPinIcon,
  QrCodeIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import {
  addDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import eventService from '../../services/eventService';
import bookingService from '../../services/bookingService';
import advertisementService from '../../services/advertisementService';
import sponsorService from '../../services/sponsorService';
import { getNanakshahiDate, toGurmukhiNumber } from '../../utils/punjabiCalendar';
import { siteConfig } from '../../constants/siteConfig';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';
import { expandDateRange } from '../../utils/dateRange';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const toLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const EventCalendarBoardPage = () => {
  const meta = useSeoMeta('Event Calendar Board', 'Live monthly event calendar with registration totals and Nanakshahi dates.');
  const [now, setNow] = useState(new Date());
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(Boolean(document.fullscreenElement));
  const [celebrationPieces, setCelebrationPieces] = useState([]);
  const lastGoodEventsRef = useRef([]);
  const lastGoodBookingsRef = useRef([]);
  const lastGoodAdsRef = useRef([]);
  const lastGoodSponsorsRef = useRef([]);
  const previousRegistrationTotalRef = useRef(null);
  const celebrationTimerRef = useRef(null);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const { data: eventsResponse = [], isError: eventsErrored } = useQuery({
    queryKey: ['event-calendar-board-events'],
    queryFn: () => eventService.getEvents().then((response) => response.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });
  const { data: bookingsResponse = [], isError: bookingsErrored } = useQuery({
    queryKey: ['event-calendar-board-bookings'],
    queryFn: () => bookingService.getBookings().then((response) => response.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });
  const { data: advertisementsResponse = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((response) => response.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });
  const { data: sponsorsResponse = [] } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorService.getSponsors().then((response) => response.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });

  const events = useMemo(() => {
    if (Array.isArray(eventsResponse)) {
      lastGoodEventsRef.current = eventsResponse;
      return eventsResponse;
    }
    return lastGoodEventsRef.current;
  }, [eventsResponse]);
  const bookings = useMemo(() => {
    if (Array.isArray(bookingsResponse)) {
      lastGoodBookingsRef.current = bookingsResponse;
      return bookingsResponse;
    }
    return lastGoodBookingsRef.current;
  }, [bookingsResponse]);
  const advertisements = useMemo(() => {
    if (Array.isArray(advertisementsResponse)) {
      lastGoodAdsRef.current = advertisementsResponse;
      return advertisementsResponse;
    }
    return lastGoodAdsRef.current;
  }, [advertisementsResponse]);
  const sponsors = useMemo(() => {
    if (Array.isArray(sponsorsResponse)) {
      lastGoodSponsorsRef.current = sponsorsResponse;
      return sponsorsResponse;
    }
    return lastGoodSponsorsRef.current;
  }, [sponsorsResponse]);

  const monthStart = useMemo(() => startOfMonth(now), [now]);
  const monthDays = useMemo(() => {
    const calendarStart = startOfWeek(monthStart);
    return eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 41) });
  }, [monthStart]);
  const activeEvents = useMemo(() => events
    .filter((event) => event?.active !== false)
    .map((event) => ({ ...event, itemType: 'event' }))
    .sort((left, right) => new Date(left.date || 0).getTime() - new Date(right.date || 0).getTime()), [events]);
  const confirmedBookings = useMemo(() => bookings
    .filter((booking) => booking?.status === 'confirmed' && booking?.date)
    .flatMap((booking) => expandDateRange(booking.date, booking.toDate || booking.date).map((date) => ({
        ...booking,
        id: `${booking.id}-${date}`,
        sourceBookingId: booking.id,
        itemType: 'booking',
        title: booking.title || booking.categoryName || 'Gurdwara Booking',
        category: 'Booking',
        date,
        dateTime: new Date(`${date}T${booking.startTime || '00:00'}`),
        location: booking.bookingLocation || siteConfig.name
      })))
    .filter((booking) => !Number.isNaN(booking.dateTime.getTime()))
    .sort((left, right) => left.dateTime.getTime() - right.dateTime.getTime()), [bookings]);
  const calendarItems = useMemo(() => [...activeEvents, ...confirmedBookings]
    .sort((left, right) => new Date(left.dateTime || left.date || 0).getTime() - new Date(right.dateTime || right.date || 0).getTime()), [activeEvents, confirmedBookings]);
  const visibleCalendarItems = useMemo(() => {
    const todayKey = toLocalDateKey(now);
    return calendarItems.filter((item) => item.itemType !== 'event' || toLocalDateKey(item.date) >= todayKey);
  }, [calendarItems, now]);
  const itemsByDate = useMemo(() => visibleCalendarItems.reduce((accumulator, item) => {
    const key = item.itemType === 'booking' ? String(item.date) : toLocalDateKey(item.date);
    if (!key) return accumulator;
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(item);
    return accumulator;
  }, {}), [visibleCalendarItems]);
  const monthEvents = useMemo(() => activeEvents.filter((event) => {
    const eventDate = new Date(event.date || 0);
    return !Number.isNaN(eventDate.getTime()) && isSameMonth(eventDate, monthStart);
  }), [activeEvents, monthStart]);
  const registrationTickerItems = useMemo(() => {
    const upcoming = activeEvents.filter((event) => new Date(event.endDate || event.date || 0).getTime() >= now.getTime());
    const source = upcoming.length ? upcoming : monthEvents;
    if (!source.length) return [];
    const base = source.map((event) => ({
      id: event.id,
      title: event.title || 'Community Event',
      registrations: Number(event.registrations || event.registrants?.length || 0),
      capacity: Number(event.capacity || 0)
    }));
    const repeats = Math.max(2, Math.ceil(10 / base.length));
    return Array.from({ length: repeats }, () => base).flat();
  }, [activeEvents, monthEvents, now]);
  const partnerTickerItems = useMemo(() => {
    const nowMs = now.getTime();
    const activeSponsors = sponsors.filter((entry) => {
      if (!entry?.active || !String(entry.bannerUrl || '').trim()) return false;
      if (!entry.expiryDate) return true;
      const expiry = new Date(entry.expiryDate).getTime();
      return Number.isFinite(expiry) && expiry >= nowMs;
    }).map((entry) => ({ id: `sponsor-${entry.id}`, label: entry.title || 'Proud Sponsor', imageUrl: entry.bannerUrl }));
    const activeAds = advertisements
      .filter((entry) => entry?.active && String(entry.bannerUrl || '').trim())
      .map((entry) => ({ id: `ad-${entry.id}`, label: entry.title || 'Website Advertiser', imageUrl: entry.bannerUrl }));
    const base = [...activeSponsors, ...activeAds];
    if (!base.length) return [];
    const repeats = Math.max(2, Math.ceil(12 / base.length));
    return Array.from({ length: repeats }, () => base).flat();
  }, [advertisements, now, sponsors]);

  const eventsUrl = useMemo(() => new URL('/events', window.location.origin).toString(), []);
  const qrImageUrl = useMemo(() => {
    const query = new URLSearchParams({ size: '360x360', margin: '8', data: eventsUrl });
    return `https://api.qrserver.com/v1/create-qr-code/?${query.toString()}`;
  }, [eventsUrl]);
  const totalRegistrations = useMemo(
    () => monthEvents.reduce((sum, event) => sum + Number(event.registrations || event.registrants?.length || 0), 0),
    [monthEvents]
  );
  const allRegistrationTotal = useMemo(
    () => activeEvents.reduce((sum, event) => sum + Number(event.registrations || event.registrants?.length || 0), 0),
    [activeEvents]
  );
  const todaysRegistrationCount = useMemo(() => {
    const todayKey = toLocalDateKey(now);
    return activeEvents.reduce((total, event) => total + (Array.isArray(event.registrants) ? event.registrants : [])
      .filter((registrant) => registrant?.status !== 'cancelled' && toLocalDateKey(registrant?.createdAt) === todayKey)
      .length, 0);
  }, [activeEvents, now]);
  const monthBookings = useMemo(() => confirmedBookings.filter((booking) => isSameMonth(booking.dateTime, monthStart)), [confirmedBookings, monthStart]);
  const monthScheduleItems = useMemo(() => visibleCalendarItems.filter((item) => {
    const itemDate = new Date(item.dateTime || item.date || 0);
    return !Number.isNaN(itemDate.getTime()) && isSameMonth(itemDate, monthStart);
  }), [monthStart, visibleCalendarItems]);
  const scheduleCarouselItems = useMemo(() => {
    if (!monthScheduleItems.length) return [];
    const repeats = Math.max(1, Math.ceil(5 / monthScheduleItems.length));
    return Array.from({ length: repeats }, () => monthScheduleItems).flat();
  }, [monthScheduleItems]);

  useEffect(() => {
    if (previousRegistrationTotalRef.current === null) {
      previousRegistrationTotalRef.current = allRegistrationTotal;
      return;
    }

    if (allRegistrationTotal > previousRegistrationTotalRef.current) {
      const timestamp = Date.now();
      setCelebrationPieces(Array.from({ length: 130 }, (_, index) => ({
        id: `${timestamp}-${index}`,
        flower: index % 4 === 0,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.4}s`,
        duration: `${4.2 + Math.random() * 2.4}s`,
        scale: `${0.7 + Math.random() * 0.9}`,
        sway: `${-80 + Math.random() * 160}px`,
        rotation: `${360 + Math.random() * 720}deg`
      })));

      if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = window.setTimeout(() => setCelebrationPieces([]), 8200);
    }

    previousRegistrationTotalRef.current = allRegistrationTotal;
  }, [allRegistrationTotal]);

  useEffect(() => () => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }
    await document.documentElement.requestFullscreen?.();
  };

  return (
    <>
      <Seo {...meta} />
      <div className="event-board relative h-screen min-h-[620px] overflow-hidden bg-[#05080e] text-slate-100">
        <style>{`
          @keyframes event-board-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @keyframes event-board-schedule-scroll { from { transform: translateY(-50%); } to { transform: translateY(0); } }
          @keyframes event-board-celebration-rain {
            0% { opacity: 0; transform: translate3d(0, -14vh, 0) rotate(0deg) scale(var(--scale, 1)); }
            8% { opacity: 1; }
            88% { opacity: 1; }
            100% { opacity: 0; transform: translate3d(var(--sway, 0), 116vh, 0) rotate(var(--rotation, 540deg)) scale(var(--scale, 1)); }
          }
          @keyframes event-board-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          .event-board-marquee { animation: event-board-scroll 50s linear infinite; }
          .event-board-partners { animation: event-board-scroll 58s linear infinite; }
          .event-board-schedule-track { animation: event-board-schedule-scroll 80s linear infinite; }
          .event-board-celebration-piece { animation: event-board-celebration-rain var(--duration) linear var(--delay) forwards; will-change: transform; }
          .event-board-panel { animation: event-board-in 500ms ease-out both; }
          @media (prefers-reduced-motion: reduce) { .event-board-marquee, .event-board-partners, .event-board-schedule-track { animation-play-state: paused; } }
        `}</style>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.18),transparent_30%),radial-gradient(circle_at_8%_95%,rgba(245,158,11,0.12),transparent_28%)]" />

        {celebrationPieces.length ? (
          <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden" aria-hidden="true">
            {celebrationPieces.map((piece, index) => (
              <span
                key={piece.id}
                className={`event-board-celebration-piece absolute -top-8 ${piece.flower ? 'text-2xl sm:text-3xl' : 'h-3 w-2 rounded-sm sm:h-4 sm:w-2.5'}`}
                style={{
                  left: piece.left,
                  color: piece.flower ? ['#fda4af', '#f9a8d4', '#fde68a'][index % 3] : undefined,
                  backgroundColor: piece.flower ? undefined : ['#22d3ee', '#fde047', '#fb7185', '#60a5fa', '#f8fafc'][index % 5],
                  '--delay': piece.delay,
                  '--duration': piece.duration,
                  '--scale': piece.scale,
                  '--sway': piece.sway,
                  '--rotation': piece.rotation
                }}
              >
                {piece.flower ? '✿' : ''}
              </span>
            ))}
          </div>
        ) : null}

        <main className="relative z-10 flex h-full flex-col px-3 py-2 sm:px-5 sm:py-3 lg:px-7">
          <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src={gurdwaraLogo} alt={`${siteConfig.name} logo`} className="h-12 w-12 shrink-0 rounded-full border border-white/20 object-cover sm:h-16 sm:w-16 xl:h-20 xl:w-20" />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200 sm:text-sm xl:text-base">{siteConfig.name}</p>
                <h1 className="truncate text-2xl font-semibold text-white sm:text-3xl">Event Calendar</h1>
              </div>
            </div>
            <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-6 py-2 text-center shadow-[0_0_24px_rgba(251,191,36,0.08)] backdrop-blur">
              <p className="text-3xl font-bold leading-none text-amber-200 xl:text-4xl">{todaysRegistrationCount}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-50 xl:text-xs">Registered Today</p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-xl font-semibold text-white xl:text-3xl">{format(monthStart, 'MMMM yyyy')}</p>
                <p className="text-xs text-slate-300 xl:text-base">Gregorian · ਨਾਨਕਸ਼ਾਹੀ</p>
              </div>
              <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10" aria-label={isBrowserFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isBrowserFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                <ArrowsPointingOutIcon className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="my-2 h-px shrink-0 bg-gradient-to-r from-white/55 via-white/25 to-transparent" />

          <section className="shrink-0 overflow-hidden rounded-md border border-cyan-300/15 bg-cyan-950/25 py-1.5">
            {registrationTickerItems.length ? (
              <div className="event-board-marquee flex w-max flex-nowrap">
                {[0, 1].map((groupIndex) => (
                  <div key={`registration-group-${groupIndex}`} className="flex shrink-0 items-center" aria-hidden={groupIndex === 1}>
                    {registrationTickerItems.map((event, index) => (
                      <span key={`${event.id}-${groupIndex}-${index}`} className="inline-flex items-center gap-2 border-r border-white/10 px-6 text-sm font-semibold text-slate-100 xl:text-lg">
                        <UserGroupIcon className="h-5 w-5 text-cyan-300" />
                        {event.title} · <strong className="text-amber-200">{event.registrations}{event.capacity > 0 ? `/${event.capacity}` : ' registered'}</strong>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : <p className="px-4 text-center text-xs text-slate-400">Registration totals will appear when events are published.</p>}
          </section>

          <div className="mt-2 grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="event-board-panel flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] p-2 backdrop-blur">
              <div className="mb-1 flex items-center justify-between sm:hidden">
                <h2 className="font-heading text-lg font-semibold">{format(monthStart, 'MMMM yyyy')}</h2>
                <span className="text-[10px] text-slate-400">Gregorian · ਨਾਨਕਸ਼ਾਹੀ</span>
              </div>
              <div className="grid shrink-0 grid-cols-7 gap-px border-b border-white/10 pb-1 text-center text-[9px] font-bold tracking-[0.16em] text-cyan-200 sm:text-sm xl:text-base">
                {WEEKDAY_LABELS.map((label) => <div key={label}>{label}</div>)}
              </div>
              <div className="mt-1 grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
                {monthDays.map((day) => {
                  const key = toLocalDateKey(day);
                  const dayItems = itemsByDate[key] || [];
                  const nanakshahi = getNanakshahiDate(day);
                  const inMonth = isSameMonth(day, monthStart);
                  if (!inMonth) {
                    return <div key={key} className="min-h-0 rounded-md border border-white/[0.05] bg-slate-950/20" aria-hidden="true" />;
                  }
                  const hasEvent = dayItems.some((item) => item.itemType === 'event');
                  const hasBooking = dayItems.some((item) => item.itemType === 'booking');
                  const occupiedCellClass = hasEvent && hasBooking
                    ? 'border-violet-300/60 bg-gradient-to-br from-cyan-300/15 to-rose-300/20'
                    : hasBooking
                      ? 'border-rose-300/60 bg-rose-300/15 shadow-[inset_0_0_20px_rgba(253,164,175,0.08)]'
                      : hasEvent
                        ? 'border-cyan-300/55 bg-cyan-300/10 shadow-[inset_0_0_20px_rgba(103,232,249,0.07)]'
                        : 'border-white/[0.08] bg-slate-950/35';
                  return (
                    <div key={key} className={`min-h-0 overflow-hidden rounded-md border p-1 ${occupiedCellClass} ${isToday(day) ? 'ring-2 ring-inset ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.12)]' : ''}`}>
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-sm font-bold leading-none sm:text-xl xl:text-2xl ${isToday(day) ? 'text-amber-200' : 'text-white'}`}>{format(day, 'd')}</span>
                        <span lang="pa" className="truncate text-right text-[7px] font-semibold leading-tight text-cyan-100 sm:text-xs xl:text-sm">{toGurmukhiNumber(nanakshahi.day)} {nanakshahi.monthPa}</span>
                      </div>
                      {dayItems.length ? (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`${dayItems.length} scheduled item${dayItems.length === 1 ? '' : 's'}`}>
                          {dayItems.map((item) => (
                            <span
                              key={`${item.itemType}-${item.id}`}
                              className={`h-2.5 w-2.5 rounded-full ring-2 ring-white/10 xl:h-3.5 xl:w-3.5 ${item.itemType === 'booking' ? 'bg-rose-300' : 'bg-cyan-300'}`}
                            />
                          ))}
                          <span className="ml-0.5 text-xs font-bold text-slate-300 xl:text-sm">{dayItems.length}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="event-board-panel hidden min-h-0 flex-col rounded-lg border border-white/10 bg-white/[0.045] p-3 backdrop-blur lg:flex" style={{ animationDelay: '90ms' }}>
              <div className="flex items-center gap-2 text-cyan-200">
                <QrCodeIcon className="h-5 w-5" />
                <p className="text-sm font-bold uppercase tracking-[0.12em] xl:text-base">Scan to Register</p>
              </div>
              <div className="mx-auto mt-2 w-full max-w-[132px] rounded-lg bg-white p-2">
                <img src={qrImageUrl} alt="Events registration QR code" className="aspect-square w-full" />
              </div>
              <p className="mt-1 break-all text-center text-[9px] text-slate-400">{eventsUrl}</p>
              <div className="my-2 h-px bg-white/10" />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md border border-white/10 bg-slate-950/40 p-2">
                  <p className="text-2xl font-bold text-white">{monthEvents.length}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-300">Events</p>
                </div>
                <div className="rounded-md border border-white/10 bg-slate-950/40 p-2">
                  <p className="text-2xl font-bold text-amber-200">{totalRegistrations}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-300">Registered</p>
                </div>
              </div>
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-200">{format(monthStart, 'MMMM')} Schedule</p>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-300">
                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />Event</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-300" />Booking</span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {monthScheduleItems.length ? (
                    <div className="event-board-schedule-track">
                      {[0, 1].map((groupIndex) => (
                        <div key={`schedule-group-${groupIndex}`} className="space-y-3 pb-3" aria-hidden={groupIndex === 1}>
                          {scheduleCarouselItems.map((item, itemIndex) => {
                            const itemDate = new Date(item.dateTime || item.date);
                            const hasPassed = itemDate.getTime() < now.getTime();
                            return (
                              <div key={`${item.itemType}-${item.id}-${groupIndex}-${itemIndex}`} className={`min-h-[104px] overflow-hidden rounded-md border bg-slate-950/45 px-3 py-3 ${item.itemType === 'booking' ? 'border-rose-300/45' : 'border-cyan-300/35'} ${hasPassed ? 'opacity-65' : ''}`}>
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-bold leading-snug text-white xl:text-base">{item.title}</p>
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${item.itemType === 'booking' ? 'bg-rose-300/20 text-rose-100' : 'bg-cyan-300/20 text-cyan-100'}`}>{item.itemType}</span>
                                </div>
                                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200"><CalendarDaysIcon className="h-4 w-4 shrink-0" /> {format(itemDate, 'EEEE, MMM d')} · {format(itemDate, 'h:mm a')}</p>
                                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-400"><MapPinIcon className="h-4 w-4 shrink-0" /> {item.location || siteConfig.name}</p>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-400">No events or bookings this month.</p>}
                </div>
              </div>
            </aside>
          </div>

          {partnerTickerItems.length ? (
            <section className="mt-2 shrink-0 overflow-hidden rounded-md border border-amber-300/15 bg-slate-900/70">
              <p className="px-3 pt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-amber-200">Sponsors & Advertisers</p>
              <div className="event-board-partners flex w-max flex-nowrap py-1">
                {[0, 1].map((groupIndex) => (
                  <div key={`partner-group-${groupIndex}`} className="flex shrink-0 gap-2 px-1" aria-hidden={groupIndex === 1}>
                    {partnerTickerItems.map((entry, index) => (
                      <div key={`${entry.id}-${groupIndex}-${index}`} className="h-16 w-60 overflow-hidden rounded border border-white/10 bg-white">
                        <img src={entry.imageUrl} alt={entry.label} className="h-full w-full object-contain" loading="lazy" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="mt-1 flex shrink-0 items-center justify-between text-[9px] text-slate-500">
            <span>{eventsErrored || bookingsErrored ? 'Showing last synced calendar data' : `Live events and bookings · ${monthBookings.length} confirmed booking${monthBookings.length === 1 ? '' : 's'} this month`}</span>
            <span>{format(now, 'EEEE, MMMM d · h:mm a')}</span>
          </footer>
        </main>
      </div>
    </>
  );
};

export default EventCalendarBoardPage;