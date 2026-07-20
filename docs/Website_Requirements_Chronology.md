# Singh Sabha Milton Website
## Reverse Chronological Requirements Breakdown (Epics, Stories, Tasks)

Date prepared: 2026-07-17  
Scope: Requirements implemented during the current delivery cycle

---

## How to read this document
- Reverse chronological order is preserved: latest request first, earliest request last.
- Each Epic includes user-driven Stories and implementation Tasks.
- Status reflects current implemented state in the codebase.

---

## Timeline Summary (Latest to Earliest)

| Order | Epic | Focus Area | Status |
|---|---|---|---|
| 1 | Epic J | Signed-in flow polish and compact profile/forms UX | Done |
| 2 | Epic I | Mobile admin CTA parity | Done |
| 3 | Epic H | Festival Hub decommission | Done |
| 4 | Epic G | Family dashboard donation list pagination | Done |
| 5 | Epic F | Visibility gating for unauthenticated users | Done |
| 6 | Epic E | Runbook and executive documentation assets | Done |
| 7 | Epic D | Profile and identity safety constraints | Done |
| 8 | Epic C | Auth, role policy, and admin access governance | Done |
| 9 | Epic B | Registration integrity and duplicate prevention | Done |
| 10 | Epic A | Public UI polish and clarity updates | Done |

---

## Epic J: Signed-in flow polish and compact profile/forms UX

### Story J1: Make event add-to-calendar control part of pill stack
Requirement:
- Convert add-to-calendar action into a pill with icon treatment.
- Keep event title on one line with ellipsis.
- Move event date/time into concise supporting copy near the title/action.

Tasks:
- Add calendar glyph pill in event detail header.
- Collapse date/time into concise labels.
- Truncate event heading text with ellipsis.

Outcome:
- Event detail modal now uses a more consistent pill-based action layout.

### Story J2: Preserve current page after sign-in from gated event, seva, and donation actions
Requirement:
- If sign-in is triggered from an action guard, return the user to the same page after login.
- If sign-in is triggered from the top ribbon CTA, default to Home after login.

Tasks:
- Keep page-specific `next` query params on gated sign-in links.
- Remove `next` override from top ribbon sign-in CTA.

Outcome:
- Action recovery is preserved while global sign-in continues to land on Home.

### Story J3: Replace signed-in identity textboxes with compact identity cards
Requirement:
- Donation, Seva, and Event registration flows should show signed-in identity as text, not editable textboxes.

Tasks:
- Replace visible name/email/phone inputs with read-only identity cards.
- Keep hidden submitted values for backend compatibility.

Outcome:
- Signed-in forms are shorter, clearer, and less repetitive on desktop and mobile.

### Story J4: Improve profile edit modal with app-specific avatar upload
Requirement:
- Allow users to upload a profile image for the application.
- Do not allow email edits in the profile modal.
- Preserve uploaded app avatar on future Google sign-ins.

Tasks:
- Add avatar upload control and preview to profile modal.
- Remove editable email field from profile modal.
- Save uploaded avatar URL in user profile.
- Preserve stored avatar ahead of provider avatar during Google login.

Outcome:
- Users can manage an app-specific profile image without altering provider account identity.

### Story J5: Make Seva volunteer registration modal more concise and engaging
Requirement:
- Reduce modal footprint.
- Split personal details and registration details into separate cards.
- Keep controls mobile-safe and visually stronger.

Tasks:
- Tighten modal width and restyle shell.
- Add readonly signed-in identity card.
- Group registration controls into a second compact card.

Outcome:
- Seva registration is more focused, visually stronger, and responsive on mobile.

---

## Epic I: Mobile admin CTA parity

### Story I1: Add mobile Go to Admin Portal button placement
Requirement:
- On mobile menu, show Go to Admin Portal button above Logout.

Tasks:
- Add conditional mobile CTA using same role visibility rule as desktop.
- Position CTA directly above logout action.

Outcome:
- Mobile and desktop admin shortcut behavior now consistent.

---

## Epic H: Festival Hub decommission

### Story H1: Remove Festival Hub page from product surface
Requirement:
- Remove Festival Hub page.

Tasks:
- Remove public route wiring.
- Remove admin route wiring.
- Remove public/admin nav entries.
- Remove related layout icon mapping.
- Delete obsolete page/admin/service files.

Outcome:
- Festival Hub removed from routes, menus, and source modules.

