const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { URL } = require('url');
const Stripe = require('stripe');
const crypto = require('crypto');
const ffmpegPath = require('ffmpeg-static');
const {
  extractZeffyPaymentId,
  mapZeffyApiPayment,
  normalizeEventType,
  verifyZeffyWebhookToken
} = require('./zeffyWebhook');

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

const API_VERSION = '2026-07-27.phase2';
const API_STARTUP_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const PHASE2_TRANSLITERATION_VARIANTS = {
  gurdwara: ['gurudwara', 'gurdawara'],
  gurudwara: ['gurdwara', 'gurdawara'],
  seva: ['sewa'],
  sewa: ['seva'],
  waheguru: ['vaheguru'],
  vaheguru: ['waheguru'],
  gurbani: ['gurubani'],
  gurubani: ['gurbani'],
  langar: ['lungar'],
  lungar: ['langar'],
  nanakshahi: ['nanak shahi']
};

const buildPhase2SearchVariants = (query) => {
  const trimmed = String(query || '').trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const variants = new Set([trimmed]);
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  tokens.forEach((token) => {
    const replacements = PHASE2_TRANSLITERATION_VARIANTS[token] || [];
    replacements.forEach((candidate) => {
      variants.add(tokens.map((part) => (part === token ? candidate : part)).join(' '));
      variants.add(candidate);
    });
  });

  return Array.from(variants).slice(0, 5);
};

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
const zeffyApiKey = String(process.env.ZEFFY_API_KEY || '').trim();
const zeffyWebhookToken = String(process.env.ZEFFY_WEBHOOK_TOKEN || '').trim();
const zeffyCampaignId = Number(process.env.ZEFFY_CAMPAIGN_ID || 0);
const zeffyCampaignName = String(process.env.ZEFFY_CAMPAIGN_NAME || 'Help Us Build Our Gurdwara').trim();
const youtubeApiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
const dataDir = path.resolve(__dirname, 'data');
const usersPath = path.join(dataDir, 'users.json');
const volunteerReminderLogPath = path.join(dataDir, 'volunteer-reminder-log.json');
const eventReminderLogPath = path.join(dataDir, 'event-reminder-log.json');
const uploadsDir = path.resolve(__dirname, 'uploads');
const quizBankDir = path.resolve(workspaceRoot, 'public', 'quiz');
const maxUploadBytes = 15 * 1024 * 1024;
const uploadServiceMimePolicies = {
  cms: ['image/*', 'video/*', 'application/pdf'],
  events: ['image/*', 'video/*', 'application/pdf'],
  news: ['image/*', 'video/*', 'application/pdf', 'text/plain'],
  library: ['image/*'],
  sponsors: ['image/*'],
  advertisements: ['image/*'],
  users: ['image/*'],
  default: ['image/*']
};
const maxJsonBodyBytes = 2 * 1024 * 1024;

const resolveLocalWebhookUrl = (value, fallbackPath = '/api/internal/mail-relay') => {
  const normalizedFallbackPath = String(fallbackPath || '/api/internal/mail-relay').trim();
  const trimmed = String(value || '').trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const rawPath = trimmed || normalizedFallbackPath;
  const pathValue = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `http://127.0.0.1:${port}${pathValue}`;
};

const internalMailRelayUrl = resolveLocalWebhookUrl(
  process.env.INTERNAL_MAIL_RELAY_URL || process.env.WEBHOOK_URL || '/api/internal/mail-relay',
  '/api/internal/mail-relay'
);
const volunteerReminderWebhookUrl = resolveLocalWebhookUrl(
  process.env.VOLUNTEER_REMINDER_WEBHOOK_URL || process.env.WEBHOOK_URL || process.env.REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL || internalMailRelayUrl,
  '/api/internal/mail-relay'
);
const volunteerReminderLogoUrl = String(process.env.VOLUNTEER_REMINDER_LOGO_URL || '').trim();
const volunteerReminderSiteName = String(process.env.VOLUNTEER_REMINDER_ORG_NAME || 'Singh Sabha Milton Gurdwara').trim();
const volunteerReminderBaseUrl = String(process.env.VOLUNTEER_REMINDER_BASE_URL || 'http://localhost:3001').trim().replace(/\/$/, '');
const volunteerReminderHtmlTemplateEnabled = String(process.env.VOLUNTEER_REMINDER_HTML_TEMPLATE_ENABLED || 'true').trim().toLowerCase() !== 'false';
const volunteerReminderSendTimeRaw = String(process.env.VOLUNTEER_REMINDER_SEND_TIME || '09:00').trim();
const volunteerReminderTimeZone = String(process.env.VOLUNTEER_REMINDER_TIME_ZONE || 'America/Toronto').trim() || 'America/Toronto';
const volunteerReminderDays = [10, 5, 2, 1];
const eventReminderWebhookUrl = resolveLocalWebhookUrl(
  process.env.EVENT_REMINDER_WEBHOOK_URL || process.env.WEBHOOK_URL || volunteerReminderWebhookUrl || internalMailRelayUrl,
  '/api/internal/mail-relay'
);
const donationInvoiceWebhookUrl = resolveLocalWebhookUrl(
  process.env.DONATION_INVOICE_WEBHOOK_URL || process.env.DONATION_EMAIL_WEBHOOK_URL || process.env.WEBHOOK_URL || volunteerReminderWebhookUrl || internalMailRelayUrl
  ,
  '/api/internal/mail-relay'
);
const eventReminderSendTimeRaw = String(process.env.EVENT_REMINDER_SEND_TIME || volunteerReminderSendTimeRaw || '09:00').trim();
const eventReminderTimeZone = String(process.env.EVENT_REMINDER_TIME_ZONE || volunteerReminderTimeZone || 'America/Toronto').trim() || 'America/Toronto';
const eventReminderDays = String(process.env.EVENT_REMINDER_DAYS || '7,3,1')
  .split(',')
  .map((value) => Number(String(value || '').trim()))
  .filter((value) => Number.isFinite(value) && value >= 0);
const localMailFromAddress = String(process.env.LOCAL_MAIL_FROM || 'no-reply@singhsabhamilton.local').trim() || 'no-reply@singhsabhamilton.local';
const localMailTransport = String(process.env.LOCAL_MAIL_TRANSPORT || 'sendmail').trim().toLowerCase();
const smtpHost = String(process.env.SMTP_HOST || '').trim();
const smtpPortRaw = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const smtpFromAddress = String(process.env.SMTP_FROM || localMailFromAddress).trim() || localMailFromAddress;
const contactUsInboxAddress = String(process.env.CONTACT_US_EMAIL || smtpFromAddress || smtpUser || localMailFromAddress).trim();
let volunteerReminderSweepRunning = false;
let volunteerReminderLastRunDateKey = '';
let eventReminderSweepRunning = false;
let eventReminderLastRunDateKey = '';
const darbarSahibStreamSource = String(process.env.DARBAR_SAHIB_STREAM_PROXY_TARGET || 'http://live.sgpc.net:4835/;').trim();
const darbarSahibHlsDir = path.join(process.env.TMPDIR || dataDir, 'singhsabha-darbar-hls');
const darbarSahibHlsPlaylistPath = path.join(darbarSahibHlsDir, 'stream.m3u8');
let darbarSahibHlsProcess = null;
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
const ADMIN_PAGE_PATHS = [
  '/admin',
  '/admin/cms',
  '/admin/news',
  '/admin/schedule',
  '/admin/hukamnama',
  '/admin/langar',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/library',
  '/admin/videos',
  '/admin/streaming',
  '/admin/advertisements',
  '/admin/sponsors',
  '/admin/events',
  '/admin/kids-learning',
  '/admin/donations',
  '/admin/newsletter',
  '/admin/audit-trail',
  '/admin/users'
];

const MEMBER_ALLOWED_ADMIN_PAGE_PATHS = [
  '/admin',
  '/admin/hukamnama',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/library',
  '/admin/videos',
  '/admin/streaming',
  '/admin/events'
];
const VOLUNTEER_ALLOWED_ADMIN_PAGE_PATHS = [
  '/admin',
  '/admin/seva-opportunities',
  '/admin/gallery',
  '/admin/videos',
  '/admin/events'
];

const getDefaultAdminPageAccessForRole = (role) => {
  if (role === 'Super Admin' || role === 'Admin') {
    return [...ADMIN_PAGE_PATHS];
  }

  if (role === 'Member') {
    return [...MEMBER_ALLOWED_ADMIN_PAGE_PATHS];
  }

  if (role === 'Volunteer') {
    return [...VOLUNTEER_ALLOWED_ADMIN_PAGE_PATHS];
  }

  return [];
};

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

const publicServerErrorMessage = 'An unexpected error occurred. Please try again later.';

const looksLikeInternalErrorMessage = (value) => {
  const text = String(value || '');
  return /\/Users\/|\/var\/|node_modules|\.js:\d+|\.ts:\d+|stack trace|syntax error|invalid input syntax|SQLSTATE|PostgreSQL|Prisma|Sequelize|ENOENT|EACCES|ECONN|relation .* does not exist|permission denied/i.test(text);
};

const sanitizeResponseMessage = (statusCode, message) => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return statusCode >= 500 ? publicServerErrorMessage : '';
  }

  if (statusCode >= 500 && looksLikeInternalErrorMessage(normalizedMessage)) {
    return publicServerErrorMessage;
  }

  return normalizedMessage;
};

const sendJson = (response, statusCode, payload) => {
  const nextPayload = payload && typeof payload === 'object' ? { ...payload } : payload;
  if (nextPayload && typeof nextPayload === 'object' && 'message' in nextPayload) {
    nextPayload.message = sanitizeResponseMessage(statusCode, nextPayload.message);
  }

  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature, X-Zeffy-Webhook-Token, X-API-Key, Authorization, X-Actor-Email, X-Actor-Role, X-Actor-Name',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  });
  response.end(JSON.stringify(nextPayload));
};

const logServerError = (error, context) => {
  console.error(`[${context}]`, {
    message: error?.message || 'Unknown error',
    stack: error?.stack || '',
    name: error?.name || 'Error',
    status: error?.status || null,
    statusCode: error?.statusCode || null,
    code: error?.code || null,
    cause: error?.cause || null
  });
};

const readBody = async (request) => {
  if (request.__cachedBodyBuffer) {
    return request.__cachedBodyBuffer;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  request.__cachedBodyBuffer = Buffer.concat(chunks);
  return request.__cachedBodyBuffer;
};

class InputValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'InputValidationError';
    this.status = status;
  }
}

const throwInputError = (message, status = 400) => {
  throw new InputValidationError(message, status);
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const assertInput = (condition, message, status = 400) => {
  if (!condition) {
    throwInputError(message, status);
  }
};

const parseJsonObjectBody = async (request, options = {}) => {
  const maxBytes = Number.isFinite(Number(options.maxBytes)) ? Number(options.maxBytes) : maxJsonBodyBytes;
  const allowEmpty = options.allowEmpty !== false;
  const buffer = await readBody(request);

  if (buffer.length > maxBytes) {
    throwInputError('Request body too large.', 413);
  }

  const raw = buffer.toString('utf8').trim();
  if (!raw) {
    return allowEmpty ? {} : throwInputError('Request body is required.');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throwInputError('Invalid JSON payload.');
  }

  assertInput(isPlainObject(parsed), 'Request body must be a JSON object.');
  return parsed;
};

const isLoopbackAddress = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === '::ffff:127.0.0.1') {
    return true;
  }
  return normalized.startsWith('::ffff:127.');
};

const sanitizeHeaderValue = (value = '') => {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
};

const decodeDataUrlBase64 = (value = '') => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const match = text.match(/^data:[^;]+;base64,(.+)$/i);
  if (!match) {
    return '';
  }
  return String(match[1] || '').trim();
};

const encodeMimeBase64 = (value = '') => {
  const content = Buffer.from(String(value || ''), 'utf8').toString('base64');
  return content.replace(/(.{76})/g, '$1\r\n');
};

const normalizeRecipientList = (payload = {}) => {
  const list = [];

  const pushIfEmail = (candidate) => {
    const email = String(candidate || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return;
    }
    if (!list.includes(email)) {
      list.push(email);
    }
  };

  const toField = String(payload.to || payload.email || payload.primaryRecipient || '').trim();
  if (toField) {
    toField.split(',').forEach((entry) => pushIfEmail(entry));
  }

  const toList = Array.isArray(payload.toList) ? payload.toList : [];
  toList.forEach((entry) => pushIfEmail(entry));

  const recipientEmails = Array.isArray(payload.recipientEmails) ? payload.recipientEmails : [];
  recipientEmails.forEach((entry) => pushIfEmail(entry));

  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  recipients.forEach((entry) => pushIfEmail(entry));

  return list;
};

const normalizeBccRecipientList = (payload = {}) => {
  const list = [];

  const pushIfEmail = (candidate) => {
    const email = String(candidate || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return;
    }
    if (!list.includes(email)) {
      list.push(email);
    }
  };

  const bccField = String(payload.bcc || '').trim();
  if (bccField) {
    bccField.split(',').forEach((entry) => pushIfEmail(entry));
  }

  const bccList = Array.isArray(payload.bccList) ? payload.bccList : [];
  bccList.forEach((entry) => pushIfEmail(entry));

  const bccRecipients = Array.isArray(payload.bccRecipients) ? payload.bccRecipients : [];
  bccRecipients.forEach((entry) => pushIfEmail(entry));

  return list;
};

const normalizeAttachmentList = (payload = {}) => {
  const attachments = [];
  const raw = Array.isArray(payload.attachments) ? payload.attachments : [];

  raw.forEach((entry, index) => {
    const fileName = sanitizeHeaderValue(entry?.filename || `attachment-${index + 1}.bin`) || `attachment-${index + 1}.bin`;
    const contentType = sanitizeHeaderValue(entry?.contentType || 'application/octet-stream') || 'application/octet-stream';
    const directBase64 = String(entry?.content || '').trim();
    const dataUrlBase64 = decodeDataUrlBase64(entry?.dataUrl || entry?.url || '');
    const base64 = directBase64 || dataUrlBase64;
    if (!base64) {
      return;
    }
    attachments.push({
      filename: fileName,
      contentType,
      contentBase64: base64.replace(/\s+/g, ''),
      contentId: sanitizeHeaderValue(entry?.contentId || ''),
      disposition: String(entry?.disposition || '').trim().toLowerCase() === 'inline' || entry?.inline === true ? 'inline' : 'attachment'
    });
  });

  const invoiceName = sanitizeHeaderValue(payload.invoicePdfFileName || 'invoice.pdf') || 'invoice.pdf';
  const invoiceData = decodeDataUrlBase64(payload.invoicePdfDataUrl || '');
  if (invoiceData) {
    const exists = attachments.some((entry) => String(entry.filename || '').toLowerCase() === String(invoiceName || '').toLowerCase());
    if (!exists) {
      attachments.push({
        filename: invoiceName,
        contentType: 'application/pdf',
        contentBase64: invoiceData.replace(/\s+/g, '')
      });
    }
  }

  return attachments;
};

