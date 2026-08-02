# Production Deployment Guide (Updated)

This guide is the current end-to-end checklist for deploying Singh Sabha Milton to production.

## 1) Prerequisites

- Node.js 18+ and npm
- A PostgreSQL database (managed service recommended)
- Public domain(s) for frontend and backend
- TLS/HTTPS enabled on both frontend and backend endpoints
- Persistent storage for uploaded files (do not rely on ephemeral disk)

## 2) Architecture Notes

- Frontend is a CRA app (`react-scripts`) that builds to static files.
- Backend serves APIs under `/api/*` and content/upload endpoints.
- The app uses PostgreSQL for persistent data.
- Uploaded sponsor/advertisement banners must persist across restarts/deploys.

## 3) Environment Variables

Set these in production (frontend and backend as applicable).

### Frontend (`REACT_APP_*`)

- `REACT_APP_GOOGLE_OAUTH_URL`
  - Must use production `redirect_uri`.
- `REACT_APP_ADMIN_EMAILS`
  - Comma-separated admin allowlist.
- `REACT_APP_APPROVAL_EMAIL_WEBHOOK_URL`
  - Optional webhook for approval notifications.
- `REACT_APP_DARBAR_SAHIB_STREAM_URL`
  - Production stream URL or API route.
- `REACT_APP_HUKAMNAMA_READ_ALONG_ENABLED`
  - `true`/`false`.
- `REACT_APP_HUKAMNAMA_READ_ALONG_EXACT_BASE_URL`
  - Base URL for read-along audio.
- `REACT_APP_SIKHNET_GURPURAB_CALENDAR_URL`
  - Source page for Sikh Gurpurab / Nanakshahi calendar observances.
  - Example: `https://sikhnet.com/pages/sikh-gurpurab-calendar`

### Backend / Server

- `DATABASE_URL`
  - Production PostgreSQL connection string.
  - Prefer SSL-enabled URL (`sslmode=require` or equivalent).
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`
  - Optional discrete fields if `DATABASE_URL` is not used.
- `STRIPE_SECRET_KEY`
  - Live key in production.
- `STRIPE_WEBHOOK_SECRET`
  - Live webhook secret.
- `STRIPE_CURRENCY`
  - Example: `cad`.
- `ZEFFY_API_KEY`
  - Optional legacy/default server-only credential used when a campaign-specific key has not been saved in Admin Donations.
  - Never prefix this value with `REACT_APP_` or place it in frontend source.
- `ZEFFY_WEBHOOK_TOKEN`
  - Optional. Set only when the webhook sender is configured to provide the same custom token.
- `ZEFFY_CAMPAIGN_ID`
  - Optional numeric ID of the matching local donation campaign.
- `ZEFFY_CAMPAIGN_NAME`
  - Local campaign-name fallback. Example: `Help Us Build Our Gurdwara`.
- `YOUTUBE_API_KEY`
  - Server-side key with YouTube Data API access.
- `VOLUNTEER_REMINDER_WEBHOOK_URL`
  - Reminder email webhook.
- `VOLUNTEER_REMINDER_SEND_TIME`
  - 24h format (`HH:mm`).
- `VOLUNTEER_REMINDER_TIME_ZONE`
  - IANA timezone (example: `America/Toronto`).
- `EVENT_REMINDER_WEBHOOK_URL`
  - Event reminder email webhook.
  - If omitted, event reminders fall back to `VOLUNTEER_REMINDER_WEBHOOK_URL`.
- `EVENT_REMINDER_SEND_TIME`
  - 24h format (`HH:mm`) for event reminder scheduler.
  - If omitted, uses volunteer reminder send time.
- `EVENT_REMINDER_TIME_ZONE`
  - IANA timezone for event reminder scheduler.
  - If omitted, uses volunteer reminder timezone.
- `EVENT_REMINDER_DAYS`
  - Comma-separated day offsets before event date.
  - Example: `7,3,1`.
- `VOLUNTEER_REMINDER_BASE_URL`
  - Public URL for email logo/assets.
- `VOLUNTEER_REMINDER_LOGO_URL`
  - Public image URL for reminder emails.

## 3.1) Automatic Reminder Delivery (Events + Seva)

Reminder emails are sent automatically by the backend scheduler when production is configured correctly.

For this to work reliably in production:

1. Backend must be always-on.
   - The scheduler runs inside the Node backend process.
   - If your platform sleeps/pauses containers, reminders can be delayed or missed.
2. Reminder webhooks must be valid and reachable.
   - Seva uses `VOLUNTEER_REMINDER_WEBHOOK_URL`.
   - Events use `EVENT_REMINDER_WEBHOOK_URL` (or volunteer webhook fallback).
3. Timezone and send-time env vars must be set to production values.
4. Registration records must include valid recipient email addresses.
5. Public base URL/logo env vars should point to production for branded HTML templates.

Operational note:
- If you want independent event and seva reminder destinations, set both webhook vars explicitly.
- If you want the same destination for both, set only `VOLUNTEER_REMINDER_WEBHOOK_URL`.

### Dev-only Variables (do not use in production)

- `DANGEROUSLY_DISABLE_HOST_CHECK`
- Localhost OAuth redirect URIs
- Test Stripe keys/secrets

## 4) Stripe Production Setup

1. Create live products/prices/payment links if used.
2. Set backend env:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
3. Configure webhook endpoint in Stripe Dashboard:
   - `POST https://<backend-domain>/api/stripe/webhook`
