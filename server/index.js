const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const Stripe = require('stripe');
const crypto = require('crypto');

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) {
      return;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      return;
    }

    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
};

const workspaceRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(workspaceRoot, '.env'));
loadEnvFile(path.join(workspaceRoot, '.env.local'));

const eventsDb = require('./db/postgres');

const resolveServerPort = () => {
  const preferred = Number(process.env.STRIPE_API_PORT || process.env.SERVER_PORT || 4242);
  if (Number.isFinite(preferred) && preferred > 0) {
    return preferred;
  }

  const fallback = Number(process.env.PORT || 4242);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 4242;
};

const port = resolveServerPort();
const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const stripeCurrency = String(process.env.STRIPE_CURRENCY || 'cad').toLowerCase();
const youtubeApiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
const dataDir = path.resolve(__dirname, 'data');
const usersPath = path.join(dataDir, 'users.json');
const volunteerReminderLogPath = path.join(dataDir, 'volunteer-reminder-log.json');
const eventReminderLogPath = path.join(dataDir, 'event-reminder-log.json');
const uploadsDir = path.resolve(__dirname, 'uploads');
const quizBankDir = path.resolve(workspaceRoot, 'public', 'quiz');
const maxUploadBytes = 15 * 1024 * 1024;
const volunteerReminderWebhookUrl = String(
  process.env.VOLUNTEER_REMINDER_WEBHOOK_URL || process.env.REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL || ''
).trim();
const volunteerReminderLogoUrl = String(process.env.VOLUNTEER_REMINDER_LOGO_URL || '').trim();
const volunteerReminderSiteName = String(process.env.VOLUNTEER_REMINDER_ORG_NAME || 'Singh Sabha Milton Gurdwara').trim();
const volunteerReminderBaseUrl = String(process.env.VOLUNTEER_REMINDER_BASE_URL || 'http://localhost:3001').trim().replace(/\/$/, '');
const volunteerReminderHtmlTemplateEnabled = String(process.env.VOLUNTEER_REMINDER_HTML_TEMPLATE_ENABLED || 'true').trim().toLowerCase() !== 'false';
const volunteerReminderSendTimeRaw = String(process.env.VOLUNTEER_REMINDER_SEND_TIME || '09:00').trim();
const volunteerReminderTimeZone = String(process.env.VOLUNTEER_REMINDER_TIME_ZONE || 'America/Toronto').trim() || 'America/Toronto';
const volunteerReminderDays = [10, 5, 2, 1];
const eventReminderWebhookUrl = String(process.env.EVENT_REMINDER_WEBHOOK_URL || volunteerReminderWebhookUrl || '').trim();
const eventReminderSendTimeRaw = String(process.env.EVENT_REMINDER_SEND_TIME || volunteerReminderSendTimeRaw || '09:00').trim();
const eventReminderTimeZone = String(process.env.EVENT_REMINDER_TIME_ZONE || volunteerReminderTimeZone || 'America/Toronto').trim() || 'America/Toronto';
const eventReminderDays = String(process.env.EVENT_REMINDER_DAYS || '7,3,1')
  .split(',')
  .map((value) => Number(String(value || '').trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);
let volunteerReminderSweepRunning = false;
let volunteerReminderLastRunDateKey = '';
let eventReminderSweepRunning = false;
let eventReminderLastRunDateKey = '';
const darbarSahibStreamSource = String(process.env.DARBAR_SAHIB_STREAM_PROXY_TARGET || 'http://live.sgpc.net:4835/;').trim();
const adOrganicViewCooldownMs = Number(process.env.AD_ORGANIC_VIEW_COOLDOWN_MS || (24 * 60 * 60 * 1000));

const resolveClientIp = (request) => {
  const forwarded = String(request.headers['x-forwarded-for'] || '').trim();
  if (forwarded) {
    const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[0];
    }
  }

  const remote = request.socket?.remoteAddress || request.connection?.remoteAddress || '';
  return String(remote || '').trim();
};

