# Social cards: production setup and operating guide

The admin page at `/admin/social-posts` creates branded 1080 × 1350 (4:5) JPEGs for the daily Hukamnama and event posters, previews them, and keeps a post log. Posting defaults to **dry-run**. Real Meta publishing has a separate server-side kill switch and is disabled until explicitly enabled.

## Server environment

Set these in the production server environment (for example, the hosting provider's environment-variable screen or protected secret store). Do not place access tokens in React `REACT_APP_*` variables, source control, client storage, or a committed `.env` file.

| Variable | Required | Purpose |
|---|---:|---|
| `PUBLIC_SITE_URL` | Yes for live posts | Canonical public HTTPS origin, e.g. `https://www.example.org`, no trailing slash. Meta must be able to download the generated JPEG at this public URL. It must not be localhost or a private address. |
| `META_PAGE_ACCESS_TOKEN` | Yes | Page access token used for Instagram Graph API and Facebook Page photo publishing. Use a long-lived token with the minimum necessary permissions. |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram only | Instagram professional/business account ID connected to the Facebook Page. |
| `FACEBOOK_PAGE_ID` | Facebook only | Facebook Page ID for posting event/Hukamnama photo posts. |
| `ENABLE_SOCIAL_CARDS` | Yes to go live | Set `false` (or omit) while configuring and testing. Set to `true` only after dry-runs pass and both account permissions have been verified. |
| `SOCIAL_CARDS_TIME_ZONE` | No | IANA timezone for scheduled send time and event dates; default is `America/Toronto`. |
| `SOCIAL_ORGANIZATION_NAME` | No | Organization name printed in the card footer; default is `Gurdwara Singh Sabha Milton`. |

Meta app/Page configuration typically needs Instagram Graph publishing permissions (`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`) and, for Facebook Page photo posts, `pages_manage_posts`. Meta's review and token requirements depend on the app/account type. Connect an Instagram professional account to the Facebook Page and use Meta's current Graph API access-token guidance. Never send tokens through chat or put them into this repository.

## Enable safely

1. Deploy the server code and restart the Node.js server so it reads the new environment variables. The image renderer uses the bundled Noto fonts and Gurdwara logo under `server/assets`; keep these deployment assets with the server package.
2. Set `PUBLIC_SITE_URL` to the site's public HTTPS origin. In production, also keep the configured persistent `UPLOAD_DIR`; generated JPEG files are saved under `UPLOAD_DIR/social/YYYY/MM/` and served from `/api/uploads/social/...`.
3. Add the Meta IDs/token to the server secret store, but leave `ENABLE_SOCIAL_CARDS=false`.
4. Restart the server and open `/admin/social-posts` as an admin. Check the Instagram/Facebook/public-HTTPS indicators. Leave **Test mode (dry run)** enabled, preview a current Hukamnama and upcoming event, and use each Test post button. Confirm a dry-run record appears in Recent posts and no platform post is created.
5. Correct any account, media URL or card layout issue before going live. If only one platform is configured, disable the other platform in the admin settings.
6. Set `ENABLE_SOCIAL_CARDS=true` in the server environment and restart the Node.js process. In the admin, uncheck Test mode and save; confirm before using Post now. Begin with a manual post to each selected platform and verify it on the actual Page/account.
7. Enable automatic posting only after a successful manual test. Set the Hukamnama send time. The worker checks once per minute and posts once per date after the configured time. New active events are posted when created. Both automations respect Test mode and platform toggles.

To immediately stop live posting, set `ENABLE_SOCIAL_CARDS=false` and restart the server. You can also re-enable Test mode from the admin page. Each LED/social admin change is stored in the app database; secret values remain in the server environment only.

## Behavior and limits

- Hukamnama cards include Gurmukhi, English meaning when available, Ang, Raag, writer, date, and the organization footer. Card copy also includes a short text caption and the `/hukamnama` link.
- Event posters include the event title, date/time, location, description, optional event image, and `/events` link. External poster images must be on public HTTP(S) hosts; unsafe/private hosts are not fetched.
- Image previews require a Hukamnama entry for the selected date or an existing event. Test post writes a JPEG and log record but never calls Meta.
- Automatic event posters are deduplicated per event ID; daily Hukamnama posts are deduplicated per date. Recent post records retain the latest 200 attempts.
- Meta may take time to fetch a freshly generated image. If publishing fails, inspect the platform-specific detail in Recent posts and the server logs; do not repeatedly retry until checking the Page/account state.

## Troubleshooting checklist

- **No card preview:** verify the selected Hukamnama date exists, or check that the event still exists.
- **Live post disabled:** the admin status shows the missing server switch, token/account ID, or public HTTPS URL.
- **Meta cannot fetch the image:** confirm `PUBLIC_SITE_URL` is reachable from the public internet, HTTPS is valid, and `/api/uploads/` files are publicly readable.
- **Permission/token error:** renew the Page access token and check that the correct professional Instagram account is linked to the Page. Update the server secret store and restart.
- **Scheduled post not sent:** verify auto-post is enabled, dry-run is off, the server is running, the requested date has a Hukamnama record, and the server timezone is correct.
