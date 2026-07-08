import { NavLink, Outlet } from 'react-router-dom';
import { adminNav } from '../constants/navigation';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import gurdwaraLogo from '../assets/gurdwara-logo.webp';

const AdminLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-100 dark:bg-slate-950 lg:grid-cols-[270px_1fr]">
      <aside className="border-r border-slate-800 bg-slate-950 p-4 text-slate-100">
        <p className="flex items-center gap-2 font-heading text-xl font-bold text-white">
          <img src={gurdwaraLogo} alt="Singh Sabha logo" className="h-8 w-8 rounded-full border border-brand-saffron/70 object-cover" />
          Admin Portal
        </p>
        <p className="mt-1 text-sm text-slate-400">{user?.name}</p>
        <nav className="mt-6 grid gap-2" aria-label="Admin navigation">
          {adminNav.map((item) => (
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
        <Button variant="ghost" className="mt-6 w-full bg-slate-800 text-slate-100 ring-0 hover:bg-slate-700" onClick={logout}>Logout</Button>
      </aside>
      <main className="p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
