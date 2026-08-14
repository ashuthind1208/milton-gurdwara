const assert = require('assert/strict');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    if (Object.prototype.hasOwnProperty.call(process.env, key)) return;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  });
};

const workspaceRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(workspaceRoot, '.env'));
loadEnvFile(path.join(workspaceRoot, '.env.local'));

const db = require('../server/db/mysql');
const apiPort = 4243;
const smtpPort = 2526;
const smtpProvider = String(process.env.NEWSLETTER_SMOKE_SMTP_PROVIDER || 'gmail').trim().toLowerCase();
const marker = `newsletter-smoke-${Date.now()}`;
const subscribers = [
  { id: `${marker}-one`, email: `${marker}-one@example.com`, active: true, interests: ['Test'] },
  { id: `${marker}-two`, email: `${marker}-two@example.com`, active: true, interests: ['Test'] }
];
const capturedMessages = [];
let backend = null;

const createSmtpCapture = () => net.createServer((socket) => {
  let buffer = '';
  let dataMode = false;
  let recipients = [];
  socket.setEncoding('utf8');
  socket.write('220 localhost newsletter smoke SMTP\r\n');
  socket.on('data', (chunk) => {
    buffer += chunk;
    while (buffer.length > 0) {
      if (dataMode) {
        const endIndex = buffer.indexOf('\r\n.\r\n');
        if (endIndex < 0) return;
        capturedMessages.push({ recipients: [...recipients], raw: buffer.slice(0, endIndex) });
        buffer = buffer.slice(endIndex + 5);
        recipients = [];
        dataMode = false;
        socket.write('250 2.0.0 queued\r\n');
        continue;
      }
      const lineEnd = buffer.indexOf('\r\n');
      if (lineEnd < 0) return;
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      if (/^(EHLO|HELO)\b/i.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 PIPELINING\r\n');
      else if (/^AUTH PLAIN\b/i.test(line)) socket.write('235 2.7.0 authentication successful\r\n');
      else if (/^MAIL FROM:/i.test(line)) socket.write('250 2.1.0 sender ok\r\n');
      else if (/^RCPT TO:/i.test(line)) {
        const match = line.match(/<([^>]+)>/);
        if (match) recipients.push(match[1].toLowerCase());
        socket.write('250 2.1.5 recipient ok\r\n');
      } else if (/^DATA$/i.test(line)) {
        dataMode = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (/^RSET$/i.test(line)) {
        recipients = [];
        socket.write('250 2.0.0 reset\r\n');
      } else if (/^NOOP$/i.test(line)) socket.write('250 2.0.0 ok\r\n');
      else if (/^QUIT$/i.test(line)) {
        socket.end('221 2.0.0 bye\r\n');
      } else socket.write('250 2.0.0 ok\r\n');
    }
  });
});

const listen = (server, port) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const waitForBackend = (child) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Newsletter smoke backend did not start.')), 10000);
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
    if (output.includes(`127.0.0.1:${apiPort}`)) {
      clearTimeout(timeout);
      resolve();
    }
  });
  child.stderr.on('data', (chunk) => { output += String(chunk); });
  child.once('exit', (code) => {
    clearTimeout(timeout);
    reject(new Error(`Newsletter smoke backend exited with code ${code}: ${output}`));
  });
});

const closeServer = (server) => new Promise((resolve) => server.close(resolve));

const decodeQuotedPrintable = (value) => String(value || '')
  .replace(/=\r\n/g, '')
  .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

const cleanup = async (smtpServer) => {
  if (backend && backend.exitCode == null) backend.kill('SIGTERM');
  if (smtpServer.listening) await closeServer(smtpServer);
  if (db.pool) {
    for (const subscriber of subscribers) {
      await db.pool.execute('DELETE FROM app_items WHERE resource = ? AND id = ?', ['subscribers', subscriber.id]);
    }
    await db.pool.end();
  }
};

