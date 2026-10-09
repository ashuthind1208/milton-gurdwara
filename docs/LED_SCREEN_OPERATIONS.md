# LED board operations

## Screen addresses

The kiosk board accepts a stable screen identity in its query string:

- Main hall: `/led-boards?screen=main`
- Darbar hall: `/led-boards?screen=darbar`
- Langar hall: `/led-boards?screen=langar`
- Lobby: `/led-boards?screen=lobby`

Keep each display on its own URL and leave the browser running. Screens report a heartbeat every 30 seconds; the admin marks them offline after 90 seconds without a heartbeat. Browser network interruptions can delay updates. The Special Events board also accepts `?screen=...` and reports its heartbeat.

## Admin controls

Open **Admin → LED Board**:

Emergency and screen-health controls require an Admin or Super Admin sign-in.

- **Scheduled announcements:** optionally choose a local start/end date and time, weekdays, and target screens. With no weekdays chosen the announcement can display every day in its date/time window. With no target screens selected it is eligible on all screens. Schedules are checked while the board polls announcements; images and text follow the same timing rules.
- **Per-screen playlists:** select a screen and check the enabled boards, in the configured order. Screens without a saved screen playlist use the global board toggles. A board globally turned off is omitted from every screen playlist.
- **Gurpurab/Sangrand banner:** the board checks the existing Nanakshahi holidays feed and adds a banner for today's matching observances. Other boards continue if that feed is unavailable.
- **Emergency override:** one authorized admin action covers every screen using the kiosk/special-events routes. Set a concise headline and optional directions, then choose an automatic expiry (15 minutes to 4 hours). Screens poll the override every five seconds. Clear it early when safe; it also expires automatically.
- **Screen health:** last-seen time, online/offline/unknown state, and the last reported slide are shown in the same admin page.

The playlist and announcement data use the site's existing database singleton/item storage. Emergency and screen health data use server-managed LED API resources. Keep the backend running for screen polling and status updates.

## Holiday feed configuration

The frontend uses `REACT_APP_GURPURAB_HOLIDAYS_API_URL` at build time when provided; otherwise it uses the existing public `https://api.gurpurab.com/v1/holidays` feed. To use another feed, set the variable in the frontend build environment and rebuild/redeploy the React app. The expected response is the same Gurpurab API format already consumed by the Nanakshahi calendar. The banner shows only Gurpurab observances or entries whose type/title identifies Sangrand/Sankranti and whose Gregorian date is today.

## Deploy/restart checklist

1. Deploy the frontend and server changes together; keep the bundled `@napi-rs/canvas` native package and server assets in the production server install/package.
2. Ensure production `UPLOAD_DIR` remains persistent if social cards are enabled. Existing event image URLs continue to use the site's upload endpoint.
3. Restart the Node.js server so the new `/api/led/override`, `/api/led/heartbeat`, and `/api/led/screens/health` endpoints are loaded.
4. Restart the server, open the LED admin, and set screen-specific playlists as desired. Add `?screen=...` to each physical screen's URL.
5. After deploy, manually reload each existing kiosk once. Thereafter announcements/settings refresh in-page; the override refreshes every five seconds and board settings refresh about every 15 seconds.
6. Verify each physical screen appears in Screen health, then test an emergency override for a short period and clear it.
