import { siteConfig } from '../constants/siteConfig';

export const buildMeta = ({
  title,
  description,
  pathname,
  image = '/logo192.png'
}) => {
  const fullTitle = title ? `${title} | ${siteConfig.shortName}` : siteConfig.name;
  const canonical = `${siteConfig.baseUrl}${pathname || ''}`;

  return {
    title: fullTitle,
    description: description || siteConfig.description,
    canonical,
    image
  };
};
