import apiClient from './apiClient';

export const contentApiService = {
  list: async (resource) => {
    const response = await apiClient.get(`/content/${encodeURIComponent(resource)}`);
    return response.data?.data || [];
  },

  create: async (resource, payload) => {
    const response = await apiClient.post(`/content/${encodeURIComponent(resource)}`, payload);
    return response.data?.data;
  },

  update: async (resource, id, payload) => {
    const response = await apiClient.patch(`/content/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, payload);
    return response.data?.data;
  },

  remove: async (resource, id) => {
    const response = await apiClient.delete(`/content/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
    return response.data?.data;
  },

  getSingleton: async (resource, fallback = null) => {
    const response = await apiClient.get(`/content-single/${encodeURIComponent(resource)}`);
    return response.data?.data ?? fallback;
  },

  setSingleton: async (resource, payload) => {
    const response = await apiClient.put(`/content-single/${encodeURIComponent(resource)}`, payload);
    return response.data?.data;
  }
};

export default contentApiService;
