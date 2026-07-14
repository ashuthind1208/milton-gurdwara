import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import PageHero from '../../components/common/PageHero';
import eventService from '../../services/eventService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';
import advertisementService from '../../services/advertisementService';

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

const EventsPage = () => {
  const meta = useSeoMeta('Events', 'Event calendar, list view, filters, and RSVP registration for all programs.');
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [category, setCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [overflowEventsModal, setOverflowEventsModal] = useState({ open: false, date: null, events: [] });
  const deepLinkOpenedRef = useRef('');
  const queryClient = useQueryClient();
  const registrationForm = useForm({ defaultValues: { name: '', contact: '' } });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => eventService.getEvents().then((res) => res.data) });
  const { data: content } = useQuery({
    queryKey: ['page-content', 'events'],
    queryFn: () => cmsService.getPageContent('events').then((res) => res.data)
  });
  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });

  const eventsTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Events Top Banner').slice(0, 2), [ads]);
  const eventsFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Events Footer Banner').slice(0, 2), [ads]);

  const registrationMutation = useMutation({
    mutationFn: (values) => eventService.registerForEvent({
      eventId: selectedEvent?.id,
      name: values.name,
      contact: values.contact
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      registrationForm.reset({ name: '', contact: '' });
      setSelectedEvent(null);
      window.alert('Registration saved successfully.');
    }
  });

  const filtered = useMemo(
    () => (category === 'All' ? events : events.filter((event) => event.category === category)),
    [events, category]
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
      category: event.category,
      location: event.location,
      mediaUrl: event.mediaUrl || '',
      registrations: event.registrations,
      date: event.date,
      endDate: event.endDate,
      start: startDate,
      end: endDate
    };
  }), [filtered]);

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
      {content?.mediaUrl ? <img src={content.mediaUrl} alt="Events banner" className="h-56 w-full rounded-xl object-cover" loading="lazy" /> : null}
      {eventsTopAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
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
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      {content?.intro ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">{content.intro}</p> : null}
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
          <div className="events-calendar-shell h-[700px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-blue-50/35 p-3 shadow-[0_18px_46px_-28px_rgba(30,64,175,0.38)] md:h-[740px] md:overflow-hidden">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calendar View</p>
              <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-[11px] font-bold text-brand-blue">{calendarEvents.length} events in view</span>
            </div>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              date={selectedDate}
              startAccessor="start"
              endAccessor="end"
              onNavigate={setSelectedDate}
              onSelectSlot={({ start }) => setSelectedDate(start)}
              selectable
              popup={false}
              messages={{
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
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
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-2xl font-semibold text-slate-900">Event Details and Registration</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-md border border-slate-300 px-3 py-1 text-sm">Close</button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">{selectedEvent.category}</p>
                <h4 className="mt-1 font-heading text-xl font-semibold text-slate-900">{selectedEvent.title}</h4>
                {selectedEvent.mediaUrl ? <img src={selectedEvent.mediaUrl} alt={selectedEvent.title || 'Event media'} className="mt-3 h-44 w-full rounded-lg object-cover" loading="lazy" /> : null}
                <p className="mt-2 text-sm text-slate-700">Date: {new Date(selectedEvent.date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-sm text-slate-700">Time: {new Date(selectedEvent.date).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-sm text-slate-700">End Time: {new Date(selectedEvent.endDate || selectedEvent.end).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-sm text-slate-700">Location: {selectedEvent.location}</p>
                <p className="mt-2 text-sm font-semibold text-brand-green">Registered persons: {selectedEvent.registrations || 0}</p>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-heading text-lg font-semibold text-slate-900">Register for This Event</h4>
                <form className="mt-3 space-y-3" onSubmit={registrationForm.handleSubmit((values) => registrationMutation.mutate(values))}>
                  <label className="text-sm">Name
                    <input {...registrationForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                  </label>
                  <label className="text-sm">Contact
                    <input {...registrationForm.register('contact', { required: true })} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" />
                  </label>
                  <Button type="submit" className="w-full" disabled={registrationMutation.isPending}>{registrationMutation.isPending ? 'Saving...' : 'Save Registration'}</Button>
                </form>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {eventsFooterAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
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
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default EventsPage;
