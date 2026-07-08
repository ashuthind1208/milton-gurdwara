import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  InformationCircleIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  HandRaisedIcon,
  GiftIcon,
  PhotoIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import { publicNav } from '../../constants/navigation';
import { siteConfig } from '../../constants/siteConfig';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';

const navClass = ({ isActive }) =>
  `border-b-2 px-3 py-2 text-base font-medium transition ${isActive ? 'border-brand-saffron text-brand-blue' : 'border-transparent text-slate-700 hover:text-brand-blue'}`;

const iconClass = 'h-4.5 w-4.5';

const leftMenu = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'About', path: '/about', icon: InformationCircleIcon },
  { label: 'Sikhism', path: '/sikhism', icon: BookOpenIcon },
  { label: 'Events', path: '/events', icon: CalendarDaysIcon }
];

const rightMenu = [
  { label: 'Seva', path: '/seva', icon: HandRaisedIcon },
  { label: 'Donation', path: '/donation', icon: GiftIcon },
  { label: 'Gallery', path: '/gallery', icon: PhotoIcon },
  { label: 'Contact', path: '/contact', icon: PhoneIcon }
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="hidden bg-brand-navy px-4 py-1 text-xs text-blue-50 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between md:px-2">
          <p>{siteConfig.contact.address}</p>
          <div className="flex items-center gap-3">
            <p>{siteConfig.contact.phone} | {siteConfig.contact.email}</p>
            <a href={siteConfig.baseUrl} target="_blank" rel="noreferrer" className="hover:underline">Website</a>
            <a href={siteConfig.social.youtube} target="_blank" rel="noreferrer" className="hover:underline">YouTube</a>
            <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer" className="hover:underline">Facebook</a>
            <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer" className="hover:underline">Instagram</a>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center px-4 py-3 md:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <nav className="hidden w-full items-center justify-between pr-8 lg:flex" aria-label="Left navigation">
          {leftMenu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={navClass}>
                <span className="inline-flex items-center gap-1.5"><Icon className={iconClass} /> {item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <Link to="/" className="mx-8 flex items-center justify-center px-3 text-center font-heading text-brand-blue">
          <img src={gurdwaraLogo} alt="Gurdwara Singh Sabha Milton logo" className="h-[7.5rem] w-[7.5rem] rounded-full border-2 border-brand-saffron object-cover shadow-soft" />
        </Link>
        <div className="hidden w-full items-center justify-between pl-8 lg:flex">
          <nav className="flex w-full items-center justify-between" aria-label="Right navigation">
            {rightMenu.map((item) => {
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
      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
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
