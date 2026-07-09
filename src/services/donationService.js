import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-donation-campaigns';
const DONATION_STORAGE_KEY = 'ssm-donation-records';
const PENDING_DONATION_KEY = 'ssm-donation-pending';

const seedCampaigns = [
  {
    id: 1,
    name: 'Langar Fund',
    description: 'Monthly langar and seva support.',
    raised: 42000,
    target: 60000,
    isActive: true,
    paymentProvider: 'STRIPE',
    paymentLink: '',
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
    paymentLink: '',
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

const writePendingDonations = (records) => {
  try {
    window.localStorage.setItem(PENDING_DONATION_KEY, JSON.stringify(records));
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

const resolveCheckoutUrl = async ({ campaign, amount, donorName, donorEmail, pendingId }) => {
  const paymentLink = String(campaign.paymentLink || '').trim();
  if (!paymentLink) {
    throw new Error('Payment setup missing. Add Stripe/PayPal checkout URL in admin campaign settings.');
  }

  if (!isHttpUrl(paymentLink)) {
    const response = await fetch(paymentLink, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        campaignName: campaign.name,
        amount,
        amountCents: Math.round(amount * 100),
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
    amount,
    amountCents: Math.round(amount * 100),
    email: donorEmail,
    name: donorName,
    campaign: campaign.name,
    reference: pendingId
  });

  if (campaign.paymentProvider === 'PAYPAL') {
    return withQueryParams(templated, {
      amount,
      currency_code: 'CAD',
      item_name: campaign.name,
      custom: pendingId
    });
  }

  // Stripe Payment Links are usually fixed-amount; this adds common prefill params,
  // while dynamic amount requires a backend checkout-session endpoint.
  return withQueryParams(templated, {
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

const donationService = {
  getCampaigns: async () => mockResponse(readCampaigns().filter((campaign) => campaign.isActive)),
  getAllCampaigns: async () => mockResponse(readCampaigns()),
  getDonations: async () => mockResponse(readDonations()),
  getPendingDonations: async () => mockResponse(readPendingDonations()),
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
  initiateDonation: async (payload) => {
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

    const pendingId = `pending-${Date.now()}`;
    const checkoutUrl = await resolveCheckoutUrl({
      campaign,
      amount,
      donorName: payload.donorName,
      donorEmail: payload.donorEmail,
      pendingId
    });

    const pendingRecord = {
      id: pendingId,
      campaignId: campaign.id,
      campaignName: campaign.name,
      donorName: payload.donorName || 'Anonymous',
      donorEmail: payload.donorEmail || '',
      amount,
      frequency: payload.frequency || 'one-time',
      paymentProvider: campaign.paymentProvider,
      checkoutUrl,
      createdAt: new Date().toISOString()
    };

    writePendingDonations([pendingRecord, ...readPendingDonations()]);

    return mockResponse({
      success: true,
      pendingId,
      checkoutUrl,
      campaign
    });
  },

  confirmDonationPayment: async ({ pendingId, gatewayTransactionId = '' }) => {
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

    const nextRaised = campaign.raised + Number(record.amount || 0);
    const receiptId = `R-${Date.now()}`;
    const donationRecord = {
      id: `don-${Date.now()}`,
      receiptId,
      campaignId: record.campaignId,
      campaignName: record.campaignName,
      donorName: record.donorName,
      donorEmail: record.donorEmail,
      amount: Number(record.amount || 0),
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

    return mockResponse({
      success: true,
      receiptId,
      emailSent: donationRecord.emailSent,
      campaign: updatedCampaigns.find((entry) => entry.id === campaign.id),
      donation: donationRecord
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
