import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Card from '../ui/Card';
import { formatDate } from '../../utils/formatters';

const EventCard = ({ event }) => (
  <Card className="h-full">
    <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">{event.category}</p>
    <h3 className="mt-2 font-heading text-xl font-semibold text-slate-900 dark:text-white">{event.title}</h3>
    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-200">
      <p className="flex items-center gap-2"><CalendarDaysIcon className="h-4 w-4" /> {formatDate(event.date)}</p>
      <p className="flex items-center gap-2"><MapPinIcon className="h-4 w-4" /> {event.location}</p>
    </div>
    <p className="mt-4 text-sm font-medium text-brand-green">{event.registrations} registrations</p>
  </Card>
);

export default EventCard;
