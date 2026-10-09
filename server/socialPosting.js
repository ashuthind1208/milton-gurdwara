const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cards = require('./socialCards');

const SETTINGS_RESOURCE = 'social_card_settings';
const LOG_RESOURCE = 'social_post_log';
const HUKAMNAMA_RESOURCE = 'hukamnama_ssm_hukamnama_entries';
const GRAPH_BASE = 'https://graph.facebook.com/v20.0';
const MAX_LOG_ITEMS = 200;
const RENDER_CACHE_LIMIT = 16;
const IMAGE_FETCH_TIMEOUT_MS = 10000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const NAMING_HEADING_TYPES = new Set([1, 2]);

const DEFAULT_SETTINGS = {
  hukamnamaAuto: false,
  hukamnamaTime: '07:00',
  eventAuto: false,
  instagram: true,
  facebook: true,
  dryRun: true
};

const readText = (value) => (typeof value === 'string' ? value.trim() : '');
const pad = (value) => String(value).padStart(2, '0');
const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));

const normalizeSettings = (input = {}) => {
  const merged = { ...DEFAULT_SETTINGS, ...(input || {}) };
  return {
    hukamnamaAuto: merged.hukamnamaAuto === true,
    hukamnamaTime: isTime(merged.hukamnamaTime) ? merged.hukamnamaTime : DEFAULT_SETTINGS.hukamnamaTime,
    eventAuto: merged.eventAuto === true,
    instagram: merged.instagram !== false,
    facebook: merged.facebook !== false,
    dryRun: merged.dryRun !== false
  };
};

// Reads a stored "2026-10-12T18:00" style value as-is, or converts an absolute instant into the target time zone.
const toWallClock = (value, timeZone) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const naive = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?(?::\d{2}(?:\.\d+)?)?$/);
  if (naive) {
    return { year: +naive[1], month: +naive[2], day: +naive[3], hour: naive[4] === undefined ? null : +naive[4], minute: naive[5] === undefined ? null : +naive[5] };
  }
  const instant = new Date(raw);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(instant);
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: pick('year'), month: pick('month'), day: pick('day'), hour: pick('hour') % 24, minute: pick('minute') };
};

const wallToUtcDate = (wall) => new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour ?? 0, wall.minute ?? 0));

const formatEventWhen = (startValue, endValue, timeZone) => {
  const start = toWallClock(startValue, timeZone);
  if (!start) return '';
  const end = toWallClock(endValue, timeZone);
  const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
  const startDay = dayFormat.format(wallToUtcDate(start));
  const hasStartTime = start.hour !== null && !(start.hour === 0 && start.minute === 0);
  if (!hasStartTime) return startDay;
  const sameDay = end && end.year === start.year && end.month === start.month && end.day === start.day;
  const startTime = timeFormat.format(wallToUtcDate(start));
  if (!end || end.hour === null) return `${startDay} • ${startTime}`;
  if (sameDay) return `${startDay} • ${startTime} – ${timeFormat.format(wallToUtcDate(end))}`;
  return `${startDay} ${startTime} – ${dayFormat.format(wallToUtcDate(end))} ${timeFormat.format(wallToUtcDate(end))}`;
};

const formatDateLabel = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)));
};

const isPrivateHost = (hostname = '') => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host === '::1') return true;
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80');
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const pickCoverUrl = (mediaUrl = '') => String(mediaUrl || '')
  .split(/[\n,;|]+/)
  .map((entry) => entry.trim())
  .find((entry) => entry && !/\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(entry) && !/youtu\.?be/i.test(entry)) || '';

