import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
