import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  BellAlertIcon,
  ChartBarSquareIcon,
  CalendarDaysIcon,
  CameraIcon,
  CurrencyDollarIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PhotoIcon,
  QueueListIcon,
  RectangleGroupIcon,
  SignalIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
  VideoCameraIcon,
  BookOpenIcon,
  HeartIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { adminNav } from '../constants/navigation';
import { useAuth } from '../context/AuthContext';
import gurdwaraLogo from '../assets/gurdwara-logo.webp';

const FULL_ACCESS_ROLES = new Set(['Super Admin', 'Admin']);

const MEMBER_VISIBLE_PATHS = [
  '/admin',
  '/admin/hukamnama',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/library',
  '/admin/videos',
  '/admin/streaming',
  '/admin/events'
];

const getFirstName = (fullName) => {
  const tokens = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return tokens[0] || 'Member';
};

const iconByPath = {
  '/admin': Squares2X2Icon,
  '/admin/cms': RectangleGroupIcon,
  '/admin/news': NewspaperIcon,
  '/admin/schedule': CalendarDaysIcon,
  '/admin/hukamnama': SparklesIcon,
  '/admin/langar': HeartIcon,
  '/admin/seva-opportunities': UserGroupIcon,
  '/admin/gallery': PhotoIcon,
  '/admin/library': BookOpenIcon,
  '/admin/videos': VideoCameraIcon,
  '/admin/streaming': SignalIcon,
  '/admin/advertisements': MegaphoneIcon,
  '/admin/sponsors': CameraIcon,
  '/admin/events': QueueListIcon,
  '/admin/kids-learning': BookOpenIcon,
  '/admin/donations': CurrencyDollarIcon,
  '/admin/audit-trail': BellAlertIcon,
  '/admin/users': UsersIcon,
  '/admin/analytics': ChartBarSquareIcon
};

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accessDeniedModalOpen, setAccessDeniedModalOpen] = useState(false);
  const [accessDeniedNotice, setAccessDeniedNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerAction, setHeaderAction] = useState(null);
  const firstName = getFirstName(user?.name);
  const hasFullAccess = FULL_ACCESS_ROLES.has(String(user?.role || ''));
  const visibleNav = hasFullAccess
    ? adminNav
    : adminNav.filter((item) => MEMBER_VISIBLE_PATHS.includes(item.path));
  const currentNavItem = [...adminNav]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const pageTitle = currentNavItem?.label || (location.pathname.startsWith('/admin/analytics') ? 'Analytics and KPIs' : 'Admin');

  useEffect(() => {
    const state = location.state || {};
    if (!state.accessDenied) {
      return;
    }

    const message = 'You are not allowed to access that section. Please contact an admin or super admin for access.';
    setAccessDeniedNotice(message);
    setAccessDeniedModalOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr]">
      <aside className="hidden border-r border-slate-800 bg-slate-950 p-4 text-slate-100 lg:block">
        <p className="flex items-center gap-2 font-heading text-xl font-bold text-white">
          <img src={gurdwaraLogo} alt="Singh Sabha logo" className="h-8 w-8 rounded-full border border-brand-saffron/70 object-cover" />
          Admin Portal
        </p>
        <nav className="mt-6 grid gap-2" aria-label="Admin navigation">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-blue text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              {(() => {
                const Icon = iconByPath[item.path] || Squares2X2Icon;
                return (
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </span>
                );
              })()}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="admin-main-content p-4 md:p-8">
        <div className="mb-6 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 lg:hidden"
                aria-label="Open admin menu"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <h1 className="font-heading text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{pageTitle}</h1>
              {headerAction ? <div className="flex-shrink-0">{headerAction}</div> : null}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <img src={user?.avatarUrl || gurdwaraLogo} alt={user?.name || 'Profile'} className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-semibold text-slate-700 underline underline-offset-4"
              >
                Logout
              </button>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <img src={user?.avatarUrl || gurdwaraLogo} alt={user?.name || 'Profile'} className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
              <p className="text-base font-extrabold text-slate-800">{firstName}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-semibold text-slate-700 underline underline-offset-4"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        <Outlet context={{ setHeaderAction }} />

        {accessDeniedModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" role="dialog" aria-modal="true" aria-live="assertive">
            <div className="w-full max-w-md rounded-2xl border border-rose-300 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-rose-800">Access Restricted</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{accessDeniedNotice || 'You are not allowed to access that section. Please contact an admin or super admin for access.'}</p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAccessDeniedModalOpen(false)}
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[140] lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            aria-label="Close admin menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative h-full w-[86%] max-w-[320px] overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-heading text-xl font-bold text-white">
                <img src={gurdwaraLogo} alt="Singh Sabha logo" className="h-8 w-8 rounded-full border border-brand-saffron/70 object-cover" />
                Admin Portal
              </p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md border border-slate-700 p-1 text-slate-300"
                aria-label="Close admin menu"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-6 grid gap-2" aria-label="Admin navigation mobile">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-brand-blue text-white' : 'text-slate-300 hover:bg-slate-800'}`
                  }
                >
                  {(() => {
                    const Icon = iconByPath[item.path] || Squares2X2Icon;
                    return (
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                    );
                  })()}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLayout;
