const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const Stripe = require('stripe');

const port = Number(process.env.PORT || 4242);
const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
const stripeCurrency = String(process.env.STRIPE_CURRENCY || 'cad').toLowerCase();
const youtubeApiKey = String(process.env.YOUTUBE_API_KEY || '').trim();
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
  if (!youtubeApiKey) {
    const error = new Error('YOUTUBE_API_KEY is not configured on the server.');
    error.status = 500;
    throw error;
  }

  const parsedSource = parseYouTubeChannelSource(source);
  if (!parsedSource) {
    const error = new Error('Enter a YouTube channel URL, handle, or channel ID.');
    error.status = 400;
    throw error;
  }

  const fetchVideoDetails = async (videoId) => {
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

  let channelId = parsedSource.value;

  if (parsedSource.type === 'handle') {
    const channelLookupUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    channelLookupUrl.searchParams.set('part', 'id');
    channelLookupUrl.searchParams.set('forHandle', parsedSource.value);
    channelLookupUrl.searchParams.set('key', youtubeApiKey);

    const channelResponse = await fetch(channelLookupUrl);
    const channelPayload = await channelResponse.json();
    channelId = channelPayload?.items?.[0]?.id || '';

    if (!channelResponse.ok || !channelId) {
      const error = new Error('Unable to resolve the YouTube channel handle.');
      error.status = 404;
      throw error;
    }
  }

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('channelId', channelId);
  searchUrl.searchParams.set('eventType', 'live');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', '1');
  searchUrl.searchParams.set('key', youtubeApiKey);

  const searchResponse = await fetch(searchUrl);
  const searchPayload = await searchResponse.json();
  const liveItem = searchPayload?.items?.[0] || null;
  let videoId = liveItem?.id?.videoId || '';

  if (!videoId) {
    videoId = await resolveLiveVideoIdFromChannelPage(parsedSource.type, parsedSource.value, channelId);
  }

  if (!videoId) {
    return {
      available: false,
      reason: searchResponse.ok ? 'not_live' : 'lookup_failed',
      checkedAt: new Date().toISOString(),
      channelId,
      videoId: '',
      title: '',
      channelTitle: '',
      concurrentViewers: null,
      totalViews: null,
      embedUrl: '',
      watchUrl: ''
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
