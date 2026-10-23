import apiClient from './apiClient';

const communityAnnouncementService = {
  listPublic: async () => {
    const response = await apiClient.get('/community-announcements');
    return response.data?.data || [];
  },
  submit: async (payload) => {
    const response = await apiClient.post('/community-announcements/submissions', payload);
    return response.data?.data;
  },
  listForReview: async () => {
    const response = await apiClient.get('/community-announcements/admin');
    return response.data?.data || [];
  },
  createForAdmin: async (payload) => {
    const response = await apiClient.post('/community-announcements/admin', payload);
    return response.data?.data;
  },
  review: async (id, payload) => {
    const response = await apiClient.patch(`/community-announcements/admin/${encodeURIComponent(id)}`, payload);
    return response.data?.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/community-announcements/admin/${encodeURIComponent(id)}`);
    return response.data?.data;
  },
  getCategories: async () => {
    const response = await apiClient.get('/community-announcements/categories');
    return response.data?.data || [];
  },
  saveCategories: async (categories) => {
    const response = await apiClient.put('/community-announcements/categories', { categories });
    return response.data?.data || [];
  },
  getBoardSettings: async () => {
    const response = await apiClient.get('/community-announcements/settings');
    return response.data?.data || { slideDurationSeconds: 24 };
  },
  saveBoardSettings: async (settings) => {
    const response = await apiClient.put('/community-announcements/settings', settings);
    return response.data?.data || settings;
  }
};

export default communityAnnouncementService;