4. Subscribe to required events:
   - `checkout.session.completed`
5. Validate end-to-end donation flow:
   - Create donation
   - Complete payment
   - Confirm donation record persisted
   - Confirm campaign raised total updates

## 4.1) Zeffy Production Setup

The Donations page opens each configured Zeffy campaign in an on-site iframe modal. Payment completion is recorded only after backend verification through Zeffy's API, using webhook notifications or API reconciliation; redirect query parameters never create donation records.

1. Confirm the nonprofit account and campaign remain active in Zeffy.
2. In Admin Donations, create or edit the campaign:
  - Select `Zeffy` as the payment provider.
  - Enter its public Zeffy donation-form link.
  - Enter the Zeffy API key. The key is stored only on the backend and is never returned by campaign APIs.
3. In Zeffy, set the post-payment redirect URL to:
  - `https://<frontend-domain>/donation?zeffy=completed`
4. Subscribe the webhook to `payment.completed` and set its endpoint to:
  - `POST https://<backend-domain>/api/zeffy/webhook`
5. Keep all Zeffy API keys server-only. The webhook verifies each notified payment through Zeffy's authenticated API before saving it.
  - Do not add API keys to webhook URLs or frontend environment variables.
  - Set `ZEFFY_WEBHOOK_TOKEN` only if the webhook sender is configured to provide the same custom token.
6. Send a test `payment.completed` event and verify:
  - The endpoint returns `200`.
  - One donation is stored with provider `ZEFFY` and status `PAID`.
  - Re-delivering the same transaction updates the same record rather than creating a duplicate.
  - The donation appears in Admin Donations and the campaign raised total updates.

The backend also reconciles succeeded Zeffy payments from each configured campaign at startup, every minute, and when donations are read. Zeffy's campaign ID is used to associate donor name, email, amount, and raised totals with the correct local campaign. This recovers payments missed while a temporary tunnel or deployment was unavailable.

## 5) Google OAuth Production Setup

1. In Google Cloud OAuth settings, add authorized redirect URI for production login path.
2. Update `REACT_APP_GOOGLE_OAUTH_URL` with production redirect URI.
3. Verify login/logout in production domain.

## 6) Uploads and Asset Persistence

The app now uses uploaded sponsor/advertisement banners.

You must ensure uploaded files survive restarts/redeploys:

- Preferred: move uploads to object storage (S3/R2/GCS) and serve via CDN/public URL.
- Minimum: mount persistent volume for server uploads directory.

If storage is ephemeral, sponsor/advertisement banners may disappear after deployment.

## 7) Donation Board Production Checks

1. Confirm QR resolves to production donation URL:
  - Open the board from the production domain and confirm the QR uses that same origin with `/donation`.
  - No donation URL environment variable is required.
2. Validate donation-board route:
   - `/donation-board`
3. Validate TV-readonly data behavior:
   - Campaigns update automatically
   - Sponsor/advertiser footer ticker loads image banners
   - Reconnect/fallback behavior functions when API is briefly unavailable

## 8) Build and Deploy

### Build

1. Install dependencies:
   - `npm ci`
2. Build frontend:
   - `npm run build`
3. Run backend in production mode with production env vars.

### Deploy

1. Deploy backend API server with env vars.
2. Deploy frontend static build.
3. Ensure frontend can reach backend APIs (`/api/*` routing or reverse proxy).
4. Configure SPA fallback to `index.html` for client-side routing.

## 9) Reverse Proxy / Routing

If using Nginx/Cloudflare/ingress:

- Route `/api/*` and upload endpoints to backend.
- Route static/frontend requests to built assets.
- Enable gzip/brotli and cache static assets.

## 10) Database and Backups

1. Ensure PostgreSQL credentials are correct and SSL is enabled.
2. Confirm app boot initializes required tables.
3. Enable automated DB backups and point-in-time recovery if available.

## 11) Post-Deployment Verification

Run this smoke test after each production deployment:

1. Public pages load:
   - Home, Events, Seva, Donation, Library, Videos
