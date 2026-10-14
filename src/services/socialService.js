import apiClient from './apiClient';

const unwrap = (response) => response.data?.data;
const cardPreviewVersion = Date.now();

const socialService = {
  getSettings: async () => unwrap(await apiClient.get('/social/settings')),
  checkMetaTokenStatus: async () => unwrap(await apiClient.post('/social/meta-token-status')),
  saveSettings: async (settings) => unwrap(await apiClient.put('/social/settings', settings)),
  getLog: async () => unwrap(await apiClient.get('/social/log')),
  retry: async (id) => unwrap(await apiClient.post('/social/retry', { id })),
  post: async (payload) => unwrap(await apiClient.post('/social/post', payload)),
  hukamnamaCardUrl: (date) => `/api/social/cards/hukamnama.jpg?date=${encodeURIComponent(date)}&v=${cardPreviewVersion}`,
  eventCardUrl: (id) => `/api/social/cards/event/${encodeURIComponent(id)}.jpg?v=${cardPreviewVersion}`
};

export default socialService;
