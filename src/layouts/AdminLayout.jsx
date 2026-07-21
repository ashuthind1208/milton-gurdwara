import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bars3Icon,
  ArrowTopRightOnSquareIcon,
  PowerIcon,
  BellIcon,
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
import auditService from '../services/auditService';
import userService from '../services/userService';

const FULL_ACCESS_ROLES = new Set(['Super Admin', 'Admin']);

const NOTIFICATION_READ_KEY_PREFIX = 'ssm-admin-notifications-read';

const getFirstName = (fullName) => {
  const tokens = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return tokens[0] || 'Member';
};

const formatActivityTime = (value) => {
  if (!value) {
    return 'Just now';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return parsed.toLocaleDateString();
};

const toSimpleTargetLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'item';
  if (normalized.includes('user')) return 'user account';
  if (normalized.includes('event')) return 'event';
  if (normalized.includes('donation')) return 'donation';
  if (normalized.includes('volunteer') || normalized.includes('seva')) return 'seva application';
  if (normalized.includes('library')) return 'library item';
  return normalized.replace(/[_-]+/g, ' ');
};

const toSimpleActionLabel = (entry) => {
  const action = String(entry?.action || '').trim().toLowerCase();
  const target = toSimpleTargetLabel(entry?.targetType);

  if (action.includes('create') || action.includes('add') || action.includes('register')) {
    return `New ${target} added`;
  }
  if (action.includes('update') || action.includes('edit')) {
    return `${target.charAt(0).toUpperCase()}${target.slice(1)} updated`;
  }
  if (action.includes('delete') || action.includes('remove')) {
    return `${target.charAt(0).toUpperCase()}${target.slice(1)} removed`;
  }
  if (action.includes('approve')) {
    return 'User approved';
  }
  if (action.includes('reject')) {
    return 'User rejected';
  }

  return `${target.charAt(0).toUpperCase()}${target.slice(1)} activity`;
};