const buildMimeEmail = ({ from, toList, bccList = [], subject, textBody, htmlBody, attachments = [] }) => {
  const safeFrom = sanitizeHeaderValue(from || 'no-reply@singhsabhamilton.local') || 'no-reply@singhsabhamilton.local';
  const safeSubject = sanitizeHeaderValue(subject || 'Notification');
  const safeTo = toList.map((entry) => sanitizeHeaderValue(entry)).filter(Boolean).join(', ') || 'undisclosed-recipients:;';
  const safeBcc = bccList.map((entry) => sanitizeHeaderValue(entry)).filter(Boolean).join(', ');
  const plainText = String(textBody || '').trim() || 'Notification from Singh Sabha Milton.';
  const html = String(htmlBody || '').trim();

  const headers = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0'
  ];

  if (safeBcc) {
    headers.push(`Bcc: ${safeBcc}`);
  }

  const altBoundary = `alt_${crypto.randomBytes(8).toString('hex')}`;
  const mixBoundary = `mix_${crypto.randomBytes(8).toString('hex')}`;

  const plainPart = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeMimeBase64(plainText)
  ].join('\r\n');

  const htmlPart = html
    ? [
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodeMimeBase64(html)
    ].join('\r\n')
    : '';

  const alternativeBody = [
    plainPart,
    htmlPart,
    `--${altBoundary}--`
  ].filter(Boolean).join('\r\n');

  if (attachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    return `${headers.join('\r\n')}\r\n\r\n${alternativeBody}\r\n`;
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${mixBoundary}"`);

  const attachmentParts = attachments.map((entry) => {
    const safeName = sanitizeHeaderValue(entry.filename || 'attachment.bin') || 'attachment.bin';
    const safeType = sanitizeHeaderValue(entry.contentType || 'application/octet-stream') || 'application/octet-stream';
    const safeContentId = sanitizeHeaderValue(entry.contentId || '');
    const safeDisposition = String(entry.disposition || '').trim().toLowerCase() === 'inline' ? 'inline' : 'attachment';
    const encoded = String(entry.contentBase64 || '').replace(/\s+/g, '').replace(/(.{76})/g, '$1\r\n');
    return [
      `--${mixBoundary}`,
      `Content-Type: ${safeType}; name="${safeName}"`,
      `Content-Disposition: ${safeDisposition}; filename="${safeName}"`,
      ...(safeContentId ? [`Content-ID: <${safeContentId}>`] : []),
      'Content-Transfer-Encoding: base64',
      '',
      encoded
    ].join('\r\n');
  });

  const message = [
    headers.join('\r\n'),
    '',
    `--${mixBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    alternativeBody,
    ...attachmentParts,
    `--${mixBoundary}--`,
    ''
  ].join('\r\n');

  return message;
};

const extractEmailAddress = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const angleMatch = raw.match(/<([^>]+)>/);
  if (angleMatch && angleMatch[1]) {
    return String(angleMatch[1]).trim().toLowerCase();
  }

  return raw.toLowerCase();
};

const sendViaLocalSendmail = async ({ from, toList, bccList, subject, textBody, htmlBody, attachments }) => {
  const message = buildMimeEmail({ from, toList, bccList, subject, textBody, htmlBody, attachments });
  const envelopeFromCandidate = extractEmailAddress(from);
  const envelopeFrom = isValidEmailAddress(envelopeFromCandidate)
    ? envelopeFromCandidate
    : 'no-reply@singhsabhamilton.local';

  await new Promise((resolve, reject) => {
    const child = spawn('/usr/sbin/sendmail', ['-t', '-oi', '-f', envelopeFrom]);
    let stderr = '';

    child.on('error', (error) => reject(error));
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const relayError = stderr.trim() || `sendmail exited with code ${code}`;
      reject(new Error(`${relayError} (envelope-from=${envelopeFrom})`));
    });

    child.stdin.write(message, 'utf8');
    child.stdin.end();
  });

  return {
    provider: 'local-sendmail',
    envelopeFrom,
    fromHeader: from
  };
};

const sendViaSmtp = async ({ from, toList, bccList, subject, textBody, htmlBody, attachments }) => {
  if (!smtpHost) {
    throw new Error('SMTP_HOST is required when LOCAL_MAIL_TRANSPORT=smtp.');
  }

  const smtpPort = Number.isFinite(smtpPortRaw) && smtpPortRaw > 0 ? smtpPortRaw : 587;
  const authEnabled = Boolean(smtpUser || smtpPass);

  let nodemailer = null;
  try {
    // Lazy load so sendmail-only deployments do not require nodemailer.
    nodemailer = require('nodemailer');
  } catch {
    throw new Error('nodemailer is not installed. Run: npm install nodemailer');
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    ...(authEnabled ? { auth: { user: smtpUser, pass: smtpPass } } : {})
  });

  const normalizedAttachments = Array.isArray(attachments)
    ? attachments.map((entry) => ({
      filename: String(entry?.filename || 'attachment.bin').trim() || 'attachment.bin',
      contentType: String(entry?.contentType || 'application/octet-stream').trim() || 'application/octet-stream',
      content: Buffer.from(String(entry?.contentBase64 || '').replace(/\s+/g, ''), 'base64'),
      cid: String(entry?.contentId || '').trim() || undefined,
      contentDisposition: String(entry?.disposition || '').trim().toLowerCase() === 'inline' ? 'inline' : 'attachment'
    }))
    : [];

  // Use a mailbox authenticated with SMTP to avoid provider-side silent drops.
  const fromHeader = smtpFromAddress;
  const replyToCandidate = extractEmailAddress(from);
  const replyToHeader = isValidEmailAddress(replyToCandidate) ? replyToCandidate : undefined;
  const smtpInfo = await transport.sendMail({
    from: fromHeader,
    replyTo: replyToHeader,
    to: Array.isArray(toList) && toList.length > 0 ? toList : undefined,
    bcc: Array.isArray(bccList) && bccList.length > 0 ? bccList : undefined,
    subject,
    text: textBody || undefined,
    html: htmlBody || undefined,
    attachments: normalizedAttachments
  });

  const acceptedRecipients = Array.isArray(smtpInfo?.accepted)
    ? smtpInfo.accepted.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  if (acceptedRecipients.length === 0) {
    const rejectedRecipients = Array.isArray(smtpInfo?.rejected)
      ? smtpInfo.rejected.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
      : [];
    throw new Error(`SMTP did not accept any recipients. Rejected: ${rejectedRecipients.join(', ') || 'unknown'}`);
  }

  return {
    provider: 'smtp',
    envelopeFrom: smtpFromAddress,
    fromHeader,
    messageId: String(smtpInfo?.messageId || '').trim(),
    accepted: acceptedRecipients,
    rejected: Array.isArray(smtpInfo?.rejected)
      ? smtpInfo.rejected.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
      : []
  };
};

const sendViaConfiguredMailTransport = async ({ from, toList, bccList = [], subject, textBody, htmlBody, attachments }) => {
  if (localMailTransport === 'smtp') {
    return sendViaSmtp({ from, toList, bccList, subject, textBody, htmlBody, attachments });
  }

  return sendViaLocalSendmail({ from, toList, bccList, subject, textBody, htmlBody, attachments });
};

const ensureNoUnknownKeys = (payload, allowedKeys, label = 'body') => {
  const keySet = new Set(allowedKeys);
  Object.keys(payload || {}).forEach((key) => {
    if (!keySet.has(key)) {
      throwInputError(`${label}.${key} is not allowed.`);
    }
  });
};

const readStringField = (payload, key, options = {}) => {
  const value = payload?.[key];
  const required = options.required === true;
  const min = Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
  const max = Number.isFinite(Number(options.max)) ? Number(options.max) : 10000;
  const pattern = options.pattern instanceof RegExp ? options.pattern : null;
  const trim = options.trim !== false;

  if (value == null || value === '') {
    if (required) {
      throwInputError(`${key} is required.`);
    }
    return '';
  }

  assertInput(typeof value === 'string', `${key} must be a string.`);
  const normalized = trim ? value.trim() : value;
  assertInput(normalized.length >= min, `${key} must be at least ${min} characters.`);
  assertInput(normalized.length <= max, `${key} must be at most ${max} characters.`);
  if (pattern) {
    assertInput(pattern.test(normalized), `${key} has an invalid format.`);
  }
  return options.toLowerCase === true ? normalized.toLowerCase() : normalized;
};

const readNumberField = (payload, key, options = {}) => {
  const value = payload?.[key];
  const required = options.required === true;
  if (value == null || value === '') {
    if (required) {
      throwInputError(`${key} is required.`);
    }
    return null;
  }

  assertInput(typeof value === 'number' && Number.isFinite(value), `${key} must be a finite number.`);
  if (options.integer === true) {
    assertInput(Number.isInteger(value), `${key} must be an integer.`);
  }
  if (Number.isFinite(Number(options.min))) {
    assertInput(value >= Number(options.min), `${key} must be >= ${Number(options.min)}.`);
  }
  if (Number.isFinite(Number(options.max))) {
    assertInput(value <= Number(options.max), `${key} must be <= ${Number(options.max)}.`);
  }
  return value;
};

const readBooleanField = (payload, key, options = {}) => {
  const value = payload?.[key];
  const required = options.required === true;
  if (value == null) {
    if (required) {
      throwInputError(`${key} is required.`);
    }
    return null;
  }

  assertInput(typeof value === 'boolean', `${key} must be a boolean.`);
  return value;
};

const readObjectField = (payload, key, options = {}) => {
  const value = payload?.[key];
  const required = options.required === true;
  if (value == null) {
    if (required) {
      throwInputError(`${key} is required.`);
    }
    return null;
  }

  assertInput(isPlainObject(value), `${key} must be an object.`);
  return value;
};

const readArrayField = (payload, key, options = {}) => {
  const value = payload?.[key];
  const required = options.required === true;
  const max = Number.isFinite(Number(options.max)) ? Number(options.max) : 1000;
  if (value == null) {
    if (required) {
      throwInputError(`${key} is required.`);
    }
    return null;
  }

  assertInput(Array.isArray(value), `${key} must be an array.`);
  assertInput(value.length <= max, `${key} must contain at most ${max} items.`);
  return value;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const simpleIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const mimeTypePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,79}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,79}$/i;

const readEmailField = (payload, key, options = {}) => {
  const value = readStringField(payload, key, {
    required: options.required === true,
    min: 3,
    max: 254,
    toLowerCase: true
  });
  if (!value) {
    return '';
  }
  assertInput(emailPattern.test(value), `${key} must be a valid email.`);
  return value;
};

const parseNumericPathId = (rawValue, fieldName) => {
  const value = String(rawValue || '').trim();
  assertInput(/^\d{1,12}$/.test(value), `${fieldName} must be a numeric id.`);
  return Number(value);
};

const parseStringPathId = (rawValue, fieldName) => {
  const value = String(rawValue || '').trim();
  assertInput(simpleIdPattern.test(value), `${fieldName} has an invalid format.`);
  return value;
};

const validateGenericJsonValue = (value, fieldPath = 'body', depth = 0) => {
  assertInput(depth <= 8, `${fieldPath} is nested too deeply.`);

  if (value == null) {
    return;
  }

  const valueType = typeof value;
  if (valueType === 'string') {
    assertInput(value.length <= 10000, `${fieldPath} is too long.`);
    return;
  }

  if (valueType === 'number') {
    assertInput(Number.isFinite(value), `${fieldPath} must be a finite number.`);
    return;
  }

  if (valueType === 'boolean') {
    return;
  }

  if (Array.isArray(value)) {
    assertInput(value.length <= 1500, `${fieldPath} has too many items.`);
    value.forEach((entry, index) => validateGenericJsonValue(entry, `${fieldPath}[${index}]`, depth + 1));
    return;
  }

  assertInput(isPlainObject(value), `${fieldPath} must be an object.`);
  const keys = Object.keys(value);
  assertInput(keys.length <= 200, `${fieldPath} contains too many properties.`);
  keys.forEach((key) => {
    assertInput(key.length > 0 && key.length <= 80, `${fieldPath}.${key} has an invalid key length.`);
    assertInput(key !== '__proto__' && key !== 'constructor' && key !== 'prototype', `${fieldPath}.${key} is not allowed.`);
    validateGenericJsonValue(value[key], `${fieldPath}.${key}`, depth + 1);
  });
};

const parseAndValidateGenericObjectBody = async (request, options = {}) => {
  const body = await parseJsonObjectBody(request, options);
  validateGenericJsonValue(body, 'body');
  return body;
};

const parsePositiveIntEnv = (envName, fallback) => {
  const parsed = Number(process.env[envName]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const parseBooleanEnv = (envName, fallback = false) => {
  const raw = String(process.env[envName] || '').trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

const parseCsvEnv = (envName, fallback = []) => {
  const raw = String(process.env[envName] || '').trim();
  if (!raw) {
    return fallback;
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
};

const rateLimitConfig = {
  enabled: parseBooleanEnv('RATE_LIMIT_ENABLED', true),
  publicWindowMs: parsePositiveIntEnv('RATE_LIMIT_PUBLIC_WINDOW_MS', 60 * 1000),
  publicMaxRequests: parsePositiveIntEnv('RATE_LIMIT_PUBLIC_MAX_REQUESTS', 180),
  authenticatedWindowMs: parsePositiveIntEnv('RATE_LIMIT_AUTHENTICATED_WINDOW_MS', 60 * 1000),
  authenticatedMaxRequests: parsePositiveIntEnv('RATE_LIMIT_AUTHENTICATED_MAX_REQUESTS', 600),
  authIpWindowMs: parsePositiveIntEnv('RATE_LIMIT_AUTH_IP_WINDOW_MS', 60 * 1000),
  authIpMaxAttempts: parsePositiveIntEnv('RATE_LIMIT_AUTH_IP_MAX_ATTEMPTS', 12),
  authAccountWindowMs: parsePositiveIntEnv('RATE_LIMIT_AUTH_ACCOUNT_WINDOW_MS', 5 * 60 * 1000),
  authAccountMaxAttempts: parsePositiveIntEnv('RATE_LIMIT_AUTH_ACCOUNT_MAX_ATTEMPTS', 6),
  authBackoffBaseMs: parsePositiveIntEnv('RATE_LIMIT_AUTH_BACKOFF_BASE_MS', 1000),
  authBackoffMaxMs: parsePositiveIntEnv('RATE_LIMIT_AUTH_BACKOFF_MAX_MS', 30 * 60 * 1000),
  cleanupIntervalMs: parsePositiveIntEnv('RATE_LIMIT_CLEANUP_INTERVAL_MS', 5 * 60 * 1000),
  authRouteRules: parseCsvEnv('RATE_LIMIT_AUTH_ROUTE_RULES', [
    'POST:/api/auth/*',
    'POST:/api/users/upsert-by-email',
    'POST:/api/users/complete-registration',
    'POST:/api/users',
    'POST:/api/users/by-email',
    'PATCH:/api/users/*/approval'
  ])
};

const fixedWindowRateState = new Map();
const authIpRateState = new Map();
const authAccountRateState = new Map();

const isRouteMatch = (rule, method, pathname) => {
  const normalizedRule = String(rule || '').trim();
  if (!normalizedRule) {
    return false;
  }

  const dividerIndex = normalizedRule.indexOf(':');
  if (dividerIndex < 0) {
    return false;
  }

  const ruleMethod = normalizedRule.slice(0, dividerIndex).trim().toUpperCase() || '*';
  const rulePath = normalizedRule.slice(dividerIndex + 1).trim();
  if (!rulePath) {
    return false;
  }

  if (ruleMethod !== '*' && ruleMethod !== String(method || '').toUpperCase()) {
    return false;
  }

  if (rulePath.endsWith('*')) {
    const prefix = rulePath.slice(0, -1);
    return pathname.startsWith(prefix);
  }

  return pathname === rulePath;
};

const isAuthRateLimitedRoute = (method, pathname) => {
  return rateLimitConfig.authRouteRules.some((rule) => isRouteMatch(rule, method, pathname));
};

const getCachedJsonBody = async (request) => {
  if (request.__cachedJsonBody !== undefined) {
    return request.__cachedJsonBody;
  }

  try {
    const raw = (await readBody(request)).toString('utf8').trim();
    request.__cachedJsonBody = raw ? JSON.parse(raw) : {};
  } catch {
    request.__cachedJsonBody = {};
  }

  return request.__cachedJsonBody;
};

const extractAccountIdentifier = async (request, requestUrl) => {
  const body = await getCachedJsonBody(request);
  const queryEmail = String(requestUrl?.searchParams?.get('email') || '').trim().toLowerCase();
  const headerEmail = String(request.headers['x-actor-email'] || '').trim().toLowerCase();
  const candidates = [
    body?.email,
    body?.donorEmail,
    body?.username,
    body?.userName,
    body?.actorEmail,
    body?.contact,
    queryEmail,
    headerEmail
  ]
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);

  return candidates[0] || 'anonymous-account';
};

const evaluateFixedWindowLimit = (stateMap, key, maxRequests, windowMs, now) => {
  const current = stateMap.get(key);
  if (!current || current.resetAt <= now) {
    stateMap.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return { limited: false, retryAfterMs: 0 };
  }

  if (current.count < maxRequests) {
    current.count += 1;
    stateMap.set(key, current);
    return { limited: false, retryAfterMs: 0 };
  }

  return {
    limited: true,
    retryAfterMs: Math.max(1, current.resetAt - now)
  };
};

const evaluateAuthBackoffLimit = (stateMap, key, maxAttempts, windowMs, backoffBaseMs, backoffMaxMs, now) => {
  const current = stateMap.get(key) || {
    count: 0,
    windowStart: now,
    blockedUntil: 0
  };

  if (current.blockedUntil > now) {
    return {
      limited: true,
      retryAfterMs: current.blockedUntil - now
    };
  }

  if ((now - current.windowStart) >= windowMs) {
    current.count = 0;
    current.windowStart = now;
    current.blockedUntil = 0;
  }

  current.count += 1;
  if (current.count <= maxAttempts) {
    stateMap.set(key, current);
    return { limited: false, retryAfterMs: 0 };
  }

  const overflow = current.count - maxAttempts;
  const backoffMs = Math.min(backoffMaxMs, backoffBaseMs * (2 ** Math.max(0, overflow - 1)));
  current.blockedUntil = now + backoffMs;
  stateMap.set(key, current);

  return {
    limited: true,
    retryAfterMs: backoffMs
  };
};

const sendRateLimitExceeded = (response, retryAfterMs, message, scope = 'request') => {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  response.writeHead(429, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature, X-Zeffy-Webhook-Token, X-API-Key, Authorization, X-Actor-Email, X-Actor-Role, X-Actor-Name',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Retry-After': String(retryAfterSeconds),
    'X-RateLimit-Scope': scope
  });
  response.end(JSON.stringify({
    ok: false,
    message,
    retryAfterSeconds,
    scope
  }));
};

const enforceRateLimit = async (request, response, requestUrl) => {
  if (!rateLimitConfig.enabled) {
    return true;
  }

  if (String(request.method || '').toUpperCase() === 'OPTIONS') {
    return true;
  }

  const method = String(request.method || 'GET').toUpperCase();
  const pathname = String(requestUrl?.pathname || '/');
  const now = Date.now();
  const clientIp = resolveClientIp(request) || 'unknown-ip';
  const actorEmail = String(request.headers['x-actor-email'] || '').trim().toLowerCase();

  if (isAuthRateLimitedRoute(method, pathname)) {
    const accountIdentifier = await extractAccountIdentifier(request, requestUrl);
    const ipKey = `${method}:${pathname}:ip:${clientIp}`;
    const accountKey = `${method}:${pathname}:account:${accountIdentifier}`;

    const ipDecision = evaluateAuthBackoffLimit(
      authIpRateState,
      ipKey,
      rateLimitConfig.authIpMaxAttempts,
      rateLimitConfig.authIpWindowMs,
      rateLimitConfig.authBackoffBaseMs,
      rateLimitConfig.authBackoffMaxMs,
      now
    );

    if (ipDecision.limited) {
      sendRateLimitExceeded(response, ipDecision.retryAfterMs, 'Too many authentication attempts from this IP. Please retry later.', 'auth-ip');
      return false;
    }

    const accountDecision = evaluateAuthBackoffLimit(
      authAccountRateState,
      accountKey,
      rateLimitConfig.authAccountMaxAttempts,
      rateLimitConfig.authAccountWindowMs,
      rateLimitConfig.authBackoffBaseMs,
      rateLimitConfig.authBackoffMaxMs,
      now
    );

    if (accountDecision.limited) {
      sendRateLimitExceeded(response, accountDecision.retryAfterMs, 'Too many authentication attempts for this account. Please retry later.', 'auth-account');
      return false;
    }

    return true;
  }

  const isAuthenticatedAction = Boolean(actorEmail) && method !== 'GET' && method !== 'HEAD';
  const bucketKey = isAuthenticatedAction
    ? `${method}:${pathname}:actor:${actorEmail}`
    : `${method}:${pathname}:ip:${clientIp}`;

  const decision = evaluateFixedWindowLimit(
    fixedWindowRateState,
    bucketKey,
    isAuthenticatedAction ? rateLimitConfig.authenticatedMaxRequests : rateLimitConfig.publicMaxRequests,
    isAuthenticatedAction ? rateLimitConfig.authenticatedWindowMs : rateLimitConfig.publicWindowMs,
    now
  );

  if (decision.limited) {
    sendRateLimitExceeded(
      response,
      decision.retryAfterMs,
      isAuthenticatedAction
        ? 'Too many authenticated requests. Please retry shortly.'
        : 'Too many requests. Please retry shortly.',
      isAuthenticatedAction ? 'authenticated' : 'public'
    );
    return false;
  }

  return true;
};

const pruneRateLimitStates = () => {
  const now = Date.now();

  for (const [key, value] of fixedWindowRateState.entries()) {
    if (!value || value.resetAt <= now) {
      fixedWindowRateState.delete(key);
    }
  }

  for (const [key, value] of authIpRateState.entries()) {
    if (!value) {
      authIpRateState.delete(key);
      continue;
    }
    const stale = (now - value.windowStart) > (rateLimitConfig.authIpWindowMs * 2) && value.blockedUntil <= now;
    if (stale) {
      authIpRateState.delete(key);
    }
  }

  for (const [key, value] of authAccountRateState.entries()) {
    if (!value) {
      authAccountRateState.delete(key);
      continue;
    }
    const stale = (now - value.windowStart) > (rateLimitConfig.authAccountWindowMs * 2) && value.blockedUntil <= now;
    if (stale) {
      authAccountRateState.delete(key);
    }
  }
};

const rateLimitPruneTimer = setInterval(pruneRateLimitStates, rateLimitConfig.cleanupIntervalMs);
if (typeof rateLimitPruneTimer?.unref === 'function') {
  rateLimitPruneTimer.unref();
}

const startDarbarSahibHls = () => {
  if (darbarSahibHlsProcess && darbarSahibHlsProcess.exitCode == null) {
    return;
  }

  fs.rmSync(darbarSahibHlsDir, { recursive: true, force: true });
  fs.mkdirSync(darbarSahibHlsDir, { recursive: true });
  const segmentPattern = path.join(darbarSahibHlsDir, 'segment-%08d.m4s');
  const processHandle = spawn(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', darbarSahibStreamSource,
    '-map', '0:a:0',
    '-vn',
    '-codec:a', 'aac',
    '-profile:a', 'aac_low',
    '-b:a', '48k',
    '-ar', '44100',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '6',
    '-hls_flags', 'delete_segments+omit_endlist+independent_segments',
    '-hls_segment_type', 'fmp4',
    '-hls_fmp4_init_filename', 'init.mp4',
    '-hls_segment_filename', segmentPattern,
    darbarSahibHlsPlaylistPath
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  darbarSahibHlsProcess = processHandle;
  let errorOutput = '';

  processHandle.stderr.on('data', (chunk) => {
    if (errorOutput.length < 4000) {
      errorOutput += chunk.toString();
    }
  });
  processHandle.once('close', (code, signal) => {
    if (darbarSahibHlsProcess === processHandle) {
      darbarSahibHlsProcess = null;
    }
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error('Darbar Sahib HLS transcoder failed:', errorOutput.trim() || `exit code ${code}`);
    }
  });
};

const waitForDarbarSahibHlsFile = async (filePath, timeoutMs = 12000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (fs.statSync(filePath).size > 0) {
        return true;
      }
    } catch {
      // The first playlist and segment are created after FFmpeg receives enough audio.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};

const stopDarbarSahibHls = () => {
  if (darbarSahibHlsProcess && darbarSahibHlsProcess.exitCode == null) {
    darbarSahibHlsProcess.kill('SIGTERM');
  }
  darbarSahibHlsProcess = null;
};

process.once('exit', stopDarbarSahibHls);
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.once(signal, () => {
    stopDarbarSahibHls();
    process.exit(0);
  });
});

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
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return 'Date TBD';
  }

  const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Date TBD';
  }

  return parsedDate.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildContactInquiryEmail = ({ name = '', email = '', phone = '', message = '', subject = '' }) => {
  const logoSrc = volunteerReminderLogoUrl || `${volunteerReminderBaseUrl}/gurdwara-logo.webp` || embeddedVolunteerReminderLogo;
  const siteName = String(volunteerReminderSiteName || 'Singh Sabha Milton Gurdwara').trim();
  const recipientSubject = sanitizeHeaderValue(subject || `Contact Us Inquiry from ${name}`) || 'Contact Us Inquiry';
  const contactMessage = String(message || '').trim();
  const submittedAt = new Date().toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const text = [
    `Contact inquiry received - ${siteName}`,
    '',
    `Name: ${name || '-'}`,
    `Email: ${email || '-'}`,
    `Phone: ${phone || '-'}`,
    `Submitted: ${submittedAt}`,
    `Subject: ${recipientSubject}`,
    '',
    'Message:',
    contactMessage || '-'
  ].join('\n');

  const html = `
  <div style="background:#f5f8fc;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:16px 22px;background:linear-gradient(90deg,#0a4d9f,#0b67c2,#e58b16);color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${logoSrc ? `<td style="width:44px;padding-right:12px;vertical-align:middle;"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(siteName)} logo" width="44" height="44" style="display:block;border-radius:9999px;background:#ffffff;object-fit:cover;"/></td>` : ''}
                    <td style="vertical-align:middle;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${escapeHtml(siteName)}</div>
                      <div style="font-size:18px;font-weight:800;line-height:1.3;margin-top:2px;">Contact Us Inquiry</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #c7dcf7;border-radius:14px;overflow:hidden;background:#f6faff;box-shadow:0 8px 24px -18px rgba(11,103,194,.65);margin-bottom:16px;">
            <tr>
              <td colspan="2" style="padding:11px 14px;background:linear-gradient(90deg,#eaf2ff,#f6f9ff);border-bottom:1px solid #c7dcf7;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#0a4d9f;">Submission Details</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Name</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(name || '-')}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Email</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(email || '-')}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Phone</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(phone || '-')}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Submitted</td>
              <td style="padding:11px 12px;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(submittedAt)}</td>
            </tr>
          </table>

          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0b67c2;margin-bottom:8px;">Message</div>
          <div style="border:1px solid #cfe1fb;border-radius:12px;background:#ffffff;padding:12px 14px;line-height:1.6;white-space:pre-wrap;box-shadow:inset 0 0 0 1px #f5f9ff;">${escapeHtml(contactMessage || '-')}</div>
        </td>
      </tr>
    </table>
  </div>`;

  return {
    subject: recipientSubject,
    text,
    html
  };
};

const buildVolunteerReminderEmail = ({ registration, daysRemaining = null, manual = false }) => {
  const sevaDateLabel = formatSevaDateLabel(registration.sevaDate);
  const timeLabel = registration.sevaTime || 'Time TBD';
  const logoSrc = volunteerReminderLogoUrl || `${volunteerReminderBaseUrl}/gurdwara-logo.webp` || embeddedVolunteerReminderLogo;
  const baseUrl = String(volunteerReminderBaseUrl || 'https://singhsabhamilton.com').trim().replace(/\/+$/, '');
  const sevaUrl = `${baseUrl}/seva`;
  const contactUrl = `${baseUrl}/contact`;
  const eventsUrl = `${baseUrl}/events`;
  const greetingLine = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ';
  const requesterNameBase = String(registration.name || 'Sangat Member').trim().replace(/[.\s]+$/g, '');
  const requesterName = `${requesterNameBase}.`;
  const countdownLabel = Number.isFinite(daysRemaining) && daysRemaining >= 0
    ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
    : 'Upcoming Seva';

  const subject = manual
    ? `${registration.sevaType} Seva Details | ${volunteerReminderSiteName}`
    : Number.isFinite(daysRemaining)
      ? `Seva Reminder (${daysRemaining} day${daysRemaining === 1 ? '' : 's'}): ${registration.sevaType}`
      : `Seva Reminder: ${registration.sevaType}`;

  const text = [
    greetingLine,
    '',
    requesterName,
    '',
    manual ? 'This is a manual seva notification from admin.' : 'This is your seva reminder for an upcoming seva opportunity.',
    '',
    `Seva Type: ${registration.sevaType}`,
    `Seva Date: ${sevaDateLabel}`,
    `Seva Time: ${timeLabel}`,
    `Gurdwara: ${volunteerReminderSiteName}`,
    `Seva Page: ${sevaUrl}`,
    `Events Page: ${eventsUrl}`,
    `Contact: ${contactUrl}`,
    '',
    'Kindly arrive a little early and check in with the seva coordinator.',
    'Thank you for serving the sangat.'
  ].join('\n');

  if (!volunteerReminderHtmlTemplateEnabled) {
    return { subject, text, html: '' };
  }

  const html = `
  <div style="background:#f5f8fc;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:16px 22px;background:linear-gradient(90deg,#0a4d9f,#0b67c2,#e58b16);color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${logoSrc ? `<td style="width:44px;padding-right:12px;vertical-align:middle;"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(volunteerReminderSiteName)} logo" width="44" height="44" style="display:block;border-radius:9999px;background:#ffffff;object-fit:cover;"/></td>` : ''}
                    <td style="vertical-align:middle;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${escapeHtml(volunteerReminderSiteName)}</div>
                      <div style="font-size:18px;font-weight:800;line-height:1.3;margin-top:2px;">Seva Opportunity Reminder</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px 12px;text-align:center;">
          <div style="font-size:19px;line-height:1.45;font-weight:800;color:#0f172a;">${escapeHtml(greetingLine)}</div>
          <div style="margin-top:8px;font-size:16px;line-height:1.7;color:#334155;font-weight:600;">${escapeHtml(requesterName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;">
          <div style="font-size:15px;line-height:1.85;color:#334155;margin-bottom:14px;text-align:center;">
            ${manual
    ? `This is a manual seva update from the admin team for your upcoming seva (${escapeHtml(countdownLabel)}). Please review the details below and plan your seva accordingly.`
    : `A warm reminder that your seva opportunity is coming up (${escapeHtml(countdownLabel)}). Please review the details below and arrive a little early so the seva can begin smoothly.`}
          </div>
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
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
            <tr>
              <td style="border-radius:8px;background:#0b67c2;text-align:center;">
                <a href="${escapeHtml(sevaUrl)}" style="display:inline-block;padding:11px 16px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">View Seva Opportunities</a>
              </td>
              <td style="width:8px;">&nbsp;</td>
              <td style="border-radius:8px;background:#eef5ff;border:1px solid #cfe1fb;text-align:center;">
                <a href="${escapeHtml(eventsUrl)}" style="display:inline-block;padding:11px 16px;color:#0a4d9f;text-decoration:none;font-size:13px;font-weight:700;">Upcoming Events</a>
              </td>
            </tr>
          </table>
          <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:12px;line-height:1.8;color:#64748b;">
            <div style="font-weight:700;color:#334155;">Need help?</div>
            <div>Contact Page: <a href="${escapeHtml(contactUrl)}" style="color:#0b67c2;text-decoration:none;">${escapeHtml(contactUrl)}</a></div>
            <div style="margin-top:6px;">${escapeHtml(volunteerReminderSiteName)}</div>
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
  const skippedByReason = {
    ineligible: 0,
    deliveryFailed: 0
  };

  for (const registration of matching) {
    processed += 1;

    if (!registration.email || registration.status === 'rejected' || registration.status === 'cancelled') {
      skipped += 1;
      skippedByReason.ineligible += 1;
      continue;
    }

    const result = await sendVolunteerReminderEmail(registration, { manual: true });
    if (!result.sent) {
      skipped += 1;
      skippedByReason.deliveryFailed += 1;
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
    skippedByReason,
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
  const baseUrl = String(volunteerReminderBaseUrl || 'https://singhsabhamilton.com').trim().replace(/\/+$/, '');
  const eventsUrl = `${baseUrl}/events`;
  const contactUrl = `${baseUrl}/contact`;
  const calendarUrl = registration.eventId ? `${baseUrl}/api/events/${encodeURIComponent(String(registration.eventId))}/calendar.ics` : '';
  const greetingLine = 'ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ';
  const recipientNameBase = String(registration.name || 'Sangat Member').trim().replace(/[.\s]+$/g, '');
  const recipientName = `${recipientNameBase}.`;
  const registrationType = registration.status === 'waitlisted' ? 'waitlist' : 'registration';
  const countdownLabel = Number.isFinite(daysRemaining) && daysRemaining >= 0
    ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
    : 'Upcoming Event';
  const subject = Number.isFinite(daysRemaining)
    ? `Event Reminder (${daysRemaining} day${daysRemaining === 1 ? '' : 's'}): ${registration.eventTitle}`
    : `Event Reminder: ${registration.eventTitle}`;
  const text = [
    greetingLine,
    '',
    recipientName,
    '',
    `This is your ${registrationType} reminder for the upcoming event.`,
    `Event: ${registration.eventTitle}`,
    `Date and Time: ${timeLabel}`,
    `Location: ${registration.eventLocation || 'Singh Sabha Milton Gurdwara'}`,
    `Events Page: ${eventsUrl}`,
    calendarUrl ? `Add to Calendar: ${calendarUrl}` : '',
    `Contact: ${contactUrl}`,
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
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:16px 22px;background:linear-gradient(90deg,#0a4d9f,#0b67c2,#e58b16);color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${logoSrc ? `<td style="width:44px;padding-right:12px;vertical-align:middle;"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(volunteerReminderSiteName)} logo" width="44" height="44" style="display:block;border-radius:9999px;background:#ffffff;object-fit:cover;"/></td>` : ''}
                    <td style="vertical-align:middle;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${escapeHtml(volunteerReminderSiteName)}</div>
                      <div style="font-size:18px;font-weight:800;line-height:1.3;margin-top:2px;">Event Reminder</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px 12px;">
          <div style="font-size:19px;line-height:1.45;font-weight:800;color:#0f172a;">${escapeHtml(greetingLine)}</div>
          <div style="margin-top:8px;font-size:16px;line-height:1.7;color:#334155;font-weight:600;">${escapeHtml(recipientName)}</div>
          <div style="margin-top:10px;display:inline-block;background:#eef5ff;border:1px solid #cfe1fb;color:#0a4d9f;border-radius:9999px;padding:7px 14px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">
            ${escapeHtml(countdownLabel)}
          </div>
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
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
            <tr>
              <td style="border-radius:8px;background:#0b67c2;text-align:center;">
                <a href="${escapeHtml(eventsUrl)}" style="display:inline-block;padding:11px 16px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">View Event Details</a>
              </td>
              ${calendarUrl ? `<td style="width:8px;">&nbsp;</td><td style="border-radius:8px;background:#eef5ff;border:1px solid #cfe1fb;text-align:center;"><a href="${escapeHtml(calendarUrl)}" style="display:inline-block;padding:11px 16px;color:#0a4d9f;text-decoration:none;font-size:13px;font-weight:700;">Add To Calendar</a></td>` : ''}
            </tr>
          </table>
          <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:12px;line-height:1.8;color:#64748b;">
            <div style="font-weight:700;color:#334155;">Need help?</div>
            <div>Contact Page: <a href="${escapeHtml(contactUrl)}" style="color:#0b67c2;text-decoration:none;">${escapeHtml(contactUrl)}</a></div>
            <div style="margin-top:6px;">${escapeHtml(volunteerReminderSiteName)}</div>
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

const buildDonationInvoiceEmail = ({ donation = {}, organizationName = '', campaignDescription = '', address = '', phone = '' }) => {
  const donorName = String(donation.donorName || 'Sangat Member').trim();
  const donorEmail = String(donation.donorEmail || '').trim().toLowerCase();
  const receiptId = String(donation.receiptId || donation.id || '').trim();
  const campaignName = String(donation.campaignName || '').trim() || 'Donation Campaign';
  const amountValue = Number(donation.amount);
  const amountText = Number.isFinite(amountValue) ? `$${amountValue.toFixed(2)}` : '-';
  const donationDateLabel = donation.createdAt
    ? new Date(donation.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const siteName = String(organizationName || volunteerReminderSiteName || 'Singh Sabha Milton Gurdwara').trim();
  const siteAddress = String(address || '').trim();
  const sitePhone = String(phone || '').trim();
  const purposeText = String(campaignDescription || '').trim() || `Support for ${campaignName}`;
  const subject = `Donation Invoice ${receiptId || campaignName} - Thank You`;
  const logoSrc = volunteerReminderLogoUrl || `${volunteerReminderBaseUrl}/gurdwara-logo.webp` || embeddedVolunteerReminderLogo;

  const text = [
    `Sat Sri Akal ${donorName},`,
    '',
    'Thank you for your generous donation. We are grateful for your support.',
    '',
    `Campaign: ${campaignName}`,
    `Purpose: ${purposeText}`,
    `Amount: ${amountText}`,
    `Date: ${donationDateLabel}`,
    receiptId ? `Receipt/Invoice No: ${receiptId}` : '',
    '',
    'Please find your donation invoice PDF attached to this email.',
    siteAddress ? `Address: ${siteAddress}` : '',
    sitePhone ? `Phone: ${sitePhone}` : '',
    '',
    `With gratitude,`,
    siteName
  ].filter(Boolean).join('\n');

  const safeName = escapeHtml(donorName || 'Sangat Member');
  const html = `
  <div style="background:#f5f8fc;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f6;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:16px 22px;background:linear-gradient(90deg,#0a4d9f,#0b67c2,#e58b16);color:#ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${logoSrc ? `<td style="width:44px;padding-right:12px;vertical-align:middle;"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(siteName)} logo" width="44" height="44" style="display:block;border-radius:9999px;background:#ffffff;object-fit:cover;"/></td>` : ''}
                    <td style="vertical-align:middle;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${escapeHtml(siteName)}</div>
                      <div style="font-size:18px;font-weight:800;line-height:1.3;margin-top:2px;">Donation Invoice &amp; Thank You</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px 8px;text-align:left;">
          <div style="margin-top:10px;font-size:15px;line-height:1.8;color:#334155;">Sat Sri Akal ${safeName},</div>
          <div style="margin-top:8px;font-size:15px;line-height:1.8;color:#334155;">Thank you for your generous contribution. Your seva directly supports the sangat and ongoing Gurdwara initiatives. We deeply appreciate your kindness and trust.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #c7dcf7;border-radius:14px;overflow:hidden;background:#f6faff;box-shadow:0 8px 24px -18px rgba(11,103,194,.65);">
            <tr>
              <td colspan="2" style="padding:11px 14px;background:linear-gradient(90deg,#eaf2ff,#f6f9ff);border-bottom:1px solid #c7dcf7;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#0a4d9f;">Donation Details</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Campaign</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(campaignName)}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Purpose</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(purposeText)}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Amount</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:700;">${escapeHtml(amountText)}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;border-bottom:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Date</td>
              <td style="padding:11px 12px;border-bottom:1px solid #d7e3f3;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(donationDateLabel)}</td>
            </tr>
            <tr>
              <td style="width:34%;padding:11px 12px;border-right:1px solid #d7e3f3;background:#edf4ff;font-size:12px;font-weight:700;color:#1e3a8a;">Receipt/Invoice</td>
              <td style="padding:11px 12px;background:#ffffff;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(receiptId || '-')}</td>
            </tr>
          </table>
          <div style="margin-top:14px;font-size:15px;line-height:1.8;color:#334155;">Please find your donation invoice PDF attached to this email for your records.</div>
          <div style="margin-top:18px;font-size:15px;line-height:1.8;color:#334155;">
            <div style="font-weight:700;color:#0f172a;">With gratitude,</div>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:6px;">
              <tr>
                ${logoSrc ? `<td style="padding-right:8px;vertical-align:middle;"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(siteName)} logo" width="18" height="18" style="display:block;border-radius:9999px;object-fit:cover;"/></td>` : ''}
                <td style="vertical-align:middle;font-weight:800;color:#0f172a;">${escapeHtml(siteName)}</td>
              </tr>
            </table>
            ${siteAddress ? `<div><strong style="color:#0f172a;">Address:</strong> ${escapeHtml(siteAddress)}</div>` : ''}
            ${sitePhone ? `<div><strong style="color:#0f172a;">Phone:</strong> ${escapeHtml(sitePhone)}</div>` : ''}
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  return { donorEmail, donorName, subject, text, html, receiptId, campaignName, amountText, donationDateLabel };
};

const sendDonationInvoiceEmail = async ({
  donation = {},
  campaignDescription = '',
  organizationName = '',
  address = '',
  phone = '',
  fileName = '',
  attachmentBase64 = ''
} = {}) => {
  if (!donationInvoiceWebhookUrl) {
    const error = new Error('Donation email webhook is not configured.');
    error.status = 503;
    throw error;
  }

  if (!eventsDb.hasDatabaseConnection) {
    const error = new Error('Database is not configured. Donation invoice emails require PostgreSQL data.');
    error.status = 503;
    throw error;
  }

  const requestedId = String(donation?.id || '').trim();
  const requestedReceiptId = String(donation?.receiptId || '').trim();
  if (!requestedId && !requestedReceiptId) {
    const error = new Error('Donation id or receiptId is required.');
    error.status = 400;
    throw error;
  }

  const persistedDonations = await eventsDb.getDonations();
  const persistedDonation = (Array.isArray(persistedDonations) ? persistedDonations : []).find((entry) => {
    const entryId = String(entry?.id || '').trim();
    const entryReceiptId = String(entry?.receiptId || '').trim();
    return (requestedId && entryId === requestedId) || (requestedReceiptId && entryReceiptId === requestedReceiptId);
  });

  if (!persistedDonation) {
    const error = new Error('Donation record not found in database.');
    error.status = 404;
    throw error;
  }

  const normalizedAttachment = String(attachmentBase64 || '').trim();
  if (!normalizedAttachment) {
    const error = new Error('Invoice attachment is required.');
    error.status = 400;
    throw error;
  }

  let attachmentBuffer = null;
  try {
    attachmentBuffer = Buffer.from(normalizedAttachment, 'base64');
  } catch {
    attachmentBuffer = null;
  }

  if (!attachmentBuffer || !attachmentBuffer.length || String(attachmentBuffer.slice(0, 4)) !== '%PDF') {
    const error = new Error('Invalid PDF attachment payload.');
    error.status = 400;
    throw error;
  }

  const canonicalAttachmentBase64 = attachmentBuffer.toString('base64');

  const template = buildDonationInvoiceEmail({
    donation: persistedDonation,
    organizationName,
    campaignDescription,
    address,
    phone
  });

  if (!isValidEmailAddress(template.donorEmail)) {
    const error = new Error('Valid donor email is required.');
    error.status = 400;
    throw error;
  }

  const normalizedFileName = String(fileName || '').trim() || `invoice-${template.receiptId || Date.now()}.pdf`;
  const attachmentDataUrl = `data:application/pdf;base64,${canonicalAttachmentBase64}`;
  const normalizedAttachmentPayload = {
    filename: normalizedFileName,
    contentType: 'application/pdf',
    content: canonicalAttachmentBase64,
    encoding: 'base64',
    disposition: 'attachment'
  };

  const payload = {
    type: 'donation-invoice',
    to: template.donorEmail,
    email: template.donorEmail,
    name: template.donorName,
    subject: template.subject,
    message: template.text,
    text: template.text,
    html: template.html,
    bodyHtml: template.html,
    bodyText: template.text,
    templateType: 'html',
    attachments: [normalizedAttachmentPayload],
    invoicePdfFileName: normalizedFileName,
    invoicePdfDataUrl: attachmentDataUrl,
    metadata: {
      campaignName: template.campaignName,
      amount: template.amountText,
      donationDate: template.donationDateLabel,
      receiptId: template.receiptId,
      organizationName: String(organizationName || volunteerReminderSiteName || '').trim(),
      address: String(address || '').trim(),
      phone: String(phone || '').trim()
    },
    sentAt: new Date().toISOString()
  };

  try {
    const response = await fetch(donationInvoiceWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const upstreamBody = await response.text().catch(() => '');
      const snippet = String(upstreamBody || '').trim().slice(0, 240);
      const message = snippet
        ? `Donation invoice email service returned ${response.status}: ${snippet}`
        : `Donation invoice email service returned ${response.status}.`;
      const error = new Error(message);
      error.status = 502;
      throw error;
    }

    return {
      sent: true,
      to: template.donorEmail,
      subject: template.subject,
      fileName: normalizedFileName
    };
  } catch (error) {
    if (error?.status) {
      throw error;
    }
    const wrapped = new Error('Unable to send donation invoice email right now.');
    wrapped.status = 502;
    throw wrapped;
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
  if (normalized.includes('application/pdf')) return '.pdf';
  if (normalized.includes('video/mp4')) return '.mp4';
  if (normalized.includes('video/webm')) return '.webm';
  if (normalized.includes('video/quicktime')) return '.mov';
  if (normalized.includes('text/plain')) return '.txt';
  return '';
};

const isAllowedUploadMime = (mimeType, allowedMimeTypes = []) => {
  const normalizedMime = String(mimeType || '').toLowerCase();
  if (!normalizedMime) {
    return false;
  }

  if (normalizedMime === 'image/svg+xml' || normalizedMime === 'text/html' || normalizedMime === 'application/xhtml+xml') {
    return false;
  }

  const policies = Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0
    ? allowedMimeTypes
    : [];

  if (policies.length === 0) {
    return true;
  }

  return policies.some((policy) => {
    const normalizedPolicy = String(policy || '').trim().toLowerCase();
    if (!normalizedPolicy) {
      return true;
    }
    if (normalizedPolicy.endsWith('/*')) {
      return normalizedMime.startsWith(normalizedPolicy.slice(0, -1));
    }
    return normalizedMime === normalizedPolicy;
  });
};

const detectUploadMimeType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return '';
  }

  if (buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4E
    && buffer[3] === 0x47
    && buffer[4] === 0x0D
    && buffer[5] === 0x0A
    && buffer[6] === 0x1A
    && buffer[7] === 0x0A) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  if (buffer.length >= 6) {
    const header = buffer.toString('ascii', 0, 6);
    if (header === 'GIF87a' || header === 'GIF89a') {
      return 'image/gif';
    }
  }

  if (buffer.length >= 12) {
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') {
      return 'image/webp';
    }

    const atomType = buffer.toString('ascii', 4, 8);
    if (atomType === 'ftyp') {
      const brand = buffer.toString('ascii', 8, 12).trim().toLowerCase();
      if (brand === 'qt' || brand.startsWith('qt')) {
        return 'video/quicktime';
      }
      if (brand.startsWith('mp4') || brand.startsWith('isom') || brand.startsWith('iso2') || brand.startsWith('avc1') || brand.startsWith('m4v')) {
        return 'video/mp4';
      }
    }
  }

  if (buffer.length >= 4
    && buffer[0] === 0x1A
    && buffer[1] === 0x45
    && buffer[2] === 0xDF
    && buffer[3] === 0xA3) {
    return 'video/webm';
  }

  if (buffer.length >= 5) {
    const pdfHeader = buffer.toString('ascii', 0, 5);
    if (pdfHeader === '%PDF-') {
      return 'application/pdf';
    }
  }

  const hasBinaryNull = buffer.includes(0x00);
  if (!hasBinaryNull) {
    const text = buffer.toString('utf8');
    const roundTrip = Buffer.from(text, 'utf8');
    if (roundTrip.length === buffer.length && roundTrip.equals(buffer)) {
      return 'text/plain';
    }
  }

  return '';
};

const getSafeUploadFileName = (originalName, mimeType) => {
  const parsed = path.parse(sanitizeFileName(originalName || 'file'));
  const baseName = sanitizeFileName(parsed.name || 'file');
  const safeExtension = getExtensionFromMime(mimeType) || '';
  return `${baseName}${safeExtension}`;
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
    return String(value || '').trim() || 'Member';
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
  const hasExplicitAdminPageAccess = Array.isArray(user.adminPageAccess);
  const adminPageAccess = hasExplicitAdminPageAccess
    ? [...new Set(user.adminPageAccess.map((path) => String(path || '').trim()).filter((path) => ADMIN_PAGE_PATHS.includes(path)))]
    : getDefaultAdminPageAccessForRole(role);

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
    adminPageAccess: adminPageAccess.length > 0 ? adminPageAccess : getDefaultAdminPageAccessForRole(role),
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

const hasCurrentPaidMembershipFee = (user = {}) => {
  const role = String(user.role || '').trim().toLowerCase();
  if (role !== 'member') {
    return false;
  }

  const schedule = String(user.membershipProfile?.donationSchedule || 'monthly').trim().toLowerCase();
  const validityDays = schedule === 'yearly' ? 365 : 30;
  const paidDates = (Array.isArray(user.membershipFeeRecords) ? user.membershipFeeRecords : [])
    .filter((entry) => String(entry?.status || '').trim().toLowerCase() === 'paid')
    .map((entry) => new Date(entry?.paymentDate || entry?.updatedAt || '').getTime())
    .filter(Number.isFinite);

  if (paidDates.length === 0) {
    return false;
  }

  const latestPaidAt = Math.max(...paidDates);
  return Date.now() <= latestPaidAt + (validityDays * 24 * 60 * 60 * 1000);
};

const enforceUserMembershipActivity = (user = {}, requestedBody = {}) => {
  const role = String(user.role || '').trim().toLowerCase();
  const approvalStatus = role === 'member' && !hasCurrentPaidMembershipFee(user)
    ? 'pending'
    : 'approved';
  const previousApprovalStatus = String(user.approvalStatus || '').trim().toLowerCase();

  return {
    ...user,
    isActive: Object.prototype.hasOwnProperty.call(requestedBody, 'isActive')
      ? requestedBody.isActive !== false
      : user.isActive !== false,
    approvalStatus,
    approvalUpdatedAt: previousApprovalStatus === approvalStatus
      ? user.approvalUpdatedAt
      : new Date().toISOString()
  };
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
  const hasAdminPageAccessInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'adminPageAccess');
  const hasApprovalInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'approvalStatus');
  const hasRoleInPayload = Object.prototype.hasOwnProperty.call(payload || {}, 'role');
  const roleChanged = hasRoleInPayload && normalizeUser({ role: payload.role }).role !== existing.role;
  const nextAdminPageAccess = hasAdminPageAccessInPayload
    ? normalized.adminPageAccess
    : (roleChanged ? undefined : existing.adminPageAccess);
  const updated = {
    ...existing,
    ...normalized,
    approvalStatus: hasApprovalInPayload ? normalized.approvalStatus : existing.approvalStatus,
    adminPageAccess: hasAdminPageAccessInPayload ? normalized.adminPageAccess : normalizeUser({ ...existing, role: normalized.role, adminPageAccess: nextAdminPageAccess }).adminPageAccess,
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

const getZeffyDonationCampaigns = async () => {
  return eventsDb.getZeffyDonationCampaigns();
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

const resolveZeffyCampaign = (donationRecord, campaigns = []) => {
  const eventCampaignName = String(donationRecord?.campaignName || '').trim().toLowerCase();
  const configuredCampaignName = zeffyCampaignName.toLowerCase();
  return Number.isFinite(zeffyCampaignId) && zeffyCampaignId > 0
    ? campaigns.find((entry) => Number(entry.id) === zeffyCampaignId)
    : campaigns.find((entry) => {
      const name = String(entry.name || '').trim().toLowerCase();
      return name === eventCampaignName || name === configuredCampaignName;
    });
};

const normalizeZeffyCampaignSlug = (value = '') => {
  try {
    const url = new URL(String(value || '').trim());
    const hostname = url.hostname.toLowerCase();
    if (hostname !== 'zeffy.com' && !hostname.endsWith('.zeffy.com')) {
      return '';
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const donationFormIndex = segments.indexOf('donation-form');
    return String(segments[donationFormIndex + 1] || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const fetchZeffyCampaigns = async (apiKey) => {
  const response = await fetch('https://api.zeffy.com/api/v1/campaigns?limit=100', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Unable to load Zeffy campaigns (${response.status}).`);
    error.status = response.status >= 500 || response.status === 429 ? 502 : 400;
    throw error;
  }
  return Array.isArray(body.data) ? body.data : [];
};

const resolveRemoteZeffyCampaign = (campaign, remoteCampaigns = []) => {
  const configuredSlug = normalizeZeffyCampaignSlug(campaign?.paymentLink);
  const configuredName = String(campaign?.name || zeffyCampaignName).trim().toLowerCase();
  return remoteCampaigns.find((entry) => (
    configuredSlug && normalizeZeffyCampaignSlug(entry?.url) === configuredSlug
  )) || remoteCampaigns.find((entry) => {
    const remoteName = String(entry?.title || entry?.description || '').trim().toLowerCase();
    return remoteName && remoteName === configuredName;
  }) || (remoteCampaigns.length === 1 ? remoteCampaigns[0] : null);
};

const validateZeffyCampaignConfiguration = async ({ name, paymentLink, apiKey }) => {
  assertInput(Boolean(normalizeZeffyCampaignSlug(paymentLink)), 'paymentLink must be a valid Zeffy donation form URL.');
  const remoteCampaigns = await fetchZeffyCampaigns(apiKey);
  const remoteCampaign = resolveRemoteZeffyCampaign({ name, paymentLink }, remoteCampaigns);
  assertInput(Boolean(remoteCampaign), 'The Zeffy API key does not provide access to the configured donation form.');
  return remoteCampaign;
};

const getConfiguredZeffyCampaigns = async () => {
  const campaigns = await getDonationCampaigns();
  const storedConfigurations = await getZeffyDonationCampaigns();
  const configurations = storedConfigurations.map((campaign) => ({
    apiKey: campaign.zeffyApiKey,
    campaign
  }));

  if (zeffyApiKey) {
    const environmentCampaign = resolveZeffyCampaign({ campaignName: zeffyCampaignName }, campaigns) || null;
    const alreadyConfigured = configurations.some((entry) => (
      entry.apiKey === zeffyApiKey && Number(entry.campaign?.id || 0) === Number(environmentCampaign?.id || 0)
    ));
    if (!alreadyConfigured) {
      configurations.push({ apiKey: zeffyApiKey, campaign: environmentCampaign });
    }
  }

  const remoteCampaignCache = new Map();
  const hydrated = [];
  for (const configuration of configurations) {
    if (!configuration.apiKey) {
      continue;
    }
    let remoteCampaigns = remoteCampaignCache.get(configuration.apiKey);
    if (!remoteCampaigns) {
      remoteCampaigns = await fetchZeffyCampaigns(configuration.apiKey);
      remoteCampaignCache.set(configuration.apiKey, remoteCampaigns);
    }
    const remoteCampaign = resolveRemoteZeffyCampaign(configuration.campaign, remoteCampaigns);
    hydrated.push({
      ...configuration,
      remoteCampaignId: String(remoteCampaign?.id || '').trim()
    });
  }

  return { campaigns, configurations: hydrated };
};

const zeffyPaymentMatchesConfiguration = (payment, configuration, configurationCount) => {
  const paymentCampaignId = String(payment?.campaign_id || '').trim();
  if (configuration.remoteCampaignId) {
    return paymentCampaignId === configuration.remoteCampaignId;
  }

  const paymentCampaignName = String(payment?.description || '').trim().toLowerCase();
  const localCampaignName = String(configuration.campaign?.name || '').trim().toLowerCase();
  return Boolean(localCampaignName && paymentCampaignName === localCampaignName) || configurationCount === 1;
};

const persistVerifiedZeffyPayment = async (payment, campaigns = [], campaignOverride = null) => {
  const donationRecord = mapZeffyApiPayment(payment);
  const matchedCampaign = campaignOverride || resolveZeffyCampaign(donationRecord, campaigns);
  return upsertDonation({
    ...donationRecord,
    campaignId: matchedCampaign ? Number(matchedCampaign.id) : null,
    campaignName: matchedCampaign?.name || donationRecord.campaignName || zeffyCampaignName
  });
};

let zeffyReconciliationPromise = null;
let lastZeffyReconciliationAt = 0;

const reconcileZeffyDonations = async ({ force = false } = {}) => {
  if (!force && Date.now() - lastZeffyReconciliationAt < 30 * 1000) {
    return { imported: 0, checked: 0, skipped: 'throttled' };
  }
  if (zeffyReconciliationPromise) {
    return zeffyReconciliationPromise;
  }

  zeffyReconciliationPromise = (async () => {
    const { campaigns, configurations } = await getConfiguredZeffyCampaigns();
    if (configurations.length === 0) {
      return { imported: 0, checked: 0, skipped: 'not-configured' };
    }
    const existingTransactionIds = new Set(
      (await readDonations()).map((entry) => String(entry.gatewayTransactionId || '').trim()).filter(Boolean)
    );
    const touchedCampaigns = new Map();
    let imported = 0;
    let checked = 0;

    for (const configuration of configurations) {
      let cursor = '';
      for (let page = 0; page < 5; page += 1) {
        const url = new URL('https://api.zeffy.com/api/v1/payments');
        url.searchParams.set('status', 'succeeded');
        url.searchParams.set('limit', '100');
        if (cursor) {
          url.searchParams.set('starting_after', cursor);
        }

        const zeffyResponse = await fetch(url, {
          headers: { Authorization: `Bearer ${configuration.apiKey}` }
        });
        const zeffyBody = await zeffyResponse.json().catch(() => ({}));
        if (!zeffyResponse.ok) {
          throw new Error(`Unable to reconcile Zeffy payments (${zeffyResponse.status}).`);
        }

        const payments = Array.isArray(zeffyBody.data) ? zeffyBody.data : [];
        for (const payment of payments) {
          if (!zeffyPaymentMatchesConfiguration(payment, configuration, configurations.length)) {
            continue;
          }
          checked += 1;
          const persistedDonation = await persistVerifiedZeffyPayment(payment, campaigns, configuration.campaign);
          if (!existingTransactionIds.has(String(payment.id || '').trim())) {
            imported += 1;
          }
          existingTransactionIds.add(String(payment.id || '').trim());
          const campaignKey = persistedDonation.campaignId || persistedDonation.campaignName;
          touchedCampaigns.set(campaignKey, persistedDonation);
        }

        cursor = String(zeffyBody.next_cursor || '').trim();
        if (!zeffyBody.has_more || !cursor) {
          break;
        }
      }
    }

    for (const donation of touchedCampaigns.values()) {
      await syncCampaignRaisedTotal({
        campaignId: donation.campaignId,
        campaignName: donation.campaignName
      });
    }
    lastZeffyReconciliationAt = Date.now();
    return { imported, checked };
  })();

  try {
    return await zeffyReconciliationPromise;
  } finally {
    zeffyReconciliationPromise = null;
  }
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
      logServerError(error, '[donations] reconcile failed for pending row');
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

  if (!/^https?:\/\//i.test(input) && !input.includes('/')) {
    if (/^[A-Za-z0-9._-]+$/.test(input)) {
      return { type: 'handle', value: input.replace(/^@/, '') };
    }
    return { type: 'channelName', value: input };
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
    if (sourceType === 'channelName' && sourceValue) {
      candidates.push(`https://www.youtube.com/results?search_query=${encodeURIComponent(sourceValue)}`);
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

  if (parsedSource.type === 'channelName') {
    if (youtubeApiKey) {
      const channelSearchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      channelSearchUrl.searchParams.set('part', 'snippet');
      channelSearchUrl.searchParams.set('q', parsedSource.value);
      channelSearchUrl.searchParams.set('type', 'channel');
      channelSearchUrl.searchParams.set('maxResults', '1');
      channelSearchUrl.searchParams.set('key', youtubeApiKey);

      const channelSearchResponse = await fetch(channelSearchUrl);
      const channelSearchPayload = await channelSearchResponse.json().catch(() => ({}));
      channelId = channelSearchPayload?.items?.[0]?.id?.channelId || '';
    }

    if (!channelId) {
      channelId = await resolveChannelIdFromSourcePage(parsedSource.type, parsedSource.value, channelId);
    }

    if (!channelId) {
      const error = new Error('Unable to resolve the YouTube channel name. Try its @handle instead.');
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

  const rateLimitAllowed = await enforceRateLimit(request, response, requestUrl);
  if (!rateLimitAllowed) {
    return;
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (requestUrl.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      stripeConfigured: Boolean(stripeSecretKey),
      webhookConfigured: Boolean(stripeWebhookSecret),
      eventsDatabaseConfigured: eventsDb.hasDatabaseConnection,
      apiVersion: API_VERSION,
      startupId: API_STARTUP_ID,
      serverPort: port
    });
    return;
  }

  if (requestUrl.pathname === '/api/contact-us/send' && request.method === 'POST') {
    try {
      const payload = await parseJsonObjectBody(request, { maxBytes: 128 * 1024, allowEmpty: false });
      ensureNoUnknownKeys(payload, ['name', 'email', 'phone', 'message', 'subject', 'to']);

      const name = readStringField(payload, 'name', { required: true, min: 2, max: 140 });
      const senderEmail = readEmailField(payload, 'email', { required: true });
      const phone = readStringField(payload, 'phone', { max: 40 });
      const message = readStringField(payload, 'message', { required: true, min: 8, max: 5000 });
      const subject = readStringField(payload, 'subject', { max: 200 }) || `Contact Us Inquiry from ${name}`;
      const requestedRecipient = readStringField(payload, 'to', { max: 254, toLowerCase: true });

      const recipient = isValidEmailAddress(requestedRecipient)
        ? requestedRecipient
        : (isValidEmailAddress(contactUsInboxAddress) ? contactUsInboxAddress : '');
      assertInput(Boolean(recipient), 'Contact inbox email is not configured. Set CONTACT_US_EMAIL or SMTP_FROM.');

      const template = buildContactInquiryEmail({
        name,
        email: senderEmail,
        phone,
        message,
        subject
      });

      const deliveryResult = await sendViaConfiguredMailTransport({
        from: localMailFromAddress,
        toList: [recipient],
        subject: template.subject,
        textBody: template.text,
        htmlBody: template.html,
        attachments: []
      });

      sendJson(response, 200, {
        ok: true,
        sent: true,
        provider: String(deliveryResult?.provider || localMailTransport || 'sendmail').trim(),
        recipient,
        type: 'contact'
      });
    } catch (error) {
      logServerError(error, 'contact-us-send');
      sendJson(response, error.status || 502, {
        ok: false,
        sent: false,
        message: error?.message || 'Unable to send contact message.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/internal/mail-relay' && request.method === 'POST') {
    const remoteAddress = String(request.socket?.remoteAddress || '').trim();
    if (!isLoopbackAddress(remoteAddress)) {
      sendJson(response, 403, {
        ok: false,
        message: 'Mail relay only accepts local requests.'
      });
      return;
    }

    try {
      const payload = await parseJsonObjectBody(request);
      const relayPayload = isPlainObject(payload.body) ? payload.body : payload;
      const recipients = normalizeRecipientList(relayPayload);
      const bccRecipients = normalizeBccRecipientList(relayPayload);
      if (recipients.length === 0 && bccRecipients.length === 0) {
        sendJson(response, 400, {
          ok: false,
          message: 'Recipient address required.'
        });
        return;
      }

      const subject = sanitizeHeaderValue(relayPayload.subject || relayPayload.title || 'Singh Sabha Milton Notification')
        || 'Singh Sabha Milton Notification';
      const htmlBody = String(relayPayload.html || relayPayload.bodyHtml || relayPayload.content || relayPayload.message || '').trim();
      const textBody = String(relayPayload.text || relayPayload.bodyText || relayPayload.message || '').trim();
      const attachments = normalizeAttachmentList(relayPayload);

      const deliveryResult = await sendViaConfiguredMailTransport({
        from: localMailFromAddress,
        toList: recipients,
        bccList: bccRecipients,
        subject,
        textBody,
        htmlBody,
        attachments
      });

      sendJson(response, 200, {
        ok: true,
        sent: true,
        provider: String(deliveryResult?.provider || localMailTransport || 'sendmail').trim(),
        envelopeFrom: String(deliveryResult?.envelopeFrom || localMailFromAddress).trim() || localMailFromAddress,
        messageId: String(deliveryResult?.messageId || '').trim() || undefined,
        acceptedRecipients: Array.isArray(deliveryResult?.accepted) ? deliveryResult.accepted : undefined,
        rejectedRecipients: Array.isArray(deliveryResult?.rejected) ? deliveryResult.rejected : undefined,
        recipients: recipients.length,
        bccRecipients: bccRecipients.length,
        hasAttachments: attachments.length > 0,
        type: String(relayPayload.type || '').trim() || 'generic'
      });
    } catch (error) {
      logServerError(error, 'mail-relay');
      sendJson(response, 502, {
        ok: false,
        sent: false,
        message: error?.message || 'Unable to send relay email.'
      });
    }
    return;
  }

  if (/^\/api\/streaming\/darbar-sahib\/live\/?$/i.test(requestUrl.pathname) && (request.method === 'GET' || request.method === 'HEAD')) {
    response.writeHead(302, {
      Location: '/api/streaming/darbar-sahib/hls/stream.m3u8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    response.end();
    return;
  }

  const darbarHlsMatch = requestUrl.pathname.match(/^\/api\/streaming\/darbar-sahib\/hls\/(stream\.m3u8|init\.mp4|segment-\d+\.m4s)$/i);
  if (darbarHlsMatch && (request.method === 'GET' || request.method === 'HEAD')) {
    try {
      startDarbarSahibHls();
      const fileName = darbarHlsMatch[1];
      const filePath = path.join(darbarSahibHlsDir, fileName);
      const exists = await waitForDarbarSahibHlsFile(filePath);
      if (!exists) {
        sendJson(response, 503, { ok: false, message: 'Live Kirtan is starting. Please try again shortly.' });
        return;
      }

      const contentType = fileName.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : fileName.endsWith('.mp4')
          ? 'video/mp4'
          : 'video/iso.segment';
      const stat = fs.statSync(filePath);
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': fileName.endsWith('.m3u8') ? 'no-store' : 'public, max-age=30',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS'
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to serve the Darbar Sahib live stream.'
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
        'X-Content-Type-Options': 'nosniff',
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

      const body = await parseJsonObjectBody(request, { maxBytes: maxUploadBytes * 2, allowEmpty: false });
      ensureNoUnknownKeys(body, ['fileName', 'mimeType', 'dataUrl', 'base64Data']);

      const rawNameField = readStringField(body, 'fileName', { max: 180 }) || 'upload-file';
      const mimeType = readStringField(body, 'mimeType', { max: 160 }).toLowerCase();
      if (mimeType) {
        assertInput(mimeTypePattern.test(mimeType), 'mimeType has an invalid format.');
      }
      const allowedMimeTypes = uploadServiceMimePolicies[service] || uploadServiceMimePolicies.default;
      assertInput(isAllowedUploadMime(mimeType, allowedMimeTypes), 'Unsupported file type for this upload service.');
      const dataUrl = readStringField(body, 'dataUrl', { max: maxUploadBytes * 3 });
      const base64Data = readStringField(body, 'base64Data', { max: maxUploadBytes * 3 });
      const base64Payload = extractBase64Payload(dataUrl || base64Data || '');

      if (!base64Payload) {
        sendJson(response, 400, { ok: false, message: 'No file payload found.' });
        return;
      }

      const fileBuffer = Buffer.from(base64Payload, 'base64');
      if (!fileBuffer.length) {
        sendJson(response, 400, { ok: false, message: 'Invalid file payload.' });
        return;
      }

      const detectedMimeType = detectUploadMimeType(fileBuffer);
      if (!detectedMimeType) {
        sendJson(response, 400, { ok: false, message: 'Uploaded file content is not supported.' });
        return;
      }

      assertInput(isAllowedUploadMime(detectedMimeType, allowedMimeTypes), 'Uploaded file content is not allowed for this service.');
      assertInput(detectedMimeType === mimeType, 'File content does not match the declared file type.');

      if (fileBuffer.length > maxUploadBytes) {
        sendJson(response, 413, { ok: false, message: 'File too large. Max size is 15 MB.' });
        return;
      }

      const finalName = getSafeUploadFileName(rawNameField, detectedMimeType);

      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storedFileName = `${uniqueSuffix}-${finalName}`;
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
          mimeType: detectedMimeType,
          url: publicUrl
        }
      });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to upload file.' });
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

      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['questions']);
      const questions = readArrayField(body, 'questions', { required: true, max: 2000 });
      questions.forEach((entry, index) => {
        validateGenericJsonValue(entry, `questions[${index}]`, 0);
      });
      fs.mkdirSync(quizBankDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf8');

      const normalizedFileName = path.basename(filePath);
      if (eventsDb.hasDatabaseConnection) {
        await eventsDb.upsertQuizBankFile(normalizedFileName, questions);
      }

      sendJson(response, 200, { ok: true, data: { fileName: normalizedFileName, questions } });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to update quiz file.' });
    }
    return;
  }

  const contentResourceMatch = requestUrl.pathname.match(/^\/api\/content\/([a-z0-9_-]+)$/i);
  if (contentResourceMatch && request.method === 'GET') {
    try {
      const resource = String(contentResourceMatch[1]).toLowerCase();
      let data = await eventsDb.listItems(resource);
      if (resource === 'users') {
        data = await Promise.all(data.map(async (user) => {
          const reconciled = enforceUserMembershipActivity(user, {});
          const approvalChanged = reconciled.approvalStatus !== user.approvalStatus;
          const activeDefaultChanged = reconciled.isActive !== user.isActive;
          if (!approvalChanged && !activeDefaultChanged) {
            return user;
          }
          return eventsDb.updateItem('users', user.id, reconciled);
        }));
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to fetch content list.' });
    }
    return;
  }

  if (contentResourceMatch && request.method === 'POST') {
    try {
      const resource = String(contentResourceMatch[1]).toLowerCase();
      const body = await parseAndValidateGenericObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      const validatedBody = resource === 'users' ? enforceUserMembershipActivity(body, body) : body;
      const data = await eventsDb.createItem(resource, validatedBody);
      if (resource !== 'audit_logs') {
        await appendAuditLog(request, {
          action: 'content.create',
          targetType: resource,
          targetId: String(data?.id || ''),
          description: `Created ${resource} item`,
          payload: validatedBody
        });
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to create content item.' });
    }
    return;
  }

  const contentResourceIdMatch = requestUrl.pathname.match(/^\/api\/content\/([a-z0-9_-]+)\/([^/]+)$/i);
  if (contentResourceIdMatch && request.method === 'PATCH') {
    try {
      const resource = String(contentResourceIdMatch[1]).toLowerCase();
      const id = parseStringPathId(decodeURIComponent(contentResourceIdMatch[2]), 'id');
      const body = await parseAndValidateGenericObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      const existingUsers = resource === 'users' ? await eventsDb.listItems('users') : null;
      const existingUser = Array.isArray(existingUsers) ? existingUsers.find((entry) => String(entry?.id || '') === String(id)) : null;
      const changedRoleToMember = resource === 'users'
        && String(existingUser?.role || '').trim().toLowerCase() !== 'member'
        && String(body?.role || '').trim().toLowerCase() === 'member';
      const validatedBody = resource === 'users'
        ? enforceUserMembershipActivity({
          ...(existingUser || {}),
          ...body,
          ...(changedRoleToMember ? { membershipFeeRecords: [] } : {}),
          id
        }, body)
        : body;
      const data = await eventsDb.updateItem(resource, id, validatedBody);

      if (resource === 'users' && eventsDb.hasDatabaseConnection) {
        const mergedUser = {
          ...(existingUser || {}),
          ...(data || {}),
          ...(validatedBody || {}),
          id: String(id)
        };
        const becameInactive = (existingUser?.isActive !== false) && (mergedUser?.isActive === false);
        if (becameInactive) {
          await eventsDb.markUserRegistrationsDormant({
            userId: mergedUser.id,
            email: mergedUser.email,
            contact: mergedUser.phone
          });
        }
      }

      if (resource !== 'audit_logs') {
        await appendAuditLog(request, {
          action: 'content.update',
          targetType: resource,
          targetId: String(id || ''),
          description: `Updated ${resource} item`,
          payload: validatedBody
        });
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to update content item.' });
    }
    return;
  }

  if (contentResourceIdMatch && request.method === 'DELETE') {
    try {
      const resource = String(contentResourceIdMatch[1]).toLowerCase();
      const id = parseStringPathId(decodeURIComponent(contentResourceIdMatch[2]), 'id');

      if (resource === 'users' && eventsDb.hasDatabaseConnection) {
        const users = await eventsDb.listItems('users');
        const targetUser = Array.isArray(users) ? users.find((entry) => String(entry?.id || '') === String(id)) : null;
        if (targetUser) {
          await eventsDb.purgeUserRegistrations({
            userId: targetUser.id,
            email: targetUser.email,
            contact: targetUser.phone,
            name: targetUser.name
          });
        }
      }

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
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to delete content item.',
        details: error.details || null
      });
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
      const body = await parseAndValidateGenericObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
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
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to update singleton content.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/search/fulltext' && request.method === 'GET') {
    try {
      if (!eventsDb.hasDatabaseConnection) {
        sendJson(response, 503, {
          ok: false,
          message: 'Search backend is unavailable because database is not configured.'
        });
        return;
      }

      const rawQuery = String(requestUrl.searchParams.get('q') || '').trim();
      const rawLimit = Number(requestUrl.searchParams.get('limit') || 12);
      const limit = Number.isFinite(rawLimit) ? Math.min(25, Math.max(1, Math.floor(rawLimit))) : 12;
      const rawScope = String(requestUrl.searchParams.get('scope') || 'public').trim().toLowerCase();
      const scope = rawScope === 'admin' ? 'admin' : 'public';

      if (rawQuery.length < 2) {
        sendJson(response, 200, { ok: true, data: [], metadata: { variants: [], minChars: 2 } });
        return;
      }

      const variants = buildPhase2SearchVariants(rawQuery);
      const resultsByKey = new Map();

      const batches = await Promise.all(
        variants.map((variant) => eventsDb.searchPublicContent(variant, { limit: Math.max(20, limit * 2), scope }))
      );

      batches.forEach((rows, variantIndex) => {
        (Array.isArray(rows) ? rows : []).forEach((row) => {
          const key = `${row.type}:${row.id}`;
          const existing = resultsByKey.get(key);
          if (!existing || Number(row.score || 0) > Number(existing.score || 0)) {
            resultsByKey.set(key, {
              ...row,
              matchedVariant: variants[variantIndex] || rawQuery
            });
          }
        });
      });

      const data = Array.from(resultsByKey.values())
        .sort((left, right) => {
          const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
          if (scoreDelta !== 0) {
            return scoreDelta;
          }
          return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
        })
        .slice(0, limit);

      sendJson(response, 200, {
        ok: true,
        data,
        metadata: {
          variants,
          source: 'postgres_full_text',
          scope,
          count: data.length
        }
      });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to run full-text search.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/phase2/channels-config' && request.method === 'GET') {
    try {
      const defaults = {
        whatsAppOptInEnabled: false,
        whatsAppJoinLink: '',
        kioskModeEnabled: false,
        kioskHomeRoute: '/',
        kioskInactivityTimeoutSeconds: 90
      };
      const data = await eventsDb.getSingleton('phase2_channels_config', defaults);
      sendJson(response, 200, { ok: true, data: data || defaults });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: error.message || 'Unable to fetch Phase 2 channel config.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/phase2/channels-config' && request.method === 'PUT') {
    try {
      const body = await parseAndValidateGenericObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, [
        'whatsAppOptInEnabled',
        'whatsAppJoinLink',
        'kioskModeEnabled',
        'kioskHomeRoute',
        'kioskInactivityTimeoutSeconds'
      ]);

      const whatsAppOptInEnabled = readBooleanField(body, 'whatsAppOptInEnabled');
      const whatsAppJoinLink = readStringField(body, 'whatsAppJoinLink', { max: 300 });
      const kioskModeEnabled = readBooleanField(body, 'kioskModeEnabled');
      const kioskHomeRoute = readStringField(body, 'kioskHomeRoute', { max: 120 }) || '/';
      const kioskInactivityTimeoutSeconds = Number(body.kioskInactivityTimeoutSeconds);
      assertInput(
        Number.isFinite(kioskInactivityTimeoutSeconds) && kioskInactivityTimeoutSeconds >= 15 && kioskInactivityTimeoutSeconds <= 1800,
        'kioskInactivityTimeoutSeconds must be between 15 and 1800 seconds.'
      );

      const payload = {
        whatsAppOptInEnabled: whatsAppOptInEnabled === true,
        whatsAppJoinLink,
        kioskModeEnabled: kioskModeEnabled === true,
        kioskHomeRoute,
        kioskInactivityTimeoutSeconds: Math.floor(kioskInactivityTimeoutSeconds)
      };

      const data = await eventsDb.setSingleton('phase2_channels_config', payload);
      await appendAuditLog(request, {
        action: 'phase2.channels-config.update',
        targetType: 'phase2_channels_config',
        targetId: 'phase2_channels_config',
        description: 'Updated Phase 2 WhatsApp and kiosk configuration',
        payload
      });

      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to update Phase 2 channel config.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/calendar.ics' && request.method === 'GET') {
    try {

  if (requestUrl.pathname === '/api/auth/logout' && request.method === 'POST') {
    try {
      await appendAuditLog(request, {
        action: 'auth.logout',
        targetType: 'session',
        targetId: getRequestActor(request).email || 'current-user',
        description: 'User logged out'
      });
      sendJson(response, 200, { ok: true, data: { success: true } });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message || 'Unable to log out.' });
    }
    return;
  }
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
      const body = await parseAndValidateGenericObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      const title = readStringField(body, 'title', { required: true, min: 2, max: 180 });
      const date = readStringField(body, 'date', { required: true, max: 64 });
      assertInput(!Number.isNaN(new Date(date).getTime()), 'date must be a valid date string.');
      body.title = title;
      body.date = date;
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
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to create event in database.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/register' && request.method === 'POST') {
    try {
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['eventId', 'name', 'email', 'contact', 'status', 'notes', 'wantsEventEmails', 'contactPreference']);
      const eventId = readStringField(body, 'eventId', { required: true, max: 12, pattern: /^\d{1,12}$/ });
      const name = readStringField(body, 'name', { required: true, min: 2, max: 120 });
      const email = readEmailField(body, 'email', { required: false });
      const contact = readStringField(body, 'contact', { max: 40 });
      assertInput(Boolean(email || contact), 'Either email or contact is required.');
      if (contact) {
        assertInput(/^[0-9+()\-\s]{7,40}$/.test(contact), 'contact has an invalid format.');
      }
      readStringField(body, 'status', { max: 40 });
      readStringField(body, 'notes', { max: 1000 });
      const wantsEventEmails = readBooleanField(body, 'wantsEventEmails');
      readStringField(body, 'contactPreference', { max: 20 });
      body.eventId = eventId;
      body.name = name;
      if (email) {
        body.email = email;
      }
      if (wantsEventEmails != null) {
        body.wantsEventEmails = wantsEventEmails;
      }
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['eventId', 'registrantId']);
      const eventId = readStringField(body, 'eventId', { required: true, max: 12, pattern: /^\d{1,12}$/ });
      const registrantId = readStringField(body, 'registrantId', { required: true, max: 128, pattern: simpleIdPattern });
      body.eventId = eventId;
      body.registrantId = registrantId;
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
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to remove event registrant.'
      });
    }
    return;
  }

  const eventPathMatch = requestUrl.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventPathMatch && request.method === 'PATCH') {
    try {
      const id = parseNumericPathId(decodeURIComponent(eventPathMatch[1]), 'event id');
      const body = await parseAndValidateGenericObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
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
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to update event.'
      });
    }
    return;
  }

  if (eventPathMatch && request.method === 'DELETE') {
    try {
      const id = parseNumericPathId(decodeURIComponent(eventPathMatch[1]), 'event id');
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['campaignName', 'pendingId', 'origin', 'amountCents', 'amount', 'donorEmail', 'campaignId', 'donorName', 'frequency', 'donationPurpose']);
      readStringField(body, 'campaignName', { max: 160 });
      readStringField(body, 'pendingId', { max: 120, pattern: simpleIdPattern });
      const originInput = readStringField(body, 'origin', { max: 300 });
      if (originInput) {
        assertInput(/^https?:\/\//i.test(originInput), 'origin must be a valid http/https URL.');
      }
      const amountCents = readNumberField(body, 'amountCents', { integer: true, min: 1, max: 50000000 });
      const amount = readNumberField(body, 'amount', { min: 0.01, max: 500000 });
      assertInput(amountCents != null || amount != null, 'amountCents or amount is required.');
      readEmailField(body, 'donorEmail', { required: false });
      readNumberField(body, 'campaignId', { integer: true, min: 1, max: 1000000000 });
      readStringField(body, 'donorName', { max: 140 });
      readStringField(body, 'frequency', { max: 40 });
      readStringField(body, 'donationPurpose', { max: 240 });

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
        assertInput(/^cs_[A-Za-z0-9_]+$/.test(String(sessionId)), 'session_id has an invalid format.');
      }

      if (paymentIntentId) {
        assertInput(/^pi_[A-Za-z0-9_]+$/.test(String(paymentIntentId)), 'payment_intent has an invalid format.');
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
      sendJson(response, error.status || error.statusCode || 500, {
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
      const body = await parseJsonObjectBody(request, { maxBytes: 64 * 1024, allowEmpty: true });
      ensureNoUnknownKeys(body, ['force']);
      const force = readBooleanField(body, 'force');
      const data = await runVolunteerReminderSweep({ force: body?.force === true });
      if (force != null) {
        data.force = force;
      }
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to run volunteer reminders.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/events/reminders/run' && request.method === 'POST') {
    try {
      const body = await parseJsonObjectBody(request, { maxBytes: 64 * 1024, allowEmpty: true });
      ensureNoUnknownKeys(body, ['force']);
      const force = readBooleanField(body, 'force');
      const data = await runEventReminderSweep({ force: body?.force === true });
      await appendAuditLog(request, {
        action: 'event.reminders.run',
        targetType: 'event-reminders',
        targetId: 'scheduled',
        description: 'Executed event reminder sweep',
        payload: { force: force === true, result: data }
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
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
      const opportunityId = parseStringPathId(decodeURIComponent(manualReminderMatch[1]), 'opportunity id');
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

  if (requestUrl.pathname === '/api/zeffy/webhook' && request.method === 'POST') {
    try {
      if (zeffyWebhookToken) {
        const authorization = String(request.headers.authorization || '').trim();
        const bearerToken = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
        const providedToken = String(
          request.headers['x-zeffy-webhook-token']
          || request.headers['x-api-key']
          || requestUrl.searchParams.get('token')
          || bearerToken
          || ''
        ).trim();
        if (!verifyZeffyWebhookToken(zeffyWebhookToken, providedToken)) {
          sendJson(response, 401, { ok: false, message: 'Invalid Zeffy webhook token.' });
          return;
        }
      }

      const event = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      if (normalizeEventType(event) !== 'payment.completed') {
        sendJson(response, 200, { ok: true, received: true, ignored: true });
        return;
      }

      const paymentId = extractZeffyPaymentId(event);
      assertInput(Boolean(paymentId), 'Zeffy payment.completed event is missing its payment id.');
      const { campaigns, configurations } = await getConfiguredZeffyCampaigns();
      assertInput(configurations.length > 0, 'No Zeffy API key is configured.');

      let verifiedPayment = null;
      let matchedConfiguration = null;
      let verificationStatus = 400;
      for (const configuration of configurations) {
        const zeffyResponse = await fetch(`https://api.zeffy.com/api/v1/payments/${encodeURIComponent(paymentId)}`, {
          headers: { Authorization: `Bearer ${configuration.apiKey}` }
        });
        const zeffyBody = await zeffyResponse.json().catch(() => ({}));
        verificationStatus = zeffyResponse.status;
        if (!zeffyResponse.ok) {
          continue;
        }
        const payment = zeffyBody.data || zeffyBody;
        if (zeffyPaymentMatchesConfiguration(payment, configuration, configurations.length)) {
          verifiedPayment = payment;
          matchedConfiguration = configuration;
          break;
        }
      }
      if (!verifiedPayment) {
        const error = new Error(`Unable to verify Zeffy payment (${verificationStatus}).`);
        error.status = verificationStatus >= 500 || verificationStatus === 429 ? 502 : 400;
        throw error;
      }
      const persistedDonation = await persistVerifiedZeffyPayment(
        verifiedPayment,
        campaigns,
        matchedConfiguration?.campaign || null
      );
      await syncCampaignRaisedTotal({
        campaignId: persistedDonation.campaignId,
        campaignName: persistedDonation.campaignName
      });

      sendJson(response, 200, {
        ok: true,
        received: true,
        data: {
          id: persistedDonation.id,
          receiptId: persistedDonation.receiptId,
          paymentStatus: persistedDonation.paymentStatus
        }
      });
    } catch (error) {
      sendJson(response, error.status || 400, {
        ok: false,
        message: error.message || 'Unable to process Zeffy webhook event.'
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donations' && request.method === 'GET') {
    await reconcilePaidPendingDonations();
    try {
      await reconcileZeffyDonations();
    } catch (error) {
      logServerError(error, '[donations] Zeffy reconciliation failed');
    }
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, [
        'id', 'receiptId', 'sourcePendingId', 'campaignId', 'campaignName', 'donorName', 'donorEmail', 'amount',
        'frequency', 'paymentProvider', 'paymentStatus', 'gatewayTransactionId', 'stripeSessionId', 'stripeEventId',
        'createdAt', 'emailSent', 'source', 'phone', 'address', 'donationPurpose', 'notes'
      ]);
      readStringField(body, 'id', { max: 160, pattern: simpleIdPattern });
      readStringField(body, 'receiptId', { max: 160, pattern: simpleIdPattern });
      readStringField(body, 'sourcePendingId', { max: 160, pattern: simpleIdPattern });
      readNumberField(body, 'campaignId', { integer: true, min: 1, max: 1000000000 });
      readStringField(body, 'campaignName', { max: 180 });
      readStringField(body, 'donorName', { max: 140 });
      readEmailField(body, 'donorEmail', { required: false });
      readNumberField(body, 'amount', { required: true, min: 0.01, max: 500000 });
      readStringField(body, 'frequency', { max: 40 });
      readStringField(body, 'paymentProvider', { max: 40 });
      readStringField(body, 'paymentStatus', { max: 40 });
      readStringField(body, 'gatewayTransactionId', { max: 180 });
      readStringField(body, 'stripeSessionId', { max: 180 });
      readStringField(body, 'stripeEventId', { max: 180 });
      const createdAt = readStringField(body, 'createdAt', { max: 64 });
      if (createdAt) {
        assertInput(!Number.isNaN(new Date(createdAt).getTime()), 'createdAt must be a valid ISO date string.');
      }
      readBooleanField(body, 'emailSent');
      readStringField(body, 'source', { max: 80 });
      readStringField(body, 'phone', { max: 40 });
      readStringField(body, 'address', { max: 240 });
      readStringField(body, 'donationPurpose', { max: 240 });
      readStringField(body, 'notes', { max: 1000 });
      const data = await upsertDonation(body);
      await syncCampaignRaisedTotal({ campaignId: data?.campaignId, campaignName: data?.campaignName });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      const isDuplicateReceipt = error?.code === '23505' && String(error?.constraint || '') === 'uq_donations_receipt_id';
      sendJson(response, isDuplicateReceipt ? 409 : (error.status || 500), {
        ok: false,
        message: isDuplicateReceipt
          ? 'This receipt number already exists. Enter a unique Gurdwara receipt number.'
          : (error.message || 'Unable to upsert donation.')
      });
    }
    return;
  }

  if (requestUrl.pathname === '/api/donations/email-invoice' && request.method === 'POST') {
    try {
      const body = await parseJsonObjectBody(request, { maxBytes: maxUploadBytes * 2, allowEmpty: false });
      ensureNoUnknownKeys(body, ['donation', 'campaignDescription', 'organizationName', 'address', 'phone', 'fileName', 'attachmentBase64']);
      const donation = readObjectField(body, 'donation', { required: true });
      ensureNoUnknownKeys(donation, ['id', 'receiptId']);
      const donationId = readStringField(donation, 'id', { max: 160, pattern: simpleIdPattern });
      const receiptId = readStringField(donation, 'receiptId', { max: 160, pattern: simpleIdPattern });
      assertInput(Boolean(donationId || receiptId), 'donation.id or donation.receiptId is required.');
      readStringField(body, 'campaignDescription', { max: 500 });
      readStringField(body, 'organizationName', { max: 180 });
      readStringField(body, 'address', { max: 300 });
      readStringField(body, 'phone', { max: 40 });
      readStringField(body, 'fileName', { max: 180, pattern: /^[A-Za-z0-9._-]+$/ });
      readStringField(body, 'attachmentBase64', { required: true, max: maxUploadBytes * 3 });
      const data = await sendDonationInvoiceEmail(body || {});
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to send donation invoice email.'
      });
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, [
        'name', 'description', 'target', 'raised', 'startDate', 'endDate', 'active', 'isActive',
        'progressTitle', 'progressDescription', 'progressPhotos', 'progressUpdates', 'progressItems', 'storyBlocks',
        'paymentProvider', 'paymentLink', 'stripeBuyButtonId', 'stripePublishableKey', 'zeffyApiKey'
      ]);
      readStringField(body, 'name', { required: true, min: 2, max: 180 });
      readStringField(body, 'description', { max: 1000 });
      readStringField(body, 'progressTitle', { max: 180 });
      readStringField(body, 'progressDescription', { max: 5000 });
      readNumberField(body, 'target', { min: 0, max: 500000000 });
      readNumberField(body, 'raised', { min: 0, max: 500000000 });
      const startDate = readStringField(body, 'startDate', { max: 64 });
      const endDate = readStringField(body, 'endDate', { max: 64 });
      if (startDate) {
        assertInput(!Number.isNaN(new Date(startDate).getTime()), 'startDate must be a valid date string.');
      }
      if (endDate) {
        assertInput(!Number.isNaN(new Date(endDate).getTime()), 'endDate must be a valid date string.');
      }
      const progressPhotos = readArrayField(body, 'progressPhotos', { max: 200 });
      if (progressPhotos) {
        progressPhotos.forEach((entry, index) => {
          assertInput(typeof entry === 'string', `progressPhotos[${index}] must be a string.`);
          assertInput(String(entry).trim().length <= 1200, `progressPhotos[${index}] must be at most 1200 characters.`);
        });
      }
      const progressUpdates = readArrayField(body, 'progressUpdates', { max: 200 });
      if (progressUpdates) {
        progressUpdates.forEach((entry, index) => {
          validateGenericJsonValue(entry, `progressUpdates[${index}]`, 0);
        });
      }
      const progressItems = readArrayField(body, 'progressItems', { max: 500 });
      if (progressItems) {
        progressItems.forEach((entry, index) => {
          validateGenericJsonValue(entry, `progressItems[${index}]`, 0);
        });
      }
      const storyBlocks = readArrayField(body, 'storyBlocks', { max: 500 });
      if (storyBlocks) {
        storyBlocks.forEach((entry, index) => {
          validateGenericJsonValue(entry, `storyBlocks[${index}]`, 0);
        });
      }
      const paymentProviderRaw = readStringField(body, 'paymentProvider', { max: 20 });
      const paymentProvider = String(paymentProviderRaw || '').trim().toUpperCase();
      if (paymentProvider) {
        assertInput(['STRIPE', 'PAYPAL', 'ZEFFY'].includes(paymentProvider), 'paymentProvider must be STRIPE, PAYPAL, or ZEFFY.');
      }
      const paymentLink = readStringField(body, 'paymentLink', { max: 1200 });
      if (paymentLink) {
        assertInput(/^https?:\/\//i.test(paymentLink), 'paymentLink must be a valid http/https URL.');
      }
      readStringField(body, 'stripeBuyButtonId', { max: 180 });
      readStringField(body, 'stripePublishableKey', { max: 240 });
      const zeffyApiKeyValue = readStringField(body, 'zeffyApiKey', { max: 1200 });
      if (paymentProvider === 'ZEFFY') {
        assertInput(Boolean(paymentLink), 'paymentLink is required for Zeffy campaigns.');
        assertInput(Boolean(zeffyApiKeyValue), 'zeffyApiKey is required for Zeffy campaigns.');
        await validateZeffyCampaignConfiguration({
          name: body.name,
          paymentLink,
          apiKey: zeffyApiKeyValue
        });
      }
      readBooleanField(body, 'active');
      readBooleanField(body, 'isActive');
      const data = await createDonationCampaign(body);
      await appendAuditLog(request, {
        action: 'donation.campaign.create',
        targetType: 'donation-campaign',
        targetId: String(data?.id || ''),
        description: `Created campaign ${String(data?.name || '')}`,
        payload: {
          ...body,
          ...(body.zeffyApiKey ? { zeffyApiKey: '[REDACTED]' } : {})
        }
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to create donation campaign.' });
    }
    return;
  }

  const campaignIdMatch = requestUrl.pathname.match(/^\/api\/donation-campaigns\/([^/]+)$/);
  if (campaignIdMatch && request.method === 'PATCH') {
    try {
      const id = parseNumericPathId(decodeURIComponent(campaignIdMatch[1]), 'campaign id');
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, [
        'name', 'description', 'target', 'raised', 'startDate', 'endDate', 'active', 'isActive',
        'progressTitle', 'progressDescription', 'progressPhotos', 'progressUpdates', 'progressItems', 'storyBlocks',
        'paymentProvider', 'paymentLink', 'stripeBuyButtonId', 'stripePublishableKey', 'zeffyApiKey'
      ]);
      readStringField(body, 'name', { min: 2, max: 180 });
      readStringField(body, 'description', { max: 1000 });
      readStringField(body, 'progressTitle', { max: 180 });
      readStringField(body, 'progressDescription', { max: 5000 });
      readNumberField(body, 'target', { min: 0, max: 500000000 });
      readNumberField(body, 'raised', { min: 0, max: 500000000 });
      const startDate = readStringField(body, 'startDate', { max: 64 });
      const endDate = readStringField(body, 'endDate', { max: 64 });
      if (startDate) {
        assertInput(!Number.isNaN(new Date(startDate).getTime()), 'startDate must be a valid date string.');
      }
      if (endDate) {
        assertInput(!Number.isNaN(new Date(endDate).getTime()), 'endDate must be a valid date string.');
      }
      const progressPhotos = readArrayField(body, 'progressPhotos', { max: 200 });
      if (progressPhotos) {
        progressPhotos.forEach((entry, index) => {
          assertInput(typeof entry === 'string', `progressPhotos[${index}] must be a string.`);
          assertInput(String(entry).trim().length <= 1200, `progressPhotos[${index}] must be at most 1200 characters.`);
        });
      }
      const progressUpdates = readArrayField(body, 'progressUpdates', { max: 200 });
      if (progressUpdates) {
        progressUpdates.forEach((entry, index) => {
          validateGenericJsonValue(entry, `progressUpdates[${index}]`, 0);
        });
      }
      const progressItems = readArrayField(body, 'progressItems', { max: 500 });
      if (progressItems) {
        progressItems.forEach((entry, index) => {
          validateGenericJsonValue(entry, `progressItems[${index}]`, 0);
        });
      }
      const storyBlocks = readArrayField(body, 'storyBlocks', { max: 500 });
      if (storyBlocks) {
        storyBlocks.forEach((entry, index) => {
          validateGenericJsonValue(entry, `storyBlocks[${index}]`, 0);
        });
      }
      const paymentProviderRaw = readStringField(body, 'paymentProvider', { max: 20 });
      const paymentProvider = String(paymentProviderRaw || '').trim().toUpperCase();
      if (paymentProvider) {
        assertInput(['STRIPE', 'PAYPAL', 'ZEFFY'].includes(paymentProvider), 'paymentProvider must be STRIPE, PAYPAL, or ZEFFY.');
      }
      const paymentLink = readStringField(body, 'paymentLink', { max: 1200 });
      if (paymentLink) {
        assertInput(/^https?:\/\//i.test(paymentLink), 'paymentLink must be a valid http/https URL.');
      }
      readStringField(body, 'stripeBuyButtonId', { max: 180 });
      readStringField(body, 'stripePublishableKey', { max: 240 });
      const zeffyApiKeyValue = readStringField(body, 'zeffyApiKey', { max: 1200 });
      if (paymentProvider === 'ZEFFY') {
        assertInput(Boolean(normalizeZeffyCampaignSlug(paymentLink)), 'paymentLink must be a valid Zeffy donation form URL.');
      }
      if (paymentProvider === 'ZEFFY' && zeffyApiKeyValue) {
        await validateZeffyCampaignConfiguration({
          name: body.name,
          paymentLink,
          apiKey: zeffyApiKeyValue
        });
      }
      readBooleanField(body, 'active');
      readBooleanField(body, 'isActive');
      const data = await updateDonationCampaign(id, body);
      await appendAuditLog(request, {
        action: 'donation.campaign.update',
        targetType: 'donation-campaign',
        targetId: String(id),
        description: `Updated campaign ${String(id)}`,
        payload: {
          ...body,
          ...(body.zeffyApiKey ? { zeffyApiKey: '[REDACTED]' } : {})
        }
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to update donation campaign.' });
    }
    return;
  }

  if (campaignIdMatch && request.method === 'DELETE') {
    try {
      const id = parseNumericPathId(decodeURIComponent(campaignIdMatch[1]), 'campaign id');
      const data = await removeDonationCampaign(id);
      await appendAuditLog(request, {
        action: 'donation.campaign.delete',
        targetType: 'donation-campaign',
        targetId: String(id),
        description: `Deleted campaign ${String(id)}`
      });
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to remove donation campaign.' });
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, [
        'id', 'campaignId', 'campaignName', 'donorName', 'donorEmail', 'amount', 'amountCents', 'frequency', 'paymentProvider',
        'sessionId', 'paymentIntentId', 'checkoutUrl', 'origin', 'donationPurpose', 'createdAt', 'metadata'
      ]);
      readStringField(body, 'id', { max: 160, pattern: simpleIdPattern });
      readNumberField(body, 'campaignId', { integer: true, min: 1, max: 1000000000 });
      readStringField(body, 'campaignName', { max: 180 });
      readStringField(body, 'donorName', { max: 140 });
      readEmailField(body, 'donorEmail', { required: false });
      readNumberField(body, 'amount', { min: 0.01, max: 500000 });
      readNumberField(body, 'amountCents', { integer: true, min: 1, max: 50000000 });
      readStringField(body, 'frequency', { max: 40 });
      readStringField(body, 'paymentProvider', { max: 40 });
      readStringField(body, 'sessionId', { max: 180 });
      readStringField(body, 'paymentIntentId', { max: 180 });
      const checkoutUrl = readStringField(body, 'checkoutUrl', { max: 2000 });
      if (checkoutUrl) {
        assertInput(/^https?:\/\//i.test(checkoutUrl), 'checkoutUrl must be a valid http/https URL.');
      }
      const origin = readStringField(body, 'origin', { max: 300 });
      if (origin) {
        assertInput(/^https?:\/\//i.test(origin), 'origin must be a valid http/https URL.');
      }
      readStringField(body, 'donationPurpose', { max: 240 });
      const createdAt = readStringField(body, 'createdAt', { max: 64 });
      if (createdAt) {
        assertInput(!Number.isNaN(new Date(createdAt).getTime()), 'createdAt must be a valid ISO date string.');
      }
      const metadata = readObjectField(body, 'metadata');
      if (metadata) {
        validateGenericJsonValue(metadata, 'metadata', 0);
      }
      const data = await createPendingDonation(body);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to create pending donation.' });
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
      const id = parseStringPathId(decodeURIComponent(pendingIdMatch[1]), 'pending id');
      const data = await removePendingDonation(id);
      sendJson(response, 200, { ok: true, data });
    } catch (error) {
      sendJson(response, error.status || 500, { ok: false, message: error.message || 'Unable to remove pending donation.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/users' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, data: readUsers() });
    return;
  }

  if (requestUrl.pathname === '/api/users/by-email' && request.method === 'GET') {
    const email = String(requestUrl.searchParams.get('email') || '').trim().toLowerCase();
    if (!email || !emailPattern.test(email)) {
      sendJson(response, 400, { ok: false, message: 'email query param must be a valid email.' });
      return;
    }
    sendJson(response, 200, { ok: true, data: getUserByEmail(email) });
    return;
  }

  if (requestUrl.pathname === '/api/users/upsert-by-email' && request.method === 'POST') {
    try {
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['id', 'name', 'role', 'email', 'phone', 'address', 'memberType', 'authProvider', 'avatarUrl', 'picture', 'registrationComplete', 'isActive', 'approvalStatus', 'approvalUpdatedAt', 'adminPageAccess']);
      readStringField(body, 'id', { max: 120, pattern: simpleIdPattern });
      readStringField(body, 'name', { max: 140 });
      readStringField(body, 'role', { max: 40 });
      readEmailField(body, 'email', { required: true });
      readStringField(body, 'phone', { max: 40 });
      readStringField(body, 'address', { max: 240 });
      readStringField(body, 'memberType', { max: 40 });
      readStringField(body, 'authProvider', { max: 40 });
      readStringField(body, 'avatarUrl', { max: 600 });
      readStringField(body, 'picture', { max: 600 });
      readBooleanField(body, 'registrationComplete');
      readBooleanField(body, 'isActive');
      readStringField(body, 'approvalStatus', { max: 20 });
      readStringField(body, 'approvalUpdatedAt', { max: 64 });
      const adminPageAccess = readArrayField(body, 'adminPageAccess', { max: 50 });
      if (adminPageAccess) {
        adminPageAccess.forEach((entry, index) => {
          assertInput(typeof entry === 'string', `adminPageAccess[${index}] must be a string.`);
          assertInput(ADMIN_PAGE_PATHS.includes(String(entry).trim()), `adminPageAccess[${index}] is not an allowed path.`);
        });
      }
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['email', 'name', 'phone', 'address', 'role', 'memberType', 'avatarUrl']);
      readEmailField(body, 'email', { required: true });
      readStringField(body, 'name', { min: 2, max: 140 });
      readStringField(body, 'phone', { max: 40 });
      readStringField(body, 'address', { max: 240 });
      readStringField(body, 'role', { max: 40 });
      readStringField(body, 'memberType', { max: 40 });
      readStringField(body, 'avatarUrl', { max: 600 });
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
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['id', 'name', 'role', 'email', 'phone', 'address', 'memberType', 'authProvider', 'avatarUrl', 'picture', 'registrationComplete', 'isActive', 'approvalStatus', 'adminPageAccess']);
      readStringField(body, 'id', { max: 120, pattern: simpleIdPattern });
      readStringField(body, 'name', { required: true, min: 2, max: 140 });
      readStringField(body, 'role', { max: 40 });
      readEmailField(body, 'email', { required: true });
      readStringField(body, 'phone', { max: 40 });
      readStringField(body, 'address', { max: 240 });
      readStringField(body, 'memberType', { max: 40 });
      readStringField(body, 'authProvider', { max: 40 });
      readStringField(body, 'avatarUrl', { max: 600 });
      readStringField(body, 'picture', { max: 600 });
      readBooleanField(body, 'registrationComplete');
      readBooleanField(body, 'isActive');
      readStringField(body, 'approvalStatus', { max: 20 });
      const adminPageAccess = readArrayField(body, 'adminPageAccess', { max: 50 });
      if (adminPageAccess) {
        adminPageAccess.forEach((entry, index) => {
          assertInput(typeof entry === 'string', `adminPageAccess[${index}] must be a string.`);
          assertInput(ADMIN_PAGE_PATHS.includes(String(entry).trim()), `adminPageAccess[${index}] is not an allowed path.`);
        });
      }
      const record = normalizeUser({
        ...body,
        id: body.id || `user-${Date.now()}`,
        isActive: body.isActive !== false,
        approvalStatus: body.approvalStatus || 'pending',
        approvalUpdatedAt: new Date().toISOString()
      });
      const next = [record, ...readUsers()];
      writeUsers(next);
      sendJson(response, 200, { ok: true, data: record });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to create user.'
      });
    }
    return;
  }

  const approvalPathMatch = requestUrl.pathname.match(/^\/api\/users\/([^/]+)\/approval$/);
  if (approvalPathMatch && request.method === 'PATCH') {
    try {
      const id = parseStringPathId(decodeURIComponent(approvalPathMatch[1]), 'user id');
      const body = await parseJsonObjectBody(request, { maxBytes: 64 * 1024, allowEmpty: false });
      ensureNoUnknownKeys(body, ['approvalStatus']);
      const nextApprovalStatus = readStringField(body, 'approvalStatus', { required: true, max: 20, toLowerCase: true });
      assertInput(['approved', 'pending', 'rejected'].includes(nextApprovalStatus), 'approvalStatus must be approved, pending, or rejected.');
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
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to update approval status.'
      });
    }
    return;
  }

  const userPathMatch = requestUrl.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userPathMatch && request.method === 'PATCH') {
    try {
      const id = parseStringPathId(decodeURIComponent(userPathMatch[1]), 'user id');
      const body = await parseJsonObjectBody(request, { maxBytes: maxJsonBodyBytes, allowEmpty: false });
      ensureNoUnknownKeys(body, ['name', 'role', 'email', 'phone', 'address', 'memberType', 'authProvider', 'avatarUrl', 'picture', 'registrationComplete', 'isActive', 'approvalStatus', 'adminPageAccess']);
      readStringField(body, 'name', { min: 2, max: 140 });
      readStringField(body, 'role', { max: 40 });
      readEmailField(body, 'email', { required: false });
      readStringField(body, 'phone', { max: 40 });
      readStringField(body, 'address', { max: 240 });
      readStringField(body, 'memberType', { max: 40 });
      readStringField(body, 'authProvider', { max: 40 });
      readStringField(body, 'avatarUrl', { max: 600 });
      readStringField(body, 'picture', { max: 600 });
      readBooleanField(body, 'registrationComplete');
      readBooleanField(body, 'isActive');
      readStringField(body, 'approvalStatus', { max: 20 });
      const adminPageAccess = readArrayField(body, 'adminPageAccess', { max: 50 });
      if (adminPageAccess) {
        adminPageAccess.forEach((entry, index) => {
          assertInput(typeof entry === 'string', `adminPageAccess[${index}] must be a string.`);
          assertInput(ADMIN_PAGE_PATHS.includes(String(entry).trim()), `adminPageAccess[${index}] is not an allowed path.`);
        });
      }
      const users = readUsers();
      const targetUser = users.find((user) => user.id === id) || null;
      assertInput(Boolean(targetUser), 'User not found.');

      const changedRoleToMember = String(targetUser?.role || '').trim().toLowerCase() !== 'member'
        && String(body?.role || '').trim().toLowerCase() === 'member';
      const validatedBody = enforceUserMembershipActivity({
        ...targetUser,
        ...body,
        ...(changedRoleToMember ? { membershipFeeRecords: [] } : {}),
        id
      }, body);

      const next = users.map((user) => (
        user.id === id ? normalizeUser({ ...user, ...validatedBody, id, createdAt: user.createdAt }) : user
      ));
      const updatedUser = next.find((user) => user.id === id) || null;

      if (targetUser?.isActive !== false && updatedUser?.isActive === false && eventsDb.hasDatabaseConnection) {
        await eventsDb.markUserRegistrationsDormant({
          userId: updatedUser.id,
          email: updatedUser.email,
          contact: updatedUser.phone
        });
      }

      writeUsers(next);
      sendJson(response, 200, { ok: true, data: updatedUser });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to update user.'
      });
    }
    return;
  }

  if (userPathMatch && request.method === 'DELETE') {
    try {
      const id = parseStringPathId(decodeURIComponent(userPathMatch[1]), 'user id');
      const users = readUsers();
      const targetUser = users.find((user) => user.id === id) || null;
      assertInput(Boolean(targetUser), 'User not found.');

      if (eventsDb.hasDatabaseConnection) {
        await eventsDb.purgeUserRegistrations({
          userId: targetUser.id,
          email: targetUser.email,
          contact: targetUser.phone,
          name: targetUser.name
        });
      }

      const next = readUsers().filter((user) => user.id !== id);
      writeUsers(next);
      sendJson(response, 200, { ok: true, data: { success: true } });
    } catch (error) {
      sendJson(response, error.status || 500, {
        ok: false,
        message: error.message || 'Unable to delete user.',
        details: error.details || null
      });
    }
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
      logServerError(error, 'Failed to initialize events database');
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
      logServerError(error, 'Volunteer reminder sweep failed');
    });
  }, 60 * 1000);

  // Run one immediate scheduler check on startup in case the server starts after today's send time.
  runScheduledVolunteerReminderSweep().catch((error) => {
    logServerError(error, 'Initial volunteer reminder scheduler check failed');
  });

  // Event reminders use the same minute cadence but maintain their own send window and dedupe log.
  setInterval(() => {
    runScheduledEventReminderSweep().catch((error) => {
      logServerError(error, 'Event reminder sweep failed');
    });
  }, 60 * 1000);

  runScheduledEventReminderSweep().catch((error) => {
    logServerError(error, 'Initial event reminder scheduler check failed');
  });

  const zeffyReconciliationTimer = setInterval(() => {
    reconcileZeffyDonations().catch((error) => {
      logServerError(error, 'Zeffy donation reconciliation failed');
    });
  }, 60 * 1000);
  if (typeof zeffyReconciliationTimer.unref === 'function') {
    zeffyReconciliationTimer.unref();
  }

  reconcileZeffyDonations({ force: true }).then((result) => {
    if (result.imported > 0) {
      console.log(`Imported ${result.imported} missing Zeffy donation(s).`);
    }
  }).catch((error) => {
    logServerError(error, 'Initial Zeffy donation reconciliation failed');
  });
};

bootstrap();