const buildAdViewerHash = (request) => {
  const ip = resolveClientIp(request);
  const ua = String(request.headers['user-agent'] || '').trim();
  const fingerprint = `${ip}|${ua}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
};

const parseReminderSendTime = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { hour: 9, minute: 0 };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 9, minute: 0 };
  }

  return { hour, minute };
};

const volunteerReminderSendTime = parseReminderSendTime(volunteerReminderSendTimeRaw);
const eventReminderSendTime = parseReminderSendTime(eventReminderSendTimeRaw);

const getDatePartsInTimeZone = (date = new Date(), timeZone = 'UTC') => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const lookup = (type) => parts.find((part) => part.type === type)?.value || '';
    return {
      year: Number(lookup('year')) || date.getUTCFullYear(),
      month: Number(lookup('month')) || (date.getUTCMonth() + 1),
      day: Number(lookup('day')) || date.getUTCDate(),
      hour: Number(lookup('hour')) || 0,
      minute: Number(lookup('minute')) || 0
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes()
    };
  }
};

const toDateKeyFromParts = ({ year, month, day }) => {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const shouldRunVolunteerReminderSweep = (date = new Date()) => {
  const nowParts = getDatePartsInTimeZone(date, volunteerReminderTimeZone);
  const todayDateKey = toDateKeyFromParts(nowParts);
  const nowMinutes = (nowParts.hour * 60) + nowParts.minute;
  const scheduledMinutes = (volunteerReminderSendTime.hour * 60) + volunteerReminderSendTime.minute;

  if (volunteerReminderLastRunDateKey === todayDateKey) {
    return false;
  }

  return nowMinutes >= scheduledMinutes;
};

const runScheduledVolunteerReminderSweep = async () => {
  if (!shouldRunVolunteerReminderSweep()) {
    return null;
  }

  const result = await runVolunteerReminderSweep();
  const nowParts = getDatePartsInTimeZone(new Date(), volunteerReminderTimeZone);
  volunteerReminderLastRunDateKey = toDateKeyFromParts(nowParts);
  return result;
};

const buildLogoDataUri = () => {
  const candidates = [
    path.join(workspaceRoot, 'src', 'assets', 'gurdwara-logo.webp'),
    path.join(workspaceRoot, 'public', 'gurdwara-logo.webp')
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const binary = fs.readFileSync(candidate);
      if (!binary?.length) {
        continue;
      }
      return `data:image/webp;base64,${binary.toString('base64')}`;
    } catch {
      // Ignore logo read failure and continue to next source.
    }
  }

  return '';
};

const embeddedVolunteerReminderLogo = buildLogoDataUri();

const seedUsers = [
  {
    id: 'user-1',
    name: 'Admin Singh',
    role: 'Super Admin',
    email: 'admin@singhsabhamilton.org',
    phone: '',
    address: '',
    memberType: 'Admin',
    authProvider: 'LOCAL',
    avatarUrl: '',
    registrationComplete: true,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature, Authorization, X-Actor-Email, X-Actor-Role, X-Actor-Name',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  response.end(JSON.stringify(payload));
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const proxyAudioStream = (request, response, targetUrlString) => {
  const targetUrl = new URL(targetUrlString);
  const client = targetUrl.protocol === 'https:' ? https : http;
  const upstreamMethod = request.method === 'HEAD' ? 'HEAD' : 'GET';

  const proxyRequest = client.request(targetUrl, {
    method: upstreamMethod,
    headers: {
      'User-Agent': request.headers['user-agent'] || 'Mozilla/5.0',
      Accept: '*/*'
    }
  }, (proxyResponse) => {
    const headers = {
      'Content-Type': proxyResponse.headers['content-type'] || 'audio/aacp',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Icy-MetaData',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS'
    };

    ['icy-notice1', 'icy-notice2', 'icy-name', 'icy-genre', 'icy-br', 'icy-sr', 'icy-url', 'icy-pub'].forEach((headerName) => {
      if (proxyResponse.headers[headerName]) {
        headers[headerName] = proxyResponse.headers[headerName];
      }
    });

    response.writeHead(proxyResponse.statusCode || 200, headers);

    if (request.method === 'HEAD') {
      response.end();
      proxyResponse.destroy();
      return;
    }

    proxyResponse.pipe(response);
  });

  proxyRequest.setTimeout(15000, () => {
    proxyRequest.destroy(new Error('Stream request timed out'));
  });

  proxyRequest.on('error', (error) => {
    if (!response.headersSent) {
      sendJson(response, 502, {
        ok: false,
        message: error.message || 'Unable to proxy the live stream.'
      });
      return;
    }

    response.destroy(error);
  });

  proxyRequest.end();
};

const ensureStorage = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify(seedUsers, null, 2), 'utf8');
  }
  if (!fs.existsSync(volunteerReminderLogPath)) {
    fs.writeFileSync(volunteerReminderLogPath, JSON.stringify({ sent: {} }, null, 2), 'utf8');
  }
  if (!fs.existsSync(eventReminderLogPath)) {
    fs.writeFileSync(eventReminderLogPath, JSON.stringify({ sent: {} }, null, 2), 'utf8');
  }
};

const readVolunteerReminderLog = () => {
  ensureStorage();
  try {
    const raw = fs.readFileSync(volunteerReminderLogPath, 'utf8');
    const parsed = JSON.parse(raw);
    const sent = parsed && typeof parsed.sent === 'object' && parsed.sent ? parsed.sent : {};
    return { sent };
  } catch {
    return { sent: {} };
  }
};

const writeVolunteerReminderLog = (payload) => {
  ensureStorage();
  const next = {
    sent: payload && typeof payload.sent === 'object' && payload.sent ? payload.sent : {}
  };
  fs.writeFileSync(volunteerReminderLogPath, JSON.stringify(next, null, 2), 'utf8');
};

const readEventReminderLog = () => {
  ensureStorage();
  try {
    const raw = fs.readFileSync(eventReminderLogPath, 'utf8');
    const parsed = JSON.parse(raw);
    const sent = parsed && typeof parsed.sent === 'object' && parsed.sent ? parsed.sent : {};
    return { sent };
  } catch {
    return { sent: {} };
  }
};

const writeEventReminderLog = (payload) => {
  ensureStorage();
  const next = {
    sent: payload && typeof payload.sent === 'object' && payload.sent ? payload.sent : {}
  };
  fs.writeFileSync(eventReminderLogPath, JSON.stringify(next, null, 2), 'utf8');
};

const getUtcStartOfDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const getDaysUntilDate = (dateValue) => {
  const target = getUtcStartOfDay(dateValue);
  if (target == null) {
    return null;
  }

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
};

const formatDateTimeLabel = (dateValue, fallback = 'Date TBD') => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  try {
    return parsed.toLocaleString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return parsed.toISOString();
  }
};

const escapeIcsText = (value) => {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
};

const formatIcsDateUtc = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

const buildEventIcsBody = (event, urlBase = '') => {
  const start = new Date(event?.date || '');
  const endCandidate = new Date(event?.endDate || event?.end || '');
  const end = Number.isNaN(endCandidate.getTime()) ? new Date(start.getTime() + (60 * 60 * 1000)) : endCandidate;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '';
  }

  const uid = `${String(event?.id || 'event')}-ssm@singhsabhamilton.org`;
  const created = formatIcsDateUtc(new Date());
  const startUtc = formatIcsDateUtc(start);
  const endUtc = formatIcsDateUtc(end);
  const location = escapeIcsText(event?.location || 'Singh Sabha Milton Gurdwara');
  const title = escapeIcsText(event?.title || 'Event');
  const description = escapeIcsText(event?.description || 'Sangat event');
  const eventUrl = urlBase
    ? `${String(urlBase).replace(/\/$/, '')}/events?eventId=${encodeURIComponent(String(event?.id || ''))}`
    : '';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Singh Sabha Milton//Events Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${created}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    ...(eventUrl ? [`URL:${escapeIcsText(eventUrl)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return `${lines.join('\r\n')}\r\n`;
};

const buildEventsCalendarIcsBody = (events = [], urlBase = '') => {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Singh Sabha Milton//Events Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  const footer = ['END:VCALENDAR'];
  const nowStamp = formatIcsDateUtc(new Date());

  const items = (Array.isArray(events) ? events : [])
    .filter((event) => Boolean(event?.date))
    .map((event) => {
      const start = new Date(event.date);
      if (Number.isNaN(start.getTime())) {
        return '';
      }

      const endCandidate = new Date(event.endDate || event.end || '');
      const end = Number.isNaN(endCandidate.getTime()) ? new Date(start.getTime() + (60 * 60 * 1000)) : endCandidate;
      const eventUrl = urlBase
        ? `${String(urlBase).replace(/\/$/, '')}/events?eventId=${encodeURIComponent(String(event.id || ''))}`
        : '';

      return [
        'BEGIN:VEVENT',
        `UID:${String(event.id || `event-${start.getTime()}`)}-ssm@singhsabhamilton.org`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${formatIcsDateUtc(start)}`,
        `DTEND:${formatIcsDateUtc(end)}`,
        `SUMMARY:${escapeIcsText(event.title || 'Event')}`,
        `DESCRIPTION:${escapeIcsText(event.description || 'Sangat event')}`,
        `LOCATION:${escapeIcsText(event.location || 'Singh Sabha Milton Gurdwara')}`,
        ...(eventUrl ? [`URL:${escapeIcsText(eventUrl)}`] : []),
        'END:VEVENT'
      ].join('\r\n');
    })
    .filter(Boolean);

  return `${[...header, ...items, ...footer].join('\r\n')}\r\n`;
};

const getRequestActor = (request) => {
  const email = String(request.headers['x-actor-email'] || '').trim().toLowerCase();
  const role = String(request.headers['x-actor-role'] || '').trim();
  const name = String(request.headers['x-actor-name'] || '').trim();
  return { email, role, name };
};

const appendAuditLog = async (request, details = {}) => {
  try {
    const actor = getRequestActor(request);
    const record = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action: String(details.action || '').trim() || 'unknown',
      targetType: String(details.targetType || '').trim() || 'unknown',
      targetId: String(details.targetId || '').trim(),
      description: String(details.description || '').trim(),
      actorEmail: actor.email,
      actorRole: actor.role,
      actorName: actor.name,
      method: String(request.method || ''),
      path: String(details.path || request.url || ''),
      payload: details.payload || null,
      createdAt: new Date().toISOString()
    };

    if (!eventsDb.hasDatabaseConnection) {
      return;
    }

    await eventsDb.createItem('audit_logs', record);
  } catch {
    // Never block request flow on audit log failures.
  }
};

const normalizeVolunteerRegistrationForReminder = (entry = {}) => {
  const id = String(entry.id || '').trim();
  const email = String(entry.email || '').trim().toLowerCase();
  const sevaDate = String(entry.sevaDate || entry.seva_date || entry.date || '').trim();
  const sevaType = String(entry.sevaType || entry.seva_type || entry.area || 'Seva').trim();
  const sevaTime = String(entry.sevaTime || entry.seva_time || entry.time || '').trim();
  const name = String(entry.name || 'Volunteer').trim();
  const status = String(entry.status || '').trim().toLowerCase();
  const contactPreference = String(entry.contactPreference || entry.contact_preference || 'Email').trim().toLowerCase();
  const wantsEventEmails = entry.wantsEventEmails == null
    ? entry.wants_event_emails == null
      ? true
      : Boolean(entry.wants_event_emails)
    : Boolean(entry.wantsEventEmails);

  return {
    id,
    opportunityId: String(entry.opportunityId || entry.opportunity_id || '').trim(),
    email,
    name,
    sevaDate,
    sevaType,
    sevaTime,
    status,
    contactPreference,
    wantsEventEmails
  };
};

const getSevaOpportunitiesMap = async () => {
  const opportunityRows = await eventsDb.listItems('seva_opportunities');

  return new Map(
    (Array.isArray(opportunityRows) ? opportunityRows : []).map((row) => [String(row.id || ''), row || {}])
  );
};

const getVolunteerRegistrationsForReminder = async () => {
  const opportunityMap = await getSevaOpportunitiesMap();

  const rows = await eventsDb.listItems('volunteer_registrations');

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const registration = normalizeVolunteerRegistrationForReminder(row);
    const opportunityId = String(row?.opportunityId || row?.opportunity_id || '').trim();
    const linkedOpportunity = opportunityId ? opportunityMap.get(opportunityId) : null;

    if (!linkedOpportunity) {
      return registration;
    }

    return {
      ...registration,
      sevaDate: String(linkedOpportunity.date || registration.sevaDate || ''),
      sevaTime: String(linkedOpportunity.time || registration.sevaTime || ''),
      sevaType: String(linkedOpportunity.sevaType || registration.sevaType || 'Seva')
    };
  });
};

const formatSevaDateLabel = (value) => {
  if (!value) {
    return 'Date TBD';
  }

  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildVolunteerReminderEmail = ({ registration, daysRemaining = null, manual = false }) => {
  const sevaDateLabel = formatSevaDateLabel(registration.sevaDate);
  const timeLabel = registration.sevaTime || 'Time TBD';
  const logoSrc = volunteerReminderLogoUrl || `${volunteerReminderBaseUrl}/gurdwara-logo.webp` || embeddedVolunteerReminderLogo;
  const greetingLine = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ';
  const requesterNameBase = String(registration.name || 'Aashoodeep singh Singh').trim().replace(/[.\s]+$/g, '');
  const requesterName = `${requesterNameBase}.`;

  const subject = manual
    ? `${registration.sevaType} Seva Details | ${volunteerReminderSiteName}`
    : `Seva Reminder (${daysRemaining} day${daysRemaining === 1 ? '' : 's'}): ${registration.sevaType}`;

  const text = [
    greetingLine,
    '',
    requesterName,
    '',
    'This is a manual seva notification from admin.',
    '',
    `Seva Type: ${registration.sevaType}`,
    `Seva Date: ${sevaDateLabel}`,
    `Seva Time: ${timeLabel}`,
    `Gurdwara: ${volunteerReminderSiteName}`,
    '',
    'Kindly arrive a little early and check in with the seva coordinator.',
    'Thank you for serving the sangat.'
  ].join('\n');

  if (!volunteerReminderHtmlTemplateEnabled) {
    return { subject, text, html: '' };
  }

  const html = `
  <div style="background:#f5f8fc;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:28px 24px 14px;text-align:center;">
          ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(volunteerReminderSiteName)} logo" width="92" height="92" style="display:block;margin:0 auto 18px;object-fit:contain;background:#ffffff;border-radius:50%;"/>` : ''}
          <div style="font-size:18px;line-height:1.6;font-weight:700;color:#0f172a;">${escapeHtml(greetingLine)}</div>
          <div style="margin-top:12px;font-size:16px;line-height:1.7;color:#334155;font-weight:600;">${escapeHtml(requesterName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <div style="font-size:15px;line-height:1.8;color:#334155;margin-bottom:14px;">This is a manual seva notification from admin.</div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #d7e3f3;border-radius:12px;overflow:hidden;background:#fbfdff;margin-bottom:16px;">
            <tr>
              <td style="width:34%;padding:12px 14px;background:#eef5ff;border-bottom:1px solid #d7e3f3;font-size:14px;font-weight:700;color:#0a4d9f;">Seva Type</td>
              <td style="padding:12px 14px;border-bottom:1px solid #d7e3f3;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(registration.sevaType || 'Seva')}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;background:#eef5ff;border-bottom:1px solid #d7e3f3;font-size:14px;font-weight:700;color:#0a4d9f;">Seva Date</td>
              <td style="padding:12px 14px;border-bottom:1px solid #d7e3f3;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(sevaDateLabel)}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;background:#eef5ff;border-bottom:1px solid #d7e3f3;font-size:14px;font-weight:700;color:#0a4d9f;">Seva Time</td>
              <td style="padding:12px 14px;border-bottom:1px solid #d7e3f3;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(timeLabel)}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;background:#eef5ff;font-size:14px;font-weight:700;color:#0a4d9f;">Gurdwara</td>
              <td style="padding:12px 14px;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(volunteerReminderSiteName)}</td>
            </tr>
          </table>
          <div style="font-size:15px;line-height:1.8;color:#334155;">
            Kindly arrive a little early and check in with the seva coordinator.<br/>
            Thank you for serving the sangat.
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  return { subject, text, html };
};

const sendVolunteerReminderEmail = async (registration, options = {}) => {
  if (!volunteerReminderWebhookUrl) {
    return { sent: false, reason: 'missing_webhook' };
  }

  const daysRemaining = Number.isFinite(Number(options.daysRemaining)) ? Number(options.daysRemaining) : null;
  const manual = options.manual === true;
  const template = buildVolunteerReminderEmail({ registration, daysRemaining, manual });
  const htmlBody = String(template?.html || '').trim();

  const payload = {
    type: manual ? 'volunteer-seva-manual' : 'volunteer-seva-reminder',
    to: registration.email,
    name: registration.name,
    subject: template.subject,
    message: template.text,
    text: template.text,
    html: htmlBody,
    bodyHtml: htmlBody,
    bodyText: template.text,
    templateType: htmlBody ? 'html' : 'text',
    metadata: {
      reminderDays: daysRemaining,
      sevaType: registration.sevaType,
      sevaDate: registration.sevaDate,
      sevaTime: registration.sevaTime,
      registrationId: registration.id,
      opportunityId: registration.opportunityId || '',
      manual
    },
    sentAt: new Date().toISOString()
  };

  try {
    const response = await fetch(volunteerReminderWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { sent: false, reason: 'webhook_error' };
    }

    return { sent: true };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
};

const buildOpportunityEmailPreview = async (opportunityId) => {
  const normalizedOpportunityId = String(opportunityId || '').trim();
  if (!normalizedOpportunityId) {
    const error = new Error('Opportunity id is required.');
    error.status = 400;
    throw error;
  }

  const opportunityMap = await getSevaOpportunitiesMap();
  const selectedOpportunity = opportunityMap.get(normalizedOpportunityId);
  if (!selectedOpportunity) {
    const error = new Error('Seva opportunity not found.');
    error.status = 404;
    throw error;
  }

  const registrations = await getVolunteerRegistrationsForReminder();
  const matching = registrations.filter((entry) => {
    const linked = String(entry.opportunityId || '') === normalizedOpportunityId;
    const legacyMatch = !entry.opportunityId
      && String(entry.sevaType || '').trim().toLowerCase() === String(selectedOpportunity.sevaType || '').trim().toLowerCase()
      && String(entry.sevaDate || '').trim() === String(selectedOpportunity.date || '').trim();
    return linked || legacyMatch;
  });

  const sample = matching[0] || {
    id: `preview-${normalizedOpportunityId}`,
    opportunityId: normalizedOpportunityId,
    email: 'volunteer@example.com',
    name: 'Sevadar',
    sevaDate: String(selectedOpportunity.date || ''),
    sevaType: String(selectedOpportunity.sevaType || 'Seva'),
    sevaTime: String(selectedOpportunity.time || ''),
    status: 'pending',
    contactPreference: 'email',
    wantsEventEmails: true
  };

  const template = buildVolunteerReminderEmail({ registration: sample, manual: true });
  return template;
};

const sendManualOpportunityReminders = async (opportunityId) => {
  const normalizedOpportunityId = String(opportunityId || '').trim();
  if (!normalizedOpportunityId) {
    const error = new Error('Opportunity id is required.');
    error.status = 400;
    throw error;
  }

  const opportunityMap = await getSevaOpportunitiesMap();
  const selectedOpportunity = opportunityMap.get(normalizedOpportunityId);
  if (!selectedOpportunity) {
    const error = new Error('Seva opportunity not found.');
    error.status = 404;
    throw error;
  }

  const registrations = await getVolunteerRegistrationsForReminder();
  const matching = registrations.filter((entry) => {
    const linked = String(entry.opportunityId || '') === normalizedOpportunityId;
    const legacyMatch = !entry.opportunityId
      && String(entry.sevaType || '').trim().toLowerCase() === String(selectedOpportunity.sevaType || '').trim().toLowerCase()
      && String(entry.sevaDate || '').trim() === String(selectedOpportunity.date || '').trim();
    return linked || legacyMatch;
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const registration of matching) {
    processed += 1;

    if (!registration.email || registration.status === 'rejected' || registration.status === 'cancelled') {
      skipped += 1;
      continue;
    }

    const result = await sendVolunteerReminderEmail(registration, { manual: true });
    if (!result.sent) {
      skipped += 1;
      continue;
    }

    sent += 1;
  }

  return {
    opportunityId: normalizedOpportunityId,
    sevaType: String(selectedOpportunity.sevaType || ''),
    sevaDate: String(selectedOpportunity.date || ''),
    processed,
    sent,
    skipped,
    webhookConfigured: Boolean(volunteerReminderWebhookUrl)
  };
};

const runVolunteerReminderSweep = async (options = {}) => {
  if (volunteerReminderSweepRunning) {
    return { processed: 0, sent: 0, skipped: 0, reason: 'already_running' };
  }

  volunteerReminderSweepRunning = true;
  const force = options.force === true;

  try {
    const registrations = await getVolunteerRegistrationsForReminder();
    const logStore = readVolunteerReminderLog();
    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const registration of registrations) {
      processed += 1;

      if (!registration.id || !registration.email || !registration.sevaDate) {
        skipped += 1;
        continue;
      }

      if (registration.status === 'rejected' || registration.status === 'cancelled') {
        skipped += 1;
        continue;
      }

      if (!(registration.wantsEventEmails || registration.contactPreference === 'email')) {
        skipped += 1;
        continue;
      }

      const daysRemaining = getDaysUntilDate(registration.sevaDate);
      if (daysRemaining == null || !volunteerReminderDays.includes(daysRemaining)) {
        skipped += 1;
        continue;
      }

      const reminderKey = `${registration.id}:${registration.sevaDate}:${daysRemaining}`;
      if (!force && logStore.sent[reminderKey]) {
        skipped += 1;
        continue;
      }

      const result = await sendVolunteerReminderEmail(registration, { daysRemaining, manual: false });
      if (!result.sent) {
        skipped += 1;
        continue;
      }

      sent += 1;
      logStore.sent[reminderKey] = new Date().toISOString();
    }

    writeVolunteerReminderLog(logStore);
    return { processed, sent, skipped, force, webhookConfigured: Boolean(volunteerReminderWebhookUrl) };
  } finally {
    volunteerReminderSweepRunning = false;
  }
};

const normalizeEventRegistrantForReminder = (entry = {}, event = {}) => {
  return {
    id: String(entry.id || '').trim(),
    email: String(entry.email || '').trim().toLowerCase(),
    name: String(entry.name || 'Registrant').trim(),
    status: String(entry.status || 'confirmed').trim().toLowerCase(),
    eventId: String(event.id || '').trim(),
    eventTitle: String(event.title || 'Event').trim(),
    eventDate: String(event.date || '').trim(),
    eventEndDate: String(event.endDate || event.end || '').trim(),
    eventLocation: String(event.location || '').trim(),
    eventDescription: String(event.description || '').trim()
  };
};

const isValidEmailAddress = (value = '') => {
  const email = String(value || '').trim().toLowerCase();
  if (!email) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getEventRegistrationsForReminder = async () => {
  const events = await eventsDb.getEvents();
  const rows = [];

  (Array.isArray(events) ? events : []).forEach((event) => {
    const registrants = Array.isArray(event?.registrants) ? event.registrants : [];
    registrants.forEach((entry) => {
      rows.push(normalizeEventRegistrantForReminder(entry, event));
    });
  });

  return rows;
};

const buildEventReminderEmail = ({ registration, daysRemaining = null }) => {
  const eventDateLabel = formatDateTimeLabel(registration.eventDate, 'Date TBD');
  const timeLabel = registration.eventEndDate
    ? `${formatDateTimeLabel(registration.eventDate, eventDateLabel)} - ${formatDateTimeLabel(registration.eventEndDate, 'End TBD')}`
    : eventDateLabel;
  const logoSrc = volunteerReminderLogoUrl || `${volunteerReminderBaseUrl}/gurdwara-logo.webp` || embeddedVolunteerReminderLogo;
  const greetingLine = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ';
  const recipientNameBase = String(registration.name || 'Sangat Member').trim().replace(/[.\s]+$/g, '');
  const recipientName = `${recipientNameBase}.`;
  const registrationType = registration.status === 'waitlisted' ? 'waitlist' : 'registration';
  const subject = `Event Reminder (${daysRemaining} day${daysRemaining === 1 ? '' : 's'}): ${registration.eventTitle}`;
  const text = [
    greetingLine,
    '',
    recipientName,
    '',
    `This is your ${registrationType} reminder for the upcoming event.`,
    `Event: ${registration.eventTitle}`,
    `Date and Time: ${timeLabel}`,
    `Location: ${registration.eventLocation || 'Singh Sabha Milton Gurdwara'}`,
    registration.eventDescription ? `Details: ${registration.eventDescription}` : '',
    '',
    registration.status === 'waitlisted'
      ? 'You are currently on the waitlist. If a confirmed spot opens, the team will contact you.'
      : 'Please arrive a few minutes early so the program can begin on time.',
    '',
    'Thank you for your support and participation.'
  ].filter(Boolean).join('\n');

  const html = `
  <div style="background:#f5f8fc;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:28px 24px 14px;text-align:center;">
          ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(volunteerReminderSiteName)} logo" width="92" height="92" style="display:block;margin:0 auto 18px;object-fit:contain;background:#ffffff;border-radius:50%;"/>` : ''}
          <div style="font-size:18px;line-height:1.6;font-weight:700;color:#0f172a;">${escapeHtml(greetingLine)}</div>
          <div style="margin-top:12px;font-size:16px;line-height:1.7;color:#334155;font-weight:600;">${escapeHtml(recipientName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <div style="font-size:15px;line-height:1.8;color:#334155;margin-bottom:14px;">This is your ${escapeHtml(registrationType)} reminder for the upcoming event.</div>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #d7e3f3;border-radius:12px;overflow:hidden;background:#fbfdff;margin-bottom:16px;">
            <tr>
              <td style="width:34%;padding:12px 14px;background:#eef5ff;border-bottom:1px solid #d7e3f3;font-size:14px;font-weight:700;color:#0a4d9f;">Event</td>
              <td style="padding:12px 14px;border-bottom:1px solid #d7e3f3;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(registration.eventTitle || 'Event')}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;background:#eef5ff;border-bottom:1px solid #d7e3f3;font-size:14px;font-weight:700;color:#0a4d9f;">Date and Time</td>
              <td style="padding:12px 14px;border-bottom:1px solid #d7e3f3;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(timeLabel)}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;background:#eef5ff;border-bottom:1px solid #d7e3f3;font-size:14px;font-weight:700;color:#0a4d9f;">Location</td>
              <td style="padding:12px 14px;border-bottom:1px solid #d7e3f3;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(registration.eventLocation || 'Singh Sabha Milton Gurdwara')}</td>
            </tr>
            <tr>
              <td style="padding:12px 14px;background:#eef5ff;font-size:14px;font-weight:700;color:#0a4d9f;">Gurdwara</td>
              <td style="padding:12px 14px;font-size:17px;font-weight:800;color:#0f172a;">${escapeHtml(volunteerReminderSiteName)}</td>
            </tr>
          </table>
          ${registration.eventDescription ? `<div style="font-size:15px;line-height:1.8;color:#334155;margin-bottom:10px;">${escapeHtml(registration.eventDescription)}</div>` : ''}
          <div style="font-size:15px;line-height:1.8;color:#334155;">
            ${registration.status === 'waitlisted'
              ? 'You are currently on the waitlist. If a confirmed spot opens, the team will contact you.'
              : 'Please arrive a little early and check in at the registration desk.'}
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  return { subject, text, html };
};

const sendEventReminderEmail = async (registration, options = {}) => {
  if (!eventReminderWebhookUrl) {
    return { sent: false, reason: 'missing_webhook' };
  }

  const daysRemaining = Number.isFinite(Number(options.daysRemaining)) ? Number(options.daysRemaining) : null;
  const template = buildEventReminderEmail({ registration, daysRemaining });
  const htmlBody = String(template.html || '').trim();

  const payload = {
    type: 'event-registration-reminder',
    to: registration.email,
    email: registration.email,
    name: registration.name,
    subject: template.subject,
    message: template.text,
    text: template.text,
    html: htmlBody,
    bodyHtml: htmlBody,
    bodyText: template.text,
    templateType: htmlBody ? 'html' : 'text',
    metadata: {
      reminderDays: daysRemaining,
      eventId: registration.eventId,
      eventTitle: registration.eventTitle,
      eventDate: registration.eventDate,
      registrationStatus: registration.status
    },
    sentAt: new Date().toISOString()
  };

  try {
    const response = await fetch(eventReminderWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { sent: false, reason: 'webhook_error' };
    }

    return { sent: true };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
};

const shouldRunEventReminderSweep = (date = new Date()) => {
  const nowParts = getDatePartsInTimeZone(date, eventReminderTimeZone);
  const todayDateKey = toDateKeyFromParts(nowParts);
  const nowMinutes = (nowParts.hour * 60) + nowParts.minute;
  const scheduledMinutes = (eventReminderSendTime.hour * 60) + eventReminderSendTime.minute;

  if (eventReminderLastRunDateKey === todayDateKey) {
    return false;
  }

  return nowMinutes >= scheduledMinutes;
};

const runEventReminderSweep = async (options = {}) => {
  if (eventReminderSweepRunning) {
    return { processed: 0, sent: 0, skipped: 0, reason: 'already_running' };
  }

  eventReminderSweepRunning = true;
  const force = options.force === true;

  try {
    const registrations = await getEventRegistrationsForReminder();
    const logStore = readEventReminderLog();
    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const registration of registrations) {
      processed += 1;

      if (!registration.id || !registration.email || !registration.eventDate || !isValidEmailAddress(registration.email)) {
        skipped += 1;
        continue;
      }

      if (registration.status === 'cancelled') {
        skipped += 1;
        continue;
      }

      const daysRemaining = getDaysUntilDate(registration.eventDate);
      if (daysRemaining == null || !eventReminderDays.includes(daysRemaining)) {
        skipped += 1;
        continue;
      }

      const reminderKey = `${registration.id}:${registration.eventId}:${registration.eventDate}:${daysRemaining}`;
      if (!force && logStore.sent[reminderKey]) {
        skipped += 1;
        continue;
      }

      const result = await sendEventReminderEmail(registration, { daysRemaining });
      if (!result.sent) {
        skipped += 1;
        continue;
      }

      sent += 1;
      logStore.sent[reminderKey] = new Date().toISOString();
    }

    writeEventReminderLog(logStore);
    return { processed, sent, skipped, force, webhookConfigured: Boolean(eventReminderWebhookUrl) };
  } finally {
    eventReminderSweepRunning = false;
  }
};

const runScheduledEventReminderSweep = async () => {
  if (!shouldRunEventReminderSweep()) {
    return null;
  }

  const result = await runEventReminderSweep();
  const nowParts = getDatePartsInTimeZone(new Date(), eventReminderTimeZone);
  eventReminderLastRunDateKey = toDateKeyFromParts(nowParts);
  return result;
};

const getVolunteerRecognitionData = async () => {
  const rows = await eventsDb.listItems('volunteer_registrations');

  const summaryByKey = new Map();

  (Array.isArray(rows) ? rows : []).forEach((entry) => {
    const status = String(entry?.status || '').trim().toLowerCase();
    if (status === 'cancelled' || status === 'rejected') {
      return;
    }

    const email = String(entry?.email || '').trim().toLowerCase();
    const name = String(entry?.name || 'Volunteer').trim() || 'Volunteer';
    const key = email || name.toLowerCase();
    const existing = summaryByKey.get(key) || {
      key,
      email,
      name,
      participations: 0,
      points: 0,
      latestSevaDate: ''
    };

    const participationPoints = status === 'approved' || status === 'completed' ? 2 : 1;
    const sevaDate = String(entry?.sevaDate || entry?.date || '').trim();

    existing.participations += 1;
    existing.points += participationPoints;
    if (sevaDate && (!existing.latestSevaDate || sevaDate > existing.latestSevaDate)) {
      existing.latestSevaDate = sevaDate;
    }

    summaryByKey.set(key, existing);
  });

  const resolveBadge = (points, participations) => {
    if (points >= 20 || participations >= 12) return 'Platinum Sevadar';
    if (points >= 12 || participations >= 8) return 'Gold Sevadar';
    if (points >= 6 || participations >= 4) return 'Silver Sevadar';
    return 'Bronze Sevadar';
  };

  const leaders = [...summaryByKey.values()]
    .map((entry) => ({
      ...entry,
      badge: resolveBadge(entry.points, entry.participations)
    }))
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.participations !== left.participations) {
        return right.participations - left.participations;
      }
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

  return {
    totalRecognized: leaders.length,
    topLeaders: leaders.slice(0, 12),
    allLeaders: leaders
  };
};

const mimeByExtension = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.txt': 'text/plain'
};

const normalizeUploadService = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return '';
  }
  return normalized;
};

const sanitizeFileName = (value) => {
  const base = path.basename(String(value || '').trim());
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  if (!cleaned) {
    return 'file';
  }
  return cleaned.slice(0, 120);
};

const getMimeTypeFromName = (fileName) => {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  return mimeByExtension[extension] || 'application/octet-stream';
};

const getExtensionFromMime = (mimeType) => {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('image/png')) return '.png';
  if (normalized.includes('image/jpeg')) return '.jpg';
  if (normalized.includes('image/gif')) return '.gif';
  if (normalized.includes('image/webp')) return '.webp';
  if (normalized.includes('image/svg+xml')) return '.svg';
  if (normalized.includes('application/pdf')) return '.pdf';
  if (normalized.includes('video/mp4')) return '.mp4';
  if (normalized.includes('video/webm')) return '.webm';
  if (normalized.includes('video/quicktime')) return '.mov';
  return '';
};

const extractBase64Payload = (dataUrlOrBase64 = '') => {
  const source = String(dataUrlOrBase64 || '').trim();
  if (!source) {
    return '';
  }

  if (source.startsWith('data:')) {
    const commaIndex = source.indexOf(',');
    if (commaIndex < 0) {
      return '';
    }
    return source.slice(commaIndex + 1);
  }

  return source;
};

const safeUploadPathSegments = (encodedRelativePath = '') => {
  return String(encodedRelativePath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, '_'))
    .filter(Boolean);
};

const normalizeQuizFileName = (value = '') => {
  const normalized = String(value || '').trim();
  if (!/^[0-9]{3}_[a-z0-9_]+\.json$/i.test(normalized)) {
    return '';
  }
  return normalized;
};

const getQuizBankFilePath = (fileName) => {
  const normalized = normalizeQuizFileName(fileName);
  if (!normalized) {
    return '';
  }

  const filePath = path.join(quizBankDir, normalized);
  const quizRoot = `${path.resolve(quizBankDir)}${path.sep}`;
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(quizRoot)) {
    return '';
  }

  return resolvedPath;
};

const buildUploadDirectory = (service) => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const targetDir = path.join(uploadsDir, service, year, month);
  fs.mkdirSync(targetDir, { recursive: true });
  return { targetDir, year, month };
};

