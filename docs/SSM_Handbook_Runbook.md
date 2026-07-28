# Singh Sabha Milton Platform
## Handbook and Runbook (People-First Edition)

Version: 1.2  
Date: 2026-07-28  
Audience: Sangat, Sevadars, Operations Team, Leadership

---

## Cover Note

This is not just a website. It is a digital front door for the sangat.

People come here to find what matters right now:
- What is happening at the Gurdwara
- Where they can serve
- How they can contribute
- Who to contact
- How admins can run everything without chaos

This document explains the real value behind each page, not only the features.

---

## Index

1. Why This Website Exists
2. Who Uses This Website
3. What We Gain as an Organization
4. Page-by-Page Value Guide (Public)
5. Family and Member Experience
6. Authentication, Roles, and Trust Model
7. Admin Experience (Module-by-Module Value)
8. Runbook: How to Operate Smoothly
9. Troubleshooting and Risk Notes
10. Screenshot Index

---

## 1. Why This Website Exists

The website exists to remove friction between intention and action.

When someone wants to attend an event, donate, or do seva, the platform should help them do it in minutes, not after a chain of calls and messages.

At the same time, admin teams need structure. This platform gives that structure through role-based controls, approval flows, and centralized modules.

---

## 2. Who Uses This Website

### Public Visitors
- Families exploring the Gurdwara
- Youth and newcomers learning about Sikh values
- Community members checking events, news, and media

### Active Participants
- People registering for events
- Volunteers signing up for seva opportunities
- Donors contributing to campaigns and causes

### Internal Operators
- Sevadars coordinating communications and schedules
- Admin teams managing users, content, and campaigns
- Leadership tracking community engagement and operational readiness

---

## 3. What We Gain as an Organization

### Community Gain
- Stronger participation in events and seva
- Better visibility into activities and opportunities
- Easier access for first-time visitors and returning families

### Operational Gain
- Fewer duplicate registrations and manual corrections
- Faster publishing and updates across all pages
- Role-based workflows that reduce confusion and accidental changes

### Leadership Gain
- One place to understand momentum: registrations, donations, and activity
- Better confidence in approvals, permissions, and governance
- A repeatable system instead of ad-hoc coordination

---

## 4. Page-by-Page Value Guide (Public)

Each page below answers three simple questions:
- Who is this page for?
- Why would someone use it?
- What do we gain when they do?

### Home
Who uses this page:
- Everyone. First-time visitors, returning families, volunteers, and donors.

Why this page matters:
- It sets trust in seconds and helps people find the right next step.

What we gain:
- Better first impressions and faster navigation to high-value actions.

Screenshot:
![Home](screenshots/home.png)

### About
Who uses this page:
- New visitors and people evaluating the institution.

Why this page matters:
- People support what they understand. About gives context and credibility.

What we gain:
- Higher trust and stronger confidence in the organization.

Screenshot:
![About](screenshots/about.png)

### Sikhism
Who uses this page:
- Youth, learners, and anyone exploring Sikh teachings.

Why this page matters:
- Education keeps engagement meaningful, not just transactional.

What we gain:
- Deeper spiritual connection and longer-term community participation.

Screenshot:
![Sikhism](screenshots/sikhism.png)

### Hukamnama
Who uses this page:
- Sangat looking for daily spiritual guidance.

Why this page matters:
- It brings daily relevance and routine connection to the platform.

What we gain:
- Repeat visits and stronger spiritual engagement.

Screenshot:
![Hukamnama](screenshots/hukamnama.png)

### Events
Who uses this page:
- Families, participants, and organizers.

Why this page matters:
- People need a clear path from discovery to registration.

What we gain:
- Higher event participation and cleaner attendee records.

Operational note:
- Duplicate registration is prevented and already-registered users see a clear disabled state.

Screenshot:
![Events](screenshots/events.png)

### Seva
Who uses this page:
- Volunteers and coordinators.

Why this page matters:
- It turns good intentions into scheduled, trackable service.

What we gain:
- Better volunteer coordination and less manual follow-up.

Operational note:
- Already-registered users cannot re-submit for the same opportunity.

Screenshot:
![Seva](screenshots/seva.png)

### Donation
Who uses this page:
- Donors and families supporting campaigns.

Why this page matters:
- Donations should feel trustworthy, direct, and respectful.

