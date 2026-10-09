import apiClient from './apiClient';

const unwrap = (response) => response.data?.data;

const ledScreenService = {
  getOverride: async () => unwrap(await apiClient.get('/led/override')),
  setOverride: async (payload) => unwrap(await apiClient.put('/led/override', payload)),
  heartbeat: async (payload) => unwrap(await apiClient.post('/led/heartbeat', payload)),
  getHealth: async () => unwrap(await apiClient.get('/led/screens/health'))
};

export default ledScreenService;
