# Singh Sabha Milton Website
## Phase 1 Technical Spec: Smart Search + Progressive Breadcrumbs

Date prepared: 2026-07-27  
Owner: Product + Frontend Engineering  
Status: Phase 1 complete; Phase 2 requirements in progress

---

## 1. Scope

This Phase 1 spec covers:
- Smart global search across Events, News, Library, and Seva.
- Progressive breadcrumbs for deeper content contexts, starting with Library and Kids Learning.

Out of scope for Phase 1:
- These capabilities are moved into Phase 2 in-scope requirements (see Section 14).

---

## 2. Objectives and Success Criteria

### Objectives
- Reduce navigation time to high-intent actions (register, donate, volunteer, read updates).
- Improve orientation on content-heavy pages where users may feel lost.

### Success Metrics (first 30 days)
- Search usage rate: at least 20% of active sessions use search.
- Search click-through rate: at least 35% of searches result in a result click.
- Library and Kids Learning bounce rate down by 10%.
- Time-to-content (home to target page) reduced by 20% for tracked journeys.

---

## 3. Current Codebase Integration Points

### Existing Public Navigation
- Primary navigation and mobile menu are rendered in [src/components/layout/Navbar.jsx](src/components/layout/Navbar.jsx).
- Public route list is in [src/constants/navigation.js](src/constants/navigation.js).
- Public route mapping is in [src/routes/AppRoutes.jsx](src/routes/AppRoutes.jsx).

### Existing Data Sources
- Events: [src/services/eventService.js](src/services/eventService.js)
- News: [src/services/newsService.js](src/services/newsService.js)
- Library content: [src/services/libraryService.js](src/services/libraryService.js)
- Seva opportunities: [src/services/volunteerService.js](src/services/volunteerService.js)
- Kids Learning content: [src/services/kidsLearningService.js](src/services/kidsLearningService.js)

### Initial Breadcrumb Targets
- Library page: [src/pages/Library/LibraryPage.jsx](src/pages/Library/LibraryPage.jsx)
- Kids Learning page: [src/pages/KidsLearning/KidsLearningPage.jsx](src/pages/KidsLearning/KidsLearningPage.jsx)

---

## 4. Feature A: Smart Global Search

## 4.1 UX Requirements

- Search input visible in desktop navbar and mobile menu panel.
- Keyboard support:
  - Arrow Up/Down to navigate results.
  - Enter to open selected result.
  - Escape to close result panel.
- Results grouped by type with clear section labels:
  - Events
  - News
  - Library
  - Seva
- Empty state with suggestions when no results match.
- Loading state and resilient fallback if one dataset fails.

## 4.2 Search Matching (Phase 1)

Use client-side matching with weighted fields:

- Events
  - title (high)
  - description (medium)
  - location (medium)
  - category (low)
- News
  - heading (high)
  - content (medium)
- Library
  - physicalBooks.title (high)
  - physicalBooks.author (medium)
  - digitalResources.title (high)
  - digitalResources.tags (medium)
  - programUpdates.title (medium)
- Seva
  - sevaType (high)
  - date (low)
  - time (low)

Ranking strategy (simple and deterministic):
- Exact prefix match > word-start match > contains match.
- Tie-breaker by recency where applicable (events/news).

## 4.3 Result Routing

Use route-only deep links in Phase 1 for reliability:
- Event result -> /events
- News result -> /news
- Library result -> /library
- Seva result -> /seva

Optional query param enhancement (safe in Phase 1.1):
- /events?eventId=...
- /library?focus=book&id=...
- /seva?opportunityId=...

## 4.4 New Components and Hooks

Create:
- [src/components/common/GlobalSearchBar.jsx](src/components/common/GlobalSearchBar.jsx)
- [src/components/common/GlobalSearchResultsPanel.jsx](src/components/common/GlobalSearchResultsPanel.jsx)
- [src/hooks/useGlobalSearchIndex.js](src/hooks/useGlobalSearchIndex.js)
- [src/utils/searchRanker.js](src/utils/searchRanker.js)

Responsibilities:
- useGlobalSearchIndex: fetch + normalize + memoized index.
- searchRanker: rank and group result rows.
- GlobalSearchBar: input, keyboard handling, open/close state.
- GlobalSearchResultsPanel: grouped list rendering and no-result state.

## 4.5 Integration Tasks

1. Add search UI into navbar desktop layout in [src/components/layout/Navbar.jsx](src/components/layout/Navbar.jsx).
2. Add search UI into mobile menu in [src/components/layout/Navbar.jsx](src/components/layout/Navbar.jsx).
3. Add a small reusable result item style in [src/index.css](src/index.css) or page-safe utility classes.
4. Track telemetry events (if analytics hook exists later):
   - search_open
   - search_query_changed
   - search_result_clicked

---

## 5. Feature B: Progressive Breadcrumbs

## 5.1 UX Requirements

- Breadcrumb appears below page hero on target pages.
- Never noisy: max 3 segments in Phase 1.
- Last segment is current context (not clickable).
- Mobile-safe truncation for long labels.

Example baseline:
- Home / Library
- Home / Library / Kids Learning Hub
- Home / Kids Learning

