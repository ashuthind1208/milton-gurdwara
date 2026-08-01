# Website Change Worksheet - 2026-07-31

Use the issue number below when referring to a requested change.

| Issue | Requested change | Status | Implementation / validation |
|---|---|---|---|
| 1 | Restore Live Kirtan playback on web and mobile. | Complete - decoded playback retested | The SGPC source is MPEG-2 AAC/ADTS, which transferred valid bytes but never reached browser metadata or playback. The backend now uses one shared FFmpeg process to produce a rolling two-second fragmented-MP4 HLS stream. Safari/iOS uses native HLS and other supported browsers use `hls.js`. Real React compact and desktop players each fired `playing`, reached `readyState: 4`, remained unpaused, reported no media error, and advanced by approximately three seconds during a measured three-second interval. Backend shutdown also terminates the shared FFmpeg child to prevent duplicate playlist writers after restarts. |
| 2 | Keep navbar fixed at the top and preserve its compact scrolling state. | Complete | Replaced the sticky-breaking root overflow containment while retaining the existing compact scroll state logic. Production build passed. |
| 3 | Slow the Home events and daily schedule tickers to match the ticker above the hero. | Complete - retested | Removed the remaining inline `34s` events override. Device emulation confirmed the top, events, and daily schedule ticker rules use the 160-second reference duration. |
| 4 | Restore the ticker above the hero on mobile. | Implementation complete - real iOS smoke test required | Rebuilt the marquee as two identical non-shrinking groups with prefixed Safari animation and `translate3d`. At a 390 x 844 viewport, the 54,807 px track contained real observance text and had one or two visible items at 0%, 25%, 50%, 75%, and 99.4% of the animation cycle, including the group handoff. The automation clock was frozen, so actual iOS Safari remains the final motion check. |
| 5 | Hide Admin Portal access from unapproved members. | Complete | Admin Portal controls now require privileged access, approved status, and an active account; the protected route continues to enforce the same account gates. Production build passed. |
| 6 | Derive member active status from paid membership fees; block manual activation without payment; auto-activate after payment; improve acceptance email with fee information attachment. | Complete - attachment rendered | Enforced fee-derived Member status on both user persistence APIs, retained manual deactivation, blocked unpaid activation in UI/server, preserved inactive creation, and clarified approval messaging. Approval email and Membership Fee Tracking now share a branded PDF generator with logo, organization details, status panel, member profile, latest payment, validity date, and record-keeping copy. The exact generator produced a 153,140-byte one-page PDF; Quick Look validation found no clipping or overlap after the header adjustment. See [PDF preview](screenshots/Membership_Fee_Attachment_Preview.pdf) and [rendered page](screenshots/Membership_Fee_Attachment_Preview.png). |
| 7 | Remove desktop admin sidebar scrollbar and extend its background through the full page height. | Complete | Removed desktop viewport-height/sticky scrolling and made the sidebar stretch to the page grid height. Production build passed. |
| 8 | Allow multiple cash donations per donor, preserve each date, and split donor details into required name plus optional email/phone. | Complete - feedback added | Each Add Cash Donation modal opening receives a fresh `GRC-YYYYMMDD-...` receipt and submission failures remain visible in the modal. While saving, the submit button is disabled and displays a spinning loader. After saving, the modal remains open, resets for another entry, and displays `Cash donation saved successfully.` with a green confirmation icon. Duplicate receipt testing still returns the actionable `409 Conflict` without adding a record. |
| 9 | Fix `INVALID DATE` in Seva Opportunity Reminder emails and send a test reminder. | Complete | The formatter now accepts date-only values and full ISO timestamps. Preview rendered `Seva Date: August 4, 2026`; a manual test sent successfully to 2 confirmed registrations with 0 skipped or failed deliveries. |

## Validation Log

- `node --check server/index.js` passed.
- `node --check server/db/postgres.js` passed.
- `npm run build` passed after the final PDF header adjustment.
- `CI=true npm test -- --watchAll=false` passed: 1 suite, 1 test. Jest still reports existing API network console noise and an open-handle warning after completion.
- `git diff --check` passed.
- Mobile layout validation found visible ticker content throughout five sampled points in the complete animation cycle; real iOS Safari motion validation remains pending.
- The HLS playlist returned `200 application/vnd.apple.mpegurl` with a version 7 fragmented-MP4 map and rolling two-second segments. In real Chrome, both the compact Live sheet and desktop navbar player fired `playing`, reached `readyState: 4`, remained unpaused, had no `MediaError`, and advanced by approximately 3.0 seconds over a measured three-second interval.
- Backend restart validation confirmed its signal handler terminates the shared FFmpeg child; the final backend instance owns exactly one HLS writer.
- Cash duplicate receipt verification returned the specific `409` message without changing the existing 47-record dataset.
- Cash submission now shows an animated saving indicator and an in-modal success confirmation while preparing a fresh receipt for the next entry.
- The membership attachment was generated through the compiled production utility, rendered to PNG, and visually checked for overlap, clipping, and legibility.
- Seva reminder preview showed a valid date, and the manual reminder test reported 2 sent and 0 skipped.
