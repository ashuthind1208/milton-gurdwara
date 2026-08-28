const {
  extractZeffyPaymentId,
  mapZeffyApiPayment,
  mapZeffyCompletedPayment,
  verifyZeffyWebhookToken
} = require('../../server/zeffyWebhook');

describe('Zeffy webhook mapping', () => {
  test('maps a completed nested payment into the donation ledger shape', () => {
    const donation = mapZeffyCompletedPayment({
      id: 'event-123',
      type: 'payment.completed',
      data: {
        payment: {
          id: 'payment-456',
          amount: { value: '125.50', currency: 'CAD' },
          frequency: 'Monthly',
          completed_at: '2026-08-01T12:00:00.000Z',
          donor: {
            first_name: 'Harpreet',
            last_name: 'Kaur',
            email: 'HARPREET@example.com',
            phone_number: '(905) 555-0101'
          },
          form: { name: 'Help Us Build Our Gurdwara' }
        }
      }
    });

    expect(donation).toEqual(expect.objectContaining({
      id: 'zeffy-payment-456',
      donorName: 'Harpreet Kaur',
      donorEmail: 'harpreet@example.com',
      donorPhone: '(905) 555-0101',
      amount: 125.5,
      frequency: 'monthly',
      campaignName: 'Help Us Build Our Gurdwara',
      paymentProvider: 'ZEFFY',
      paymentStatus: 'PAID',
      gatewayTransactionId: 'payment-456',
      source: 'zeffy-webhook'
    }));
  });

  test('ignores other events and rejects incomplete completed payments', () => {
    expect(mapZeffyCompletedPayment({ type: 'payment.refunded' })).toBeNull();
    expect(() => mapZeffyCompletedPayment({ type: 'payment.completed', data: { amount: 25 } }))
      .toThrow('Zeffy payment.completed requires a transaction id and positive amount.');
  });

  test('maps flat completed payments with a cents amount', () => {
    const donation = mapZeffyCompletedPayment({
      event_type: 'payment.completed',
      data: {
        transaction_id: 'transaction-flat-789',
        amount_cents: 5000,
        donor_name: 'Jaspreet Singh',
        email: 'jaspreet@example.com',
        phone: '9055550142',
        recurrence: 'Yearly',
        form_name: 'Donate to Change Lives'
      }
    });

    expect(donation).toEqual(expect.objectContaining({
      amount: 50,
      campaignName: 'Donate to Change Lives',
      donorEmail: 'jaspreet@example.com',
      frequency: 'yearly',
      gatewayTransactionId: 'transaction-flat-789'
    }));
  });

  test('compares the configured webhook token exactly', () => {
    expect(verifyZeffyWebhookToken('private-token', 'private-token')).toBe(true);
    expect(verifyZeffyWebhookToken('private-token', 'wrong-token')).toBe(false);
    expect(verifyZeffyWebhookToken('', '')).toBe(false);
  });

  test('extracts a payment id from Zeffy webhook notification shapes', () => {
    expect(extractZeffyPaymentId({ data: { object: { id: 'payment-object' } } })).toBe('payment-object');
    expect(extractZeffyPaymentId({ data: { payment: { id: 'payment-nested' } } })).toBe('payment-nested');
    expect(extractZeffyPaymentId({ data: { id: 'payment-data' } })).toBe('payment-data');
  });

  test('maps an API-verified succeeded payment using cents and buyer details', () => {
    const donation = mapZeffyApiPayment({
      id: 'payment-api-123',
      status: 'succeeded',
      amount: 12550,
      created: 1785585600,
      description: 'Help Us Build Our Gurdwara',
      buyer: { first_name: 'Harpreet', last_name: 'Kaur', email: 'HARPREET@example.com' },
      recurring: { interval: 'monthly' },
      items: []
    });

    expect(donation).toEqual(expect.objectContaining({
      donorName: 'Harpreet Kaur',
      donorEmail: 'harpreet@example.com',
      amount: 125.5,
      frequency: 'monthly',
      gatewayTransactionId: 'payment-api-123',
      paymentProvider: 'ZEFFY'
    }));
    expect(() => mapZeffyApiPayment({ id: 'pending', status: 'pending', amount: 1000 }))
      .toThrow('Zeffy payment must be a succeeded transaction with a positive amount.');
  });

  test('maps phone from verified Zeffy custom fields when buyer phone is absent', () => {
    const arrayFieldDonation = mapZeffyApiPayment({
      id: 'payment-phone-array',
      status: 'succeeded',
      amount: 2500,
      buyer: { email: 'donor@example.com' },
      custom_fields: [
        { label: 'Preferred language', value: 'Punjabi' },
        { label: 'Mobile phone', answer: '(905) 555-0199' }
      ]
    });
    const objectFieldDonation = mapZeffyApiPayment({
      id: 'payment-phone-object',
      status: 'succeeded',
      amount: 3000,
      buyer: { email: 'second@example.com' },
      custom_fields: { telephone_number: { value: '905-555-0123' } }
    });

    expect(arrayFieldDonation.donorPhone).toBe('(905) 555-0199');
    expect(objectFieldDonation.donorPhone).toBe('905-555-0123');
  });
});