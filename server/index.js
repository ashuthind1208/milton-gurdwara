const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const Stripe = require('stripe');

const port = Number(process.env.PORT || 4242);
const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const stripeCurrency = String(process.env.STRIPE_CURRENCY || 'cad').toLowerCase();
const dataDir = path.resolve(__dirname, 'data');
const donationsPath = path.join(dataDir, 'donations.json');
const usersPath = path.join(dataDir, 'users.json');

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
    'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
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

const ensureStorage = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(donationsPath)) {
    fs.writeFileSync(donationsPath, '[]', 'utf8');
  }
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify(seedUsers, null, 2), 'utf8');
  }
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

const readDonations = () => {
  ensureStorage();
  try {
    const content = fs.readFileSync(donationsPath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeDonations = (records) => {
  ensureStorage();
  fs.writeFileSync(donationsPath, JSON.stringify(records, null, 2), 'utf8');
};

const upsertDonation = (record) => {
  const allDonations = readDonations();
  const matchIndex = allDonations.findIndex((entry) => (
    String(entry.stripeSessionId || '') === String(record.stripeSessionId || '') ||
    (
      String(entry.gatewayTransactionId || '') &&
      String(record.gatewayTransactionId || '') &&
      String(entry.gatewayTransactionId) === String(record.gatewayTransactionId)
    )
  ));

  if (matchIndex >= 0) {
    const next = [...allDonations];
    next[matchIndex] = {
      ...next[matchIndex],
      ...record
    };
    writeDonations(next);
    return next[matchIndex];
  }

  const next = [record, ...allDonations];
  writeDonations(next);
  return record;
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
      webhookConfigured: Boolean(stripeWebhookSecret)
    });
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
        upsertDonation(donationRecord);
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
    const data = readDonations().sort((left, right) => {
      const l = new Date(left.createdAt || 0).getTime();
      const r = new Date(right.createdAt || 0).getTime();
      return r - l;
    });
    sendJson(response, 200, { ok: true, data });
    return;
  }

  if (requestUrl.pathname === '/api/donations/summary' && request.method === 'GET') {
    const summary = summarizeByCampaign(readDonations());
    sendJson(response, 200, { ok: true, data: summary });
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

server.listen(port, () => {
  console.log(`Stripe API helper listening on http://127.0.0.1:${port}`);
});