const normalizeUser = (user = {}) => {
  const normalizeRole = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'super admin' || raw === 'super_admin' || raw === 'superadmin') {
      return 'Super Admin';
    }
    if (raw === 'admin') {
      return 'Admin';
    }
    if (raw === 'volunteer' || raw === 'volunteer coordinator' || raw === 'volunteer_coordinator') {
      return 'Volunteer';
    }
    if (raw === 'family') {
      return 'Family';
    }
    if (!raw) {
      return 'Member';
    }
    return 'Member';
  };

  const resolveMemberType = (role, fallback) => {
    if (fallback) {
      return fallback;
    }
    if (role === 'Super Admin' || role === 'Admin') {
      return 'Admin';
    }
    if (role === 'Volunteer') {
      return 'Volunteer';
    }
    if (role === 'Family') {
      return 'Family';
    }
    return 'Member';
  };

  const email = String(user.email || '').trim().toLowerCase();
  const role = normalizeRole(user.role);
  const memberType = resolveMemberType(role, String(user.memberType || '').trim());
  const approvalStatus = String(
    user.approvalStatus || (memberType === 'Admin' ? 'approved' : 'pending')
  ).toLowerCase();

  return {
    id: String(user.id || `user-${Date.now()}`),
    name: String(user.name || '').trim(),
    role,
    email,
    phone: String(user.phone || '').trim(),
    address: String(user.address || '').trim(),
    memberType,
    authProvider: String(user.authProvider || 'LOCAL').trim() || 'LOCAL',
    avatarUrl: String(user.avatarUrl || user.picture || '').trim(),
    registrationComplete: Boolean(user.registrationComplete),
    isActive: user.isActive !== false,
    approvalStatus,
    approvalUpdatedAt: String(user.approvalUpdatedAt || ''),
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const readUsers = () => {
  ensureStorage();
  try {
    const content = fs.readFileSync(usersPath, 'utf8');
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map(normalizeUser);
  } catch {
    return seedUsers.map(normalizeUser);
  }
};

const writeUsers = (records) => {
  ensureStorage();
  fs.writeFileSync(usersPath, JSON.stringify(records.map(normalizeUser), null, 2), 'utf8');
};

const getUserByEmail = (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }
  return readUsers().find((entry) => entry.email === normalizedEmail) || null;
};

