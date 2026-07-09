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
