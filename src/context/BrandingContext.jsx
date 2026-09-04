import { createContext, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import brandingService from '../services/brandingService';
import gurdwaraLogo from '../assets/gurdwara-logo.webp';

export const DEFAULT_GURDWARA_BRANDING = Object.freeze({
  organizationName: 'Gurdwara Singh Sabha Milton',
  shortName: 'Singh Sabha Milton',
  logoUrl: '',
  primaryColor: '#0B4EA2',
  accentColor: '#F4A300',
  surfaceColor: '#FFF8E8'
});

const BrandingContext = createContext({
  branding: DEFAULT_GURDWARA_BRANDING,
  logoSrc: gurdwaraLogo,
  isLoading: false
});

const hexToRgb = (value, fallback) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(value || ''));
  return match ? `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}` : fallback;
};

export const BrandingProvider = ({ children }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['gurdwara-branding'],
    queryFn: () => brandingService.getBranding().then((response) => response.data),
    staleTime: 5 * 60 * 1000,
    retry: false
  });
  const branding = { ...DEFAULT_GURDWARA_BRANDING, ...(data || {}) };
  const logoSrc = branding.logoUrl || gurdwaraLogo;

  useEffect(() => {
    const root = document.documentElement;
    const variables = {
      '--brand-blue': branding.primaryColor,
      '--brand-blue-rgb': hexToRgb(branding.primaryColor, '11 78 162'),
      '--brand-navy': branding.primaryColor,
      '--brand-navy-rgb': hexToRgb(branding.primaryColor, '29 53 87'),
      '--brand-saffron': branding.accentColor,
      '--brand-saffron-rgb': hexToRgb(branding.accentColor, '244 163 0'),
      '--brand-gold': branding.accentColor,
      '--brand-gold-rgb': hexToRgb(branding.accentColor, '200 155 60'),
      '--brand-cream': branding.surfaceColor,
      '--brand-cream-rgb': hexToRgb(branding.surfaceColor, '255 248 232')
    };

    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
    return () => Object.keys(variables).forEach((name) => root.style.removeProperty(name));
  }, [branding.accentColor, branding.primaryColor, branding.surfaceColor]);

  return <BrandingContext.Provider value={{ branding, logoSrc, isLoading }}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);