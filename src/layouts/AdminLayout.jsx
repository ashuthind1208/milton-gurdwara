import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accessDeniedModalOpen, setAccessDeniedModalOpen] = useState(false);
  const [accessDeniedNotice, setAccessDeniedNotice] = useState('');
  const firstName = getFirstName(user?.name);
  const hasFullAccess = FULL_ACCESS_ROLES.has(String(user?.role || ''));
  const visibleNav = hasFullAccess
    ? adminNav
    : adminNav.filter((item) => MEMBER_VISIBLE_PATHS.includes(item.path));

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

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-100 dark:bg-slate-950 lg:grid-cols-[270px_1fr]">
      <aside className="border-r border-slate-800 bg-slate-950 p-4 text-slate-100">
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
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="p-4 md:p-8">
        <div className="mb-6 flex justify-end">
          <div className="flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/85 px-3 py-2 shadow-[0_4px_14px_-10px_rgba(15,23,42,0.45)] backdrop-blur">
            <img src={user?.avatarUrl || gurdwaraLogo} alt={user?.name || 'Profile'} className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Signed in</p>
              <p className="truncate text-sm font-semibold text-slate-700">{firstName}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              Logout
            </button>
          </div>
        </div>
        <Outlet />

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
  );
};

export default AdminLayout;