const getNotificationToneClasses = (entry, isRead) => {
  if (isRead) {
    return 'border-slate-200 bg-white';
  }

  if (entry.urgent) {
    return 'border-amber-300 bg-amber-50';
  }

  if (entry.kind === 'success') {
    return 'border-emerald-300 bg-emerald-50';
  }

  if (entry.kind === 'warning') {
    return 'border-amber-300 bg-amber-50';
  }

  if (entry.kind === 'danger') {
    return 'border-rose-300 bg-rose-50';
  }

  return 'border-blue-300 bg-blue-50';
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
  '/admin/roles-access': QueueListIcon,
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const notificationReadStorageKey = `${NOTIFICATION_READ_KEY_PREFIX}:${String(user?.email || 'guest').toLowerCase()}`;
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => auditService.getLogs().then((res) => res.data),
    staleTime: 30 * 1000
  });
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => userService.getUsers().then((res) => res.data),
    staleTime: 10 * 1000,
    refetchInterval: 5 * 1000,
    refetchIntervalInBackground: true
  });
  const effectiveUser = useMemo(() => {
    const currentEmail = String(user?.email || '').trim().toLowerCase();
    if (!currentEmail) {
      return user || null;
    }

    const matched = users.find((entry) => String(entry?.email || '').trim().toLowerCase() === currentEmail);
    return matched || user || null;
  }, [user, users]);
  const firstName = getFirstName(effectiveUser?.name);
  const hasFullAccess = FULL_ACCESS_ROLES.has(String(effectiveUser?.role || ''));
  const assignedAdminPages = useMemo(
    () => (Array.isArray(effectiveUser?.adminPageAccess) ? effectiveUser.adminPageAccess.map((path) => String(path || '').trim()).filter(Boolean) : []),
    [effectiveUser?.adminPageAccess]
  );
  const limitedAccessPaths = useMemo(() => {
    const normalized = [...new Set(assignedAdminPages)];
    if (normalized.includes('/admin')) {
      return normalized;
    }
    if (normalized.length === 0) {
      return ['/admin'];
    }
    return ['/admin', ...normalized];
  }, [assignedAdminPages]);
  const visibleNav = hasFullAccess
    ? adminNav
    : adminNav.filter((item) => limitedAccessPaths.includes(item.path));
  const currentNavItem = [...adminNav]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const pageTitle = currentNavItem?.label || (location.pathname.startsWith('/admin/analytics') ? 'Analytics and KPIs' : 'Admin');
  const pendingApprovals = useMemo(
    () => users.filter((entry) => String(entry?.approvalStatus || '').toLowerCase() === 'pending').length,
    [users]
  );
  const notifications = useMemo(() => {
    const items = [];

    if (pendingApprovals > 0) {
      items.push({
        id: 'pending-approvals',
        title: `${pendingApprovals} member approval${pendingApprovals === 1 ? '' : 's'} waiting`,
        meta: 'Please review new member requests.',
        timeLabel: 'Action needed',
        href: '/admin/users',
        urgent: true,
        kind: 'warning'
      });
    }

    const recentLogs = (Array.isArray(auditLogs) ? auditLogs : []).slice(0, 7).map((entry, index) => {
      const action = String(entry?.action || '').toLowerCase();
      const kind = action.includes('delete') || action.includes('remove')
        ? 'danger'
        : action.includes('create') || action.includes('add') || action.includes('approve')
          ? 'success'
          : 'info';

      return {
        id: entry?.id || `audit-${index}`,
        title: toSimpleActionLabel(entry),
        meta: `By ${entry?.actorName || entry?.actorEmail || 'system'}`,
        timeLabel: formatActivityTime(entry?.createdAt),
        href: '/admin/audit-trail',
        urgent: false,
        kind
      };
    });

    const combined = [...items, ...recentLogs];
    if (hasFullAccess) {
      return combined.slice(0, 8);
    }

    return combined.filter((entry) => !entry.href || limitedAccessPaths.includes(entry.href)).slice(0, 8);
  }, [auditLogs, hasFullAccess, limitedAccessPaths, pendingApprovals]);
  const unreadNotificationCount = useMemo(
    () => notifications.filter((entry) => !readNotificationIds.includes(entry.id)).length,
    [notifications, readNotificationIds]
  );

  const notificationCount = unreadNotificationCount;

  useEffect(() => {
    const state = location.state || {};
    if (!state.accessDenied) {
      return;
    }

    const message = "You don't have the right permissions for this page. Please check with admin.";
    setAccessDeniedNotice(message);
    setAccessDeniedModalOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (hasFullAccess) {
      return;
    }

    const isAllowed = limitedAccessPaths.some((path) => (
      path === '/admin'
        ? location.pathname === '/admin'
        : (location.pathname === path || location.pathname.startsWith(`${path}/`))
    ));

    if (isAllowed) {
      return;
    }

    navigate('/admin', {
      replace: true,
      state: {
        accessDenied: true,
        deniedPath: location.pathname
      }
    });
  }, [hasFullAccess, limitedAccessPaths, location.pathname, navigate]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(notificationReadStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setReadNotificationIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationReadStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(notificationReadStorageKey, JSON.stringify(readNotificationIds));
    } catch {
      // Ignore storage write errors.
    }
  }, [notificationReadStorageKey, readNotificationIds]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const inDesktop = notificationsDesktopRef.current?.contains(event.target);
      const inMobile = notificationsMobileRef.current?.contains(event.target);
      if (!inDesktop && !inMobile) {
        setIsNotificationsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationsOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      window.sessionStorage.setItem('ssm_admin_logout_in_progress', '1');
      window.sessionStorage.setItem('ssm_skip_login_auto_once', '1');
    } catch {
      // Ignore storage errors and continue logout flow.
    }

    setIsLoggingOut(true);
    navigate('/', { replace: true });

    try {
      try {
        await logout();
      } catch {
        // Continue redirect flow even if the API call fails.
      }
    } catch {
      // Ignore and keep user on public home.
    } finally {
      try {
        window.sessionStorage.removeItem('ssm_admin_logout_in_progress');
      } catch {
        // Ignore storage errors.
      }
    }
  };

  const markNotificationAsRead = (id) => {
    if (!id) {
      return;
    }
    setReadNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const markAllNotificationsAsRead = () => {
    setReadNotificationIds(notifications.map((entry) => entry.id));
  };

  const renderNotificationsPanel = (widthClassName) => (
    <div className={`absolute right-0 top-12 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${widthClassName}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">Notifications</p>
          <p className="text-[10px] text-slate-500">{unreadNotificationCount} unread</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllNotificationsAsRead}
            className="text-[11px] font-semibold text-slate-600 underline underline-offset-2"
            disabled={unreadNotificationCount === 0}
          >
            Mark all read
          </button>
          <Link to="/admin/audit-trail" onClick={() => setIsNotificationsOpen(false)} className="text-[11px] font-semibold text-brand-blue underline underline-offset-2">
            View all
          </Link>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {notifications.length === 0 ? <p className="p-2 text-xs text-slate-500">No new activities.</p> : null}
        {notifications.map((entry) => {
          const isRead = readNotificationIds.includes(entry.id);
          return (
            <div key={entry.id} className={`mb-1 rounded-lg border px-2 py-1.5 ${getNotificationToneClasses(entry, isRead)}`}>
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={entry.href}
                  onClick={() => {
                    markNotificationAsRead(entry.id);
                    setIsNotificationsOpen(false);
                  }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-xs font-semibold text-slate-800">{entry.title}</p>
                  <p className="truncate text-[11px] text-slate-600">{entry.meta}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{entry.timeLabel}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => markNotificationAsRead(entry.id)}
                  disabled={isRead}
                  className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRead ? 'Read' : 'Mark read'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="grid grid-cols-1 lg:min-h-screen lg:grid-cols-[270px_1fr]">
      <aside className="hidden border-r border-slate-800 bg-slate-950 p-4 text-slate-100 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto lg:self-start">
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
              <h1 className="min-w-0 truncate font-heading text-xl font-bold leading-tight text-slate-900 sm:text-3xl">{pageTitle}</h1>
              {headerAction ? <div className="flex-shrink-0">{headerAction}</div> : null}
            </div>

            <div className="relative flex flex-shrink-0 items-center gap-1.5 lg:hidden" ref={notificationsMobileRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700"
                aria-label="Open admin notifications"
                aria-expanded={isNotificationsOpen}
              >
                <BellIcon className="h-5 w-5" />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                ) : null}
              </button>
              <img src={effectiveUser?.avatarUrl || gurdwaraLogo} alt={effectiveUser?.name || 'Profile'} className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
              <Link
                to="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700"
                aria-label="Go to website"
                title="Go to website"
              >
                <ArrowTopRightOnSquareIcon className="h-5 w-5 stroke-2" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Logout"
                title="Logout"
              >
                <PowerIcon className="h-5 w-5 stroke-2" />
              </button>

              {isNotificationsOpen ? (
                renderNotificationsPanel('w-[min(88vw,22rem)]')
              ) : null}
            </div>

            <div className="relative hidden items-center gap-3 lg:flex" ref={notificationsDesktopRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-brand-blue/40 hover:text-brand-blue"
                aria-label="Open admin notifications"
                aria-expanded={isNotificationsOpen}
              >
                <BellIcon className="h-5 w-5" />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                ) : null}
              </button>
              <img src={effectiveUser?.avatarUrl || gurdwaraLogo} alt={effectiveUser?.name || 'Profile'} className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
              <p className="text-base font-extrabold text-slate-800">{firstName}</p>
              <Link
                to="/"
                className="text-sm font-semibold text-slate-700 underline underline-offset-4"
              >
                Go to Website
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-sm font-semibold text-slate-700 underline underline-offset-4"
              >
                Logout
              </button>

              {isNotificationsOpen ? (
                renderNotificationsPanel('w-[22rem]')
              ) : null}
            </div>
          </div>
        </div>
        <Outlet context={{ setHeaderAction }} />

        {accessDeniedModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" role="dialog" aria-modal="true" aria-live="assertive">
            <div className="w-full max-w-md rounded-2xl border border-rose-300 bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-rose-800">Access Restricted</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{accessDeniedNotice || "You don't have the right permissions for this page. Please check with admin."}</p>
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

      {isLoggingOut ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/65 px-4" role="status" aria-live="assertive" aria-label="Logging out">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <img
              src={gurdwaraLogo}
              alt="Singh Sabha logo"
              className="mx-auto h-16 w-16 rounded-full border border-brand-saffron/70 object-cover"
            />
            <div className="mx-auto mt-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-blue" />
            <p className="mt-4 text-sm font-semibold text-slate-800">You are currently being logged out, please wait.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLayout;
