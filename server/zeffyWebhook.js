const crypto = require('crypto');

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const readPath = (source, path) => path.split('.').reduce((value, key) => value?.[key], source);

const pickPath = (source, paths) => firstValue(...paths.map((path) => readPath(source, path)));

const normalizeEventType = (event = {}) => String(firstValue(
  event.type,
  event.event,
  event.eventType,
  event.event_type,
  event.name
) || '').trim().toLowerCase();

const resolvePayment = (event = {}) => {
  const candidates = [
    event.data?.object,
    event.data?.payment,
    event.data?.transaction,
    event.payment,
    event.transaction,
    event.data,
    event.object,
    event
  ];
  return candidates.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) || {};
};

const parseAmount = (payment = {}) => {
  const cents = Number(pickPath(payment, [
    'amountCents',
    'amount_cents',
    'totalCents',
    'total_cents'
  ]));
  if (Number.isFinite(cents) && cents > 0) {
    return cents / 100;
  }

  const raw = pickPath(payment, [
    'amount.value',
    'amount.amount',
    'amount',
    'total.value',
    'total.amount',
    'total',
    'paymentAmount',
    'payment_amount',
    'grossAmount',
    'gross_amount',
    'donationAmount',
    'donation_amount'
  ]);
  const normalized = Number(String(raw || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
};

const normalizeFrequency = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('month')) {
    return 'monthly';
  }
  if (normalized.includes('quarter')) {
    return 'quarterly';
  }
  if (normalized.includes('year') || normalized.includes('annual')) {
    return 'yearly';
  }
  return 'one-time';
};

const normalizeCreatedAt = (value) => {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const extractZeffyPaymentId = (event = {}) => String(firstValue(
  pickPath(event, ['data.object.id', 'data.payment.id', 'data.transaction.id', 'data.id']),
  pickPath(event, ['payment.id', 'transaction.id', 'payment_id', 'transaction_id'])
) || '').trim();

const mapZeffyApiPayment = (payment = {}) => {
  const transactionId = String(payment.id || '').trim();
  const amount = Number(payment.amount || 0) / 100;
  if (!transactionId || payment.status !== 'succeeded' || !Number.isFinite(amount) || amount <= 0) {
    const error = new Error('Zeffy payment must be a succeeded transaction with a positive amount.');
    error.status = 400;
    throw error;
  }

  const buyer = payment.buyer || {};
  const donorName = [buyer.first_name, buyer.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ')
    || String(buyer.company_name || 'Anonymous').trim();
  const receiptSuffix = transactionId.replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase();
  const createdAt = Number(payment.created) > 0
    ? new Date(Number(payment.created) * 1000).toISOString()
    : new Date().toISOString();

  return {
    id: `zeffy-${transactionId}`,
    receiptId: `ZEF-${receiptSuffix}`,
    sourcePendingId: '',
    campaignId: null,
    campaignName: String(payment.description || 'Help Us Build Our Gurdwara').trim(),
    donorName,
    donorEmail: String(buyer.email || '').trim().toLowerCase(),
    donorPhone: String(buyer.phone || buyer.phone_number || '').trim(),
    amount,
    frequency: normalizeFrequency(payment.recurring?.interval || payment.items?.[0]?.recurrence_interval),
    paymentProvider: 'ZEFFY',
    paymentStatus: 'PAID',
    gatewayTransactionId: transactionId,
    stripeSessionId: '',
    stripeEventId: '',
    createdAt,
    emailSent: false,
    source: 'zeffy-webhook'
  };
};

const mapZeffyCompletedPayment = (event = {}) => {
  const eventType = normalizeEventType(event);
  if (eventType !== 'payment.completed') {
    return null;
  }

  const payment = resolvePayment(event);
  const donor = payment.donor || payment.contact || payment.buyer || payment.person || payment.supporter || {};
  const transactionId = String(firstValue(
    pickPath(payment, ['transactionId', 'transaction_id', 'paymentId', 'payment_id', 'id']),
    pickPath(event, ['data.id', 'payment.id', 'transaction.id'])
  ) || '').trim();
  const amount = parseAmount(payment);

  if (!transactionId || amount <= 0) {
    const error = new Error('Zeffy payment.completed requires a transaction id and positive amount.');
    error.status = 400;
    throw error;
  }

  const firstName = String(firstValue(donor.firstName, donor.first_name, payment.firstName, payment.first_name) || '').trim();
  const lastName = String(firstValue(donor.lastName, donor.last_name, payment.lastName, payment.last_name) || '').trim();
  const donorName = String(firstValue(
    donor.name,
    donor.fullName,
    donor.full_name,
    payment.donorName,
    payment.donor_name,
    payment.name,
    `${firstName} ${lastName}`.trim()
  ) || 'Anonymous').trim();
  const campaignName = String(firstValue(
    pickPath(payment, ['form.name', 'form.title', 'campaign.name', 'campaign.title']),
    payment.formName,
    payment.form_name,
    payment.campaignName,
    payment.campaign_name,
    'Help Us Build Our Gurdwara'
  )).trim();
  const eventId = String(firstValue(event.id, event.eventId, event.event_id) || '').trim();
  const receiptSuffix = transactionId.replace(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase() || String(Date.now()).slice(-10);

  return {
    id: `zeffy-${transactionId}`,
    receiptId: `ZEF-${receiptSuffix}`,
    sourcePendingId: '',
    campaignId: null,
    campaignName,
    donorName,
    donorEmail: String(firstValue(donor.email, payment.donorEmail, payment.donor_email, payment.email) || '').trim().toLowerCase(),
    donorPhone: String(firstValue(donor.phone, donor.phoneNumber, donor.phone_number, payment.donorPhone, payment.donor_phone, payment.phone) || '').trim(),
    amount,
    frequency: normalizeFrequency(firstValue(
      payment.frequency,
      payment.recurrence,
      payment.interval,
      payment.donationType,
      payment.donation_type,
      payment.paymentType,
      payment.payment_type
    )),
    paymentProvider: 'ZEFFY',
    paymentStatus: 'PAID',
    gatewayTransactionId: transactionId,
    stripeSessionId: '',
    stripeEventId: eventId,
    createdAt: normalizeCreatedAt(firstValue(
      payment.completedAt,
      payment.completed_at,
      payment.paidAt,
      payment.paid_at,
      payment.createdAt,
      payment.created_at,
      payment.date
    )),
    emailSent: false,
    source: 'zeffy-webhook'
  };
};

const verifyZeffyWebhookToken = (configuredToken, providedToken) => {
  const expected = Buffer.from(String(configuredToken || ''), 'utf8');
  const actual = Buffer.from(String(providedToken || ''), 'utf8');
  return expected.length > 0 && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

module.exports = {
  extractZeffyPaymentId,
  mapZeffyApiPayment,
  mapZeffyCompletedPayment,
  normalizeEventType,
  verifyZeffyWebhookToken
};