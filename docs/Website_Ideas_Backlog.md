# Singh Sabha Milton Website
## Ideas Backlog for Future Enhancements

Date prepared: 2026-07-27  
Purpose: A practical list of feature ideas to evaluate later by impact, effort, and implementation readiness.

---

## How to Use This Backlog
- Pick 1 to 2 items from Quick Wins for each release.
- Pair one Medium Effort idea with one Quick Win to keep momentum.
- Use High Effort ideas as roadmap epics, not ad-hoc tasks.
- Re-score priorities every month based on seva, traffic, and admin pain points.

Priority legend:
- P1: High value, should be planned soon
- P2: Strong value, schedule when bandwidth allows
- P3: Nice to have, defer until foundations are stable

Effort legend:
- S: Small
- M: Medium
- L: Large

---

## 1) User Experience and Navigation

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Smart global search (events, news, library, seva) | Faster discovery for all users | M | P1 | One search bar across public pages |
| Sticky page action rail on mobile | Better conversion for donate/register/contact | S | P1 | Floating CTA group based on page type |
| Personalized quick links after login | Reduces clicks for repeat users | M | P1 | Show recent actions and shortcuts |
| Accessibility pass (contrast, focus order, aria labels) | Better inclusivity and compliance | M | P1 | Formal accessibility audit checklist |
| Progressive breadcrumbs on content pages | Better orientation in deeper pages | S | P2 | Especially for Library and Kids Learning |

---

## 2) Community Engagement

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Volunteer streaks and seva milestones | Motivates recurring seva | M | P1 | Recognition badges for participation |
| Monthly digital community bulletin | Improves awareness and participation | S | P1 | Auto-generated from news/events/highlights |
| Family profile with interests | Better targeted updates | M | P2 | Interests: education, seva, events, langar |
| RSVP reminders (email/SMS ready hooks) | Fewer no-shows at events | M | P1 | Reminder at T-24h and T-2h |
| Community testimonial wall | Increases social proof | S | P3 | Moderated submissions |

---

## 3) Events and Schedule

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Event waitlist with auto-promotion | Better seat utilization | M | P1 | Move users from waitlist automatically |
| Multi-day event timeline cards | Better clarity for samagams | M | P1 | Day-by-day agenda block |
| “Happening Now” schedule highlight | Strong live relevance | S | P1 | Based on current time and schedule entries |
| Calendar subscription (Google/Apple/Outlook feed) | Repeat attendance | M | P2 | Public ICS feed |
| Event transport/carpool coordination panel | Helps families attend | M | P3 | Optional volunteer transport listings |

---

## 4) Donations and Transparency

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Campaign impact timeline | Better donor trust | M | P1 | Milestones with before/after photos |
| Recurring monthly donation option | Stable contribution base | L | P1 | Stripe recurring setup |
| Donation receipts center in family dashboard | Better record-keeping | M | P1 | Download past receipts anytime |
| Goal thermometer on home and campaign pages | Drives contribution urgency | S | P2 | Show progress and days remaining |
| Sponsorship tier explainer | Improves sponsor conversion | S | P2 | Benefits matrix by tier |

---

## 5) Content, Media, and Learning

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| AI-assisted article summary blocks | Faster reading for users | M | P2 | Short “Key points” section |
| Auto-tagging for library resources | Better content findability | M | P1 | Tags by topic, age group, language |
| Punjabi + English parallel reading mode | Better accessibility for youth/families | M | P1 | Side-by-side text render |
| Kids Learning progress tracker | Better educational continuity | M | P2 | Track quiz topics completed |
| Curated “Start Here” Sikh learning path | Better onboarding for newcomers | S | P1 | Beginner path with milestones |

---

## 6) Admin Productivity and Governance

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Admin command palette | Faster module actions | M | P1 | Quick open to key admin pages |
| Bulk actions for users/events/news | Cuts repetitive admin work | M | P1 | Approve/archive/export in batches |
| Configurable approval workflows | Better governance by role | L | P2 | Different rules for each module |
| Saved dashboard views by persona | Focused operational visibility | M | P1 | Views: donations, seva, publishing |
| Content publish checklist guardrails | Fewer publishing errors | S | P1 | Validate title/image/date/status |

---

## 7) Analytics and Insights

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Funnel analytics (visit -> action) | Identifies conversion drop-off | M | P1 | For donation, seva, registration flows |
| Heatmap of most-used pages and CTAs | Better UX decisions | M | P2 | Weekly trend card in admin |
| Campaign ROI dashboard | Better financial planning | M | P1 | Compare campaign cost vs raised value |
| Retention cohorts for members/families | Better engagement strategy | L | P2 | Monthly cohort analysis |
| Scheduled KPI snapshots by email | Leadership visibility | S | P2 | Weekly digest to admin roles |

---

## 8) Reliability, Security, and Performance

| Idea | Value | Effort | Priority | Notes |
|---|---|---|---|---|
| Image optimization and CDN policy | Faster page load | M | P1 | Convert and resize media automatically |
| Rate limiting and abuse protection on forms | Better security posture | M | P1 | Contact, registration, and auth endpoints |
| Uptime/status monitor widget for admin | Faster incident awareness | S | P2 | Basic service health indicators |
| Data backup verification runbook automation | Better recovery confidence | M | P1 | Regular integrity checks |
| Structured release checklist with smoke tests | Fewer regressions | S | P1 | Per-release mandatory checks |

---

## Suggested 90-Day Implementation Plan

### Month 1 (Quick Wins)
- Smart global search
- Happening Now schedule highlight
- Content publish checklist guardrails
- Goal thermometer for campaigns

### Month 2 (Conversion and Trust)
- Donation receipts center
- Campaign impact timeline
- RSVP reminders
- Punjabi + English parallel reading mode

### Month 3 (Admin and Insights)
- Saved dashboard views by persona
- Funnel analytics
- Bulk admin actions
- Weekly KPI email snapshots

---

## Parking Lot (Needs Clarification Before Build)
- WhatsApp channel integration for reminders and announcements
- Live queue management for large event entry flow
- Kiosk mode for in-Gurdwara donation and event sign-up
- Multisite support for future branch scaling

---

## Shortlisted Ideas (User Selected)

Date shortlisted: 2026-07-27  
Status: Prioritized for solution design and scoped implementation planning.

| Idea | Why It Is Strong | Suggested First Milestone |
|---|---|---|
| Smart global search (events, news, library, seva) | High daily utility and faster discovery across all audiences | Deliver a search bar with grouped results and keyboard navigation for 4 data sources |
| Progressive breadcrumbs on content pages | Reduces disorientation in deeper content journeys | Add breadcrumb trail to Library and Kids Learning detail flows first |
| WhatsApp channel integration for reminders and announcements | Strong community adoption and better message open rates | Start with opt-in link/share flow and admin broadcast templates before full automation |
| Kiosk mode for in-Gurdwara donation and event sign-up | Converts in-person footfall into digital actions instantly | Pilot one locked-down kiosk page with donation + event signup shortcuts |

### Implementation Notes for Next Session
- Search and breadcrumbs can be started as Phase 1 UI/UX upgrades with minimal backend impact.
- WhatsApp should begin with policy-safe, consent-based flows and clear opt-in tracking.
- Kiosk mode should include session timeout, simplified navigation, and privacy-safe reset between users.
- Best execution order: Search -> Breadcrumbs -> Kiosk Pilot -> WhatsApp Integration.

---

## Notes for Future Review with Copilot
When revisiting this document, shortlist ideas with:
- High user value
- Clear owner (public/admin/content/ops)
- Smallest feasible first release
- Existing data already available in the platform
