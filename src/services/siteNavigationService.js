import apiClient from './apiClient';

export const DEFAULT_SITE_NAVIGATION = [
  ['Home', '/'], ['About', '/about'], ['Sikhism', '/sikhism'], ['Events', '/events'], ['Library', '/library'],
  ['Media', '/media'], ['Bookings', '/bookings'], ['Seva', '/seva'], ['Donation', '/donation'], ['Contact', '/contact']
].map(([label, path], index) => ({ id: `nav-${index + 1}`, label, path, children: [] }));

const siteNavigationService = {
  get: async () => (await apiClient.get('/site-navigation')).data.data,
  save: async (items) => (await apiClient.put('/site-navigation', { items })).data.data
};

export default siteNavigationService;