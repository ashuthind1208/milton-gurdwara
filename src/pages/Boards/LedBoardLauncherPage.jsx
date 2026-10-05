import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Seo from '../../components/common/Seo';
import LedSlideshow from '../../components/boards/LedSlideshow';
import useSeoMeta from '../../hooks/useSeoMeta';
import ledAnnouncementService, { isAnnouncementLive } from '../../services/ledAnnouncementService';
import ledBoardSettingsService from '../../services/ledBoardSettingsService';
import { buildLedSlides } from '../../constants/ledBoards';
import { useBranding } from '../../context/BrandingContext';

const noop = () => {};

// Display-only LED screen. Which boards play, and for how long, is controlled from the admin portal and picked up on refresh.
const LedBoardLauncherPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('LED Board', 'Singh Sabha Milton LED display.');

  const { data: settings } = useQuery({
    queryKey: ['led-board-settings'],
    queryFn: () => ledBoardSettingsService.getSettings().then((response) => response.data),
    refetchInterval: 15000,
    refetchIntervalInBackground: true
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ['led-board-announcements'],
    queryFn: () => ledAnnouncementService.getAnnouncements().then((response) => response.data),
    refetchInterval: 20000,
    refetchIntervalInBackground: true
  });

  const slides = useMemo(
    () => (settings ? buildLedSlides(settings, announcements.filter((entry) => isAnnouncementLive(entry))) : []),
    [settings, announcements]
  );

  return (
    <>
      <Seo {...meta} />
      {slides.length && settings
        ? <LedSlideshow kiosk slides={slides} intervalSeconds={settings.intervalSeconds} onExit={noop} />
        : (
          <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] px-8 text-center text-white">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-32 w-32 rounded-full border-4 border-brand-saffron object-cover" />
            <p className="font-heading text-5xl font-bold">{branding.organizationName}</p>
          </main>
        )}
    </>
  );
};

export default LedBoardLauncherPage;
