# Singh Sabha Milton

## Latest UX Updates (2026-07-18)

Recent member-facing improvements now included in the app:

1. Event registration and donation flows show signed-in identity as compact text cards instead of editable-looking textboxes.
2. Seva volunteer registration modal is smaller, more visual, and split into Personal Details and Registration Details sections.
3. Event detail calendar action is now presented as a pill-style action with icon treatment.
4. Global top-ribbon sign-in returns to Home, while page-specific gated sign-in links return users to the same page after login.
5. Profile editing now supports app-specific avatar uploads while preserving the user email as non-editable and keeping the uploaded avatar from being overwritten on future Google sign-ins.

## Donation Recording via Stripe Webhooks

This project now supports webhook-based Stripe donation recording so successful payments are saved even if a donor closes the browser after checkout.

The Donations page also supports the Zeffy campaign in an on-site iframe modal. Zeffy `payment.completed` events are accepted at `POST /api/zeffy/webhook`, authenticated with the server-only `ZEFFY_API_KEY` or `ZEFFY_WEBHOOK_TOKEN`, and persisted into the same donation ledger. See `PRODUCTION_DEPLOYMENT.md` for redirect and webhook setup.

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

## Events Database (PostgreSQL)

Events are now persisted via PostgreSQL using backend API routes. This replaces local-only event storage and allows cross-device verification when deployed.

### 1. Create a PostgreSQL instance

Use any managed Postgres provider (Neon, Supabase, Railway, Render, RDS, etc.) and create:

1. Database: `singhsabha_milton` (or your preferred name)
2. User with read/write access
3. Connection string

### 2. Configure environment

Set this in `.env.local` and in your deployment environment variables:

1. `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require`

Optional (if you do not use `DATABASE_URL`):

1. `DB_HOST`
2. `DB_PORT`
3. `DB_USER`
4. `DB_PASSWORD`
5. `DB_NAME`
6. `DB_SSL=true`

### 3. Automatic schema + seed

On server start, the app will automatically:

1. Create tables `events` and `event_registrants` if missing
2. Seed starter events only if the table is empty

### 4. Verify backend DB connection

Call health endpoint:

1. `GET /api/health`
2. Confirm `eventsDatabaseConfigured: true`

### 5. Verify cross-device persistence

1. Add/update an event in Admin -> Events
2. Open the app from another device/browser
3. Confirm the same event appears on Events calendar

## File Upload Storage (CMS, News, Events, Advertisements)

Admins can now either paste a URL or upload a file for supported fields in:

1. CMS
2. News
3. Events
4. Advertisements

Uploads are stored on disk (blob-style) under the backend folder structure:

1. `server/uploads/cms/YYYY/MM/...`
2. `server/uploads/news/YYYY/MM/...`
3. `server/uploads/events/YYYY/MM/...`
4. `server/uploads/advertisements/YYYY/MM/...`

The app serves uploaded files from:

1. `GET /api/uploads/<service>/<year>/<month>/<filename>`

### Important deployment requirements

1. Keep `server/uploads` on persistent storage (do not use ephemeral container filesystem for production).
2. If deploying with Docker/Kubernetes, mount a persistent volume to `server/uploads`.
3. If deploying to VM/bare-metal, include `server/uploads` in backup/restore plans.
4. Ensure your reverse proxy (Nginx/Apache/platform router) forwards `/api/uploads/*` to the Node backend.
5. Keep enough disk space and rotate old files as needed.

### Push/deploy checklist for uploads

1. Deploy application code as usual.
2. Create or mount the `server/uploads` directory in the runtime environment.
3. Verify upload endpoint works: `POST /api/uploads/cms`.
4. Verify file access works: open returned `url` from upload response.
5. If migrating environments, copy existing files from old `server/uploads` to the new storage before cutover.
