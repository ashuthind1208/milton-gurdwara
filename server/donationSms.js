const crypto = require('crypto');

const normalizeSmsPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
};

// Require an explicitly named consent question, not the presence of a phone.
const zeffySmsConsent = (payment = {}) => {
  const affirmative = (v) => v === true || /^(yes|true|1|i agree)$/i.test(String(v || '').trim());
  for (const fields of [payment.custom_fields, payment.customFields, payment.answers]) {
    const entries = Array.isArray(fields)
      ? fields.map((f) => [f?.key || f?.name || f?.label || f?.question, f?.value ?? f?.answer ?? f?.response])
      : Object.entries(fields || {}).map(([key, value]) => [key, value?.value ?? value?.answer ?? value]);
    if (entries.some(([key, value]) => /^(sms_consent|consent to donation sms)$/i.test(String(key || '').trim()) && affirmative(value))) return true;
  }
  return false;
};

const createDonationSms = ({ db, env = process.env, fetchImpl = fetch, logger = console }) => {
  const send = async (donation, consent) => {
    if (env.SMS_ENABLED !== 'true' || consent !== true || String(donation?.paymentStatus).toUpperCase() !== 'PAID') return { skipped: true };
    const to = normalizeSmsPhone(donation.donorPhone || donation.phone);
    if (!to || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) return { skipped: true };
    const transaction = donation.gatewayTransactionId || donation.stripeSessionId || donation.id;
    if (!transaction) return { skipped: true };
    const id = crypto.createHash('sha256').update(`${donation.paymentProvider}:${transaction}`).digest('hex');
    // A unique database insert claims the send across duplicate webhooks/processes.
    // Never auto-retry an ambiguous provider timeout: it may already have sent.
    try {
      await db.createItem('donation_sms_delivery', { id, status: 'sending', smsConsent: true, consentSource: donation.paymentProvider === 'ZEFFY' ? 'verified-zeffy-form' : 'admin-attestation', createdAt: new Date().toISOString() });
    } catch (error) {
      if (['23505', 'ER_DUP_ENTRY'].includes(error.code)) return { duplicate: true };
      throw error;
    }
    try {
      const organization = String(env.SMS_ORGANIZATION_NAME || 'Singh Sabha Milton');
      const amount = Number(donation.amount).toFixed(2);
      const donorName = String(donation.donorName || '').replace(/\s+/g, ' ').trim();
      const campaignName = String(donation.campaignName || '').replace(/\s+/g, ' ').trim();
      const greeting = donorName ? `${donorName}${/\bji$/i.test(donorName) ? '' : ' ji'}` : 'Sangat ji';
      const body = `${organization}: Thank you ${greeting} for your donation of CAD ${amount}${campaignName ? ` for ${campaignName}` : ''}. Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh.`;
      const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.TWILIO_ACCOUNT_SID)}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER, Body: body }),
        signal: AbortSignal.timeout(12000)
      });
      const result = await response.json();
      await db.updateItem('donation_sms_delivery', id, { status: response.ok ? 'accepted' : 'failed', providerId: result.sid || '', errorCode: result.code || null });
      return { accepted: response.ok };
    } catch (error) {
      await db.updateItem('donation_sms_delivery', id, { status: 'unknown' });
      logger.error('[donation-sms] Provider outcome unknown; manual review required.');
      return { accepted: false };
    }
  };
  return { send };
};

module.exports = { createDonationSms, normalizeSmsPhone, zeffySmsConsent };