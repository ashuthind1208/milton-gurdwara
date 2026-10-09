import apiClient from './apiClient';

const TEXT_TIMEOUT_MS = 30000;

const unwrap = (response) => response.data?.data;

const recitationService = {
  getState: () => apiClient.get('/recitation/state').then(unwrap),
  getCatalog: () => apiClient.get('/recitation/catalog').then(unwrap),
  search: (query, mode) => apiClient.get('/recitation/search', { params: { q: query, mode } }).then(unwrap),
  getText: (type, id, view = 'text') => apiClient.get('/recitation/text', { params: { type, id, view }, timeout: TEXT_TIMEOUT_MS }).then(unwrap),
  listSessions: (limit = 300) => apiClient.get('/recitation/sessions', { params: { limit } }).then(unwrap),
  getSession: (id) => apiClient.get(`/recitation/sessions/${encodeURIComponent(id)}`).then(unwrap),

  start: (payload) => apiClient.post('/recitation/sessions', payload, { timeout: TEXT_TIMEOUT_MS }).then(unwrap),
  step: (id, change) => apiClient.post(`/recitation/sessions/${encodeURIComponent(id)}/step`, change).then(unwrap),
  end: (id) => apiClient.post(`/recitation/sessions/${encodeURIComponent(id)}/end`, {}).then(unwrap),
  update: (id, payload) => apiClient.patch(`/recitation/sessions/${encodeURIComponent(id)}`, payload).then(unwrap),
  remove: (id) => apiClient.delete(`/recitation/sessions/${encodeURIComponent(id)}`).then(unwrap)
};

export default recitationService;