What we gain:
- Better funding reliability and clearer campaign support.

Screenshot:
![Donation](screenshots/donation.png)

### Gallery
Who uses this page:
- Community members, sponsors, and new visitors.

Why this page matters:
- Visual memory creates emotional connection and social proof.

What we gain:
- Increased confidence, participation, and shareability.

Screenshot:
![Gallery](screenshots/gallery.png)

### News
Who uses this page:
- Sangat looking for timely updates.

Why this page matters:
- Clear communication reduces confusion and missed announcements.

What we gain:
- Better attendance and fewer repetitive support questions.

Screenshot:
![News](screenshots/news.png)

### Library
Who uses this page:
- Learners, youth, and educators.

Why this page matters:
- It provides a structured place for ongoing learning.

What we gain:
- Stronger educational impact and continuous platform relevance.

Screenshot:
![Library](screenshots/library.png)

### Videos
Who uses this page:
- Users who prefer visual/audio learning and recorded sessions.

Why this page matters:
- It extends reach beyond in-person attendance.

What we gain:
- Broader engagement and content longevity.

Screenshot:
![Videos](screenshots/videos.png)

### Contact
Who uses this page:
- Visitors needing direct support or practical information.

Why this page matters:
- A clear contact path lowers drop-off when people need help.

What we gain:
- Faster issue resolution and better visitor confidence.

Screenshot:
![Contact](screenshots/contact.png)

### FAQ
Who uses this page:
- Anyone with common operational questions.

Why this page matters:
- It solves repeated questions proactively.

What we gain:
- Lower support burden and faster self-service.

Screenshot:
![FAQ](screenshots/faq.png)

### Login
Who uses this page:
- Members, families, volunteers, and admins.

Why this page matters:
- It is the gateway to personalized and role-based experiences.

What we gain:
- Secure access and cleaner user lifecycle management.

Screenshot:
![Login](screenshots/login.png)

---

## 5. Family and Member Experience

### Family Dashboard
Who uses this page:
- Signed-in family users and active participants.

Why this page matters:
- People stay engaged when they can see their own journey clearly.

What we gain:
- Better retention, stronger repeat participation, and fewer status inquiries.

Screenshot:
![Family Dashboard](screenshots/family-dashboard.png)

### Profile Editing Experience
What changed:
- Email editing is intentionally locked.
- Image URL editing was removed.
- Core profile fields remain editable: name, phone, address.

Why this matters:
- Identity consistency and fewer account integrity issues.

What we gain:
- Better trust in user records and less downstream cleanup.

---

## 6. Authentication, Roles, and Trust Model

### Policy Summary
- Standard Sign In:
  - Existing users keep their existing role.
  - First-time users default to Family.
- Become Member flow:
  - User becomes Member with pending approval.
- Allowlist path:
  - Emails in REACT_APP_ADMIN_EMAILS are elevated to Super Admin.

### Why this model is strong
- It respects real operations where admin teams may update roles manually.
- It avoids accidental role downgrades at sign-in.
- It keeps governance centralized and auditable.

### User-facing behavior
- Post-login default route is Home.
- Go to Admin Portal appears only for authorized roles.
- Family users do not see admin portal action.

---

## 7. Admin Experience (Module-by-Module Value)

### Admin Dashboard
Who uses it:
- Admins and leadership.

Why it matters:
- One command center view for platform health.

What we gain:
- Faster decisions and better operational awareness.

Screenshot:
![Admin Dashboard](screenshots/admin-dashboard.png)

### CMS, News, and Schedule
Who uses it:
- Content and communications team.

Why it matters:
- Messaging stays current and consistent across the site.

What we gain:
- Faster publishing cycles and fewer content bottlenecks.

Screenshots:
![Admin CMS](screenshots/admin-cms.png)
![Admin News](screenshots/admin-news.png)
![Admin Schedule](screenshots/admin-schedule.png)

### Hukamnama and Langar
Who uses it:
- Religious operations and service coordinators.

Why it matters:
- Keeps core spiritual and seva services accurate and visible.

What we gain:
- Better reliability in daily and weekly community operations.

Screenshots:
![Admin Hukamnama](screenshots/admin-hukamnama.png)
![Admin Langar](screenshots/admin-langar.png)