const run = async () => {
  assert.equal(db.hasDatabaseConnection, true, 'MySQL must be configured');
  for (const subscriber of subscribers) await db.createItem('subscribers', subscriber);

  const smtpServer = createSmtpCapture();
  try {
    await listen(smtpServer, smtpPort);
    backend = spawn(process.execPath, ['server/index.js'], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PORT: String(apiPort),
        SERVER_PORT: String(apiPort),
        STRIPE_API_PORT: String(apiPort),
        LOCAL_MAIL_TRANSPORT: 'smtp',
        SMTP_PROVIDER: smtpProvider,
        ...(smtpProvider === 'smtp2go'
          ? {
            SMTP2GO_HOST: '127.0.0.1',
            SMTP2GO_PORT: String(smtpPort),
            SMTP2GO_SECURE: 'false',
            SMTP2GO_USER: 'newsletter-smoke-smtp2go-user',
            SMTP2GO_PASS: 'newsletter-smoke-smtp2go-password',
            SMTP2GO_FROM: 'newsletter-smoke@example.com'
          }
          : {
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: String(smtpPort),
            SMTP_SECURE: 'false',
            SMTP_USER: 'newsletter-smoke-gmail-user',
            SMTP_PASS: 'newsletter-smoke-gmail-password',
            SMTP_FROM: 'newsletter-smoke@example.com'
          }),
        NEWSLETTER_UNSUBSCRIBE_SECRET: `${marker}-secret`,
        PUBLIC_SITE_URL: `http://127.0.0.1:${apiPort}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForBackend(backend);

    const relayResponse = await fetch(`http://127.0.0.1:${apiPort}/api/internal/mail-relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'newsletter',
        campaignId: marker,
        bccList: subscribers.map((entry) => entry.email),
        subject: marker,
        text: 'Newsletter smoke body',
        html: '<p>Newsletter smoke body</p>'
      })
    });
    const relayBody = await relayResponse.json();
    assert.equal(relayResponse.status, 200, JSON.stringify(relayBody));
    assert.equal(relayBody.provider, `smtp-${smtpProvider}`);
    assert.equal(relayBody.recipients, 0);
    assert.equal(relayBody.bccRecipients, 2);
    assert.equal(capturedMessages.length, 2);
    capturedMessages.forEach((message) => assert.equal(message.recipients.length, 1, 'each SMTP envelope must contain one BCC recipient'));
    assert.deepEqual(capturedMessages.flatMap((message) => message.recipients).sort(), subscribers.map((entry) => entry.email).sort());

    const unsubscribeUrls = capturedMessages.map((message) => {
      const decodedMessage = decodeQuotedPrintable(message.raw);
      const match = decodedMessage.match(/http:\/\/127\.0\.0\.1:4243\/api\/newsletter\/unsubscribe\?token=([^\s<"]+)/);
      assert.ok(match, 'captured message must contain an unsubscribe URL');
      return match[0].replace(/&amp;/g, '&');
    });
    assert.equal(new Set(unsubscribeUrls).size, 2, 'unsubscribe URLs must be recipient-specific');

    const firstMessageIndex = capturedMessages.findIndex((message) => message.recipients.includes(subscribers[0].email));
    const unsubscribeResponse = await fetch(unsubscribeUrls[firstMessageIndex]);
    assert.equal(unsubscribeResponse.status, 200);
    const storedSubscribers = await db.listItems('subscribers');
    assert.equal(storedSubscribers.find((entry) => entry.id === subscribers[0].id)?.active, false);
    assert.equal(storedSubscribers.find((entry) => entry.id === subscribers[1].id)?.active, true);

    console.log(JSON.stringify({
      ok: true,
      smtpProvider,
      messages: capturedMessages.length,
      recipientsPerMessage: capturedMessages.map((message) => message.recipients.length),
      distinctUnsubscribeLinks: new Set(unsubscribeUrls).size,
      unsubscribedOnlyFirstRecipient: true
    }, null, 2));
  } finally {
    await cleanup(smtpServer);
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