const createSocialPostingService = ({
  eventsDb,
  sendJson,
  parseJsonObjectBody,
  assertInput,
  isAdmin,
  getActorName = () => '',
  uploadsDir,
  publicBaseUrl = '',
  timeZone = 'America/Toronto',
  organizationName = 'Gurdwara Singh Sabha Milton',
  env = process.env,
  http = axios,
  fetchImpl = (typeof fetch === 'function' ? fetch : null),
  logger = console,
  now = () => new Date()
}) => {
  const baseUrl = String(publicBaseUrl || '').trim().replace(/\/$/, '');
  const websiteLabel = baseUrl.replace(/^https?:\/\//, '');
  const pageToken = readText(env.META_PAGE_ACCESS_TOKEN);
  const instagramAccountId = readText(env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
  const facebookPageId = readText(env.FACEBOOK_PAGE_ID);
  const postingEnabled = String(env.ENABLE_SOCIAL_CARDS || 'false').trim().toLowerCase() === 'true';
  const renderCache = new Map();
  let sweepRunning = false;

  const status = () => ({
    postingEnabled,
    instagramConfigured: Boolean(pageToken && instagramAccountId),
    facebookConfigured: Boolean(pageToken && facebookPageId),
    publicBaseUrl: baseUrl,
    publicUrlIsHttps: /^https:\/\//i.test(baseUrl),
    timeZone
  });

  const getSettings = async () => normalizeSettings(await eventsDb.getSingleton(SETTINGS_RESOURCE, null));

  const todayKey = () => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now());
    const pick = (type) => parts.find((part) => part.type === type)?.value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  };

  const minutesNow = () => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now());
    return (Number(parts.find((part) => part.type === 'hour')?.value) % 24) * 60 + Number(parts.find((part) => part.type === 'minute')?.value);
  };

  const withCache = async (key, render) => {
    if (renderCache.has(key)) return renderCache.get(key);
    const result = await render();
    renderCache.set(key, result);
    while (renderCache.size > RENDER_CACHE_LIMIT) renderCache.delete(renderCache.keys().next().value);
    return result;
  };

  const hash = (value) => crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');

  // ---- Hukamnama ----------------------------------------------------------------------------------------------
  // Entries are stored per date; older records may sit under a morning or evening key, so take whichever exists.
  const findHukamnama = async (dateKey) => {
    const entries = (await eventsDb.getSingleton(HUKAMNAMA_RESOURCE, null)) || {};
    const day = entries[dateKey] || {};
    const entry = day.morning || day.evening;
    return entry ? { entry } : null;
  };

  const buildHukamnamaInput = (entry, dateKey) => {
    const selectedId = readText(String(entry.selectedShabadId || ''));
    const source = selectedId && entry.selectedShabadLines?.length ? entry.selectedShabadLines : (entry.lines || []);
    const lines = source
      .filter((line) => !NAMING_HEADING_TYPES.has(Number(line.lineType || line.type)))
      .map((line) => ({
        gurmukhi: readText(line.gurmukhi) || readText(line.gurmukhiUnicode),
        translationEnglish: readText(line.translationEnglish) || readText(line.translation)
      }))
      .filter((line) => line.gurmukhi);
    const metadata = entry.metadata || {};
    return {
      lines,
      ang: String(entry.ang || metadata.ang || '').trim(),
      raag: readText(metadata.raag),
      writer: readText(metadata.writer),
      dateLabel: formatDateLabel(dateKey),
      organizationName,
      websiteLabel: websiteLabel ? `${websiteLabel}/hukamnama` : ''
    };
  };

  const buildHukamnamaCaption = (input, dateKey) => {
    const gurmukhi = input.lines.slice(0, 4).map((line) => line.gurmukhi).join('\n');
    const english = input.lines.slice(0, 4).map((line) => line.translationEnglish).filter(Boolean).join(' ');
    const meta = [input.ang ? `Ang ${input.ang}` : '', input.raag, input.writer].filter(Boolean).join(' • ');
    return [
      `Daily Hukamnama • ${formatDateLabel(dateKey)}`,
      gurmukhi,
      english ? `Meaning: ${english}` : '',
      meta,
      baseUrl ? `Read the full Hukamnama: ${baseUrl}/hukamnama` : '',
      '#Hukamnama #Gurbani #Waheguru #SinghSabha #Milton #Sikh'
    ].filter(Boolean).join('\n\n').slice(0, 2100);
  };

  const prepareHukamnama = async ({ date } = {}) => {
    const dateKey = isDateKey(date) ? date : todayKey();
    const found = await findHukamnama(dateKey);
    assertInput(found, `No Hukamnama has been posted for ${dateKey}.`, 404);
    const input = buildHukamnamaInput(found.entry, dateKey);
    assertInput(input.lines.length > 0, 'That Hukamnama has no Gurbani lines to put on a card.', 422);
    const rendered = await withCache(`hukamnama:${hash(input)}`, () => cards.renderHukamnamaCard(input));
    return {
      kind: 'hukamnama',
      refKey: `hukamnama:${dateKey}`,
      title: `Hukamnama ${dateKey}`,
      buffer: rendered.buffer,
      caption: buildHukamnamaCaption(input, dateKey)
    };
  };

  // ---- Events -------------------------------------------------------------------------------------------------
  const loadCoverImage = async (mediaUrl) => {
    const url = pickCoverUrl(mediaUrl);
    if (!url) return null;
    try {
      if (url.startsWith('/api/uploads/')) {
        const segments = url.slice('/api/uploads/'.length).split('/').map((segment) => decodeURIComponent(segment).replace(/[^A-Za-z0-9._-]/g, '_')).filter(Boolean);
        const filePath = path.resolve(uploadsDir, ...segments);
        if (!filePath.startsWith(`${path.resolve(uploadsDir)}${path.sep}`) || !fs.existsSync(filePath)) return null;
        return await require('@napi-rs/canvas').loadImage(filePath);
      }
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname) || !fetchImpl) return null;
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS), redirect: 'error' });
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
      return await require('@napi-rs/canvas').loadImage(buffer);
    } catch (error) {
      logger.warn?.('Social poster could not load the event image', error?.message || error);
      return null;
    }
  };

  const buildEventCaption = (event, when) => [
    readText(event.title),
    [when, readText(event.location)].filter(Boolean).join('\n'),
    cards.cleanText(event.description).slice(0, 500),
    baseUrl ? `Details: ${baseUrl}/events` : '',
    '#SinghSabha #Gurdwara #Milton #Sikh #CommunityEvent'
  ].filter(Boolean).join('\n\n').slice(0, 2100);

  const prepareEvent = async (eventId) => {
    const events = await eventsDb.getEvents();
    const event = (Array.isArray(events) ? events : []).find((entry) => String(entry.id) === String(eventId));
    assertInput(event, 'Event not found.', 404);
    return prepareEventFromRecord(event);
  };

  const prepareEventFromRecord = async (event) => {
    const when = formatEventWhen(event.date, event.endDate, timeZone);
    const input = {
      title: readText(event.title),
      when,
      where: readText(event.location),
      description: readText(event.description),
      organizationName,
      websiteLabel: websiteLabel ? `${websiteLabel}/events` : ''
    };
    const cover = await loadCoverImage(event.mediaUrl || event.coverImageUrl || event.imageUrl);
    const rendered = await cards.renderEventPoster({ ...input, coverImage: cover });
    return {
      kind: 'event',
      refKey: `event:${event.id}`,
      title: input.title,
      buffer: rendered.buffer,
      caption: buildEventCaption(event, when)
    };
  };

  // ---- Posting ------------------------------------------------------------------------------------------------
  const saveImage = (buffer) => {
    const stamp = now();
    const year = String(stamp.getUTCFullYear());
    const month = pad(stamp.getUTCMonth() + 1);
    const name = `card-${stamp.getTime()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
    const directory = path.join(uploadsDir, 'social', year, month);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, name), buffer);
    return `/api/uploads/social/${year}/${month}/${name}`;
  };

  const postToInstagram = async (imageUrl, caption) => {
    const created = await http.post(`${GRAPH_BASE}/${instagramAccountId}/media`, { image_url: imageUrl, caption, access_token: pageToken });
    const creationId = created?.data?.id;
    if (!creationId) throw new Error('Instagram did not accept the image.');
    const published = await http.post(`${GRAPH_BASE}/${instagramAccountId}/media_publish`, { creation_id: creationId, access_token: pageToken });
    return published?.data?.id || creationId;
  };

  const postToFacebook = async (imageUrl, caption) => {
    const posted = await http.post(`${GRAPH_BASE}/${facebookPageId}/photos`, { url: imageUrl, caption, access_token: pageToken });
    return posted?.data?.post_id || posted?.data?.id || '';
  };

  const describeError = (error) => {
    const meta = error?.response?.data?.error;
    return String(meta?.message || error?.message || 'Unknown error').slice(0, 300);
  };

  const appendLog = async (record) => {
    const saved = await eventsDb.createItem(LOG_RESOURCE, record);
    const items = await eventsDb.listItems(LOG_RESOURCE);
    if (items.length > MAX_LOG_ITEMS) {
      const oldest = [...items].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).slice(0, items.length - MAX_LOG_ITEMS);
      await Promise.all(oldest.map((item) => eventsDb.removeItem(LOG_RESOURCE, item.id)));
    }
    return saved;
  };

  const publishPrepared = async (prepared, { mode, settings, dryRun, platforms, actor = '' }) => {
    const wanted = {
      instagram: platforms?.instagram ?? settings.instagram,
      facebook: platforms?.facebook ?? settings.facebook
    };
    const live = dryRun === undefined ? !settings.dryRun : !dryRun;
    const imageUrlPath = saveImage(prepared.buffer);
    const imageUrl = `${baseUrl}${imageUrlPath}`;
    const results = [];
    if (live && !postingEnabled) {
      results.push({ platform: 'all', status: 'failed', message: 'Set ENABLE_SOCIAL_CARDS=true on the server before enabling live posting.' });
    } else if (live && !status().publicUrlIsHttps) {
      results.push({ platform: 'all', status: 'failed', message: 'PUBLIC_SITE_URL must be a public https address so Meta can download the image.' });
    } else {
      for (const platform of ['instagram', 'facebook']) {
        if (!wanted[platform]) continue;
        const configured = platform === 'instagram' ? status().instagramConfigured : status().facebookConfigured;
        if (!live) { results.push({ platform, status: 'dry-run', message: configured ? 'Ready to post.' : 'Not configured yet.' }); continue; }
        if (!configured) { results.push({ platform, status: 'skipped', message: 'Not configured on the server.' }); continue; }
        try {
          const id = platform === 'instagram' ? await postToInstagram(imageUrl, prepared.caption) : await postToFacebook(imageUrl, prepared.caption);
          results.push({ platform, status: 'posted', externalId: String(id || '') });
        } catch (error) {
          logger.error?.(`Social ${platform} post failed`, error?.response?.data || error?.message || error);
          results.push({ platform, status: 'failed', message: describeError(error) });
        }
      }
    }
    const posted = results.filter((item) => item.status === 'posted').length;
    const failed = results.filter((item) => item.status === 'failed').length;
    const overall = !live ? 'dry-run' : (failed && posted ? 'partial' : failed ? 'failed' : posted ? 'posted' : 'skipped');
    return appendLog({
      id: `social-${now().getTime()}-${crypto.randomBytes(3).toString('hex')}`,
      kind: prepared.kind,
      refKey: prepared.refKey,
      title: prepared.title,
      mode,
      actor,
      status: overall,
      results,
      imageUrl: imageUrlPath,
      caption: prepared.caption,
      createdAt: now().toISOString()
    });
  };

  const alreadyAutoPosted = async (refKey) => (await eventsDb.listItems(LOG_RESOURCE)).some((item) => item.refKey === refKey && item.mode === 'auto');

  const runScheduledSweep = async () => {
    if (sweepRunning || !eventsDb.hasDatabaseConnection) return null;
    sweepRunning = true;
    try {
      const settings = await getSettings();
      if (!settings.hukamnamaAuto) return null;
      const [hour, minute] = settings.hukamnamaTime.split(':').map(Number);
      if (minutesNow() < hour * 60 + minute) return null;
      const dateKey = todayKey();
      const found = await findHukamnama(dateKey);
      if (!found || await alreadyAutoPosted(`hukamnama:${dateKey}`)) return null;
      const prepared = await prepareHukamnama({ date: dateKey });
      return await publishPrepared(prepared, { mode: 'auto', settings });
    } catch (error) {
      logger.error?.('Scheduled Hukamnama social post failed', error?.message || error);
      return null;
    } finally {
      sweepRunning = false;
    }
  };

  const onEventCreated = async (event) => {
    try {
      const settings = await getSettings();
      if (!settings.eventAuto || event?.active === false || event?.isActive === false) return null;
      const start = toWallClock(event.date, timeZone);
      if (start && wallToUtcDate(start).getTime() < now().getTime() - 24 * 60 * 60 * 1000) return null;
      if (await alreadyAutoPosted(`event:${event.id}`)) return null;
      return await publishPrepared(await prepareEventFromRecord(event), { mode: 'auto', settings });
    } catch (error) {
      logger.error?.('Automatic event poster post failed', error?.message || error);
      return null;
    }
  };

  const shouldReplaceLegacyEventPost = async () => {
    try {
      return (await getSettings()).eventAuto === true;
    } catch {
      return false;
    }
  };

  // ---- HTTP ---------------------------------------------------------------------------------------------------
  const sendImage = (response, buffer) => {
    response.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(buffer);
  };

  const handleApi = async (request, response, requestUrl) => {
    const route = requestUrl.pathname;
    if (!route.startsWith('/api/social/')) return false;
    const method = request.method;
    try {
      assertInput(eventsDb.hasDatabaseConnection, 'Social posting is temporarily unavailable.', 503);

      if (method === 'GET' && route === '/api/social/cards/hukamnama.jpg') {
        const prepared = await prepareHukamnama({ date: requestUrl.searchParams.get('date') });
        sendImage(response, prepared.buffer);
        return true;
      }
      const eventCard = route.match(/^\/api\/social\/cards\/event\/([A-Za-z0-9_-]+)\.jpg$/);
      if (method === 'GET' && eventCard) {
        sendImage(response, (await prepareEvent(eventCard[1])).buffer);
        return true;
      }

      assertInput(isAdmin(request), 'Admin access is required.', 403);

      if (method === 'GET' && route === '/api/social/settings') {
        sendJson(response, 200, { ok: true, data: { settings: await getSettings(), status: status() } });
        return true;
      }
      if (method === 'PUT' && route === '/api/social/settings') {
        const body = await parseJsonObjectBody(request, { maxBytes: 2048, allowEmpty: false });
        const settings = normalizeSettings(body);
        await eventsDb.setSingleton(SETTINGS_RESOURCE, settings);
        sendJson(response, 200, { ok: true, data: { settings, status: status() } });
        return true;
      }
      if (method === 'GET' && route === '/api/social/log') {
        const items = (await eventsDb.listItems(LOG_RESOURCE)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
        sendJson(response, 200, { ok: true, data: items });
        return true;
      }
      if (method === 'POST' && route === '/api/social/post') {
        const body = await parseJsonObjectBody(request, { maxBytes: 2048, allowEmpty: false });
        assertInput(['hukamnama', 'event'].includes(body.kind), 'kind must be hukamnama or event.');
        const settings = await getSettings();
        const prepared = body.kind === 'event'
          ? await prepareEvent(body.eventId)
          : await prepareHukamnama({ date: body.date });
        const record = await publishPrepared(prepared, {
          mode: 'manual',
          settings,
          dryRun: typeof body.dryRun === 'boolean' ? body.dryRun : undefined,
          actor: getActorName(request)
        });
        sendJson(response, 200, { ok: true, data: record });
        return true;
      }
      sendJson(response, 404, { ok: false, message: 'Not found.' });
      return true;
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Social posting failed.' });
      return true;
    }
  };

  return { handleApi, runScheduledSweep, onEventCreated, shouldReplaceLegacyEventPost, status };
};

module.exports = {
  DEFAULT_SETTINGS,
  LOG_RESOURCE,
  SETTINGS_RESOURCE,
  createSocialPostingService,
  formatEventWhen,
  isPrivateHost,
  normalizeSettings,
  pickCoverUrl
};
