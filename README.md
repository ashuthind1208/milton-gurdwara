# Singh Sabha Milton

## Donation Recording via Stripe Webhooks

This project now supports webhook-based Stripe donation recording so successful payments are saved even if a donor closes the browser after checkout.

### What was added

1. Backend Checkout Session creation endpoint:
	- `POST /api/stripe/create-checkout-session`
	- Uses Stripe Checkout with `submit_type: donate` and `custom_unit_amount`.
	- Stores donor/campaign details in Stripe `metadata`.
2. Backend webhook endpoint:
	- `POST /api/stripe/webhook`
	- Verifies Stripe signature using `STRIPE_WEBHOOK_SECRET`.
	- Persists `checkout.session.completed` records into `server/data/donations.json`.
3. Backend donation read endpoints:
	- `GET /api/donations`
	- `GET /api/donations/summary`
4. Frontend integration:
	- Donation flow creates Stripe Checkout Sessions through backend.
	- Admin donation list merges webhook records.
	- Campaign totals include webhook-donation summaries.

### Environment variables required

Add these to `.env.local`:

1. `STRIPE_SECRET_KEY=sk_test_...` (or live key)
2. `STRIPE_WEBHOOK_SECRET=whsec_...`
3. `STRIPE_CURRENCY=cad` (optional, defaults to `cad`)

### Stripe Dashboard setup

1. Go to Stripe Dashboard -> Developers -> Webhooks.
2. Add endpoint URL:
	- Local dev with Stripe CLI forwarding: `http://127.0.0.1:4242/api/stripe/webhook`
	- Production: `https://your-domain/api/stripe/webhook`
3. Subscribe to event:
	- `checkout.session.completed`
4. Copy Signing Secret into `STRIPE_WEBHOOK_SECRET`.

### Local testing flow

1. Start app:
	- `npm start`
2. In another terminal, forward Stripe webhooks to local backend:
	- `stripe listen --forward-to 127.0.0.1:4242/api/stripe/webhook`
3. Perform a test donation from the site.
4. Verify:
	- Donation appears in Admin -> Donations
	- `server/data/donations.json` contains the webhook record

### Scripts

1. `npm start` starts both:
	- Frontend (`react-scripts start`)
	- Local Stripe helper API (`server/index.js`)
2. `npm run build` builds the React app.
