import { useMemo, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  PauseIcon,
  PlayIcon,
  HomeIcon,
  InformationCircleIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  HandRaisedIcon,
  GiftIcon,
  PhotoIcon,
  PhoneIcon,
  FilmIcon
} from '@heroicons/react/24/outline';
import { publicNav } from '../../constants/navigation';
import { siteConfig } from '../../constants/siteConfig';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';
import { getNanakshahiDate } from '../../utils/punjabiCalendar';

const navClass = ({ isActive }) =>
  `border-b-[3px] px-3 py-2 text-base font-semibold tracking-tight transition ${isActive ? 'border-brand-saffron text-brand-blue' : 'border-transparent text-slate-600 hover:border-slate-200 hover:text-brand-blue'}`;

const iconClass = 'h-4.5 w-4.5';

const socialGlyphClass = 'h-3.5 w-3.5';

const WebsiteGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const YouTubeGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <path d="M22 12c0 2.5-.3 4.2-.7 5.2a3.6 3.6 0 0 1-2 2C18.2 19.6 16.5 20 12 20s-6.2-.4-7.3-.8a3.6 3.6 0 0 1-2-2C2.3 16.2 2 14.5 2 12s.3-4.2.7-5.2a3.6 3.6 0 0 1 2-2C5.8 4.4 7.5 4 12 4s6.2.4 7.3.8a3.6 3.6 0 0 1 2 2c.4 1 .7 2.7.7 5.2Z" fill="currentColor" />
    <path d="m10 9 5 3-5 3V9Z" fill="#0f172a" />
  </svg>
);

const FacebookGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <path d="M13.6 22V13.3h2.9l.4-3.4h-3.3V7.8c0-1 .3-1.7 1.8-1.7H17V3.1c-.8-.1-1.6-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.4v2.5H7.6v3.4h2.8V22h3.2Z" fill="currentColor" />
  </svg>
);

const InstagramGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
  </svg>
);

const leftMenu = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'About', path: '/about', icon: InformationCircleIcon },
  { label: 'Sikhism', path: '/sikhism', icon: BookOpenIcon },
  { label: 'Events', path: '/events', icon: CalendarDaysIcon }
];

const rightMenu = [
  { label: 'Library', path: '/library', icon: BookOpenIcon },
  { label: 'Videos', path: '/videos', icon: FilmIcon },
  { label: 'Seva', path: '/seva', icon: HandRaisedIcon },
  { label: 'Donation', path: '/donation', icon: GiftIcon },
  { label: 'Gallery', path: '/gallery', icon: PhotoIcon },
  { label: 'Contact', path: '/contact', icon: PhoneIcon }
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isKirtanPlaying, setIsKirtanPlaying] = useState(false);
  const [isKirtanLoading, setIsKirtanLoading] = useState(false);
  const liveAudioRef = useRef(null);
  const nanakshahiDate = useMemo(() => getNanakshahiDate(new Date()), []);

  const libraryFromRight = rightMenu.find((item) => item.path === '/library');
  const leftMenuBalanced = libraryFromRight ? [...leftMenu, libraryFromRight] : leftMenu;
  const rightMenuBalanced = rightMenu.filter((item) => item.path !== '/library');

  const toggleLiveKirtan = async () => {
    if (!liveAudioRef.current) {
      return;
    }

    if (isKirtanPlaying) {
      liveAudioRef.current.pause();
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      return;
    }

    try {
      setIsKirtanLoading(true);
      await liveAudioRef.current.play();
      setIsKirtanPlaying(true);
      setIsKirtanLoading(false);
    } catch {
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
    }
  };

  const statusDotClass = isKirtanPlaying
    ? 'bg-emerald-400'
    : (isKirtanLoading ? 'bg-amber-300' : 'bg-red-400');

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-b from-white via-white to-slate-50/60 shadow-[0_4px_18px_-4px_rgba(10,77,159,0.09)] backdrop-blur-md">
      <div className="hidden bg-brand-navy px-4 py-1 text-xs text-blue-50 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between md:px-2">
          <div className="flex items-center gap-2">
            <p>{siteConfig.contact.address}</p>
            <span className="text-blue-200">|</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-white hover:bg-blue-800/40"
                onClick={toggleLiveKirtan}
                aria-label={isKirtanPlaying ? 'Pause live kirtan' : 'Play live kirtan'}
              >
                {isKirtanPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              </button>
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
              <span className="text-[11px] font-semibold text-blue-50">Live Kirtan from Darbar Sahib</span>
              <audio
                ref={liveAudioRef}
                src={siteConfig.liveKirtanStreamUrl}
                preload="none"
                onPlaying={() => {
                  setIsKirtanPlaying(true);
                  setIsKirtanLoading(false);
                }}
                onPause={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(false);
                }}
                onEnded={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(false);
                }}
                onWaiting={() => setIsKirtanLoading(true)}
                onError={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(false);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p>{siteConfig.contact.phone} | {siteConfig.contact.email}</p>
            <Link to="/login?mode=admin&next=/admin" className="rounded-full border border-blue-200/40 px-2 py-0.5 text-[11px] font-semibold text-blue-50 hover:bg-blue-800/40">Admin Portal</Link>
            <Link to="/login?mode=join&type=volunteer" className="rounded-full border border-blue-200/40 px-2 py-0.5 text-[11px] font-semibold text-blue-50 hover:bg-blue-800/40">Join Volunteer</Link>
            <a href={siteConfig.baseUrl} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="Website">
              <WebsiteGlyph />
            </a>
            <a href={siteConfig.social.youtube} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="YouTube">
              <YouTubeGlyph />
            </a>
            <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="Facebook">
              <FacebookGlyph />
            </a>
            <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="Instagram">
              <InstagramGlyph />
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center px-4 py-3 md:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <nav className="hidden w-full items-center justify-between pr-8 lg:flex" aria-label="Left navigation">
            {leftMenuBalanced.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={navClass}>
                <span className="inline-flex items-center gap-1.5"><Icon className={iconClass} /> {item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <Link to="/" className="mx-8 flex items-center justify-center px-3 text-center font-heading text-brand-blue">
          <img src={gurdwaraLogo} alt="Gurdwara Singh Sabha Milton logo" className="h-[7.5rem] w-[7.5rem] rounded-full border-2 border-brand-saffron object-cover shadow-[0_4px_16px_rgba(245,166,35,0.25)]" />
        </Link>
        <div className="hidden w-full items-center justify-between pl-8 lg:flex">
          <nav className="flex w-full items-center justify-between" aria-label="Right navigation">
              {rightMenuBalanced.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.path} to={item.path} className={navClass}>
                  <span className="inline-flex items-center gap-1.5"><Icon className={iconClass} /> {item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-4 top-[70px] rounded-lg p-2 text-slate-700 lg:hidden"
          aria-label="Open mobile menu"
          aria-expanded={open}
        >
          {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>
      <div className="pb-3 text-center">
        <p className="text-base font-extrabold tracking-wide text-brand-blue md:text-lg">
          <span className="text-brand-blue">{nanakshahiDate.labelPa}</span>
        </p>
      </div>
      {open ? (
        <div className="border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-3 lg:hidden">
          <div className="grid gap-2">
            {publicNav.map((item) => (
              <NavLink key={item.path} to={item.path} className={navClass} onClick={() => setOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
