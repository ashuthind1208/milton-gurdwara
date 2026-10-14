const crypto = require('crypto');

const WHATSAPP_WEBHOOK_PATH = '/api/webhooks/whatsapp';
const MAX_WEBHOOK_BYTES = 3 * 1024 * 1024;

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

const verifyWhatsAppSignature = (rawBody, signature, appSecret) => {
  if (!appSecret || !signature) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return safeEqual(signature, expected);
};

const createWhatsAppWebhookHandler = ({ verifyToken = '', appSecret = '', onEvent = () => {} } = {}) => async (request, response, requestUrl) => {
  if (requestUrl.pathname !== WHATSAPP_WEBHOOK_PATH) return false;

  const sendText = (status, text) => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(text);
  };

  if (request.method === 'GET') {
    const mode = requestUrl.searchParams.get('hub.mode');
    const suppliedToken = requestUrl.searchParams.get('hub.verify_token');
    const challenge = requestUrl.searchParams.get('hub.challenge');
    if (mode !== 'subscribe' || !safeEqual(suppliedToken, verifyToken) || !challenge) {
      sendText(403, 'Webhook verification failed.');
      return true;
    }
    sendText(200, challenge);
    return true;
  }

  if (request.method !== 'POST') {
    sendText(405, 'Method not allowed.');
    return true;
  }

  if (!appSecret) {
    sendText(503, 'Webhook signature verification is not configured.');
    return true;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_WEBHOOK_BYTES) {
      sendText(413, 'Payload too large.');
      return true;
    }
    chunks.push(buffer);
  }
  const rawBody = Buffer.concat(chunks);
  if (!verifyWhatsAppSignature(rawBody, request.headers?.['x-hub-signature-256'], appSecret)) {
    sendText(401, 'Invalid webhook signature.');
    return true;
  }

  try {
    onEvent(JSON.parse(rawBody.toString('utf8')));
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendText(400, 'Invalid JSON payload.');
      return true;
    }
    throw error;
  }
  sendText(200, 'EVENT_RECEIVED');
  return true;
};

module.exports = { WHATSAPP_WEBHOOK_PATH, createWhatsAppWebhookHandler, verifyWhatsAppSignature };