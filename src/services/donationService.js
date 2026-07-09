import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-donation-campaigns';
const DONATION_STORAGE_KEY = 'ssm-donation-records';
const PENDING_DONATION_KEY = 'ssm-donation-pending';
const LAST_PENDING_DONATION_KEY = 'ssm-donation-last-pending-id';

const seedCampaigns = [
  {
    id: 1,
    name: 'Langar Fund',
    description: 'Monthly langar and seva support.',
    raised: 42000,
    target: 60000,
    isActive: true,
    paymentProvider: 'STRIPE',
    paymentLink: 'https://donate.stripe.com/test_aFa28sdWJexZ11F3ZE6Ri00',
    stripeBuyButtonId: '',
    stripePublishableKey: ''
  },
  {
    id: 2,
    name: 'Building Fund',
    description: 'Expansion and maintenance project support.',
    raised: 110000,
    target: 250000,
    isActive: true,
    paymentProvider: 'PAYPAL',
    paymentLink: '',
    stripeBuyButtonId: '',
    stripePublishableKey: ''
  },
  {
    id: 3,
    name: 'Education Seva',
    description: 'Punjabi and gurmat classes for youth.',
    raised: 18000,
    target: 30000,
    isActive: true,
    paymentProvider: 'STRIPE',
    paymentLink: 'https://donate.stripe.com/test_aFa28sdWJexZ11F3ZE6Ri00',
    stripeBuyButtonId: '',
    stripePublishableKey: ''
  }
];

const normalizeCampaign = (campaign) => {
  const raised = Number(campaign.raised || 0);
  const target = Number(campaign.target || 0);
  const isClosed = target > 0 && raised >= target;
  const provider = String(campaign.paymentProvider || 'STRIPE').toUpperCase();

  return {
    id: campaign.id,
    name: campaign.name || '',
    description: campaign.description || '',
    raised,
    target,
    isActive: Boolean(campaign.isActive ?? true),
    isClosed,
    paymentProvider: provider === 'PAYPAL' ? 'PAYPAL' : 'STRIPE',
    paymentLink: campaign.paymentLink || '',
    stripeBuyButtonId: campaign.stripeBuyButtonId || '',
    stripePublishableKey: campaign.stripePublishableKey || ''
  };
};

const readCampaigns = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedCampaigns.map(normalizeCampaign);
    }
    return JSON.parse(raw).map(normalizeCampaign);
  } catch {
    return seedCampaigns.map(normalizeCampaign);
  }
};

