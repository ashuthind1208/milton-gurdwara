import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import useDailyHukamnama from '../../hooks/useDailyHukamnama';
import { useBranding } from '../../context/BrandingContext';
import hukamnamaService from '../../services/hukamnamaService';
import HukamnamaLedTemplate from '../../components/boards/HukamnamaLedTemplate';
import { DEFAULT_HUKAMNAMA_LED_SETTINGS, normalizeHukamnamaLedSettings } from '../../constants/hukamnamaLedTemplates';

const LedHukamnamaBoardPage = () => {
  const { branding } = useBranding();
  const meta = useSeoMeta('Daily Hukamnama Board', 'Today\'s hukamnama with translation for the Gurdwara LED display.');
  const { entry, lines, hasHukamnama } = useDailyHukamnama({ refetchInterval: 5000 });
  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, []);
  const { data: savedSettings } = useQuery({
    queryKey: ['hukamnama-led-template-settings'],
    queryFn: () => hukamnamaService.getLedTemplateSettings().then((response) => response.data),
    refetchInterval: 30000,
    retry: false
  });
  const settings = normalizeHukamnamaLedSettings(savedSettings || DEFAULT_HUKAMNAMA_LED_SETTINGS);

  return (
    <>
      <Seo {...meta} />
      <div className="fixed inset-0 h-[100dvh] w-screen overflow-hidden overscroll-none bg-black p-0">
        <HukamnamaLedTemplate settings={settings} entry={entry || {}} lines={hasHukamnama ? lines : []} hasHukamnama={hasHukamnama} branding={{ organizationName: branding.organizationName, shortName: branding.shortName, address: branding.address, logoSrc: branding.logoUrl || '', logoShape: branding.logoShape }} />
      </div>
    </>
  );
};

export default LedHukamnamaBoardPage;
