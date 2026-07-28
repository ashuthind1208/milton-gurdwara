import { useEffect, useMemo, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { getUpcomingPunjabiObservances } from '../utils/punjabiCalendar';
import nanakshahiHolidayService from '../services/nanakshahiHolidayService';
import phase2Service from '../services/phase2Service';

const PublicLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const kioskTimerRef = useRef(null);
  const isHomePage = location.pathname === '/';
  const { data: holidayWindowObservances = [] } = useQuery({
    queryKey: ['nanakshahi-holidays-window-public'],
    queryFn: () => nanakshahiHolidayService.getHolidaysForDateWindow(new Date()),
    staleTime: 12 * 60 * 60 * 1000
  });
  const upcomingObservances = useMemo(
    () => getUpcomingPunjabiObservances(366, new Date(), holidayWindowObservances).slice(0, 5),
    [holidayWindowObservances]
  );
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

  const tickerItems = useMemo(() => {
    if (upcomingObservances.length === 0) {
      return [];
    }
    return Array.from({ length: 6 }).flatMap(() => upcomingObservances);
  }, [upcomingObservances]);

  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors">
      <Navbar />
      {isHomePage ? (
        <section className="w-full overflow-hidden border-y border-brand-blue/70 bg-brand-blue py-2.5">
          <div className="public-observance-ticker flex min-w-max items-center gap-10 whitespace-nowrap px-4 md:px-8">
            {tickerItems.length > 0
              ? tickerItems.map((event, index) => (
                <span key={`${event.id}-${index}`} className="inline-flex items-center gap-2.5">
                  <span className="text-sm font-black text-white" title={event.calendarNoteEn || ''}>{event.dateLabel}</span>
                  <span className="text-sm font-black text-white" title={event.calendarNoteEn || ''}>{event.nanakshahiLabel}</span>
                  {event.hasAlternateNanakshahiLabel ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-amber-100" title={event.calendarNoteEn || ''}>
                      Alt: {event.alternateNanakshahiLabel}
                    </span>
                  ) : null}
                  <span className="text-base font-black text-white">{event.title}</span>
                  <span className="text-base font-black text-brand-saffron">{event.titlePa}</span>
                  <span
                    className="text-sm font-extrabold text-white/95"
                    title={event.significanceEn || event.calendarNoteEn || ''}
                  >
                    ({event.dateLabelPa} | {event.nanakshahiLabelPa})
                  </span>
                  <span className="text-white/80">|</span>
                </span>
              ))
              : (
                <span className="text-base font-black text-white">No Punjabi holidays, Sangrand, Gurpurab, or Shaheedi observances in the next month.</span>
              )}
          </div>
        </section>
      ) : null}
      <style>{`
        .public-observance-ticker {
          animation: publicObservanceFlow 160s linear infinite;
        }
        .public-observance-ticker:hover {
          animation-play-state: paused;
        }
        @keyframes publicObservanceFlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