### Seva Opportunities and Events Admin
Who uses it:
- Volunteer and event operations teams.

Why it matters:
- Planning, registration, and communication happen from one operational flow.

What we gain:
- Higher participation quality with lower admin overhead.

Screenshots:
![Admin Seva Opportunities](screenshots/admin-seva-opportunities.png)
![Admin Events](screenshots/admin-events.png)

### Donations and Users Admin
Who uses it:
- Donations team and user governance owners.

Why it matters:
- Financial support and user trust depend on clean records.

What we gain:
- Better accountability, cleaner approvals, stronger governance.

Screenshots:
![Admin Donations](screenshots/admin-donations.png)
![Admin Users](screenshots/admin-users.png)

### Media and Outreach Modules
Modules:
- Advertisements, Sponsors, Gallery, Library, Videos, Streaming, Festival, Kids Learning

Why they matter:
- They keep outreach, education, and community storytelling alive and current.

What we gain:
- Higher engagement across generations and channels.

Screenshots:
![Admin Advertisements](screenshots/admin-advertisements.png)
![Admin Sponsors](screenshots/admin-sponsors.png)
![Admin Gallery](screenshots/admin-gallery.png)
![Admin Library](screenshots/admin-library.png)
![Admin Videos](screenshots/admin-videos.png)
![Admin Streaming](screenshots/admin-streaming.png)
![Admin Festival](screenshots/admin-festival.png)
![Admin Kids Learning](screenshots/admin-kids-learning.png)

---

## 8. Runbook: How to Operate Smoothly

### Daily Routine
- Verify Home and top navigation load correctly.
- Verify Events and Seva registration forms are functional.
- Verify donation page is accessible and responsive.
- Verify admin dashboard opens for authorized roles.

### Weekly Routine
- Review pending member approvals and role changes.
- Review stale events and completed seva opportunities.
- Review donation campaign health.
- Spot-check media modules for broken content links.

### Before Any Release
- Validate role behavior end-to-end:
  - Family vs Member vs Volunteer vs Admin visibility
- Validate duplicate registration guard in Events and Seva
- Run production build and smoke test top journeys
- Confirm database bootstrap artifacts are current:
  - Schema and seed baseline file: `server/db/schema_and_seed.sql`
  - Runtime schema authority: `server/db/postgres.js` (`ensureEventsSchema`)

### Database Baseline and Recovery
- Purpose:
  - `server/db/schema_and_seed.sql` provides a portable baseline to initialize a fresh PostgreSQL database with core schema and representative seed content.
- What it contains:
  - Core table/index creation statements.
  - Seed records for `admin_users`, `app_singletons`, `app_items`, and mirrored relational rows currently backed by content-store resources.
- When to refresh it:
  - After schema changes in `server/db/postgres.js`.
  - After meaningful content seed updates in `server/data/users.json` or `server/data/content-store.json`.
- How to apply on a new environment:
  - Run the SQL file against the target PostgreSQL database before first app start.
  - Start the backend and verify key modules: Users, CMS, Streaming, Videos, Seva, Donations.

### If Something Breaks
Registration incidents:
- Check if user is already registered.
- Verify profile completeness requirements.

Role/access incidents:
- Verify user role and approval state.
- Verify allowlist configuration in REACT_APP_ADMIN_EMAILS.

Navigation incidents:
- Verify route role mapping for limited and full admin routes.

---

## 9. Troubleshooting and Risk Notes

### Common Pitfalls
- OAuth redirect mismatch if provider settings do not match deployed URL.
- External media hosts may be blocked by browser-level policies.
- Inconsistent test users in local storage can cause confusing role behavior during demos.

### Practical Checks
- Confirm environment variables are loaded.
- Confirm current user object in storage is what you expect.
- Confirm backend data source is in sync with what the UI displays.

---

## 10. Screenshot Index

Public:
- home, about, sikhism, hukamnama, events, seva, donation, gallery, news, library, videos, contact, faq, login, family-dashboard, donation-board

Admin:
- admin-dashboard, admin-cms, admin-news, admin-schedule, admin-hukamnama, admin-langar, admin-seva-opportunities, admin-events, admin-donations, admin-users, admin-advertisements, admin-sponsors, admin-gallery, admin-library, admin-videos, admin-streaming, admin-festival, admin-kids-learning

---

End of document.
