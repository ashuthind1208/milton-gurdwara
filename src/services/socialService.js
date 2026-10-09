import apiClient from './apiClient';

const unwrap = (response) => response.data?.data;

const socialService = {
  getSettings: async () => unwrap(await apiClient.get('/social/settings')),
  saveSettings: async (settings) => unwrap(await apiClient.put('/social/settings', settings)),
  getLog: async () => unwrap(await apiClient.get('/social/log')),
  post: async (payload) => unwrap(await apiClient.post('/social/post', payload)),
  hukamnamaCardUrl: (date) => `/api/social/cards/hukamnama.jpg?date=${encodeURIComponent(date)}`,
  eventCardUrl: (id) => `/api/social/cards/event/${encodeURIComponent(id)}.jpg`
};

export default socialService;
