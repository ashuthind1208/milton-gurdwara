# Local Mail Delivery Runbook

This runbook documents local email delivery through the backend relay endpoint.

## 1) Delivery endpoint

All email-producing flows should target this endpoint:

- http://127.0.0.1:4242/api/internal/mail-relay

This route is loopback-only and rejects non-local callers.

## 2) Existing app email producers

Frontend:

- Newsletter campaign send:
  - env: REACT_APP_NEWSLETTER_WEBHOOK_URL
  - fallback env: REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL
  - payload keys: to, toList, recipientEmails, subject, html, bodyHtml, text, topic, recipients

- Approval email:
  - env: REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL
  - payload keys: type, to, name, subject, message

Backend:

- Volunteer reminders:
  - env: VOLUNTEER_REMINDER_WEBHOOK_URL
  - payload keys: to, name, subject, html, bodyHtml, text, metadata

- Event reminders:
  - env: EVENT_REMINDER_WEBHOOK_URL
  - fallback env: VOLUNTEER_REMINDER_WEBHOOK_URL
  - payload keys: to, email, name, subject, html, bodyHtml, text, metadata

- Donation invoice:
  - env: DONATION_INVOICE_WEBHOOK_URL
  - payload keys: to, email, name, subject, html, bodyHtml, text, attachments[], invoicePdfDataUrl, metadata

## 3) Recommended environment values

Set these in local development:

- REACT_APP_NEWSLETTER_WEBHOOK_URL=http://127.0.0.1:4242/api/internal/mail-relay
- REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL=http://127.0.0.1:4242/api/internal/mail-relay
- VOLUNTEER_REMINDER_WEBHOOK_URL=http://127.0.0.1:4242/api/internal/mail-relay
- EVENT_REMINDER_WEBHOOK_URL=http://127.0.0.1:4242/api/internal/mail-relay
- DONATION_INVOICE_WEBHOOK_URL=http://127.0.0.1:4242/api/internal/mail-relay

Then restart frontend and backend processes.

For SMTP delivery, keep Gmail selected until the SMTP2GO account and sender domain are ready:

```dotenv
LOCAL_MAIL_TRANSPORT=smtp
SMTP_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<gmail-smtp-username>
SMTP_PASS=<gmail-app-password>
SMTP_FROM=<verified-sender-address>
```

Store future SMTP2GO credentials under `SMTP2GO_HOST`, `SMTP2GO_PORT`, `SMTP2GO_SECURE`, `SMTP2GO_USER`, `SMTP2GO_PASS`, and `SMTP2GO_FROM`. Switching `SMTP_PROVIDER` from `gmail` to `smtp2go` activates those values after a backend restart.

## 4) End-to-end verification checklist

1. Newsletter send from admin:
   - campaign status becomes sent
   - response confirms successful relay submission

2. Approval email test:
   - approve a pending user
   - response confirms recipient + subject

3. Volunteer reminder sweep test:
   - trigger manual reminder route in admin
   - sent count increments as expected

4. Event reminder sweep test:
   - verify reminder route delivers to configured recipients

5. Donation invoice email test:
   - generate invoice from admin donation flow
   - attachment appears in outbound email

## 5) Notes

- The app sends compatibility fields (recipient aliases and html/body aliases) to reduce integration brittleness.
- Relay normalizes payloads and sends through the selected SMTP provider (or local sendmail when configured), including attachment support for donation invoices.