import apiClient from './apiClient';

const brandingService = {
  getBranding: async () => {
    const response = await apiClient.get('/gurdwara-branding');
    return response.data;
  },
  saveBranding: async (payload) => {
    const response = await apiClient.put('/gurdwara-branding', payload);
    return response.data;
  }
};

export default brandingService;