const upsertUserByEmail = (payload = {}) => {
  const normalized = normalizeUser(payload);
  if (!normalized.email) {
    const error = new Error('Email is required.');
    error.status = 400;
    throw error;
  }

  const users = readUsers();
  const index = users.findIndex((entry) => entry.email === normalized.email);
  if (index < 0) {
    const next = [{ ...normalized, id: normalized.id || `user-${Date.now()}` }, ...users];
    writeUsers(next);
    return next[0];
  }

  const existing = users[index];
  const updated = {
    ...existing,
    ...normalized,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };
  const next = [...users];
  next[index] = updated;
  writeUsers(next);
  return updated;
};

const completeUserRegistration = (payload = {}) => {
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    const error = new Error('Email is required for registration.');
    error.status = 400;
    throw error;
  }

  const users = readUsers();
  const index = users.findIndex((entry) => entry.email === normalizedEmail);
  const base = index >= 0 ? users[index] : normalizeUser({ email: normalizedEmail, name: payload.name });
  const memberType = String(payload.memberType || base.memberType || 'Member');
  const approvalStatus = memberType === 'Admin' ? 'approved' : 'pending';

  const updated = normalizeUser({
    ...base,
    name: payload.name || base.name,
    phone: payload.phone || base.phone,
    address: payload.address || base.address,
    role: payload.role || base.role,
    memberType,
    avatarUrl: payload.avatarUrl || base.avatarUrl,
    registrationComplete: true,
    isActive: base.isActive !== false,
    approvalStatus,
    approvalUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const next = [...users];
  if (index >= 0) {
    next[index] = { ...updated, id: base.id, createdAt: base.createdAt };
  } else {
    next.unshift(updated);
  }
  writeUsers(next);
  return index >= 0 ? next[index] : next[0];
};

const readDonations = async () => {
  return eventsDb.getDonations();
};

const upsertDonation = async (record) => {
  return eventsDb.upsertDonation(record);
};

const getDonationCampaigns = async () => {
  return eventsDb.getDonationCampaigns();
};

const createDonationCampaign = async (payload) => {
  return eventsDb.createDonationCampaign(payload);
};

const updateDonationCampaign = async (id, payload) => {
  return eventsDb.updateDonationCampaign(id, payload);
};

const removeDonationCampaign = async (id) => {
  return eventsDb.removeDonationCampaign(id);
};

const getDonationSummary = async () => {
  return eventsDb.summarizeDonationsByCampaign();
};

const syncCampaignRaisedTotal = async ({ campaignId, campaignName } = {}) => {
  const summary = await getDonationSummary();
  const normalizedName = String(campaignName || '').trim().toLowerCase();
  const numericCampaignId = Number(campaignId);

  const allCampaigns = await getDonationCampaigns();
  const matchedCampaign = Number.isFinite(numericCampaignId) && numericCampaignId > 0
    ? allCampaigns.find((entry) => Number(entry.id) === numericCampaignId)
    : allCampaigns.find((entry) => String(entry.name || '').trim().toLowerCase() === normalizedName);

  if (!matchedCampaign) {
    return null;
  }

  const byId = Number(summary[`id:${Number(matchedCampaign.id)}`] || 0);
  const byName = Number(summary[`name:${String(matchedCampaign.name || '').trim().toLowerCase()}`] || 0);
  const nextRaised = Math.max(0, Number.isFinite(byId) ? byId : 0, Number.isFinite(byName) ? byName : 0);

  return updateDonationCampaign(Number(matchedCampaign.id), { raised: nextRaised });
};

const reconcilePaidPendingDonations = async () => {
  if (!stripe) {
    return { reconciled: 0, checked: 0, skipped: 0 };
  }

  const pendingRows = await getPendingDonations();
  if (!Array.isArray(pendingRows) || pendingRows.length === 0) {
    return { reconciled: 0, checked: 0, skipped: 0 };
  }

  const stripeClient = requireStripeClient();
  let reconciled = 0;
  let checked = 0;
  let skipped = 0;

  for (const pending of pendingRows.slice(0, 50)) {
    const sessionId = String(pending?.sessionId || '').trim();
    const provider = String(pending?.paymentProvider || '').trim().toUpperCase();

    if (provider !== 'STRIPE' || !sessionId) {
      skipped += 1;
      continue;
    }

    checked += 1;

    try {
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      const isPaid = String(session?.status || '').toLowerCase() === 'complete'
        && String(session?.payment_status || '').toLowerCase() === 'paid';

      if (!isPaid) {
        continue;
      }

      const donationRecord = {
        ...mapWebhookDonation(session, `reconcile-${session.id}`),
        sourcePendingId: String(pending.id || ''),
        campaignId: Number.isFinite(Number(pending.campaignId)) ? Number(pending.campaignId) : null,
        campaignName: String(pending.campaignName || '').trim() || mapWebhookDonation(session, `reconcile-${session.id}`).campaignName,
        donorName: String(pending.donorName || '').trim() || mapWebhookDonation(session, `reconcile-${session.id}`).donorName,
        donorEmail: String(pending.donorEmail || '').trim() || mapWebhookDonation(session, `reconcile-${session.id}`).donorEmail,
        source: 'stripe-reconcile'
      };

      const persistedDonation = await upsertDonation(donationRecord);
      await syncCampaignRaisedTotal({
        campaignId: persistedDonation?.campaignId,
        campaignName: persistedDonation?.campaignName
      });
      await removePendingDonation(pending.id);
      reconciled += 1;
    } catch (error) {
      // Leave pending record untouched; it can be retried on subsequent requests.
      console.error('[donations] reconcile failed for pending row', {
        pendingId: pending?.id,
        sessionId,
        message: error?.message || 'unknown error'
      });
    }
  }

  return { reconciled, checked, skipped };
};

const clearDonations = async () => {
  return eventsDb.clearDonations();
};

const getPendingDonations = async () => {
  return eventsDb.getPendingDonations();
};

const createPendingDonation = async (payload) => {
  return eventsDb.createPendingDonation(payload);
};

const removePendingDonation = async (id) => {
  return eventsDb.removePendingDonation(id);
};

const clearPendingDonations = async () => {
  return eventsDb.clearPendingDonations();
};

const requireStripeClient = () => {
  if (!stripe) {
    const error = new Error('STRIPE_SECRET_KEY is not configured on the server.');
    error.status = 500;
    throw error;
  }
  return stripe;
};

const mapWebhookDonation = (session, eventId) => {
  const metadata = session.metadata || {};
  const amountCents = Number(session.amount_total || 0);
  const amount = amountCents > 0 ? amountCents / 100 : 0;
  const campaignId = Number(metadata.campaign_id || 0);

  return {
    id: `stripe-${session.id}`,
    receiptId: `STR-${String(session.id).slice(-8).toUpperCase()}`,
    sourcePendingId: metadata.pending_id || '',
    campaignId: Number.isFinite(campaignId) && campaignId > 0 ? campaignId : null,
    campaignName: metadata.campaign_name || 'General Donation',
    donorName: metadata.donor_name || session.customer_details?.name || 'Anonymous',
    donorEmail: metadata.donor_email || session.customer_details?.email || '',
    amount,
    frequency: metadata.frequency || 'one-time',
    paymentProvider: 'STRIPE',
    paymentStatus: session.payment_status === 'paid' ? 'PAID' : String(session.payment_status || 'PENDING').toUpperCase(),
    gatewayTransactionId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',
    stripeSessionId: session.id,
    stripeEventId: eventId,
    createdAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    emailSent: true,
    source: 'stripe-webhook'
  };
};

const summarizeByCampaign = (donations) => {
  const map = {};
  donations.forEach((donation) => {
    const byIdKey = donation.campaignId != null ? `id:${donation.campaignId}` : '';
    const byNameKey = donation.campaignName ? `name:${String(donation.campaignName).toLowerCase()}` : '';
    const amount = Number(donation.amount || 0);

    if (byIdKey) {
      map[byIdKey] = (map[byIdKey] || 0) + amount;
    }
    if (byNameKey) {
      map[byNameKey] = (map[byNameKey] || 0) + amount;
    }
  });
  return map;
};

const parseYouTubeChannelSource = (value = '') => {
  const input = String(value || '').trim();
  if (!input) {
    return null;
  }

  const extractVideoId = (rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) {
      return '';
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) {
      return raw;
    }

    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();

      if (host.includes('youtu.be')) {
        const candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
        if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) {
          return candidate;
        }
      }

      if (host.includes('youtube.com')) {
        const fromQuery = parsed.searchParams.get('v') || '';
        if (/^[A-Za-z0-9_-]{11}$/.test(fromQuery)) {
          return fromQuery;
        }

        const parts = parsed.pathname.split('/').filter(Boolean);
        const liveIndex = parts.findIndex((part) => ['live', 'embed', 'shorts'].includes(part.toLowerCase()));
        if (liveIndex >= 0) {
          const candidate = parts[liveIndex + 1] || '';
          if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) {
            return candidate;
          }
        }
      }
    } catch {
      // Ignore URL parsing errors and fall back to regex matching.
    }

    const fallbackMatch = raw.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/i);
    return fallbackMatch ? fallbackMatch[1] : '';
  };

  const videoId = extractVideoId(input);
  if (videoId) {
    return { type: 'videoId', value: videoId };
  }

  const channelMatch = input.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i) || input.match(/\b(UC[A-Za-z0-9_-]{20,})\b/i);
  if (channelMatch) {
    return { type: 'channelId', value: channelMatch[1] };
  }

  const handleMatch = input.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i) || input.match(/^@([A-Za-z0-9._-]+)$/i);
  if (handleMatch) {
    return { type: 'handle', value: handleMatch[1] };
  }

  return null;
};

