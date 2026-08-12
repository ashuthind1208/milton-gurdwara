import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import PageHero from '../../components/common/PageHero';
import eventService from '../../services/eventService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';
import advertisementService from '../../services/advertisementService';
import { useAuth } from '../../context/AuthContext';
import contentApiService from '../../services/contentApiService';
import PhoneNumberRequiredNotice from '../../components/common/PhoneNumberRequiredNotice';
import PhoneInput from '../../components/forms/PhoneInput';
import { formatTenDigitPhone, isTenDigitPhone, TEN_DIGIT_PHONE_ERROR } from '../../utils/phone';
import { isEventCurrent } from '../../utils/eventAvailability';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const categoryAccent = {
  Paath: 'border-l-4 border-l-violet-500',
  Workshop: 'border-l-4 border-l-emerald-500',
  Seva: 'border-l-4 border-l-amber-500'
};

const categoryDotClass = {
  Paath: 'bg-violet-500',
  Workshop: 'bg-emerald-500',
  Seva: 'bg-amber-500'
};

const normalizeTextToken = (value) => String(value || '').trim().toLowerCase();
const normalizePhoneToken = (value) => String(value || '').replace(/\D/g, '');
const EVENTS_IDENTITY_SETTING_KEY = 'settings-events-allow-custom-name-email';

