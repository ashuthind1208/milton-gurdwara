import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import LedAnnouncementSlide from '../../components/boards/LedAnnouncementSlide';
import useSeoMeta from '../../hooks/useSeoMeta';
import ledAnnouncementService, { isAnnouncementLive } from '../../services/ledAnnouncementService';
import { useBranding } from '../../context/BrandingContext';

const DEFAULT_INTERVAL_SECONDS = 12;

const LedAnnouncementsBoardPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('Special Events Board', 'Special announcements and event photos for the Gurdwara LED display.');
  const [searchParams] = useSearchParams();
  const intervalSeconds = Math.min(600, Math.max(3, Number(searchParams.get('interval')) || DEFAULT_INTERVAL_SECONDS));
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  const { data: announcements = [] } = useQuery({
    queryKey: ['led-board-announcements'],
    queryFn: () => ledAnnouncementService.getAnnouncements().then((response) => response.data),
    refetchInterval: 20000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });

  const liveAnnouncements = useMemo(() => announcements.filter((entry) => isAnnouncementLive(entry)), [announcements]);
  const slideCount = liveAnnouncements.length;
  const current = slideCount ? liveAnnouncements[index % slideCount] : null;

  useEffect(() => {
    if (slideCount < 2) return undefined;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % slideCount), intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [index, intervalSeconds, slideCount]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  };

  return (
    <>
      <Seo {...meta} />
      <div className="relative h-screen w-full overflow-hidden bg-[#06142f] text-white">
        <style>{'@keyframes led-announcement-fade { from { opacity: 0; } to { opacity: 1; } } .led-announcement-fade { animation: led-announcement-fade 900ms ease-out both; }'}</style>
        {current ? (
          <div key={current.id} className="led-announcement-fade h-full w-full"><LedAnnouncementSlide announcement={current} /></div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] px-8 text-center">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-32 w-32 rounded-full border-4 border-brand-saffron object-cover" />
            <p className="font-heading text-5xl font-bold">{branding.organizationName}</p>
            <p className="text-xl font-semibold text-blue-100">No special announcements right now</p>
          </div>
        )}
        {slideCount > 1 ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden="true">
            {liveAnnouncements.map((entry, position) => <span key={entry.id} className={`h-1.5 rounded-full transition-all ${position === index % slideCount ? 'w-6 bg-brand-saffron' : 'w-1.5 bg-white/40'}`} />)}
          </div>
        ) : null}
        <button type="button" data-board-control onClick={() => void toggleFullscreen()} className="absolute right-3 top-3 rounded-lg border border-white/25 bg-black/40 p-2 text-white opacity-30 transition hover:opacity-100" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <ArrowsPointingOutIcon className="h-5 w-5" />
        </button>
      </div>
    </>
  );
};

export default LedAnnouncementsBoardPage;