const resolveYouTubeLiveVideo = async (source) => {
  const parsedSource = parseYouTubeChannelSource(source);
  if (!parsedSource) {
    const error = new Error('Enter a YouTube channel URL, handle, or channel ID.');
    error.status = 400;
    throw error;
  }

  const fetchVideoDetails = async (videoId) => {
    if (!youtubeApiKey) {
      return {
        isLive: true,
        channelId: '',
        videoId,
        title: '',
        channelTitle: '',
        concurrentViewers: null,
        totalViews: null,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`
      };
    }

    const liveDetailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    liveDetailsUrl.searchParams.set('part', 'snippet,liveStreamingDetails,statistics,status');
    liveDetailsUrl.searchParams.set('id', videoId);
    liveDetailsUrl.searchParams.set('key', youtubeApiKey);

    const liveDetailsResponse = await fetch(liveDetailsUrl);
    const liveDetailsPayload = await liveDetailsResponse.json().catch(() => ({}));
    const liveVideo = liveDetailsPayload?.items?.[0] || null;

    if (!liveDetailsResponse.ok || !liveVideo) {
      return null;
    }

    const liveSnippet = liveVideo?.snippet || {};
    const liveStreamingDetails = liveVideo?.liveStreamingDetails || {};
    const statistics = liveVideo?.statistics || {};
    const rawViewers = Number(liveStreamingDetails?.concurrentViewers);
    const rawTotalViews = Number(statistics?.viewCount);
    const liveBroadcastContent = String(liveSnippet?.liveBroadcastContent || '').toLowerCase();
    const hasConcurrentViewers = Number.isFinite(rawViewers) && rawViewers >= 0;
    const hasLiveWindow = Boolean(liveStreamingDetails?.actualStartTime) && !liveStreamingDetails?.actualEndTime;
    const isLive = liveBroadcastContent === 'live' || hasConcurrentViewers || hasLiveWindow;

    return {
      isLive,
      channelId: String(liveSnippet?.channelId || ''),
      videoId,
      title: String(liveSnippet?.title || ''),
      channelTitle: String(liveSnippet?.channelTitle || ''),
      concurrentViewers: hasConcurrentViewers ? rawViewers : null,
      totalViews: Number.isFinite(rawTotalViews) && rawTotalViews >= 0 ? rawTotalViews : null,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  };

  const extractVideoIdFromUrl = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    try {
      const parsed = new URL(raw);
      const v = parsed.searchParams.get('v') || '';
      if (/^[A-Za-z0-9_-]{11}$/.test(v)) {
        return v;
      }
    } catch {
      // Ignore URL parsing errors.
    }

    const match = raw.match(/(?:v=|youtu\.be\/|\/embed\/|\/live\/|\/shorts\/)([A-Za-z0-9_-]{11})/i);
    return match ? match[1] : '';
  };

  const resolveLiveVideoIdFromChannelPage = async (sourceType, sourceValue, resolvedChannelId) => {
    const candidates = [];

    if (sourceType === 'handle' && sourceValue) {
      candidates.push(`https://www.youtube.com/@${sourceValue}/live`);
    }
    if (resolvedChannelId) {
      candidates.push(`https://www.youtube.com/channel/${resolvedChannelId}/live`);
    }

    for (const candidate of candidates) {
      try {
        const pageResponse = await fetch(candidate, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SinghSabhaMiltonBot/1.0)'
          }
        });

        if (!pageResponse.ok) {
          continue;
        }

        const redirectedVideoId = extractVideoIdFromUrl(pageResponse.url || '');
        if (redirectedVideoId) {
          return redirectedVideoId;
        }

        const html = await pageResponse.text();
        const htmlVideoIdMatch = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        if (htmlVideoIdMatch?.[1]) {
          return htmlVideoIdMatch[1];
        }
      } catch {
        // Ignore fallback lookup errors and continue to the next candidate.
      }
    }

    return '';
  };

  const resolveChannelIdFromSourcePage = async (sourceType, sourceValue, resolvedChannelId) => {
    const candidates = [];

    if (resolvedChannelId) {
      candidates.push(`https://www.youtube.com/channel/${resolvedChannelId}`);
    }

    if (sourceType === 'handle' && sourceValue) {
      candidates.push(`https://www.youtube.com/@${sourceValue}`);
    }

    for (const candidate of candidates) {
      try {
        const pageResponse = await fetch(candidate, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SinghSabhaMiltonBot/1.0)'
          }
        });

        if (!pageResponse.ok) {
          continue;
        }

        const resolvedFromUrl = String(pageResponse.url || '').match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/i)?.[1] || '';
        if (resolvedFromUrl) {
          return resolvedFromUrl;
        }

        const html = await pageResponse.text();
        const fromJson = html.match(/"channelId":"(UC[A-Za-z0-9_-]{20,})"/i)?.[1] || '';
        if (fromJson) {
          return fromJson;
        }

        const fromPath = html.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/i)?.[1] || '';
        if (fromPath) {
          return fromPath;
        }
      } catch {
        // Ignore fallback lookup errors and continue to the next candidate.
      }
    }

    return '';
  };

  if (parsedSource.type === 'videoId') {
    const videoDetails = await fetchVideoDetails(parsedSource.value);

    if (videoDetails?.isLive) {
      return {
        available: true,
        reason: '',
        checkedAt: new Date().toISOString(),
        channelId: videoDetails.channelId,
        videoId: videoDetails.videoId,
        title: videoDetails.title,
        channelTitle: videoDetails.channelTitle,
        concurrentViewers: videoDetails.concurrentViewers,
        totalViews: videoDetails.totalViews,
        embedUrl: videoDetails.embedUrl,
        watchUrl: videoDetails.watchUrl
      };
    }

    return {
      available: false,
      reason: 'not_live',
      checkedAt: new Date().toISOString(),
      channelId: videoDetails?.channelId || '',
      videoId: parsedSource.value,
      title: videoDetails?.title || '',
      channelTitle: videoDetails?.channelTitle || '',
      concurrentViewers: null,
      totalViews: videoDetails?.totalViews ?? null,
      embedUrl: videoDetails?.embedUrl || `https://www.youtube.com/embed/${parsedSource.value}`,
      watchUrl: videoDetails?.watchUrl || `https://www.youtube.com/watch?v=${parsedSource.value}`
    };
  }

  let channelId = parsedSource.type === 'channelId' ? parsedSource.value : '';

  if (parsedSource.type === 'handle') {
    if (youtubeApiKey) {
      const channelLookupUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
      channelLookupUrl.searchParams.set('part', 'id');
      channelLookupUrl.searchParams.set('forHandle', parsedSource.value);
      channelLookupUrl.searchParams.set('key', youtubeApiKey);

      const channelResponse = await fetch(channelLookupUrl);
      const channelPayload = await channelResponse.json().catch(() => ({}));
      channelId = channelPayload?.items?.[0]?.id || '';

      if (!channelResponse.ok || !channelId) {
        channelId = await resolveChannelIdFromSourcePage(parsedSource.type, parsedSource.value, channelId);
      }
    } else {
      channelId = await resolveChannelIdFromSourcePage(parsedSource.type, parsedSource.value, channelId);
    }

    if (!channelId) {
      const error = new Error('Unable to resolve the YouTube channel handle.');
      error.status = 404;
      throw error;
    }
  }

  let videoId = '';
  let searchResponseOk = false;

  if (youtubeApiKey && channelId) {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('channelId', channelId);
    searchUrl.searchParams.set('eventType', 'live');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', '1');
    searchUrl.searchParams.set('key', youtubeApiKey);

    const searchResponse = await fetch(searchUrl);
    searchResponseOk = searchResponse.ok;
    const searchPayload = await searchResponse.json().catch(() => ({}));
    const liveItem = searchPayload?.items?.[0] || null;
    videoId = liveItem?.id?.videoId || '';
  }

  if (!videoId) {
    videoId = await resolveLiveVideoIdFromChannelPage(parsedSource.type, parsedSource.value, channelId);
  }

  if (!videoId) {
    const fallbackWatchUrl = parsedSource.type === 'handle'
      ? `https://www.youtube.com/@${parsedSource.value}/live`
      : channelId
        ? `https://www.youtube.com/channel/${channelId}/live`
        : '';
    const fallbackEmbedUrl = channelId
      ? `https://www.youtube.com/embed/live_stream?channel=${channelId}`
      : '';

    return {
      available: Boolean(fallbackEmbedUrl),
      reason: searchResponseOk ? 'not_live' : 'lookup_fallback',
      checkedAt: new Date().toISOString(),
      channelId,
      videoId: '',
      title: '',
      channelTitle: '',
      concurrentViewers: null,
      totalViews: null,
      embedUrl: fallbackEmbedUrl,
      watchUrl: fallbackWatchUrl
    };
  }

  const liveDetails = await fetchVideoDetails(videoId);

  if (!liveDetails) {
    return {
      available: false,
      reason: 'lookup_failed',
      checkedAt: new Date().toISOString(),
      channelId,
      videoId,
      title: '',
      channelTitle: '',
      concurrentViewers: null,
      totalViews: null,
      embedUrl: '',
      watchUrl: ''
    };
  }

  return {
    available: true,
    reason: '',
    checkedAt: new Date().toISOString(),
    channelId: liveDetails.channelId || channelId,
    videoId: liveDetails.videoId,
    title: liveDetails.title,
    channelTitle: liveDetails.channelTitle,
    concurrentViewers: liveDetails.concurrentViewers,
    totalViews: liveDetails.totalViews,
    embedUrl: liveDetails.embedUrl,
    watchUrl: liveDetails.watchUrl
  };
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (requestUrl.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      stripeConfigured: Boolean(stripeSecretKey),
      webhookConfigured: Boolean(stripeWebhookSecret),
      eventsDatabaseConfigured: eventsDb.hasDatabaseConnection
    });
    return;
  }

  if (/^\/api\/streaming\/darbar-sahib\/live\/?$/i.test(requestUrl.pathname) && (request.method === 'GET' || request.method === 'HEAD')) {
    try {
      proxyAudioStream(request, response, darbarSahibStreamSource);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to start the Darbar Sahib live stream.'
      });
    }
    return;
  }

  if (requestUrl.pathname.startsWith('/api/uploads/') && request.method === 'GET') {
    try {
      const relative = requestUrl.pathname.slice('/api/uploads/'.length);
      const segments = safeUploadPathSegments(relative);
      if (segments.length < 2) {
        sendJson(response, 400, { ok: false, message: 'Invalid upload path.' });
        return;
      }

      const normalizedService = normalizeUploadService(segments[0]);
      if (!normalizedService) {
        sendJson(response, 400, { ok: false, message: 'Invalid upload service.' });
        return;
      }

      const filePath = path.join(uploadsDir, normalizedService, ...segments.slice(1));
      const normalizedRoot = `${path.resolve(uploadsDir)}${path.sep}`;
      const normalizedFilePath = path.resolve(filePath);
      if (!normalizedFilePath.startsWith(normalizedRoot) || !fs.existsSync(normalizedFilePath)) {
        sendJson(response, 404, { ok: false, message: 'File not found.' });
        return;
      }

      const stat = fs.statSync(normalizedFilePath);
      if (!stat.isFile()) {
        sendJson(response, 404, { ok: false, message: 'File not found.' });
        return;
      }

      response.writeHead(200, {
        'Content-Type': getMimeTypeFromName(normalizedFilePath),
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(normalizedFilePath).pipe(response);
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to read uploaded file.' });
    }
    return;
  }

  const uploadResourceMatch = requestUrl.pathname.match(/^\/api\/uploads\/([a-z0-9_-]+)$/i);
  if (uploadResourceMatch && request.method === 'POST') {
    try {
      ensureStorage();
      const service = normalizeUploadService(uploadResourceMatch[1]);
      if (!service) {
        sendJson(response, 400, { ok: false, message: 'Invalid upload service.' });
        return;
      }

      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const rawName = sanitizeFileName(body.fileName || 'upload-file');
      const mimeType = String(body.mimeType || '').trim().toLowerCase();
      const base64Payload = extractBase64Payload(body.dataUrl || body.base64Data || '');

      if (!base64Payload) {
        sendJson(response, 400, { ok: false, message: 'No file payload found.' });
        return;
      }

      const fileBuffer = Buffer.from(base64Payload, 'base64');
      if (!fileBuffer.length) {
        sendJson(response, 400, { ok: false, message: 'Invalid file payload.' });
        return;
      }

      if (fileBuffer.length > maxUploadBytes) {
        sendJson(response, 413, { ok: false, message: 'File too large. Max size is 15 MB.' });
        return;
      }

      let finalName = rawName;
      const requestedExt = path.extname(rawName);
      const inferredExt = getExtensionFromMime(mimeType);
      if (!requestedExt && inferredExt) {
        finalName = `${rawName}${inferredExt}`;
      }

      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storedFileName = `${uniqueSuffix}-${sanitizeFileName(finalName)}`;
      const { targetDir, year, month } = buildUploadDirectory(service);
      const outputPath = path.join(targetDir, storedFileName);
      fs.writeFileSync(outputPath, fileBuffer);

      const publicUrl = `/api/uploads/${service}/${year}/${month}/${encodeURIComponent(storedFileName)}`;
      sendJson(response, 200, {
        ok: true,
        data: {
          service,
          fileName: storedFileName,
          size: fileBuffer.length,
          mimeType: mimeType || getMimeTypeFromName(storedFileName),
          url: publicUrl
        }
      });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to upload file.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/analytics/metrics' && request.method === 'GET') {
    try {
      if (!eventsDb.hasDatabaseConnection) {
        sendJson(response, 500, { ok: false, message: 'Database is not configured.' });
        return;
      }

      const data = await eventsDb.getSingleton('analytics_metrics', null);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to fetch analytics metrics.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/analytics/trend' && request.method === 'GET') {
    try {
      if (!eventsDb.hasDatabaseConnection) {
        sendJson(response, 500, { ok: false, message: 'Database is not configured.' });
        return;
      }

      const data = await eventsDb.getSingleton('analytics_trend', []);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to fetch analytics trend.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/quiz-bank' && request.method === 'GET') {
    try {
      if (!fs.existsSync(quizBankDir)) {
        fs.mkdirSync(quizBankDir, { recursive: true });
      }

      const filesystemFiles = fs.readdirSync(quizBankDir)
        .filter((name) => normalizeQuizFileName(name))
        .sort((left, right) => left.localeCompare(right))
        .map((name) => {
          const filePath = path.join(quizBankDir, name);
          let questionCount = 0;
          try {
            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            questionCount = Array.isArray(payload) ? payload.length : 0;
          } catch {
            questionCount = 0;
          }

          return { fileName: name, questionCount };
        });

      if (eventsDb.hasDatabaseConnection) {
        let data = await eventsDb.listQuizBankFiles();

        if (!Array.isArray(data) || data.length === 0) {
          for (const file of filesystemFiles) {
            const filePath = getQuizBankFilePath(file.fileName);
            if (!filePath || !fs.existsSync(filePath)) {
              continue;
            }
            try {
              const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              const questions = Array.isArray(payload) ? payload : [];
              await eventsDb.upsertQuizBankFile(file.fileName, questions);
            } catch {
              // Ignore file parse failures during DB backfill.
            }
          }
          data = await eventsDb.listQuizBankFiles();
        }

        sendJson(response, 200, { ok: true, data: Array.isArray(data) && data.length > 0 ? data : filesystemFiles });
        return;
      }

      sendJson(response, 200, { ok: true, data: filesystemFiles });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to list quiz files.' });
    }
    return;
  }

  const quizBankFileMatch = requestUrl.pathname.match(/^\/api\/quiz-bank\/([^/]+)$/i);
  if (quizBankFileMatch && request.method === 'GET') {
    try {
      const fileName = decodeURIComponent(quizBankFileMatch[1]);
      const filePath = getQuizBankFilePath(fileName);
      if (!filePath) {
        sendJson(response, 400, { ok: false, message: 'Invalid quiz file name.' });
        return;
      }

      const normalizedFileName = path.basename(filePath);
      if (eventsDb.hasDatabaseConnection) {
        const dbRecord = await eventsDb.getQuizBankFile(normalizedFileName);
        if (dbRecord) {
          sendJson(response, 200, { ok: true, data: dbRecord });
          return;
        }
      }

      if (!fs.existsSync(filePath)) {
        sendJson(response, 404, { ok: false, message: 'Quiz file not found.' });
        return;
      }

      const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const questions = Array.isArray(payload) ? payload : [];

      if (eventsDb.hasDatabaseConnection) {
        await eventsDb.upsertQuizBankFile(normalizedFileName, questions);
      }

      sendJson(response, 200, { ok: true, data: { fileName: normalizedFileName, questions } });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to read quiz file.' });
    }
    return;
  }

  if (quizBankFileMatch && request.method === 'PUT') {
    try {
      const fileName = decodeURIComponent(quizBankFileMatch[1]);
      const filePath = getQuizBankFilePath(fileName);
      if (!filePath) {
        sendJson(response, 400, { ok: false, message: 'Invalid quiz file name.' });
        return;
      }

      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const questions = Array.isArray(body.questions) ? body.questions : [];
      fs.mkdirSync(quizBankDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf8');

      const normalizedFileName = path.basename(filePath);
      if (eventsDb.hasDatabaseConnection) {
        await eventsDb.upsertQuizBankFile(normalizedFileName, questions);
      }

      sendJson(response, 200, { ok: true, data: { fileName: normalizedFileName, questions } });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to update quiz file.' });
    }
    return;
  }

  const contentResourceMatch = requestUrl.pathname.match(/^\/api\/content\/([a-z0-9_-]+)$/i);
  if (contentResourceMatch && request.method === 'GET') {
    try {
      const resource = String(contentResourceMatch[1]).toLowerCase();
      const data = await eventsDb.listItems(resource);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to fetch content list.' });
    }
    return;
  }

  if (contentResourceMatch && request.method === 'POST') {
    try {
      const resource = String(contentResourceMatch[1]).toLowerCase();
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.createItem(resource, body);
      if (resource !== 'audit_logs') {
        await appendAuditLog(request, {
          action: 'content.create',
          targetType: resource,
          targetId: String(data?.id || ''),
          description: `Created ${resource} item`,
          payload: body
        });
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to create content item.' });
    }
    return;
  }

  const contentResourceIdMatch = requestUrl.pathname.match(/^\/api\/content\/([a-z0-9_-]+)\/([^/]+)$/i);
  if (contentResourceIdMatch && request.method === 'PATCH') {
    try {
      const resource = String(contentResourceIdMatch[1]).toLowerCase();
      const id = decodeURIComponent(contentResourceIdMatch[2]);
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.updateItem(resource, id, body);
      if (resource !== 'audit_logs') {
        await appendAuditLog(request, {
          action: 'content.update',
          targetType: resource,
          targetId: String(id || ''),
          description: `Updated ${resource} item`,
          payload: body
        });
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to update content item.' });
    }
    return;
  }

  if (contentResourceIdMatch && request.method === 'DELETE') {
    try {
      const resource = String(contentResourceIdMatch[1]).toLowerCase();
      const id = decodeURIComponent(contentResourceIdMatch[2]);
      const data = await eventsDb.removeItem(resource, id);
      if (resource !== 'audit_logs') {
        await appendAuditLog(request, {
          action: 'content.delete',
          targetType: resource,
          targetId: String(id || ''),
          description: `Deleted ${resource} item`
        });
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to delete content item.' });
    }
    return;
  }

  const contentSingleMatch = requestUrl.pathname.match(/^\/api\/content-single\/([a-z0-9_-]+)$/i);
  if (contentSingleMatch && request.method === 'GET') {
    try {
      const resource = String(contentSingleMatch[1]).toLowerCase();
      const data = await eventsDb.getSingleton(resource, null);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to fetch singleton content.' });
    }
    return;
  }

  if (contentSingleMatch && request.method === 'PUT') {
    try {
      const resource = String(contentSingleMatch[1]).toLowerCase();
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.setSingleton(resource, body);
      await appendAuditLog(request, {
        action: 'content.singleton.update',
        targetType: resource,
        targetId: resource,
        description: `Updated singleton ${resource}`,
        payload: body
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to update singleton content.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/calendar.ics' && request.method === 'GET') {
    try {
      const events = await eventsDb.getEvents();
      const includeInactive = requestUrl.searchParams.get('includeInactive') === 'true';
      const visibleEvents = includeInactive
        ? (Array.isArray(events) ? events : [])
        : (Array.isArray(events) ? events : []).filter((event) => event?.active !== false && event?.isActive !== false);
      const feed = buildEventsCalendarIcsBody(
        visibleEvents,
        volunteerReminderBaseUrl
      );
      response.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ssm-events.ics"',
        'Access-Control-Allow-Origin': '*'
      });
      response.end(feed);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to generate calendar feed.'
      });
    }
    return;
  }

  const singleEventCalendarMatch = requestUrl.pathname.match(/^\/api\/events\/([^/]+)\/calendar\.ics$/);
  if (singleEventCalendarMatch && request.method === 'GET') {
    try {
      const id = decodeURIComponent(singleEventCalendarMatch[1]);
      const events = await eventsDb.getEvents();
      const event = (Array.isArray(events) ? events : []).find((entry) => String(entry.id) === String(id));
      if (!event) {
        sendJson(response, 404, { ok: false, message: 'Event not found.' });
        return;
      }

      const feed = buildEventIcsBody(event, volunteerReminderBaseUrl);
      response.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="event-${String(event.id)}.ics"`,
        'Access-Control-Allow-Origin': '*'
      });
      response.end(feed);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to generate event calendar file.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events' && request.method === 'GET') {
    try {
      const includeInactive = requestUrl.searchParams.get('includeInactive') === 'true';
      const rows = await eventsDb.getEvents();
      const data = includeInactive
        ? rows
        : (Array.isArray(rows) ? rows : []).filter((event) => event?.active !== false && event?.isActive !== false);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to read events from database.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.createEvent(body);
      await appendAuditLog(request, {
        action: 'event.create',
        targetType: 'event',
        targetId: String(data?.id || ''),
        description: `Created event ${String(data?.title || '').trim()}`,
        payload: body
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to create event in database.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/register' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.registerForEvent(body);
      await appendAuditLog(request, {
        action: 'event.register',
        targetType: 'event',
        targetId: String(body?.eventId || ''),
        description: `Registered ${String(body?.email || body?.contact || body?.name || 'participant')} for event`,
        payload: {
          eventId: body?.eventId,
          name: body?.name,
          email: body?.email,
          contact: body?.contact
        }
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to register for event.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/registrant/remove' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.removeEventRegistrant(body);
      await appendAuditLog(request, {
        action: 'event.registrant.remove',
        targetType: 'event',
        targetId: String(body?.eventId || ''),
        description: `Removed event registrant ${String(body?.registrantId || '')}`,
        payload: {
          eventId: body?.eventId,
          registrantId: body?.registrantId
        }
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to remove event registrant.'
      });
    }
    return;
  }

  const eventPathMatch = requestUrl.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventPathMatch && request.method === 'PATCH') {
    try {
      const id = Number(decodeURIComponent(eventPathMatch[1]));
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await eventsDb.updateEvent(id, body);
      await appendAuditLog(request, {
        action: 'event.update',
        targetType: 'event',
        targetId: String(id),
        description: `Updated event ${String(id)}`,
        payload: body
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to update event.'
      });
    }
    return;
  }

  if (eventPathMatch && request.method === 'DELETE') {
    try {
      const id = Number(decodeURIComponent(eventPathMatch[1]));
      const data = await eventsDb.removeEvent(id);
      await appendAuditLog(request, {
        action: 'event.delete',
        targetType: 'event',
        targetId: String(id),
        description: `Deleted event ${String(id)}`
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to remove event.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/stripe/create-checkout-session' && request.method === 'POST') {
    try {
      const stripeClient = requireStripeClient();
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');

      const campaignName = String(body.campaignName || 'General Donation').trim() || 'General Donation';
      const pendingId = String(body.pendingId || `pending-${Date.now()}`);
      const origin = String(body.origin || request.headers.origin || 'http://localhost:3000').replace(/\/$/, '');
      const successUrl = `${origin}/donationsuccess?session_id={CHECKOUT_SESSION_ID}&pending_id=${encodeURIComponent(pendingId)}`;
      const cancelUrl = `${origin}/donation?cancelled=1`;
      const parsedAmountCents = Number(body.amountCents);
      const parsedAmount = Number(body.amount);
      const derivedAmountCents = Number.isFinite(parsedAmount) && parsedAmount > 0
        ? Math.round(parsedAmount * 100)
        : NaN;
      const effectiveAmountCents = Number.isFinite(parsedAmountCents) && parsedAmountCents > 0
        ? Math.round(parsedAmountCents)
        : derivedAmountCents;

      if (!Number.isFinite(effectiveAmountCents) || effectiveAmountCents <= 0) {
        sendJson(response, 400, {
          ok: false,
          message: 'Donation amount is required.'
        });
        return;
      }

      const unitAmount = effectiveAmountCents;

      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        submit_type: 'donate',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: body.donorEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: `${campaignName} Donation`
              },
              unit_amount: unitAmount
            },
            quantity: 1
          }
        ],
        metadata: {
          pending_id: pendingId,
          campaign_id: String(body.campaignId || ''),
          campaign_name: campaignName,
          donor_name: String(body.donorName || ''),
          donor_email: String(body.donorEmail || ''),
          frequency: String(body.frequency || 'one-time'),
          donation_purpose: String(body.donationPurpose || campaignName)
        }
      });

      sendJson(response, 200, {
        ok: true,
        data: {
          pendingId,
          sessionId: session.id,
          checkoutUrl: session.url
        }
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to create Stripe Checkout session.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/stripe/resolve') {
    try {
      const stripeClient = requireStripeClient();
      const sessionId = requestUrl.searchParams.get('session_id') || requestUrl.searchParams.get('sessionId') || '';
      const paymentIntentId = requestUrl.searchParams.get('payment_intent') || requestUrl.searchParams.get('paymentIntentId') || '';

      if (!sessionId && !paymentIntentId) {
        sendJson(response, 400, { ok: false, message: 'Provide session_id or payment_intent.' });
        return;
      }

      if (sessionId) {
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);
        sendJson(response, 200, {
          ok: true,
          data: {
            source: 'checkout_session',
            id: session.id,
            status: session.status,
            paymentStatus: session.payment_status,
            amount: Number(session.amount_total || 0),
            currency: session.currency || stripeCurrency,
            clientReferenceId: session.client_reference_id || '',
            paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || ''
          }
        });
        return;
      }

      const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      sendJson(response, 200, {
        ok: true,
        data: {
          source: 'payment_intent',
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: Number(paymentIntent.amount_received || paymentIntent.amount || 0),
          currency: paymentIntent.currency || stripeCurrency,
          clientReferenceId: paymentIntent.client_reference_id || '',
          paymentIntentId: paymentIntent.id
        }
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        ok: false,
        message: error.message || 'Unable to resolve Stripe payment details.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/streaming/youtube/live' && request.method === 'GET') {
    try {
      const source = requestUrl.searchParams.get('source') || requestUrl.searchParams.get('channelId') || requestUrl.searchParams.get('channelUrl') || '';
      const liveDetails = await resolveYouTubeLiveVideo(source);
      sendJson(response, 200, {
        ok: true,
        data: {
          source,
          ...liveDetails
        }
      });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to resolve the live YouTube stream.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/volunteer-reminders/run' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await runVolunteerReminderSweep({ force: body?.force === true });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to run volunteer reminders.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/reminders/run' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await runEventReminderSweep({ force: body?.force === true });
      await appendAuditLog(request, {
        action: 'event.reminders.run',
        targetType: 'event-reminders',
        targetId: 'scheduled',
        description: 'Executed event reminder sweep',
        payload: { force: body?.force === true, result: data }
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to run event reminders.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/volunteer-recognition' && request.method === 'GET') {
    try {
      const data = await getVolunteerRecognitionData();
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to generate volunteer recognition data.'
      });
    }
    return;
  }

  const manualReminderMatch = requestUrl.pathname.match(/^\/api\/volunteer-reminders\/opportunity\/([^/]+)\/send$/i);
  if (manualReminderMatch && request.method === 'POST') {
    try {
      const opportunityId = decodeURIComponent(manualReminderMatch[1]);
      const data = await sendManualOpportunityReminders(opportunityId);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to send manual volunteer reminders.'
      });
    }
    return;
  }

  const reminderPreviewMatch = requestUrl.pathname.match(/^\/api\/volunteer-reminders\/opportunity\/([^/]+)\/preview$/i);
  if (reminderPreviewMatch && request.method === 'GET') {
    try {
      const opportunityId = decodeURIComponent(reminderPreviewMatch[1]);
      const template = await buildOpportunityEmailPreview(opportunityId);
      const responseFormat = String(requestUrl.searchParams.get('format') || '').trim().toLowerCase();
      const htmlBody = String(template?.html || '').trim();

      if (responseFormat === 'json') {
        sendJson(response, 200, {
          ok: true,
          data: {
            subject: template.subject || '',
            text: template.text || '',
            html: htmlBody,
            templateType: htmlBody ? 'html' : 'text'
          }
        });
        return;
      }

      if (!htmlBody) {
        response.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        response.end(template.text || 'No preview available.');
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      response.end(htmlBody);
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to render reminder preview.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/stripe/webhook' && request.method === 'POST') {
    try {
      if (!stripeWebhookSecret) {
        sendJson(response, 500, {
          ok: false,
          message: 'STRIPE_WEBHOOK_SECRET is not configured on the server.'
        });
        return;
      }

      const stripeClient = requireStripeClient();
      const body = await readBody(request);
      const signature = request.headers['stripe-signature'];
      const event = stripeClient.webhooks.constructEvent(body, signature, stripeWebhookSecret);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const donationRecord = mapWebhookDonation(session, event.id);
        const persistedDonation = await upsertDonation(donationRecord);
        await syncCampaignRaisedTotal({
          campaignId: persistedDonation?.campaignId,
          campaignName: persistedDonation?.campaignName
        });
      }

      sendJson(response, 200, { received: true });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: `Webhook Error: ${error.message || 'Invalid webhook event.'}`
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donations' && request.method === 'GET') {
    await reconcilePaidPendingDonations();
    const data = (await readDonations()).sort((left, right) => {
      const l = new Date(left.createdAt || 0).getTime();
      const r = new Date(right.createdAt || 0).getTime();
      return r - l;
    });
    sendJson(response, 200, { ok: true, data });
    return;
  }

  if (requestUrl.pathname === '/api/donations' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await upsertDonation(body);
      await syncCampaignRaisedTotal({ campaignId: data?.campaignId, campaignName: data?.campaignName });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to upsert donation.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donations' && request.method === 'DELETE') {
    try {
      const data = await clearDonations();
      await clearPendingDonations();
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to clear donations.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donations/summary' && request.method === 'GET') {
    await reconcilePaidPendingDonations();
    const summary = await getDonationSummary();
    sendJson(response, 200, { ok: true, data: summary });
    return;
  }

  if (requestUrl.pathname === '/api/donation-campaigns' && request.method === 'GET') {
    await reconcilePaidPendingDonations();
    const data = await getDonationCampaigns();
    sendJson(response, 200, { ok: true, data });
    return;
  }

  if (requestUrl.pathname === '/api/donation-campaigns' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await createDonationCampaign(body);
      await appendAuditLog(request, {
        action: 'donation.campaign.create',
        targetType: 'donation-campaign',
        targetId: String(data?.id || ''),
        description: `Created campaign ${String(data?.name || '')}`,
        payload: body
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to create donation campaign.' });
    }
    return;
  }

  const campaignIdMatch = requestUrl.pathname.match(/^\/api\/donation-campaigns\/([^/]+)$/);
  if (campaignIdMatch && request.method === 'PATCH') {
    try {
      const id = Number(decodeURIComponent(campaignIdMatch[1]));
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await updateDonationCampaign(id, body);
      await appendAuditLog(request, {
        action: 'donation.campaign.update',
        targetType: 'donation-campaign',
        targetId: String(id),
        description: `Updated campaign ${String(id)}`,
        payload: body
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to update donation campaign.' });
    }
    return;
  }

  if (campaignIdMatch && request.method === 'DELETE') {
    try {
      const id = Number(decodeURIComponent(campaignIdMatch[1]));
      const data = await removeDonationCampaign(id);
      await appendAuditLog(request, {
        action: 'donation.campaign.delete',
        targetType: 'donation-campaign',
        targetId: String(id),
        description: `Deleted campaign ${String(id)}`
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to remove donation campaign.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donation-pending' && request.method === 'GET') {
    await reconcilePaidPendingDonations();
    const data = await getPendingDonations();
    sendJson(response, 200, { ok: true, data });
    return;
  }

  if (requestUrl.pathname === '/api/donation-pending/latest' && request.method === 'GET') {
    await reconcilePaidPendingDonations();
    const list = await getPendingDonations();
    sendJson(response, 200, { ok: true, data: list[0] || null });
    return;
  }

  if (requestUrl.pathname === '/api/donation-pending' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = await createPendingDonation(body);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to create pending donation.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donation-pending' && request.method === 'DELETE') {
    try {
      const data = await clearPendingDonations();
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to clear pending donations.' });
    }
    return;
  }

  const pendingIdMatch = requestUrl.pathname.match(/^\/api\/donation-pending\/([^/]+)$/);
  if (pendingIdMatch && request.method === 'DELETE') {
    try {
      const id = decodeURIComponent(pendingIdMatch[1]);
      const data = await removePendingDonation(id);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to remove pending donation.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/users' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, data: readUsers() });
    return;
  }

  if (requestUrl.pathname === '/api/users/by-email' && request.method === 'GET') {
    const email = requestUrl.searchParams.get('email') || '';
    sendJson(response, 200, { ok: true, data: getUserByEmail(email) });
    return;
  }

  if (requestUrl.pathname === '/api/users/upsert-by-email' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = upsertUserByEmail(body);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to upsert user.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/users/complete-registration' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const data = completeUserRegistration(body);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to complete user registration.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/users' && request.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const record = normalizeUser({
        ...body,
        id: body.id || `user-${Date.now()}`,
        isActive: body.isActive !== false,
        approvalStatus: body.approvalStatus || 'approved',
        approvalUpdatedAt: new Date().toISOString()
      });
      const next = [record, ...readUsers()];
      writeUsers(next);
      sendJson(response, 200, { ok: true, data: record });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to create user.'
      });
    }
    return;
  }

  const approvalPathMatch = requestUrl.pathname.match(/^\/api\/users\/([^/]+)\/approval$/);
  if (approvalPathMatch && request.method === 'PATCH') {
    try {
      const id = decodeURIComponent(approvalPathMatch[1]);
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const approvalStatus = String(body.approvalStatus || 'pending').toLowerCase();

      const next = readUsers().map((user) => (
        user.id !== id
          ? user
          : normalizeUser({
            ...user,
            approvalStatus,
            approvalUpdatedAt: new Date().toISOString(),
            registrationComplete: approvalStatus === 'approved' ? user.registrationComplete : false
          })
      ));

      writeUsers(next);
      sendJson(response, 200, { ok: true, data: next.find((user) => user.id === id) || null });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to update approval status.'
      });
    }
    return;
  }

  const userPathMatch = requestUrl.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userPathMatch && request.method === 'PATCH') {
    try {
      const id = decodeURIComponent(userPathMatch[1]);
      const body = JSON.parse((await readBody(request)).toString('utf8') || '{}');
      const next = readUsers().map((user) => (
        user.id === id ? normalizeUser({ ...user, ...body, id, createdAt: user.createdAt }) : user
      ));
      writeUsers(next);
      sendJson(response, 200, { ok: true, data: next.find((user) => user.id === id) || null });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to update user.'
      });
    }
    return;
  }

  if (userPathMatch && request.method === 'DELETE') {
    const id = decodeURIComponent(userPathMatch[1]);
    const next = readUsers().filter((user) => user.id !== id);
    writeUsers(next);
    sendJson(response, 200, { ok: true, data: { success: true } });
    return;
  }

  sendJson(response, 404, { ok: false, message: 'Not found' });
});

const bootstrap = async () => {
  if (eventsDb.hasDatabaseConnection) {
    try {
      await eventsDb.ensureEventsSchema();
      console.log('Events database schema ready.');
    } catch (error) {
      console.error('Failed to initialize events database:', error.message || error);
    }
  } else {
    console.warn('Events database is not configured. Set DATABASE_URL to enable PostgreSQL events storage.');
  }

  server.listen(port, () => {
    console.log(`Stripe API helper listening on http://127.0.0.1:${port}`);
  });

  const configuredTime = `${String(volunteerReminderSendTime.hour).padStart(2, '0')}:${String(volunteerReminderSendTime.minute).padStart(2, '0')}`;
  console.log(`Volunteer reminder scheduler set for ${configuredTime} (${volunteerReminderTimeZone}) daily.`);
  const eventConfiguredTime = `${String(eventReminderSendTime.hour).padStart(2, '0')}:${String(eventReminderSendTime.minute).padStart(2, '0')}`;
  console.log(`Event reminder scheduler set for ${eventConfiguredTime} (${eventReminderTimeZone}) daily.`);

  // Check every minute, but only send once per day after the configured local send time.
  setInterval(() => {
    runScheduledVolunteerReminderSweep().catch((error) => {
      console.error('Volunteer reminder sweep failed:', error.message || error);
    });
  }, 60 * 1000);

  // Run one immediate scheduler check on startup in case the server starts after today's send time.
  runScheduledVolunteerReminderSweep().catch((error) => {
    console.error('Initial volunteer reminder scheduler check failed:', error.message || error);
  });

  // Event reminders use the same minute cadence but maintain their own send window and dedupe log.
  setInterval(() => {
    runScheduledEventReminderSweep().catch((error) => {
      console.error('Event reminder sweep failed:', error.message || error);
    });
  }, 60 * 1000);

  runScheduledEventReminderSweep().catch((error) => {
    console.error('Initial event reminder scheduler check failed:', error.message || error);
  });
};

bootstrap();