const EventsPage = () => {
  const meta = useSeoMeta('Events', 'Event calendar, list view, filters, and RSVP registration for all programs.');
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [category, setCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [overflowEventsModal, setOverflowEventsModal] = useState({ open: false, date: null, events: [] });
  const deepLinkOpenedRef = useRef('');
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const registrationDefaults = useMemo(() => ({
    name: String(user?.name || ''),
    email: String(user?.email || ''),
    contact: formatTenDigitPhone(user?.phone)
  }), [user?.email, user?.name, user?.phone]);
  const registrationForm = useForm({ defaultValues: { name: '', email: '', contact: '' } });

  const profilePhoneMissing = !String(user?.phone || '').trim();
  const currentUserEmail = normalizeTextToken(user?.email);
  const currentUserPhone = normalizePhoneToken(user?.phone);
  const currentUserName = normalizeTextToken(user?.name);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => eventService.getEvents().then((res) => res.data) });
  const { data: content } = useQuery({
    queryKey: ['page-content', 'events'],
    queryFn: () => cmsService.getPageContent('events').then((res) => res.data)
  });
  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });
  const { data: eventsIdentitySettings = { enabled: false } } = useQuery({
    queryKey: [EVENTS_IDENTITY_SETTING_KEY],
    queryFn: () => contentApiService.getSingleton(EVENTS_IDENTITY_SETTING_KEY, { enabled: false })
  });
  const { data: libraryContent = {} } = useQuery({
    queryKey: ['library-content-events-fallback'],
    queryFn: () => contentApiService.getSingleton('library_content', {})
  });
  const allowIdentityOverride = Boolean(eventsIdentitySettings?.enabled);

  const librarySummaryByEventId = useMemo(() => {
    const map = new Map();
    const programUpdates = Array.isArray(libraryContent?.programUpdates) ? libraryContent.programUpdates : [];
    programUpdates.forEach((entry) => {
      const eventId = Number(entry?.eventId || 0);
      const summary = String(entry?.summary || '').trim();
      if (eventId > 0 && summary) {
        map.set(eventId, summary);
      }
    });
    return map;
  }, [libraryContent]);

  const eventsTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Events Top Banner'), [ads]);
  const eventsFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Events Footer Banner'), [ads]);
  const eventsTopAdImageHeightClass = eventsTopAds.length > 2 ? 'h-16 md:h-20' : 'h-24 md:h-28';
  const eventsFooterAdImageHeightClass = eventsFooterAds.length > 2 ? 'h-16 md:h-20' : 'h-24 md:h-28';
  const eventsTopAdsGridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${Math.max(1, eventsTopAds.length)}, minmax(0, 1fr))` }), [eventsTopAds.length]);
  const eventsFooterAdsGridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${Math.max(1, eventsFooterAds.length)}, minmax(0, 1fr))` }), [eventsFooterAds.length]);

  const registrationMutation = useMutation({
    mutationFn: (values) => {
      if (!isAuthenticated && !allowIdentityOverride) {
        throw new Error('Please sign in to register for events.');
      }
      if (isAuthenticated && profilePhoneMissing) {
        throw new Error('Please add your phone number in profile before registering for events.');
      }

      const inputEmail = String(values?.email || '').trim().toLowerCase();
      const inputContact = String(values?.contact || '').trim().toLowerCase();
      const existingRegistrants = Array.isArray(selectedEvent?.registrants) ? selectedEvent.registrants : [];
      const alreadyRegistered = existingRegistrants.some((entry) => {
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const entryContact = String(entry.contact || '').trim().toLowerCase();
        return (inputEmail && entryEmail === inputEmail)
          || (inputContact && entryContact === inputContact);
      });

      if (alreadyRegistered) {
        throw new Error('You have already registered for this event.');
      }

      if (!isEventCurrent(selectedEvent)) {
        throw new Error('This event is no longer available for registration.');
      }

      return eventService.registerForEvent({
        eventId: selectedEvent?.id,
        name: values.name,
        email: values.email,
        contact: values.contact
      }).then((response) => response.data);
    },
    onSuccess: (updatedEvent, values) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      registrationForm.reset(registrationDefaults);

      const latestRegistrant = (updatedEvent?.registrants || []).find((entry) => {
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const entryContact = String(entry.contact || '').trim().toLowerCase();
        const inputEmail = String(values?.email || '').trim().toLowerCase();
        const inputContact = String(values?.contact || '').trim().toLowerCase();
        return (inputEmail && entryEmail === inputEmail) || (inputContact && entryContact === inputContact);
      });

      setSelectedEvent(null);
      if (latestRegistrant?.status === 'waitlisted') {
        window.alert('Capacity is full. You were added to the waitlist.');
        return;
      }

      window.alert('Registration saved successfully.');
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to save this registration right now.');
    }
  });

  const downloadEventCalendarFile = async (eventId) => {
    try {
      const { data: fileBlob } = await eventService.downloadEventCalendar(eventId);
      const blob = fileBlob instanceof Blob ? fileBlob : new Blob([fileBlob], { type: 'text/calendar;charset=utf-8' });
      const fileUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = fileUrl;
      anchor.download = `event-${String(eventId)}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(fileUrl);
    } catch (error) {
      window.alert(error?.message || 'Unable to download event calendar file right now.');
    }
  };

  const selectedEventDateLabel = selectedEvent?.date
    ? new Date(selectedEvent.date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Date TBD';
  const selectedEventTimeLabel = selectedEvent?.date
    ? `${new Date(selectedEvent.date).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })} - ${new Date(selectedEvent?.endDate || selectedEvent?.end).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`
    : 'Time TBD';
  const selectedEventLoginNext = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    if (selectedEvent?.id) {
      params.set('eventId', String(selectedEvent.id));
    }
    const queryText = params.toString();
    return `/events${queryText ? `?${queryText}` : ''}`;
  }, [location.search, selectedEvent?.id]);

  const selectedEventCapacity = Number(selectedEvent?.capacity || 0);
  const selectedEventConfirmedRegistrations = Number(selectedEvent?.registrations || 0);
  const selectedEventIsFull = selectedEventCapacity > 0 && selectedEventConfirmedRegistrations >= selectedEventCapacity;
  const selectedEventWaitlistEnabled = selectedEvent?.waitlistEnabled !== false;
  const isSelectedEventAvailable = Boolean(selectedEvent) && isEventCurrent(selectedEvent);
  const canRegisterForSelectedEvent = isSelectedEventAvailable && (!selectedEventIsFull || selectedEventWaitlistEnabled);

  const activeEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => event.active !== false && isEventCurrent(event, now));
  }, [events]);

  const filtered = useMemo(
    () => (category === 'All' ? activeEvents : activeEvents.filter((event) => event.category === category)),
    [activeEvents, category]
  );

  const calendarEvents = useMemo(() => filtered.map((event) => {
    const startDate = new Date(event.date);
    const parsedEndDate = event.endDate ? new Date(event.endDate) : null;
    const endDate = parsedEndDate && !Number.isNaN(parsedEndDate.getTime())
      ? parsedEndDate
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    return {
      id: event.id,
      title: event.title,
      description: String(event.description || '').trim() || librarySummaryByEventId.get(Number(event.id)) || '',
      category: event.category,
      location: event.location,
      mediaUrl: event.mediaUrl || '',
      registrations: event.registrations,
      capacity: Number(event.capacity || 0),
      waitlistEnabled: event.waitlistEnabled !== false,
      waitlistCount: Number(event.waitlistCount || 0),
      registrants: Array.isArray(event.registrants) ? event.registrants : [],
      date: event.date,
      endDate: event.endDate,
      start: startDate,
      end: endDate
    };
  }), [filtered, librarySummaryByEventId]);

  const selectedEventDescription = useMemo(() => {
    if (!selectedEvent) {
      return '';
    }
    return String(selectedEvent.description || '').trim() || librarySummaryByEventId.get(Number(selectedEvent.id)) || '';
  }, [librarySummaryByEventId, selectedEvent]);

  const isAlreadyRegisteredForSelectedEvent = useMemo(() => {
    if (!isAuthenticated || !selectedEvent) {
      return false;
    }

    const registrationEmail = normalizeTextToken(registrationDefaults.email);
    const registrationContactText = normalizeTextToken(registrationDefaults.contact);
    const registrationContactPhone = normalizePhoneToken(registrationDefaults.contact);
    const registrationName = normalizeTextToken(registrationDefaults.name);
    const registrants = Array.isArray(selectedEvent.registrants) ? selectedEvent.registrants : [];

    return registrants.some((entry) => {
      const entryEmail = normalizeTextToken(entry.email);
      const entryContact = normalizeTextToken(entry.contact || entry.phone || entry.whatsapp);
      const entryContactPhone = normalizePhoneToken(entry.contact || entry.phone || entry.whatsapp);
      const entryName = normalizeTextToken(entry.name);

      return (currentUserEmail && (entryEmail === currentUserEmail || entryContact === currentUserEmail))
        || (registrationEmail && entryEmail === registrationEmail)
        || (currentUserPhone && entryContactPhone && entryContactPhone === currentUserPhone)
        || (registrationContactPhone && entryContactPhone && entryContactPhone === registrationContactPhone)
        || (registrationContactText && entryContact === registrationContactText)
        || (currentUserName && entryName === currentUserName)
        || (registrationName && entryName === registrationName);
    });
  }, [currentUserEmail, currentUserName, currentUserPhone, isAuthenticated, registrationDefaults.contact, registrationDefaults.email, registrationDefaults.name, selectedEvent]);

  const selectedDateEvents = useMemo(() => {
    const selectedDay = selectedDate.toDateString();
    return filtered
      .filter((event) => new Date(event.date).toDateString() === selectedDay)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filtered, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return filtered
      .filter((event) => new Date(event.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [filtered]);

  const monthEventMarkers = useMemo(() => {
    const markers = {};
    filtered.forEach((event) => {
      const dayKey = format(new Date(event.date), 'yyyy-MM-dd');
      if (!markers[dayKey]) {
        markers[dayKey] = [];
      }
      if (!markers[dayKey].includes(event.category)) {
        markers[dayKey].push(event.category);
      }
    });
    return markers;
  }, [filtered]);

  const calendarEventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: '#0a4d9f',
        borderColor: '#0a4d9f',
        color: '#f5a623',
        borderRadius: '10px',
        borderWidth: '1px',
        padding: '5px 8px',
        marginBottom: '4px',
        fontSize: '12px',
        fontWeight: 800,
        lineHeight: 1.25
      }
    };
  };

  const truncateEventTitle = (value = '') => {
    const safeTitle = String(value || '');
    if (safeTitle.length <= 18) {
      return safeTitle;
    }
    return `${safeTitle.slice(0, 18)}...`;
  };

  const CalendarEventCard = ({ event }) => (
    <div className="truncate py-0.5">
      <p className="truncate font-bold tracking-tight">{truncateEventTitle(event.title)}</p>
    </div>
  );

  useEffect(() => {
    registrationForm.reset(registrationDefaults);
  }, [registrationDefaults, registrationForm]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const requestedEventId = params.get('eventId');

    if (!requestedEventId || events.length === 0) {
      deepLinkOpenedRef.current = '';
      return;
    }

    if (deepLinkOpenedRef.current === requestedEventId) {
      return;
    }

    const requestedAsNumber = Number(requestedEventId);
    const linkedEvent = events.find((entry) => (
      String(entry.id) === requestedEventId || (!Number.isNaN(requestedAsNumber) && Number(entry.id) === requestedAsNumber)
    ));

    if (linkedEvent) {
      setSelectedDate(new Date(linkedEvent.date));
      setSelectedEvent(linkedEvent);
      deepLinkOpenedRef.current = requestedEventId;
    }
  }, [events, location.search]);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle ?? 'Events and Registrations'} description={content?.heroDescription ?? 'Switch between calendar and list views, filter by category, and RSVP online.'} />
      {isAuthenticated && profilePhoneMissing ? <PhoneNumberRequiredNotice activityLabel="event registrations" /> : null}
      {content?.mediaUrl ? <img src={content.mediaUrl} alt="Events banner" className="h-56 w-full rounded-xl object-cover" loading="lazy" /> : null}
      {eventsTopAds.length > 0 ? (
        <section className="rounded-xl py-2">
          <div className="grid w-full gap-2" style={eventsTopAdsGridStyle}>
            {eventsTopAds.map((ad) => (
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
                className="block min-w-0 overflow-hidden rounded-lg transition hover:opacity-95"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className={`${eventsTopAdImageHeightClass} w-full p-1 object-contain`} loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      {content?.intro ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: content.intro }} /> : null}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 lg:sticky lg:top-24 lg:self-start">
          <label className="block text-sm font-medium">
            Filter by category
            <select className="mt-2 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>All</option>
              <option>Paath</option>
              <option>Workshop</option>
              <option>Seva</option>
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Day</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{format(selectedDate, 'EEEE, MMM d, yyyy')}</p>
            <p className="mt-1 text-xs text-slate-600">{selectedDateEvents.length} event{selectedDateEvents.length === 1 ? '' : 's'} found</p>
          </div>

          <ReactCalendar
            className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
            onChange={setSelectedDate}
            value={selectedDate}
            tileContent={({ date, view }) => {
              if (view !== 'month') {
                return null;
              }
              const key = format(date, 'yyyy-MM-dd');
              const categories = monthEventMarkers[key] || [];
              if (categories.length === 0) {
                return null;
              }
              return (
                <span className="mt-1 flex items-center justify-center gap-0.5">
                  {categories.slice(0, 3).map((cat) => (
                    <span key={`${key}-${cat}`} className={`h-1.5 w-1.5 rounded-full ${categoryDotClass[cat] || 'bg-brand-blue'}`} />
                  ))}
                </span>
              );
            }}
          />

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category Legend</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-700">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Paath</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Workshop</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Seva</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Day Agenda</p>
            {selectedDateEvents.length > 0 ? selectedDateEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEvent(event)}
                className={`w-full rounded-lg bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow ${categoryAccent[event.category] || 'border-l-4 border-l-brand-blue'}`}
              >
                <p className="truncate font-semibold text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-600">{format(new Date(event.date), 'h:mm a')} • {event.location || 'Location TBD'}</p>
              </button>
            )) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No events for this date.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming Events</p>
            {upcomingEvents.length > 0 ? upcomingEvents.map((event) => (
              <button
                key={`upcoming-${event.id}`}
                type="button"
                onClick={() => {
                  setSelectedDate(new Date(event.date));
                  setSelectedEvent(event);
                }}
                className={`w-full rounded-lg bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow ${categoryAccent[event.category] || 'border-l-4 border-l-brand-blue'}`}
              >
                <p className="truncate font-semibold text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-600">{format(new Date(event.date), 'EEE, MMM d • h:mm a')}</p>
              </button>
            )) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No upcoming events yet.</p>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="events-calendar-shell hidden h-[740px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-blue-50/35 p-3 shadow-[0_18px_46px_-28px_rgba(30,64,175,0.38)] md:block">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calendar View</p>
              <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-[11px] font-bold text-brand-blue">{calendarEvents.length} events in view</span>
            </div>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              date={selectedDate}
              view={calendarView}
              onView={setCalendarView}
              views={['month', 'week', 'day', 'agenda']}
              startAccessor="start"
              endAccessor="end"
              onNavigate={setSelectedDate}
              onSelectSlot={({ start }) => setSelectedDate(start)}
              selectable
              popup={false}
              messages={{
                month: 'Month',
                week: 'Week',
                day: 'Day',
                agenda: 'Agenda',
                showMore: (total) => `+${total}`
              }}
              doShowMoreDrillDown={false}
              onShowMore={(eventsOnDay, date) => {
                setSelectedDate(date);
                setOverflowEventsModal({
                  open: true,
                  date,
                  events: eventsOnDay
                });
              }}
              onSelectEvent={(event) => setSelectedEvent(event)}
              eventPropGetter={calendarEventStyleGetter}
              components={{ event: CalendarEventCard }}
            />
          </div>
        </div>
      </div>

      {overflowEventsModal.open ? (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-900/45 px-4 py-4">
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-semibold text-slate-900">All Events on {format(new Date(overflowEventsModal.date), 'EEEE, MMM d')}</h3>
                <p className="text-sm text-slate-600">Select any event to open registration.</p>
              </div>
              <button type="button" onClick={() => setOverflowEventsModal({ open: false, date: null, events: [] })} className="rounded-md border border-slate-300 px-3 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {overflowEventsModal.events.map((event) => (
                <button
                  key={`overflow-${event.id}`}
                  type="button"
                  onClick={() => {
                    setOverflowEventsModal({ open: false, date: null, events: [] });
                    setSelectedEvent(event);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-brand-blue/35 hover:bg-blue-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <p className="text-xs text-slate-700">{format(new Date(event.start), 'h:mm a')} - {format(new Date(event.end), 'h:mm a')} • {event.location || 'Location TBD'}</p>
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-[90] overflow-x-hidden overflow-y-auto bg-slate-900/45 px-4 py-4">
          <div className="mx-auto flex min-h-full min-w-0 items-center justify-center">
          <div className="box-border max-h-[calc(100vh-2rem)] w-full min-w-0 max-w-4xl overflow-x-hidden overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h3 className="min-w-0 break-words font-heading text-xl font-semibold text-slate-900 sm:text-2xl">Event Details and Registration</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-sm">Close</button>
            </div>

            <div className="mt-3 border-b border-slate-200" />

            <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 text-sm text-slate-700">
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-blue/25 bg-brand-blue px-3 py-1 text-xs font-extrabold tracking-wide text-white shadow-sm">
                {selectedEvent.category || 'Event'}
              </span>
              <button
                type="button"
                onClick={() => {
                  void downloadEventCalendarFile(selectedEvent.id);
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold tracking-wide text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
              >
                <CalendarDaysIcon className="h-3.5 w-3.5" />
                <span className="uppercase">Add To Calendar</span>
              </button>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mt-1 break-words font-heading text-2xl font-extrabold text-slate-900" title={selectedEvent.title}>{selectedEvent.title}</h4>
                <p className="mt-1 break-words text-xs font-semibold uppercase tracking-wide text-slate-500">{selectedEventDateLabel} • {selectedEventTimeLabel}</p>
                <div className="mt-3 border-t border-slate-200" />
                <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
                  {selectedEventDescription || 'No description provided for this event yet.'}
                </p>
                {selectedEvent.mediaUrl ? <img src={selectedEvent.mediaUrl} alt={selectedEvent.title || 'Event media'} className="mt-3 h-44 w-full rounded-lg object-cover" loading="lazy" /> : null}
              </section>

              <section className="min-w-0 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h4 className="font-heading text-lg font-semibold text-slate-900">Register for This Event</h4>
                  <div className="text-right text-sm font-semibold text-brand-green">
                    <p>Total Registrations: {selectedEvent.registrations || 0}</p>
                    {selectedEvent.capacity > 0 ? (
                      <p className="text-xs text-slate-600">
                        Capacity: {selectedEvent.capacity} • Spots left: {Math.max(0, selectedEvent.capacity - Number(selectedEvent.registrations || 0))}
                      </p>
                    ) : null}
                    {selectedEventIsFull ? (
                      <p className="text-xs text-slate-600">
                        {selectedEventWaitlistEnabled ? 'Waitlist is open' : 'Waitlist is disabled'}
                      </p>
                    ) : null}
                  </div>
                </div>
                {!isAuthenticated && !allowIdentityOverride ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Please <Link to={`/login?next=${encodeURIComponent(selectedEventLoginNext)}`} state={{ from: { pathname: '/events', search: selectedEventLoginNext.replace('/events', '') } }} className="font-bold underline">sign in</Link> to register for this event.
                  </p>
                ) : (
                  <form className="mt-3 space-y-3" onSubmit={registrationForm.handleSubmit((values) => registrationMutation.mutate(values))}>
                    {isAuthenticated ? <input type="hidden" {...registrationForm.register('name', { required: true })} /> : null}
                    {isAuthenticated ? <input type="hidden" {...registrationForm.register('email', { required: true })} /> : null}
                    {isAuthenticated ? <input type="hidden" {...registrationForm.register('contact', { required: true })} /> : null}
                    {!isAuthenticated ? (
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-700">
                          Name
                          <input
                            type="text"
                            {...registrationForm.register('name', { required: true })}
                            required
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="Enter your name"
                          />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                          Email
                          <input
                            type="email"
                            {...registrationForm.register('email', { required: true })}
                            required
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="name@example.com"
                          />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                          Phone (optional)
                          <PhoneInput
                            {...registrationForm.register('contact', { validate: (value) => !value || isTenDigitPhone(value) || TEN_DIGIT_PHONE_ERROR })}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </label>
                      </div>
                    ) : null}
                    {isAuthenticated && profilePhoneMissing ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Add your phone number in profile before registering for any event.
                      </p>
                    ) : null}
                    {isAlreadyRegisteredForSelectedEvent ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        You have already registered for this event.
                      </p>
                    ) : null}
                    {!isAlreadyRegisteredForSelectedEvent && !isSelectedEventAvailable ? (
                      <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                        Registration is closed because this event date has passed.
                      </p>
                    ) : null}
                    {!isAlreadyRegisteredForSelectedEvent && isSelectedEventAvailable && selectedEventIsFull && selectedEventWaitlistEnabled ? (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                        This event is full. You can still join the waitlist.
                      </p>
                    ) : null}
                    {!isAlreadyRegisteredForSelectedEvent && isSelectedEventAvailable && selectedEventIsFull && !selectedEventWaitlistEnabled ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                        This event is full and waitlist is closed.
                      </p>
                    ) : null}
                    {isAuthenticated ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registered As</p>
                        <div className="mt-2 space-y-1 text-xs text-slate-700">
                          <p><span className="font-semibold text-slate-800">Name:</span> {registrationDefaults.name || '-'}</p>
                          <p><span className="font-semibold text-slate-800">Email:</span> {registrationDefaults.email || '-'}</p>
                          <p><span className="font-semibold text-slate-800">Phone:</span> {registrationDefaults.contact || '-'}</p>
                        </div>
                      </div>
                    ) : null}
                    {!isAlreadyRegisteredForSelectedEvent ? (
                      <Button type="submit" className="w-full" disabled={registrationMutation.isPending || (isAuthenticated && profilePhoneMissing) || !canRegisterForSelectedEvent}>
                        {registrationMutation.isPending
                          ? 'Saving...'
                          : (selectedEventIsFull && selectedEventWaitlistEnabled ? 'Join Waitlist' : 'Save Registration')}
                      </Button>
                    ) : null}
                  </form>
                )}
              </section>
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {eventsFooterAds.length > 0 ? (
        <section className="rounded-xl py-2">
          <div className="grid w-full gap-2" style={eventsFooterAdsGridStyle}>
            {eventsFooterAds.map((ad) => (
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
                className="block min-w-0 overflow-hidden rounded-lg transition hover:opacity-95"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className={`${eventsFooterAdImageHeightClass} w-full p-1 object-contain`} loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default EventsPage;