const writeCampaigns = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const readDonations = () => {
  try {
    const raw = window.localStorage.getItem(DONATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeDonations = (records) => {
  try {
    window.localStorage.setItem(DONATION_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const readPendingDonations = () => {
  try {
    const raw = window.localStorage.getItem(PENDING_DONATION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getLatestPendingDonationRecord = () => {
  const pending = readPendingDonations();
  if (pending.length === 0) {
    return null;
  }

  return [...pending].sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return rightTime - leftTime;
  })[0] || null;
};

const writePendingDonations = (records) => {
  try {
    window.localStorage.setItem(PENDING_DONATION_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const readLastPendingDonationId = () => {
  try {
    return window.localStorage.getItem(LAST_PENDING_DONATION_KEY) || '';
  } catch {
    return '';
  }
};

const writeLastPendingDonationId = (pendingId) => {
  try {
    if (pendingId) {
      window.localStorage.setItem(LAST_PENDING_DONATION_KEY, pendingId);
      return;
    }
    window.localStorage.removeItem(LAST_PENDING_DONATION_KEY);
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const applyCheckoutTemplate = (template, values) => {
  const replacements = {
    '{AMOUNT}': String(values.amount || ''),
    '{AMOUNT_CENTS}': String(values.amountCents || ''),
    '{EMAIL}': encodeURIComponent(values.email || ''),
    '{NAME}': encodeURIComponent(values.name || ''),
    '{CAMPAIGN}': encodeURIComponent(values.campaign || ''),
    '{REFERENCE}': encodeURIComponent(values.reference || '')
  };

  return Object.entries(replacements).reduce(
    (acc, [token, tokenValue]) => acc.split(token).join(tokenValue),
    String(template || '')
  );
};

const withQueryParams = (url, params) => {
  const next = new URL(String(url));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      next.searchParams.set(key, String(value));
    }
  });
  return next.toString();
};

const extractAmountFromUrl = (url) => {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(String(url));
    const amountValue =
      parsedUrl.searchParams.get('amount') ||
      parsedUrl.searchParams.get('amount_total') ||
      parsedUrl.searchParams.get('amount_decimal') ||
      parsedUrl.searchParams.get('prefilled_amount') ||
      '';

    if (!amountValue) {
      return null;
    }

    const parsedNumber = Number(amountValue);
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
      return null;
    }

    if (parsedUrl.searchParams.get('amount_cents')) {
      return parsedNumber / 100;
    }

    return parsedNumber;
  } catch {
    return null;
  }
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || `Request failed for ${url}`);
  }
  return data;
};

const createServerCheckoutSession = async ({ campaign, pendingId, donorName, donorEmail, frequency, amount }) => {
  const parsedAmount = Number(amount);
  const amountCents = Number.isFinite(parsedAmount) && parsedAmount > 0
    ? Math.round(parsedAmount * 100)
    : undefined;

  const payload = {
    pendingId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    donorName,
    donorEmail,
    frequency,
    amount: Number.isFinite(parsedAmount) ? parsedAmount : undefined,
    amountCents,
    donationPurpose: campaign.description || campaign.name,
    origin: window.location.origin
  };

  const response = await fetchJson('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.data || null;
};

const readServerDonations = async () => {
  const response = await fetchJson('/api/donations');
  return Array.isArray(response.data) ? response.data : [];
};

const readServerDonationSummary = async () => {
  const response = await fetchJson('/api/donations/summary');
  return response.data || {};
};

const mergeDonations = (localRecords, serverRecords) => {
  const map = new Map();

  [...localRecords, ...serverRecords].forEach((entry) => {
    const key =
      String(entry.gatewayTransactionId || '').trim() ||
      String(entry.stripeSessionId || '').trim() ||
      String(entry.receiptId || '').trim() ||
      String(entry.id || '').trim();
    if (!key) {
      return;
    }

    if (!map.has(key)) {
      map.set(key, entry);
      return;
    }

    const existing = map.get(key);
    const chooseServer = String(entry.source || '').includes('stripe-webhook');
    map.set(key, chooseServer ? { ...existing, ...entry } : existing);
  });

  return [...map.values()].sort((left, right) => {
    const l = new Date(left.createdAt || 0).getTime();
    const r = new Date(right.createdAt || 0).getTime();
    return r - l;
  });
};

const applyServerRaisedTotals = async (campaigns) => {
  try {
    const summary = await readServerDonationSummary();
    return campaigns.map((campaign) => {
      const byId = Number(summary[`id:${campaign.id}`] || 0);
      const byName = Number(summary[`name:${String(campaign.name).toLowerCase()}`] || 0);
      const serverRaised = Number.isFinite(byId) && byId > 0 ? byId : byName;
      const mergedRaised = Number(campaign.raised || 0) + (Number.isFinite(serverRaised) ? serverRaised : 0);
      return normalizeCampaign({ ...campaign, raised: mergedRaised });
    });
  } catch {
    return campaigns;
  }
};

const resolveStripePaymentDetails = async ({ sessionId = '', paymentIntentId = '' } = {}) => {
  const trimmedSessionId = String(sessionId || '').trim();
  const trimmedPaymentIntentId = String(paymentIntentId || '').trim();
  if (!trimmedSessionId && !trimmedPaymentIntentId) {
    return null;
  }

  const url = new URL('/api/stripe/resolve', window.location.origin);
  if (trimmedSessionId) {
    url.searchParams.set('session_id', trimmedSessionId);
  }
  if (trimmedPaymentIntentId) {
    url.searchParams.set('payment_intent', trimmedPaymentIntentId);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || 'Unable to resolve Stripe payment details.');
  }

  return data.data || null;
};

const resolveCheckoutUrl = async ({ campaign, amount, donorName, donorEmail, pendingId }) => {
  const paymentLink = String(campaign.paymentLink || '').trim();
  if (!paymentLink) {
    throw new Error('Payment setup missing. Add Stripe/PayPal checkout URL in admin campaign settings.');
  }

  const hasAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

  if (!isHttpUrl(paymentLink)) {
    const response = await fetch(paymentLink, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        campaignName: campaign.name,
        amount: hasAmount ? amount : undefined,
        amountCents: hasAmount ? Math.round(amount * 100) : undefined,
        donorName,
        donorEmail,
        clientReferenceId: pendingId
      })
    });

    if (!response.ok) {
      throw new Error('Checkout session endpoint failed. Please verify campaign payment endpoint.');
    }

    const data = await response.json();
    const sessionUrl = data.checkoutUrl || data.url || data.sessionUrl;
    if (!sessionUrl) {
      throw new Error('Checkout endpoint did not return a checkout URL.');
    }
    return sessionUrl;
  }

  const templated = applyCheckoutTemplate(paymentLink, {
    amount: hasAmount ? amount : '',
    amountCents: hasAmount ? Math.round(amount * 100) : '',
    email: donorEmail,
    name: donorName,
    campaign: campaign.name,
    reference: pendingId
  });

  if (campaign.paymentProvider === 'PAYPAL') {
    return withQueryParams(templated, {
      amount: hasAmount ? amount : undefined,
      currency_code: 'CAD',
      item_name: campaign.name,
      custom: pendingId
    });
  }

  // Stripe Payment Links are usually fixed-amount; this adds common prefill params,
  // while dynamic amount requires a backend checkout-session endpoint.
  return withQueryParams(templated, {
    amount: hasAmount ? amount : undefined,
    amount_decimal: hasAmount ? amount : undefined,
    amount_cents: hasAmount ? Math.round(amount * 100) : undefined,
    prefilled_amount: hasAmount ? amount : undefined,
    prefilled_email: donorEmail,
    client_reference_id: pendingId
  });
};

const sendReceiptEmail = async ({ donorEmail, donorName, receiptId, amount, campaignName }) => {
  if (!donorEmail) {
    return { sent: false, reason: 'missing_email' };
  }

  return mockResponse({
    sent: true,
    to: donorEmail,
    subject: `Donation receipt ${receiptId}`,
    donorName,
    amount,
    campaignName
  }, 200).then((res) => res.data);
};

const findExistingDonation = ({ pendingId = '', gatewayTransactionId = '' } = {}) => {
  const normalizedGatewayId = String(gatewayTransactionId || '').trim();
  const normalizedPendingId = String(pendingId || '').trim();
  const genericGatewayIds = new Set(['stripe-return', 'latest-pending-fallback', 'manual-user-confirm']);

  const donations = readDonations();
  if (normalizedPendingId) {
    const byPending = donations.find((entry) => String(entry.sourcePendingId || '').trim() === normalizedPendingId);
    if (byPending) {
      return byPending;
    }
  }

  if (normalizedGatewayId && !genericGatewayIds.has(normalizedGatewayId)) {
    const byGateway = donations.find((entry) => String(entry.gatewayTransactionId || '').trim() === normalizedGatewayId);
    if (byGateway) {
      return byGateway;
    }
  }

  return null;
};

const donationService = {
  getCampaigns: async () => {
    const campaigns = await applyServerRaisedTotals(readCampaigns());
    return mockResponse(campaigns.filter((campaign) => campaign.isActive));
  },
  getAllCampaigns: async () => {
    const campaigns = await applyServerRaisedTotals(readCampaigns());
    return mockResponse(campaigns);
  },
  getDonations: async () => {
    try {
      const merged = mergeDonations(readDonations(), await readServerDonations());
      return mockResponse(merged);
    } catch {
      return mockResponse(readDonations());
    }
  },
  getPendingDonations: async () => mockResponse(readPendingDonations()),
  getLastPendingDonationId: () => readLastPendingDonationId(),
  getPendingDonationById: (pendingId) => readPendingDonations().find((entry) => entry.id === pendingId) || null,
  getLatestPendingDonation: () => getLatestPendingDonationRecord(),
  createCampaign: async (payload) => {
    const record = normalizeCampaign({
      id: Date.now(),
      name: payload.name,
      description: payload.description,
      raised: Number(payload.raised || 0),
      target: Number(payload.target || 0),
      isActive: payload.isActive ?? true,
      paymentProvider: payload.paymentProvider,
      paymentLink: payload.paymentLink,
      stripeBuyButtonId: payload.stripeBuyButtonId,
      stripePublishableKey: payload.stripePublishableKey
    });
    const next = [record, ...readCampaigns()];
    writeCampaigns(next);
    return mockResponse(record);
  },
  updateCampaign: async (id, payload) => {
    const next = readCampaigns().map((campaign) => (
      campaign.id === id ? normalizeCampaign({ ...campaign, ...payload }) : campaign
    ));
    writeCampaigns(next);
    return mockResponse(next.find((campaign) => campaign.id === id));
  },
  removeCampaign: async (id) => {
    const next = readCampaigns().filter((campaign) => campaign.id !== id);
    writeCampaigns(next);
    return mockResponse({ success: true });
  },
  clearDonations: async () => {
    writeDonations([]);
    writePendingDonations([]);
    writeLastPendingDonationId('');
    return mockResponse({ success: true, cleared: true });
  },
  resolveStripePaymentDetails,
  initiateDonation: async (payload) => {
    const campaignId = Number(payload.campaignId);
    const campaigns = readCampaigns();
    const campaign = campaigns.find((entry) => Number(entry.id) === campaignId);

    if (!campaign) {
      throw new Error('Campaign not found.');
    }
    if (!campaign.isActive) {
      throw new Error('This campaign is currently inactive.');
    }
    if (campaign.target > 0 && campaign.raised >= campaign.target) {
      throw new Error('Donation target has been achieved for this campaign.');
    }

    const pendingId = `pending-${Date.now()}`;
    let checkoutUrl = '';
    let sessionId = '';

    if (campaign.paymentProvider === 'STRIPE') {
      try {
        const session = await createServerCheckoutSession({
          campaign,
          pendingId,
          donorName: payload.donorName,
          donorEmail: payload.donorEmail,
          frequency: payload.frequency || 'one-time',
          amount: payload.amount
        });
        checkoutUrl = String(session?.checkoutUrl || '');
        sessionId = String(session?.sessionId || '');
      } catch (error) {
        throw new Error(error?.message || 'Unable to start Stripe Checkout session.');
      }
    }

    if (!checkoutUrl) {
      checkoutUrl = await resolveCheckoutUrl({
        campaign,
        amount: payload.amount,
        donorName: payload.donorName,
        donorEmail: payload.donorEmail,
        pendingId
      });
    }
    const resolvedAmount = Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0
      ? Number(payload.amount)
      : extractAmountFromUrl(checkoutUrl) || extractAmountFromUrl(campaign.paymentLink) || null;

    const pendingRecord = {
      id: pendingId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      donorName: payload.donorName || 'Anonymous',
      donorEmail: payload.donorEmail || '',
      amount: resolvedAmount,
      frequency: payload.frequency || 'one-time',
      paymentProvider: campaign.paymentProvider,
      checkoutUrl,
      sessionId,
      createdAt: new Date().toISOString()
    };

    writePendingDonations([pendingRecord, ...readPendingDonations()]);
    writeLastPendingDonationId(pendingId);

    return mockResponse({
      success: true,
      pendingId,
      checkoutUrl,
      campaign,
      sessionId,
      amount: pendingRecord.amount,
      donorName: pendingRecord.donorName,
      donorEmail: pendingRecord.donorEmail,
      frequency: pendingRecord.frequency
    });
  },

  confirmDonationPayment: async ({ pendingId, gatewayTransactionId = '', amount: amountOverride = null }) => {
    const existingDonation = findExistingDonation({ pendingId, gatewayTransactionId });
    if (existingDonation) {
      const pendingRecords = readPendingDonations();
      if (pendingRecords.some((entry) => entry.id === pendingId)) {
        writePendingDonations(pendingRecords.filter((entry) => entry.id !== pendingId));
      }
      if (readLastPendingDonationId() === pendingId) {
        writeLastPendingDonationId('');
      }

      const campaigns = readCampaigns();
      const campaign = campaigns.find((entry) => Number(entry.id) === Number(existingDonation.campaignId)) || null;

      return mockResponse({
        success: true,
        receiptId: existingDonation.receiptId,
        emailSent: Boolean(existingDonation.emailSent),
        campaign,
        donation: existingDonation,
        idempotent: true
      });
    }

    const pending = readPendingDonations();
    const record = pending.find((entry) => entry.id === pendingId);
    if (!record) {
      throw new Error('Pending payment not found. Start donation again.');
    }

    const campaigns = readCampaigns();
    const campaign = campaigns.find((entry) => Number(entry.id) === Number(record.campaignId));
    if (!campaign) {
      throw new Error('Campaign not found for this payment.');
    }
    if (campaign.target > 0 && campaign.raised >= campaign.target) {
      throw new Error('Donation target has already been achieved for this campaign.');
    }

    const confirmedAmount = Number.isFinite(Number(amountOverride)) && Number(amountOverride) > 0
      ? Number(amountOverride)
      : Number(record.amount || extractAmountFromUrl(record.checkoutUrl) || extractAmountFromUrl(campaign.paymentLink) || 0);

    if (confirmedAmount <= 0) {
      throw new Error('Donation amount could not be determined from checkout confirmation.');
    }

    const nextRaised = campaign.raised + confirmedAmount;
    const receiptId = `R-${Date.now()}`;
    const donationRecord = {
      id: `don-${Date.now()}`,
      receiptId,
      sourcePendingId: pendingId,
      campaignId: record.campaignId,
      campaignName: record.campaignName,
      donorName: record.donorName,
      donorEmail: record.donorEmail,
      amount: confirmedAmount,
      frequency: record.frequency,
      paymentProvider: record.paymentProvider,
      paymentStatus: 'PAID',
      gatewayTransactionId: gatewayTransactionId || '',
      createdAt: new Date().toISOString()
    };

    const emailResult = await sendReceiptEmail(donationRecord);
    donationRecord.emailSent = Boolean(emailResult.sent);

    const updatedCampaigns = campaigns.map((entry) => (
      entry.id === campaign.id
        ? normalizeCampaign({ ...entry, raised: nextRaised })
        : entry
    ));

    writeCampaigns(updatedCampaigns);
    writeDonations([donationRecord, ...readDonations()]);
    writePendingDonations(pending.filter((entry) => entry.id !== pendingId));
    if (readLastPendingDonationId() === pendingId) {
      writeLastPendingDonationId('');
    }

    return mockResponse({
      success: true,
      receiptId,
      emailSent: donationRecord.emailSent,
      campaign: updatedCampaigns.find((entry) => entry.id === campaign.id),
      donation: donationRecord
    });
  },

  confirmLatestPendingDonation: async ({ gatewayTransactionId = '' } = {}) => {
    const latestPending = getLatestPendingDonationRecord();
    if (!latestPending?.id) {
      throw new Error('No pending donation found to verify.');
    }

    return donationService.confirmDonationPayment({
      pendingId: latestPending.id,
      gatewayTransactionId: gatewayTransactionId || 'latest-pending-fallback'
    });
  },

  recordCompletedDonation: async (payload) => {
    const amount = Number(payload.amount || 0);
    const campaignId = Number(payload.campaignId);
    const campaigns = readCampaigns();
    const campaign = campaigns.find((entry) => Number(entry.id) === campaignId);

    if (!campaign) {
      throw new Error('Campaign not found.');
    }
    if (!campaign.isActive) {
      throw new Error('This campaign is currently inactive.');
    }
    if (campaign.target > 0 && campaign.raised >= campaign.target) {
      throw new Error('Donation target has been achieved for this campaign.');
    }
    if (amount <= 0) {
      throw new Error('Donation amount must be greater than 0.');
    }

    const receiptId = `R-${Date.now()}`;
    const donationRecord = {
      id: `don-${Date.now()}`,
      receiptId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      donorName: payload.donorName || 'Anonymous',
      donorEmail: payload.donorEmail || '',
      amount,
      frequency: payload.frequency || 'one-time',
      paymentProvider: campaign.paymentProvider,
      paymentStatus: 'PAID',
      gatewayTransactionId: payload.gatewayTransactionId || 'manual-confirm',
      createdAt: new Date().toISOString()
    };

    const emailResult = await sendReceiptEmail(donationRecord);
    donationRecord.emailSent = Boolean(emailResult.sent);

    const updatedCampaigns = campaigns.map((entry) => (
      entry.id === campaign.id
        ? normalizeCampaign({ ...entry, raised: entry.raised + amount })
        : entry
    ));

    writeCampaigns(updatedCampaigns);
    writeDonations([donationRecord, ...readDonations()]);

    return mockResponse({
      success: true,
      receiptId,
      emailSent: donationRecord.emailSent,
      campaign: updatedCampaigns.find((entry) => entry.id === campaign.id),
      donation: donationRecord
    });
  },

  donate: async (payload) => {
    const initiated = await donationService.initiateDonation(payload);
    return donationService.confirmDonationPayment({ pendingId: initiated.data.pendingId });
  }
};

export default donationService;
