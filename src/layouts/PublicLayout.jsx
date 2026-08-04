import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import phase2Service from '../services/phase2Service';

const PublicLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const kioskTimerRef = useRef(null);
  const { data: phase2ChannelsConfig } = useQuery({
    queryKey: ['phase2-channels-config-public'],
    queryFn: () => phase2Service.getChannelsConfig().then((res) => res.data || null),
    staleTime: 60 * 1000,
    retry: false
  });

  const kioskModeEnabled = phase2ChannelsConfig?.kioskModeEnabled === true;
  const kioskHomeRoute = String(phase2ChannelsConfig?.kioskHomeRoute || '/').trim() || '/';
  const kioskTimeoutMs = Math.max(15, Math.min(1800, Number(phase2ChannelsConfig?.kioskInactivityTimeoutSeconds || 90))) * 1000;

  useEffect(() => {
    if (!kioskModeEnabled) {
      if (kioskTimerRef.current) {
        window.clearTimeout(kioskTimerRef.current);
        kioskTimerRef.current = null;
      }
      return undefined;
    }

    const scheduleReturnToHome = () => {
      if (kioskTimerRef.current) {
        window.clearTimeout(kioskTimerRef.current);
      }

      kioskTimerRef.current = window.setTimeout(() => {
        if (location.pathname !== kioskHomeRoute) {
          navigate(kioskHomeRoute, { replace: true });
          return;
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
      }, kioskTimeoutMs);
    };

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, scheduleReturnToHome, { passive: true });
    });

    scheduleReturnToHome();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, scheduleReturnToHome);
      });
      if (kioskTimerRef.current) {
        window.clearTimeout(kioskTimerRef.current);
        kioskTimerRef.current = null;
      }
    };
  }, [kioskHomeRoute, kioskModeEnabled, kioskTimeoutMs, location.pathname, navigate]);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-slate-900 transition-colors">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-5 md:px-6 md:py-6">
        <Suspense fallback={<div className="py-20 text-center text-slate-600">Loading page...</div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
