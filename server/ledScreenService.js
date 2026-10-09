const crypto = require('crypto');

const OVERRIDE_RESOURCE = 'led_emergency_override';
const HEARTBEAT_RESOURCE = 'led_screen_heartbeats';
const SCREEN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,29}$/;
const DEFAULT_SCREENS = { main: 'Main Hall', darbar: 'Darbar Hall', langar: 'Langar Hall', lobby: 'Lobby' };
const MAX_SCREENS = 40;
const MAX_TITLE = 140;
const MAX_DETAILS = 500;

const normalizeScreen = (value) => String(value || '').trim().toLowerCase();
const activeOverride = (record, now = new Date()) => {
  if (!record?.active) return null;
  if (record.endsAt && new Date(record.endsAt).getTime() <= now.getTime()) return null;
  return record;
};

const createLedScreenService = ({ eventsDb, sendJson, parseJsonObjectBody, assertInput, isAdmin, now = () => new Date() }) => {
  const authorize = (request) => isAdmin(request);
  const handleApi = async (request, response, requestUrl) => {
    const path = requestUrl.pathname;
    if (!path.startsWith('/api/led/')) return false;
    try {
      assertInput(eventsDb.hasDatabaseConnection, 'LED operations are temporarily unavailable.', 503);

      if (path === '/api/led/override' && request.method === 'GET') {
        const saved = await eventsDb.getSingleton(OVERRIDE_RESOURCE, null);
        sendJson(response, 200, { ok: true, data: activeOverride(saved, now()) });
        return true;
      }

      if (path === '/api/led/heartbeat' && request.method === 'POST') {
        const body = await parseJsonObjectBody(request, { maxBytes: 1024, allowEmpty: false });
        const screenId = normalizeScreen(body.screenId);
        assertInput(SCREEN_ID_PATTERN.test(screenId), 'Unknown screen ID.');
        const label = String(body.label || screenId).trim().slice(0, 100);
        const items = await eventsDb.listItems(HEARTBEAT_RESOURCE);
        const current = items.find((item) => item.id === screenId);
        assertInput(current || items.length < MAX_SCREENS, 'Too many screens are registered.');
        if (current && now().getTime() - new Date(current.lastSeenAt || 0).getTime() < 45000) {
          sendJson(response, 200, { ok: true, data: { accepted: true } });
          return true;
        }
        const record = { ...(current || {}), id: screenId, label, lastSeenAt: now().toISOString(), currentSlide: String(body.currentSlide || '').slice(0, 160), updatedAt: now().toISOString() };
        if (current) await eventsDb.updateItem(HEARTBEAT_RESOURCE, screenId, record);
        else await eventsDb.createItem(HEARTBEAT_RESOURCE, record);
        sendJson(response, 200, { ok: true, data: { accepted: true } });
        return true;
      }

      if (path === '/api/led/screens/health' && request.method === 'GET') {
        assertInput(authorize(request), 'Admin access is required.', 403);
        const items = await eventsDb.listItems(HEARTBEAT_RESOURCE);
        const byId = new Map(items.map((item) => [item.id, item]));
        const screens = [...new Set([...Object.keys(DEFAULT_SCREENS), ...items.map((item) => item.id)])].map((id) => {
          const record = byId.get(id);
          const ageSeconds = record ? Math.max(0, Math.floor((now().getTime() - new Date(record.lastSeenAt).getTime()) / 1000)) : null;
          return { id, label: record?.label || DEFAULT_SCREENS[id] || id, lastSeenAt: record?.lastSeenAt || null, currentSlide: record?.currentSlide || '', ageSeconds, status: ageSeconds === null ? 'unknown' : ageSeconds <= 90 ? 'online' : 'offline' };
        });
        sendJson(response, 200, { ok: true, data: screens });
        return true;
      }

      if (path === '/api/led/override' && request.method === 'PUT') {
        assertInput(authorize(request), 'Admin access is required.', 403);
        const body = await parseJsonObjectBody(request, { maxBytes: 2048, allowEmpty: false });
        if (!body.active) {
          const inactive = { id: 'emergency', active: false, updatedAt: now().toISOString() };
          await eventsDb.setSingleton(OVERRIDE_RESOURCE, inactive);
          sendJson(response, 200, { ok: true, data: inactive });
          return true;
        }
        const title = String(body.title || '').trim();
        const details = String(body.details || '').trim();
        assertInput(title.length >= 2 && title.length <= MAX_TITLE, `Emergency title must be between 2 and ${MAX_TITLE} characters.`);
        assertInput(details.length <= MAX_DETAILS, `Emergency message cannot exceed ${MAX_DETAILS} characters.`);
        const durationMinutes = Math.min(240, Math.max(5, Number(body.durationMinutes) || 30));
        const startedAt = now();
        const record = {
          id: 'emergency', active: true, title, details,
          startedAt: startedAt.toISOString(),
          endsAt: new Date(startedAt.getTime() + durationMinutes * 60 * 1000).toISOString(),
          updatedAt: startedAt.toISOString(),
          incidentId: crypto.randomUUID()
        };
        await eventsDb.setSingleton(OVERRIDE_RESOURCE, record);
        sendJson(response, 200, { ok: true, data: record });
        return true;
      }

      sendJson(response, 404, { ok: false, message: 'Not found.' });
      return true;
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'LED operation failed.' });
      return true;
    }
  };

  return { handleApi, authorize };
};

module.exports = { DEFAULT_SCREENS, HEARTBEAT_RESOURCE, OVERRIDE_RESOURCE, activeOverride, createLedScreenService };