---

## Epic G: Family dashboard donation pagination

### Story G1: Paginate donation amount/history list
Requirement:
- Add pagination to donation list in Family Dashboard.

Tasks:
- Add page state and page-size logic.
- Render paginated subset of donation records.
- Add Previous/Next controls and page indicator.
- Clamp page index when dataset changes.

Outcome:
- Donation history list paginated for readability.

---

## Epic F: Visibility gating for unauthenticated users

### Story F1: Hide Event registration form for signed-out users
Requirement:
- Keep sign-in card visible, but hide all event registration fields/buttons until sign-in.

Tasks:
- Conditional render: show sign-in card only when unauthenticated.
- Render form controls only for authenticated users.

Outcome:
- Event page no longer exposes registration inputs while signed out.

### Story F2: Hide Donation form for signed-out users
Requirement:
- Keep sign-in card visible, but hide donation form and payment controls until sign-in.

Tasks:
- Guard donation form rendering by auth status.
- Guard pending checkout action area by auth status.

Outcome:
- Donation page now auth-gated for actionable inputs.

### Story F3: Hide Seva registration controls for signed-out users
Requirement:
- Show sign-in card for Seva registration and hide register action/form until sign-in.

Tasks:
- Hide Register for Seva button for signed-out users.
- Show sign-in prompt card with next route.
- Ensure registration modal cannot render unauthenticated.

Outcome:
- Seva registration UI now properly auth-gated.

---

## Epic E: Runbook and executive documentation assets

### Story E1: Build complete handbook/runbook package
Requirement:
- Create comprehensive handbook with cover page, index, feature breakdown, page-by-page capabilities, and screenshots.

Tasks:
- Capture screenshots for public and admin modules.
- Build markdown handbook.
- Generate styled HTML.
- Generate executive PPTX.
- Generate PDF artifact.

Outcome:
- Documentation suite created under docs (MD/HTML/PDF/PPTX + screenshots).

### Story E2: Humanize the narrative
Requirement:
- Rewrite docs/deck language to be less mechanical.
- Explicitly answer: who uses this site, why they use it, what value is gained.

Tasks:
- Rewrite handbook content in people-first voice.
- Update deck narrative to value-driven messaging.

Outcome:
- Humanized, audience-focused documentation delivered.

---

## Epic D: Profile and identity safety constraints

### Story D1: Lock immutable email in profile modal
Requirement:
- Email should not be editable in profile edit modal.

Tasks:
- Make email read-only in profile form.

Outcome:
- Email edits blocked in profile UI.

### Story D2: Remove image URL editing
Requirement:
- Remove direct image URL editing option in profile flow.

Tasks:
- Remove image URL field and payload updates for that field.

Outcome:
- Profile editing surface simplified and safer.

---

## Epic C: Auth, role policy, and admin access governance

### Story C1: Fix sign-in pending message behavior
Requirement:
- Pending/approval messaging should not incorrectly appear for already signed-in users.

Tasks:
- Adjust sign-in/pending condition logic in navbar/login flow.
- Ensure state reflects real auth context.

Outcome:
- Pending messaging behavior corrected.

### Story C2: Add role-aware admin portal shortcut
Requirement:
- Add Go to Admin Portal button in details callout for Admin/Super Admin/Member/Volunteer.
- Do not show for Family role.

Tasks:
- Add conditional CTA in authenticated details callout.
- Enforce role visibility rules.

Outcome:
- Authorized users receive direct admin access CTA; Family users do not.

### Story C3: Preserve role consistency on sign-in
Requirement:
- Existing user roles should not be overwritten on normal sign-in (especially after admin role edits).

Tasks:
- Update auth policy resolution to preserve existing role for known users.
- Keep allowlist admin override behavior.

Outcome:
- Role overwrite regression resolved.

### Story C4: Intent-based auth policy
Requirement:
- Sign In and Become Member should follow distinct role/approval outcomes.

Tasks:
- Keep Sign In flow role-safe and auto-approved where appropriate.
- Keep Become Member flow as Member with pending approval.
- Honor REACT_APP_ADMIN_EMAILS allowlist as Super Admin path.

Outcome:
- Deterministic role/approval policy implemented.

### Story C5: Post-login navigation sanity
Requirement:
- If no explicit return path is provided, default post-login destination should be Home.

Tasks:
- Update post-auth redirect resolver.