2. Admin login works and authorized users can access admin pages.
3. Advertisements and Sponsors pages can:
   - Create/update/delete entries
   - Upload banners
   - Toggle active/inactive
4. Donation board:
   - Shows live totals
   - QR opens correct donation URL
   - Footer image ticker renders sponsor/advertisement banners
5. Stripe payment completes and persists donation data.
6. Reminder automation checks:
   - Confirm backend logs show both schedulers initialized (seva + event).
   - Trigger manual sweeps once after deploy to verify delivery paths:
     - `POST /api/volunteer-reminders/run`
     - `POST /api/events/reminders/run`
   - Confirm webhook provider receives valid `to`/`email` recipient values.

## 12) Common Pitfalls

- QR shows an unexpected host
  - Confirm the board itself was opened from the intended public domain; the QR automatically uses the board's current origin.
- OAuth fails after deploy
  - Redirect URI mismatch between Google config and env URL.
- Missing sponsor/advertisement images after redeploy
  - Upload storage not persistent.
- Donations not updating board
  - Check backend API health, DB connectivity, and query polling/fallback behavior.
- Reminder emails not sending
  - Verify backend process is always running.
  - Verify webhook URL env vars are present and reachable.
  - Verify timezone/send-time env vars match intended schedule.
  - Verify registrants include valid email addresses.

## 13) Recommended Secrets Management

- Store secrets in deployment platform secret manager.
- Do not commit production secrets in repo/env files.
- Rotate Stripe, OAuth, and DB secrets on a scheduled cadence.
# Production Deployment Guide

This project now uses a Stripe-backed checkout flow with server-side fulfillment and local persistence in development. Before moving to production, follow the checklist below.

## What Changed In This App

- Donations are created through a backend Stripe Checkout session.
- Payment completion is recorded server-side through the Stripe webhook.
- Admin donation totals and donor lists come from persisted donation records.
- Campaign-level donor exports are available in CSV and PDF from the admin donation campaign details panel.

## Required Production Changes

1. Set real production Stripe keys.
   - `STRIPE_SECRET_KEY` must be the live secret key.
   - `STRIPE_WEBHOOK_SECRET` must match the live webhook endpoint secret.
   - `STRIPE_CURRENCY` should match the currency you want to charge in production.

2. Set the correct production host values.
   - Update the application base URL to your production domain.
   - Remove any localhost-only assumptions in the deployed environment.
   - If you use a reverse proxy, confirm it forwards `Host`, `X-Forwarded-Proto`, and request bodies correctly.

3. Configure the Stripe webhook endpoint in Stripe Dashboard.
   - Point the webhook to `https://your-domain.example/api/stripe/webhook`.
   - Subscribe to at least `checkout.session.completed`.
   - Recreate the webhook secret in production after deployment.

4. Verify file storage for donation records.
   - Development writes to `server/data/donations.json`.
   - In production, replace this with a durable storage layer if the host filesystem is ephemeral.
   - If you keep file storage, make sure the process has write permission and the file is persisted across restarts.

5. Confirm the build and runtime commands.
   - Run the frontend production build.
   - Start the backend with the production environment loaded.
   - Make sure the backend process starts before exposing the checkout page.

## Deployment Checklist

- [ ] Set `STRIPE_SECRET_KEY` to a live key.
- [ ] Set `STRIPE_WEBHOOK_SECRET` to the live webhook secret.
- [ ] Set `STRIPE_CURRENCY` to the production currency.
- [ ] Point the app URL to the production domain.
- [ ] Create or update the Stripe webhook endpoint in the dashboard.
- [ ] Confirm `checkout.session.completed` is enabled.
- [ ] Verify the backend can reach the Stripe API from production.
- [ ] Verify donation records persist after a restart.
- [ ] Test a full donation and confirm the donor appears in admin.
- [ ] Test campaign donor CSV and PDF exports in admin.

## Recommended Production Runtime

Use a real process manager such as PM2, systemd, Docker, or a platform runtime that keeps the backend alive and restarts it automatically.

If the deployment platform gives you a build step and a runtime step, make sure the runtime still has access to the same environment variables used during build.

## Notes On The Donation Flow

- Stripe Checkout amount is now sent once from the donation form.
- The success page confirms the payment and refreshes campaign and admin queries.
- If webhook delivery is delayed, the confirmation path still helps the admin state catch up.
- For production reliability, webhook delivery should remain the source of truth.

## Files To Review Before Production

- [server/index.js](server/index.js)
- [scripts/start.js](scripts/start.js)
- [.env.local](.env.local)
- [src/services/donationService.js](src/services/donationService.js)
- [src/pages/Donation/DonationSuccessPage.jsx](src/pages/Donation/DonationSuccessPage.jsx)
