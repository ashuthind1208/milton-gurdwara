import apiClient from './apiClient';
import { serviceResponse } from './serviceResponse';

const normalizeSearchRow = (row = {}) => ({
  id: String(row.id || '').trim(),
  type: String(row.type || 'other').trim() || 'other',
  title: String(row.title || '').trim(),
  subtitle: String(row.subtitle || '').trim(),
  body: String(row.body || '').trim(),
  route: String(row.route || '/').trim() || '/',
  updatedAt: row.updatedAt || '',
  score: Number(row.score || 0),
  matchedVariant: String(row.matchedVariant || '').trim()
});

const toPhase2SearchErrorMessage = (error) => {
  const statusCode = Number(error?.response?.status || 0);
  const serverMessage = String(error?.response?.data?.message || '').trim();

  if (statusCode === 404) {
    return 'Phase 2 search endpoint was not found (404). Restart the backend server on port 4242 so new routes are loaded.';
  }

  if (serverMessage) {
    return serverMessage;
  }

  return String(error?.message || 'Unable to fetch full-text search results.');
};

const phase2Service = {
  searchFullText: async (query, options = {}) => {
    const q = String(query || '').trim();
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options.limit) : 8;
    const scope = String(options?.scope || '').trim().toLowerCase();

    if (!q) {
      return serviceResponse([]);
    }

    try {
      const response = await apiClient.get('/search/fulltext', {
        params: {
          q,
          limit,
          ...(scope ? { scope } : {})
        }
      });

      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      return serviceResponse(rows.map((entry) => normalizeSearchRow(entry)));
    } catch (error) {
      const message = toPhase2SearchErrorMessage(error);
      const nextError = new Error(message);
      nextError.status = error?.response?.status || error?.status || null;
      throw nextError;
    }
  },

  getChannelsConfig: async () => {
    const response = await apiClient.get('/phase2/channels-config');
    return serviceResponse(response.data?.data || null);
  },

  setChannelsConfig: async (payload = {}) => {
    const response = await apiClient.put('/phase2/channels-config', payload);
    return serviceResponse(response.data?.data || null);
  },

  getHealth: async () => {
    const response = await apiClient.get('/health');
    return serviceResponse(response.data || null);
  }
};

export default phase2Service;