Outcome:
- Post-login default route now stable and user-friendly.

---

## Epic B: Registration integrity and duplicate prevention

### Story B1: Prevent duplicate event registrations
Requirement:
- Ensure the same user cannot register multiple times for the same event.

Tasks:
- Add duplicate match checks against registrants.
- Block submission when duplicate detected.
- Show already-registered messaging.

Outcome:
- Duplicate event registrations prevented at UX layer.

### Story B2: Prevent duplicate Seva registrations
Requirement:
- Ensure the same user cannot register multiple times for the same Seva opportunity.

Tasks:
- Add duplicate detection in volunteer registration pipeline.
- Mark already-registered opportunities in select options.
- Disable submit for already-registered state.

Outcome:
- Duplicate Seva registrations prevented and clearly communicated.

### Story B3: Make already-registered state explicit in forms
Requirement:
- For event/seva registration, submit button should be disabled with text indicating already registered.

Tasks:
- Add state-aware button labels.
- Add warning/info messages in form body.
- Enforce disabled submit conditions.

Outcome:
- Strong user feedback and fewer accidental retries.

---

## Epic A: Public UI polish and clarity updates

### Story A1: Restore missing social signals in footer
Requirement:
- Social media icons are absent from footer; restore them.

Tasks:
- Reintroduce footer social icon links.
- Ensure icons render in footer across responsive breakpoints.

Outcome:
- Footer social icons restored.

### Story A2: Improve donation amount readability
Requirement:
- Show donation metric in compact format (example: 22.9K).

Tasks:
- Add compact formatter for donation totals.
- Apply formatter in navbar/family summary surfaces.

Outcome:
- Compact donation number display implemented.

### Story A3: Improve Seva Opportunities mobile UX density
Requirement:
- On mobile Seva Opportunities admin cards, keep first icon as context menu and remove extra action clutter.

Tasks:
- Consolidate actions into mobile context menu.
- Slim card action layout for smaller screens.

Outcome:
- Cleaner mobile action model for Seva Opportunities admin.

### Story A4: Simplify Family dashboard visual noise
Requirement:
- Remove status text labels like confirmed/pending/waitlist from family event/seva summary rows.

Tasks:
- Remove status line rendering for family-facing records.
- Keep essential data only (title/date/time/amount).

Outcome:
- Family dashboard simplified with less cognitive load.

---

## Delivered Requirement Checklist

- Footer social icons restored.
- Donation compact numeric display added.
- Seva admin mobile card actions simplified.
- Family dashboard status noise removed.
- Profile: email read-only, image URL editing removed.
- Event duplicate registration prevention added.
- Seva duplicate registration prevention added.
- Already-registered disabled button states/messages added.
- Sign-in pending behavior corrected.
- Role-aware admin portal CTA added.
- Role overwrite on sign-in fixed.
- Intent/approval/allowlist policy enforced.
- Post-login default to Home.
- Runbook + screenshots + PDF + PPTX delivered.
- Documentation rewritten in humanized value-first tone.
- Event/Donation/Seva forms hidden for signed-out users.
- Family dashboard donation list paginated.
- Festival Hub removed from website.
- Mobile admin CTA added above logout.

---

## Suggested next iteration (optional)

- Add numeric pagination buttons for donation history (1, 2, 3...).
- Add product release tags/versioning per Epic.
- Add traceability links from each Story to commit hashes and QA cases.

---

End of reverse chronological requirements document.
# Singh Sabha Milton Website
## Chronological Requirements Breakdown (Epics, Stories, Tasks)

Date prepared: 2026-07-17  
Scope: Requirements implemented during the current delivery cycle

---

## How to read this document
- Chronological order is preserved from earliest request to latest request.
- Each Epic includes user-driven Stories and implementation Tasks.
- Status reflects current implemented state in the codebase.

---

## Timeline Summary

| Order | Epic | Focus Area | Status |
|---|---|---|---|
| 1 | Epic A | Public UI polish and clarity updates | Done |
| 2 | Epic B | Registration integrity and duplicate prevention | Done |
| 3 | Epic C | Auth, role policy, and admin access governance | Done |
| 4 | Epic D | Profile and identity safety constraints | Done |
| 5 | Epic E | Runbook and executive documentation assets | Done |
| 6 | Epic F | Visibility gating for unauthenticated users | Done |
| 7 | Epic G | Family dashboard donation list pagination | Done |
| 8 | Epic H | Festival Hub decommission | Done |
| 9 | Epic I | Mobile admin CTA parity | Done |

