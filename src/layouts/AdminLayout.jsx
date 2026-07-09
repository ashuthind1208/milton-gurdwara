import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminNav } from '../constants/navigation';
import { useAuth } from '../context/AuthContext';
import gurdwaraLogo from '../assets/gurdwara-logo.webp';

const MEMBER_VISIBLE_PATHS = [
  '/admin',
  '/admin/hukamnama',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/library',
  '/admin/videos',
  '/admin/events'
];

const getFirstName = (fullName) => {
  const tokens = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return tokens[0] || 'Member';
};

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const firstName = getFirstName(user?.name);
  const visibleNav = user?.role
    ? adminNav
    : adminNav.filter((item) => MEMBER_VISIBLE_PATHS.includes(item.path));

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
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-blue-50 px-4 py-3 shadow-sm">
            <img src={user?.avatarUrl || gurdwaraLogo} alt={user?.name || 'Profile'} className="h-11 w-11 rounded-full border border-slate-300 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Welcome Back</p>
              <p className="truncate text-lg font-bold text-slate-800">{firstName}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-brand-blue hover:text-brand-blue"
            >
              Logout
            </button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
