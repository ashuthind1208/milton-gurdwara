import contentApiService from './contentApiService';
import { serviceResponse } from './serviceResponse';
import { DEFAULT_INTERVAL_SECONDS, LED_BOARDS, MAX_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS } from '../constants/ledBoards';

const RESOURCE = 'led_board_settings';

export const clampInterval = (value) => Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.round(Number(value) || DEFAULT_INTERVAL_SECONDS)));

// Boards missing from saved settings default to on, so a newly added board shows up without extra setup.
export const normalizeSettings = (raw = {}) => ({
  enabled: Object.fromEntries(LED_BOARDS.map((board) => [board.key, typeof raw?.enabled?.[board.key] === 'boolean' ? raw.enabled[board.key] : true])),
  intervalSeconds: clampInterval(raw?.intervalSeconds),
  updatedAt: String(raw?.updatedAt || '')
});

const ledBoardSettingsService = {
  getSettings: async () => {
    try {
      const data = await contentApiService.getSingleton(RESOURCE, null);
      return serviceResponse(normalizeSettings(data || {}));
    } catch {
      return serviceResponse(normalizeSettings({}));
    }
  },

  saveSettings: async (settings) => {
    const next = { ...normalizeSettings(settings), updatedAt: new Date().toISOString() };
    await contentApiService.setSingleton(RESOURCE, next);
    return serviceResponse(next);
  }
};

export default ledBoardSettingsService;