---

## Epic A: Public UI polish and clarity updates

### Story A1: Restore missing social signals in footer
Requirement:
- Social media icons are absent from footer; restore them.

Tasks:
- Reintroduce footer social icon links.
- Ensure icons render in footer across responsive breakpoints.

Outcome:
- Footer social icons restored.

### Story A2: Improve donation amount readability
Requirement:
- Show donation metric in compact format (example: 22.9K).

Tasks:
- Add compact formatter for donation totals.
- Apply formatter in navbar/family summary surfaces.

Outcome:
- Compact donation number display implemented.

### Story A3: Improve Seva Opportunities mobile UX density
Requirement:
- On mobile Seva Opportunities admin cards, keep first icon as context menu and remove extra action clutter.

Tasks:
- Consolidate actions into mobile context menu.
- Slim card action layout for smaller screens.

Outcome:
- Cleaner mobile action model for Seva Opportunities admin.

### Story A4: Simplify Family dashboard visual noise
Requirement:
- Remove status text labels like confirmed/pending/waitlist from family event/seva summary rows.

Tasks:
- Remove status line rendering for family-facing records.
- Keep essential data only (title/date/time/amount).

Outcome:
- Family dashboard simplified with less cognitive load.

---

## Epic B: Registration integrity and duplicate prevention

### Story B1: Prevent duplicate event registrations
Requirement:
- Ensure the same user cannot register multiple times for the same event.

Tasks:
- Add duplicate match checks against registrants.
- Block submission when duplicate detected.
- Show already-registered messaging.

Outcome:
- Duplicate event registrations prevented at UX layer.

### Story B2: Prevent duplicate Seva registrations
Requirement:
- Ensure the same user cannot register multiple times for the same Seva opportunity.

Tasks:
- Add duplicate detection in volunteer registration pipeline.
- Mark already-registered opportunities in select options.
- Disable submit for already-registered state.

Outcome:
- Duplicate Seva registrations prevented and clearly communicated.

### Story B3: Make already-registered state explicit in forms
Requirement:
- For event/seva registration, submit button should be disabled with text indicating already registered.

Tasks:
- Add state-aware button labels.
- Add warning/info messages in form body.
- Enforce disabled submit conditions.

Outcome:
- Strong user feedback and fewer accidental retries.

---

## Epic C: Auth, role policy, and admin access governance

### Story C1: Fix sign-in pending message behavior
Requirement:
- Pending/approval messaging should not incorrectly appear for already signed-in users.

Tasks:
- Adjust sign-in/pending condition logic in navbar/login flow.
- Ensure state reflects real auth context.

Outcome:
- Pending messaging behavior corrected.

### Story C2: Add role-aware admin portal shortcut
Requirement:
- Add Go to Admin Portal button in details callout for Admin/Super Admin/Member/Volunteer.
- Do not show for Family role.

Tasks:
- Add conditional CTA in authenticated details callout.
- Enforce role visibility rules.

Outcome:
- Authorized users receive direct admin access CTA; Family users do not.

### Story C3: Preserve role consistency on sign-in
Requirement:
- Existing user roles should not be overwritten on normal sign-in (especially after admin role edits).

Tasks:
- Update auth policy resolution to preserve existing role for known users.
- Keep allowlist admin override behavior.

Outcome:
- Role overwrite regression resolved.

### Story C4: Intent-based auth policy
Requirement:
- Sign In and Become Member should follow distinct role/approval outcomes.

Tasks:
- Keep Sign In flow role-safe and auto-approved where appropriate.
- Keep Become Member flow as Member with pending approval.
- Honor REACT_APP_ADMIN_EMAILS allowlist as Super Admin path.

Outcome:
- Deterministic role/approval policy implemented.

### Story C5: Post-login navigation sanity
Requirement:
- If no explicit return path is provided, default post-login destination should be Home.

Tasks:
- Update post-auth redirect resolver.

Outcome:
- Post-login default route now stable and user-friendly.

---

## Epic D: Profile and identity safety constraints

### Story D1: Lock immutable email in profile modal
Requirement:
- Email should not be editable in profile edit modal.

Tasks:
- Make email read-only in profile form.

Outcome:
- Email edits blocked in profile UI.