## 5.2 Breadcrumb Data Model

Each breadcrumb item:
- label: string
- path: string (optional for last item)
- isCurrent: boolean

## 5.3 New Component

Create:
- [src/components/common/BreadcrumbTrail.jsx](src/components/common/BreadcrumbTrail.jsx)

Behavior:
- Accept items array prop.
- Render separators.
- Use aria-current="page" on current item.

## 5.4 Page-Level Integration

1. Library page [src/pages/Library/LibraryPage.jsx](src/pages/Library/LibraryPage.jsx)
   - Default: Home / Library
   - If a section modal/context is active, append contextual final node:
     - Home / Library / Program Sessions
     - Home / Library / Digital Media
2. Kids Learning page [src/pages/KidsLearning/KidsLearningPage.jsx](src/pages/KidsLearning/KidsLearningPage.jsx)
   - Default: Home / Kids Learning
   - If a quiz is expanded, optional contextual node:
     - Home / Kids Learning / Quiz

Implementation note:
- Keep breadcrumb states derived from local page state, not global store.

---

## 6. Data Normalization Contract for Search Index

Normalize all searchable rows to:

- id: string
- type: 'event' | 'news' | 'library' | 'seva'
- title: string
- subtitle: string
- body: string
- keywords: string[]
- route: string
- scoreHints: object (optional)

Mapping notes:
- Events from eventService.getEvents().
- News from newsService.getArticles().
- Library from libraryService.getContent() across:
  - physicalBooks
  - digitalResources
  - programUpdates
- Seva from volunteerService.getSevaOpportunities().

---

## 7. Performance and Reliability

- Debounce search input: 120ms to 180ms.
- Cap visible results: top 8 per query, max 3 per group.
- Use React Query cached data where available.
- If one source fails, continue with others and surface a soft warning in console only.

---

## 8. Accessibility Requirements

- Search input has explicit label (visible or sr-only).
- Results panel uses listbox semantics.
- Active result has aria-selected.
- Enter/Escape keyboard behavior must be deterministic.
- Breadcrumb nav wrapped in <nav aria-label="Breadcrumb">.

---

## 9. Security and Privacy Notes

- No sensitive data should be indexed in client-side search.
- Search index should include only public-facing content.
- Do not index private user attributes or approval states.

---

## 10. QA Checklist

## Search
- Typing "langar" shows Seva and relevant content.
- Typing "guru" returns news/library/event candidates.
- Keyboard navigation works with no mouse.
- Clicking result lands on expected page.
- Empty state appears for nonsense query.

## Breadcrumbs
- Breadcrumb visible on Library and Kids Learning.
- Current crumb is not clickable.
- Responsive behavior keeps one-line layout where possible.
- No overlap with hero or ticker elements.

## Regression
- Navbar layout remains stable on mobile and desktop.
- Existing auth/profile/nav behavior unchanged.
- No route breakage in AppRoutes.

---

## 11. Delivery Plan (2 Sprints)

### Sprint A (Search MVP)
- Build index hook + ranking utility.
- Add navbar search UI + results panel.
- Add route navigation from result clicks.
- QA and polish.

### Sprint B (Breadcrumbs + Hardening)
- Build breadcrumb component.
- Integrate into Library and Kids Learning.
- Add contextual breadcrumb states.
- Accessibility and responsive checks.

---

## 12. Definition of Done

- Global search is live in desktop and mobile nav.
- Search returns grouped results from all 4 target sources.
- Breadcrumbs are live in Library and Kids Learning.
- Build passes and no new eslint errors introduced by this work.
- Documentation updated with screenshots and known limitations.

---

## 13. Future Extensions (Post-Phase 1)

- Server-backed search endpoint for scale and multilingual relevance.
- Synonym dictionaries for Sikh terminology.
- Deep-link routing to specific content cards/modals.
- Recently searched items and trending queries.

---

## 14. Phase 2 In-Scope Requirements

These items are now in scope for Phase 2 and implementation has started.

### 14.1 Backend Full-Text Search Engine

- Build server endpoint for search aggregation and ranking across public content.
- Use PostgreSQL text search ranking for Events, News, Seva, and CMS page records.
- Keep route-first result behavior for reliability, then add deep-link targeting as a follow-up.
- Add query throttling and request validation at API layer.

### 14.2 Cross-Language Transliteration Search Quality Tuning

- Add transliteration variant expansion for common Sikh terms (e.g., gurdwara/gurudwara, seva/sewa).
- Normalize punctuation and whitespace before search scoring.
- Add a deterministic scoring boost when a transliteration variant matches title or subtitle fields.
- Expand QA cases for Punjabi transliteration and common spelling variants.

### 14.3 WhatsApp and Kiosk Features

- Add server-side Phase 2 channel configuration for WhatsApp and kiosk behavior.
- Support WhatsApp opt-in toggle and join-link management in a singleton config.
- Support kiosk mode enablement, home route, and inactivity timeout settings.
- Prepare UI integration tasks for admin controls and public runtime behavior in next sprint.

### 14.4 Kickoff Status

- Phase 2 kickoff started on 2026-07-27.
- First backend API scaffolding is being added for full-text search and channel configuration.
