# Social cards: production setup and operating guide

The admin page at `/admin/social-posts` creates branded 1080 × 1350 (4:5) JPEGs for the daily Hukamnama and event posters, previews them, and keeps a post log. Posting defaults to **dry-run**. Real Meta publishing has a separate server-side kill switch and is disabled until explicitly enabled.

## Server environment

Set these in the production server environment (for example, the hosting provider's environment-variable screen or protected secret store). Do not place access tokens in React `REACT_APP_*` variables, source control, client storage, or a committed `.env` file.

| Variable | Required | Purpose |
|---|---:|---|
| `PUBLIC_SITE_URL` | Yes for Instagram (Facebook uploads the image directly) | Canonical public HTTPS origin, e.g. `https://www.example.org`, no trailing slash. Meta must be able to download the generated JPEG at this public URL. It must not be localhost or a private address. |
| `META_PAGE_ACCESS_TOKEN` | Yes | Page access token used for Instagram Graph API and Facebook Page photo publishing. Use a long-lived token with the minimum necessary permissions. |
| `META_APP_ID` | Token status checker | Meta app ID paired with `META_APP_SECRET`; used only by the server to inspect token expiry/scopes. |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram only | Instagram professional/business account ID connected to the Facebook Page. |
| `FACEBOOK_PAGE_ID` | Facebook only | Facebook Page ID for posting event/Hukamnama photo posts. |
| `META_WA_ACCESS_TOKEN` | WhatsApp only | Meta WhatsApp Cloud API bearer token with `whatsapp_business_messaging` access. Keep it server-side. |
| `META_WA_PHONE_NUMBER_ID` | WhatsApp only | Sender Phone Number ID from the WhatsApp product in Meta for Developers. |
| `SOCIAL_WHATSAPP_TO` | WhatsApp individual recipient | Recipient's international phone number. Overrides `WHATSAPP_GROUP_NUMBER`, which is used as a fallback. |
| `SOCIAL_WHATSAPP_RECIPIENT_TYPE` | No | Defaults to `individual`. Set to `group` only for an eligible Meta Groups API destination. |
| `SOCIAL_WHATSAPP_GROUP_ID` | WhatsApp Groups API only | Opaque group ID created by Meta's Groups API. Regular WhatsApp group JIDs such as IDs ending in `@g.us` are not accepted. |
| `WHATSAPP_GRAPH_API_VERSION` | No | Meta Graph API version for WhatsApp; defaults to `v25.0`. |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook setup | A private random string you choose; Meta's Callback URL form must use the exact same string. |
| `META_APP_SECRET` | Webhook POST validation | App Secret from Meta for Developers → App settings → Basic. Used to validate Meta's `X-Hub-Signature-256` header; never expose it to the browser. |
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

## WhatsApp setup

### Complete the Webhooks step

The app now accepts Meta's verification handshake at `https://singhsabhamilton.com/api/webhooks/whatsapp`.

1. Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in the Node server environment to a random string you choose. Paste the identical string into Meta's **Verify token** field. This is not the access token and is not generated by Meta. Do not include quotes or spaces around it.
2. In Meta's **Callback URL** field, enter `https://singhsabhamilton.com/api/webhooks/whatsapp`. Ensure the deployed server is reachable publicly over HTTPS and restart it after setting the variable.
3. Click **Verify and save**. Meta sends a GET request with `hub.mode`, `hub.verify_token`, and `hub.challenge`; the endpoint compares the verify token and returns the challenge. A wrong/missing token returns 403.
4. Add `META_APP_SECRET` from **App settings → Basic** to the server environment too, then restart. It is used to verify signed POST notifications. The endpoint acknowledges valid callbacks; it currently logs minimal event metadata rather than storing incoming messages or delivery statuses.
5. Subscribe to the WhatsApp `messages` webhook field in the app's WhatsApp webhook configuration. If Meta's app dashboard also shows an app-wide Webhooks product, the WhatsApp configuration is still the relevant subscription for WhatsApp events.

If verification fails, check the exact callback path and HTTPS, confirm that `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is set on the running server and exactly matches Meta's Verify token, restart, and retry. Do not paste either token or App Secret into chat.

### Get the WhatsApp API token

1. In Meta for Developers → WhatsApp → **API Setup**, use the temporary access token provided there and the displayed **Phone Number ID**. Add and verify the development test recipient in that page. Webhook verification does not itself create or grant an access token; it connects Meta's callback to your server.
2. Store `META_WA_ACCESS_TOKEN` and `META_WA_PHONE_NUMBER_ID` in the server environment. Set `SOCIAL_WHATSAPP_TO` to an international-format recipient phone number. The code uploads the generated JPEG to Meta and sends it as an image message.
3. To send to a group, configure `SOCIAL_WHATSAPP_RECIPIENT_TYPE=group` and set `SOCIAL_WHATSAPP_GROUP_ID` to a group ID created through Meta's Groups API. Groups API eligibility requires an Official Business Account; it cannot target an arbitrary existing WhatsApp group or a JID ending in `@g.us`.
4. For production, create a System User token in Business Settings, assign the WhatsApp/Page assets and required permissions, and select **Never** expiration if offered. Configure `META_APP_ID` and `META_APP_SECRET` for the admin token checker too. Meta does not provide a general refresh-token endpoint for these server tokens; a revoked token must be reissued in Meta, copied into the server environment, and followed by a backend restart. The Social Posts page has a **Check Meta token status** action; its Meta settings link opens System Users. The checker reports validity, scopes, and expiry but never renews or displays the token.
5. Enable WhatsApp in `/admin/social-posts` and save. For a live test, disable Instagram and Facebook, ensure the recipient opted in and meets Meta's messaging rules, set `ENABLE_SOCIAL_CARDS=true`, turn off Test mode, then manually post. Dry runs never send.

This implementation sends direct image messages. Meta requires an approved template for business-initiated messages outside the 24-hour customer-service window; template-based image sending is not implemented here. OpenWA environment variables are not used by social-card posting (other notification features may still use them).

## Behavior and limits

- Hukamnama cards include Gurmukhi, English meaning when available, Ang, Raag, writer, date, and the organization footer. Card copy also includes a short text caption and the `/hukamnama` link.
- Event posters include the event title, date/time, location, description, and `/events` link on the blue gradient background; event photos are not used in the poster.
- Image previews require a Hukamnama entry for the selected date or an existing event. Test post writes a JPEG and log record but never calls Meta.
- Automatic event posters are deduplicated per event ID; daily Hukamnama posts are deduplicated per date. Recent post records retain the latest 200 attempts.
- Meta may take time to fetch a freshly generated image. If publishing fails, inspect the platform-specific detail in Recent posts and the server logs; do not repeatedly retry until checking the Page/account state.

## Troubleshooting checklist

- **No card preview:** verify the selected Hukamnama date exists, or check that the event still exists.
- **Live post disabled:** the admin status shows the missing server switch, token/account ID, or public HTTPS URL.
- **Meta cannot fetch the image:** confirm `PUBLIC_SITE_URL` is reachable from the public internet, HTTPS is valid, and `/api/uploads/` files are publicly readable.
- **Permission/token error:** renew the Page access token and check that the correct professional Instagram account is linked to the Page. Update the server secret store and restart.
- **Scheduled post not sent:** verify auto-post is enabled, dry-run is off, the server is running, the requested date has a Hukamnama record, and the server timezone is correct.
