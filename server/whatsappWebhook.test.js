const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createWhatsAppWebhookHandler, WHATSAPP_WEBHOOK_PATH } = require('./whatsappWebhook');

const call = async (handler, method, url, { body = '', headers = {} } = {}) => {
  const response = {
    writeHead(status, nextHeaders) { this.status = status; this.headers = nextHeaders; },
    end(text) { this.text = text; }
  };
  const request = {
    method,
    headers,
    async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); }
  };
  await handler(request, response, new URL(url, 'https://example.org'));
  return response;
};

test('WhatsApp webhook echoes Meta subscription challenge for matching verify token', async () => {
  const handler = createWhatsAppWebhookHandler({ verifyToken: 'private-verify-token' });
  const result = await call(handler, 'GET', `${WHATSAPP_WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=private-verify-token&hub.challenge=123456`);
  assert.equal(result.status, 200);
  assert.equal(result.text, '123456');
});

test('WhatsApp webhook rejects wrong verification token', async () => {
  const handler = createWhatsAppWebhookHandler({ verifyToken: 'private-verify-token' });
  const result = await call(handler, 'GET', `${WHATSAPP_WEBHOOK_PATH}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456`);
  assert.equal(result.status, 403);
});

test('WhatsApp webhook accepts valid Meta HMAC and acknowledges callback', async () => {
  const appSecret = 'meta-app-secret';
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'business-id' }] });
  const signature = `sha256=${crypto.createHmac('sha256', appSecret).update(body).digest('hex')}`;
  const received = [];
  const handler = createWhatsAppWebhookHandler({ appSecret, onEvent: (event) => received.push(event) });
  const result = await call(handler, 'POST', WHATSAPP_WEBHOOK_PATH, { body, headers: { 'x-hub-signature-256': signature } });
  assert.equal(result.status, 200);
  assert.equal(result.text, 'EVENT_RECEIVED');
  assert.equal(received[0].object, 'whatsapp_business_account');
});

test('WhatsApp webhook rejects invalid signature and unsupported methods', async () => {
  const handler = createWhatsAppWebhookHandler({ appSecret: 'meta-app-secret' });
  const invalidSignature = await call(handler, 'POST', WHATSAPP_WEBHOOK_PATH, { body: '{}', headers: { 'x-hub-signature-256': 'sha256=invalid' } });
  const wrongMethod = await call(handler, 'PUT', WHATSAPP_WEBHOOK_PATH);
  assert.equal(invalidSignature.status, 401);
  assert.equal(wrongMethod.status, 405);
});

test('WhatsApp webhook accepts payloads up to Meta 3 MB limit and rejects larger bodies', async () => {
  const appSecret = 'meta-app-secret';
  const body = JSON.stringify({ payload: 'x'.repeat(3 * 1024 * 1024 - 20) });
  const signature = `sha256=${crypto.createHmac('sha256', appSecret).update(body).digest('hex')}`;
  const handler = createWhatsAppWebhookHandler({ appSecret });
  const accepted = await call(handler, 'POST', WHATSAPP_WEBHOOK_PATH, { body, headers: { 'x-hub-signature-256': signature } });
  const oversized = await call(handler, 'POST', WHATSAPP_WEBHOOK_PATH, { body: `${body}${'x'.repeat(100)}`, headers: { 'x-hub-signature-256': signature } });
  assert.equal(accepted.status, 200);
  assert.equal(oversized.status, 413);
});
