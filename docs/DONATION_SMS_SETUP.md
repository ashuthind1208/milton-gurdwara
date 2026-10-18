# Transactional donation SMS (Twilio)

Disabled by default. No bulk sending, QR-click notification, or historical import notification.

Configure server-only environment variables (never REACT_APP variables):
- SMS_ENABLED=true
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER (SMS-capable +1 number)
- SMS_ORGANIZATION_NAME (optional; default Singh Sabha Milton)

Complete Twilio sender registration/verification before enabling. Enable Twilio Advanced Opt-Out on the sender/Messaging Service as applicable; verify STOP suppression with a real test recipient before launch. The application does not bypass Twilio opt-out errors. Keep messages transactional and obtain express SMS consent. Carrier, number rental and per-segment charges apply.

## Manual donations
The consent checkbox was removed from the admin form at the administrator's request. Normal form submissions therefore do not request SMS. An authorized admin API request can explicitly set smsConsent=true only after obtaining donor consent, and must include a North American donor phone number. Only PAID donations trigger an acknowledgement. Phone presence alone never grants consent.

## Zeffy donation links and QR codes
Clicking/scanning alone never sends SMS. Configure the existing Zeffy payment.completed webhook and API key. The server fetches the payment from Zeffy and requires succeeded status before sending.

Add a separate, optional Zeffy form consent question with key `sms_consent` or label `Consent to donation SMS`. A positive boolean or Yes/True/I agree answer must appear in the verified payment's custom_fields, customFields or answers. Also collect the donor phone number. If Zeffy's API does not expose the consent answer, SMS is skipped; do not infer consent from phone presence. Verify this payload with a real opted-in test payment before enabling production SMS.

## Reliability
Delivery claims live in the database under donation_sms_delivery. A unique provider transaction ID prevents repeat sends on webhook retries. Status accepted means Twilio accepted it, NOT handset delivery. Provider rejection is failed; network/recording uncertainty is unknown and must be investigated manually. Automatic retries are intentionally disabled to avoid duplicate acknowledgements. Historic Zeffy reconciliation does not send SMS. A claimed send interrupted by a restart also needs manual review.

SMS runs independently of saving a donation; failure never reverses payment. This initial implementation is Twilio-only, +1 destinations only, and has no delivery-callback dashboard or automated retry worker. Use Twilio account spending alerts/limits. Never put credentials in source control. Email/tax receipts remain unchanged.