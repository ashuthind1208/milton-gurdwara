# OpenWA content notifications

## Current implementation status

The application can enqueue bilingual English/Punjabi group notices for same-day Hukamnama edits, publicly visible News, active Events, public CMS page/home information, and coalesced Langar grocery changes. The queue state is stored in the application's existing database singleton, so it survives Node process restarts. The worker enforces no more than three sends per rolling minute and bounded retries. OpenWA sending is disabled unless explicitly configured and enabled.

The intended WhatsApp group invite supplied for this integration is:

`https://chat.whatsapp.com/G03RTTbjYMm5OXEYCc4Lmh`

OpenWA requires a chat JID ending in `@g.us`, not an invite URL. The linked WhatsApp account must already be a group member. Resolve the correct JID from the OpenWA group-list endpoint and verify it against the group before enabling live sends.

## Hostinger deployment caveat

The existing Hostinger website file storage (even with 50 GB available) is not itself a persistent process runtime. OpenWA is a long-running WhatsApp Web session that needs a compatible Node/Docker process and persistent session data. Do not upload OpenWA files into the website document root or expose its API key/session files there. The app-side integration can be deployed to the existing Node application; the OpenWA service must be independently reachable by that backend. Confirm that the purchased Hostinger plan actually supports long-running processes/containers before attempting to host it there. No Hostinger resources were changed as part of this implementation.

## Environment variables

Configure these as server-side Hostinger environment values, never as `REACT_APP_*` variables:

- `OPENWA_URL`: private/reachable OpenWA base URL.
- `OPENWA_API_KEY`: OpenWA API key with permission to send to the configured session/group.
- `OPENWA_SESSION_ID`: OpenWA session UUID, not the human-readable session name.
- `WA_GROUP_ID`: verified group JID ending in `@g.us`, not the invite URL.
- `WA_NOTIFICATIONS_ENABLED=false`: leave disabled until endpoint, session, membership, and destination are verified.
- `WA_DRY_RUN=true`: start in dry-run mode; switch off only for a deliberate live-send test.
- `WA_BURST_WINDOW_MS=45000`: quiet window for grouping Langar edits; tune as needed.
- `SITE_BASE_URL=https://singhsabhamilton.com`: public links appended to messages.

Read-only readiness: `GET /api/notifications/openwa/status`. It returns enabled/dry-run/configured flags and pending count, never secrets.

## Trigger and visibility rules

- Hukamnama: only a change to today's date in `America/Toronto`; no previous/future date notices.
- News: only if active, publication date has arrived, and expiry has not passed. The worker rechecks News visibility immediately before send.
- Events: only active events; includes an inactive-to-active publication transition and material edits to active events.
- Langar: add/edit/remove operations coalesce into one message during the configurable quiet window.
- CMS pages and homepage public information: only material saved changes, not no-op saves or timestamp-only changes.

The queue is database-backed but currently assumes a single active application worker. If the Node app is horizontally scaled, add a DB-level lease/transaction lock before running multiple queue consumers. A timeout after WhatsApp accepts a message but before the server records success can still produce an at-least-once duplicate on retry; the OpenWA send API has no idempotency key in this integration.

## Validation

Run the isolated queue tests with `node --test server/openWaNotifications.test.js`. They use a fake database and mocked OpenWA client and do not send real WhatsApp messages.