import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useBranding } from '../../context/BrandingContext';

const formatEventDate = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const titleSizeFor = (title) => {
  const length = String(title || '').length;
  if (length <= 22) return 11;
  if (length <= 40) return 9;
  if (length <= 70) return 7;
  return 5.5;
};

// Sizes use container units (cqmin) so the slide scales with its box: LED screen, portrait panel, or admin preview.
const LedAnnouncementSlide = ({ announcement }) => {
  const { branding, logoSrc } = useBranding();
  if (!announcement) return null;

  if (announcement.type === 'image' && announcement.imageUrl) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-black">
        <img src={announcement.imageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        <img src={announcement.imageUrl} alt={announcement.title || 'Announcement'} className="relative h-full w-full object-contain" />
      </div>
    );
  }

  const eventDate = formatEventDate(announcement.eventDate);
  const unit = (value) => `${value}cqmin`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#06142f] text-white" style={{ containerType: 'size' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f]" />
      <div className="absolute -right-[18cqmin] -top-[18cqmin] h-[80cqmin] w-[80cqmin] rounded-full" style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.32) 0%, rgba(245,166,35,0) 68%)' }} />
      <div className="absolute -bottom-[22cqmin] -left-[16cqmin] h-[75cqmin] w-[75cqmin] rounded-full" style={{ background: 'radial-gradient(circle, rgba(56,132,255,0.28) 0%, rgba(56,132,255,0) 68%)' }} />
      <div className="absolute border-2 border-brand-saffron/40" style={{ inset: unit(2.5), borderRadius: unit(2) }} />

      <div className="relative flex h-full w-full flex-col justify-between" style={{ padding: unit(7) }}>
        <header className="flex items-center" style={{ gap: unit(2.4) }}>
          <img src={logoSrc} alt="" className="shrink-0 rounded-full border-2 border-brand-saffron object-cover" style={{ width: unit(9), height: unit(9) }} />
          <div className="min-w-0">
            <p className="font-black uppercase text-brand-saffron" style={{ fontSize: unit(2.6), letterSpacing: '0.22em' }}>Special Announcement</p>
            <p className="truncate font-bold text-blue-100" style={{ fontSize: unit(3.2) }}>{branding.organizationName || branding.shortName}</p>
          </div>
        </header>

        <section className="min-w-0" style={{ paddingBlock: unit(3) }}>
          <h2 className="break-words font-heading font-black leading-[1.05] text-white" style={{ fontSize: unit(titleSizeFor(announcement.title)) }}>{announcement.title}</h2>
          <div className="rounded-full bg-brand-saffron" style={{ marginBlock: unit(2.6), height: unit(1), width: unit(16) }} />
          {announcement.subtitle ? <p className="break-words font-bold leading-tight text-amber-200" style={{ fontSize: unit(5) }}>{announcement.subtitle}</p> : null}
          {announcement.details ? <p className="whitespace-pre-line break-words font-medium leading-snug text-blue-50/90" style={{ marginTop: unit(2.6), fontSize: unit(3.4) }}>{announcement.details}</p> : null}
        </section>

        <footer className="flex flex-wrap font-bold text-white" style={{ gap: `${unit(1.4)} ${unit(4)}`, fontSize: unit(3.3) }}>
          {eventDate ? <span className="inline-flex items-center" style={{ gap: unit(1.4) }}><CalendarDaysIcon className="text-brand-saffron" style={{ width: unit(4), height: unit(4) }} />{eventDate}</span> : null}
          {announcement.location ? <span className="inline-flex items-center" style={{ gap: unit(1.4) }}><MapPinIcon className="text-brand-saffron" style={{ width: unit(4), height: unit(4) }} />{announcement.location}</span> : null}
        </footer>
      </div>
    </div>
  );
};

export default LedAnnouncementSlide;
