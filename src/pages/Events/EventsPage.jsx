import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ReactCalendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import eventService from '../../services/eventService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import Button from '../../components/ui/Button';
import cmsService from '../../services/cmsService';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const EventsPage = () => {
  const meta = useSeoMeta('Events', 'Event calendar, list view, filters, and RSVP registration for all programs.');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [category, setCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const queryClient = useQueryClient();
  const registrationForm = useForm({ defaultValues: { name: '', contact: '' } });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => eventService.getEvents().then((res) => res.data) });
  const { data: content } = useQuery({
    queryKey: ['page-content', 'events'],
    queryFn: () => cmsService.getPageContent('events').then((res) => res.data)
  });

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

  const calendarEvents = filtered.map((event) => ({
    id: event.id,
    title: event.title,
    category: event.category,
    location: event.location,
    registrations: event.registrations,
    date: event.date,
    start: new Date(event.date),
    end: new Date(new Date(event.date).getTime() + 60 * 60 * 1000)
  }));

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle || 'Events and Registrations'} description={content?.heroDescription || 'Switch between calendar and list views, filter by category, and RSVP online.'} />
      {content?.intro ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">{content.intro}</p> : null}
      {content?.mediaUrl ? <img src={content.mediaUrl} alt="Events banner" className="h-56 w-full rounded-xl object-cover" loading="lazy" /> : null}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <label className="block text-sm font-medium">
            Filter by category
            <select className="mt-2 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>All</option>
              <option>Paath</option>
              <option>Workshop</option>
              <option>Seva</option>
            </select>
          </label>
          <ReactCalendar onChange={setSelectedDate} value={selectedDate} />
        </div>
        <div className="space-y-6">
          <div className="h-[460px] rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <Calendar localizer={localizer} events={calendarEvents} startAccessor="start" endAccessor="end" onSelectEvent={(event) => setSelectedEvent(event)} />
          </div>
        </div>
      </div>

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
                <p className="mt-2 text-sm text-slate-700">Date: {new Date(selectedEvent.date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="text-sm text-slate-700">Time: {new Date(selectedEvent.date).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</p>
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
    </div>
  );
};

export default EventsPage;
