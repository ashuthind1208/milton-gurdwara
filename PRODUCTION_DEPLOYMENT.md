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
- `REACT_APP_DONATION_PUBLIC_URL`
  - Required for donation-board QR correctness.
  - Example: `https://yourdomain.com`
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
- `YOUTUBE_API_KEY`
  - Server-side key with YouTube Data API access.
- `VOLUNTEER_REMINDER_WEBHOOK_URL`
  - Reminder email webhook.
- `VOLUNTEER_REMINDER_SEND_TIME`
  - 24h format (`HH:mm`).
- `VOLUNTEER_REMINDER_TIME_ZONE`
  - IANA timezone (example: `America/Toronto`).
- `VOLUNTEER_REMINDER_BASE_URL`
  - Public URL for email logo/assets.
- `VOLUNTEER_REMINDER_LOGO_URL`
  - Public image URL for reminder emails.

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
   - Set `REACT_APP_DONATION_PUBLIC_URL=https://<frontend-domain>`
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

## 12) Common Pitfalls

- QR shows localhost in production
  - Fix `REACT_APP_DONATION_PUBLIC_URL`.
- OAuth fails after deploy
  - Redirect URI mismatch between Google config and env URL.
- Missing sponsor/advertisement images after redeploy
  - Upload storage not persistent.
- Donations not updating board
  - Check backend API health, DB connectivity, and query polling/fallback behavior.

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