### Story D2: Remove image URL editing
Requirement:
- Remove direct image URL editing option in profile flow.

Tasks:
- Remove image URL field and payload updates for that field.

Outcome:
- Profile editing surface simplified and safer.

---

## Epic E: Runbook and executive documentation assets

### Story E1: Build complete handbook/runbook package
Requirement:
- Create comprehensive handbook with cover page, index, feature breakdown, page-by-page capabilities, and screenshots.

Tasks:
- Capture screenshots for public and admin modules.
- Build markdown handbook.
- Generate styled HTML.
- Generate executive PPTX.
- Generate PDF artifact.

Outcome:
- Documentation suite created under docs (MD/HTML/PDF/PPTX + screenshots).

### Story E2: Humanize the narrative
Requirement:
- Rewrite docs/deck language to be less mechanical.
- Explicitly answer: who uses this site, why they use it, what value is gained.

Tasks:
- Rewrite handbook content in people-first voice.
- Update deck narrative to value-driven messaging.

Outcome:
- Humanized, audience-focused documentation delivered.

---

## Epic F: Visibility gating for unauthenticated users

### Story F1: Hide Event registration form for signed-out users
Requirement:
- Keep sign-in card visible, but hide all event registration fields/buttons until sign-in.

Tasks:
- Conditional render: show sign-in card only when unauthenticated.
- Render form controls only for authenticated users.

Outcome:
- Event page no longer exposes registration inputs while signed out.

### Story F2: Hide Donation form for signed-out users
Requirement:
- Keep sign-in card visible, but hide donation form and payment controls until sign-in.

Tasks:
- Guard donation form rendering by auth status.
- Guard pending checkout action area by auth status.

Outcome:
- Donation page now auth-gated for actionable inputs.

### Story F3: Hide Seva registration controls for signed-out users
Requirement:
- Show sign-in card for Seva registration and hide register action/form until sign-in.

Tasks:
- Hide Register for Seva button for signed-out users.
- Show sign-in prompt card with next route.
- Ensure registration modal cannot render unauthenticated.

Outcome:
- Seva registration UI now properly auth-gated.

---

## Epic G: Family dashboard donation pagination

### Story G1: Paginate donation amount/history list
Requirement:
- Add pagination to donation list in Family Dashboard.

Tasks:
- Add page state and page-size logic.
- Render paginated subset of donation records.
- Add Previous/Next controls and page indicator.
- Clamp page index when dataset changes.

Outcome:
- Donation history list paginated for readability.

---

## Epic H: Festival Hub decommission

### Story H1: Remove Festival Hub page from product surface
Requirement:
- Remove Festival Hub page.

Tasks:
- Remove public route wiring.
- Remove admin route wiring.
- Remove public/admin nav entries.
- Remove related layout icon mapping.
- Delete obsolete page/admin/service files.

Outcome:
- Festival Hub removed from routes, menus, and source modules.

---

## Epic I: Mobile admin CTA parity

### Story I1: Add mobile Go to Admin Portal button placement
Requirement:
- On mobile menu, show Go to Admin Portal button above Logout.

Tasks:
- Add conditional mobile CTA using same role visibility rule as desktop.
- Position CTA directly above logout action.

Outcome:
- Mobile and desktop admin shortcut behavior now consistent.

---

## Delivered Requirement Checklist

- Footer social icons restored.
- Donation compact numeric display added.
- Seva admin mobile card actions simplified.
- Family dashboard status noise removed.
- Profile: email read-only, image URL editing removed.
- Event duplicate registration prevention added.
- Seva duplicate registration prevention added.
- Already-registered disabled button states/messages added.
- Sign-in pending behavior corrected.
- Role-aware admin portal CTA added.
- Role overwrite on sign-in fixed.
- Intent/approval/allowlist policy enforced.
- Post-login default to Home.
- Runbook + screenshots + PDF + PPTX delivered.
- Documentation rewritten in humanized value-first tone.
- Event/Donation/Seva forms hidden for signed-out users.
- Family dashboard donation list paginated.
- Festival Hub removed from website.
- Mobile admin CTA added above logout.

---

## Suggested next iteration (optional)

- Add numeric pagination buttons for donation history (1, 2, 3...).
- Add product release tags/versioning per Epic.
- Add traceability links from each Story to commit hashes and QA cases.

---

End of requirements chronology.
