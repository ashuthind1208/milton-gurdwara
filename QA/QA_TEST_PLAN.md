# Singh Sabha Milton QA Test Plan

## 1. Objective
This document defines the QA approach for website validation across public pages, admin workflows, integrations, and core user journeys.

Primary goals:
- Validate business-critical user flows end-to-end.
- Prevent regressions after feature updates.
- Track execution status and defects in a structured format.
- Provide release-ready quality evidence.

## 2. Scope
In scope:
- Public website pages and navigation.
- Authentication and protected admin access.
- Admin CRUD modules (Events, Seva, News, Gallery, Videos, Library, Streaming, Sponsors, Advertisements, CMS, Donations, Users).
- Integrations (Gurpurab API, Stripe donation flow, uploads).
- Responsiveness, accessibility basics, and performance sanity checks.

Out of scope (unless explicitly requested):
- Load/stress testing at scale.
- Security penetration testing.
- Third-party platform SLA testing.

## 3. Test Types
- Smoke Testing
- Functional Testing
- Regression Testing
- Negative Testing
- UI/UX Validation
- API Integration Validation
- Data Persistence Validation
- Basic Accessibility Checks
- Basic Performance Checks

## 4. Environments
Recommended environments:
- Local Dev: http://localhost:3001 (frontend) and backend on 4242 through proxy.
- Staging: production-like environment with real configs.
- Production: post-deploy sanity only.

Browser coverage:
- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Mobile emulation and at least one real mobile device

## 5. Entry Criteria
- Latest code synced.
- App starts cleanly.
- Required environment variables configured.
- Required external services reachable.
- Seed/sample data available where needed.

## 6. Exit Criteria
- All P0/P1 tests executed.
- No open Critical or High defects for release scope.
- All failed tests have linked defects and triage notes.
- QA sign-off summary completed.

## 7. Status Definitions
- Not Run: Test has not started.
- Pass: Expected result achieved.
- Fail: Actual result differs from expected.
- Blocked: Cannot execute due to dependency/environment issue.
- Retest: Defect fix applied and awaiting verification.

## 8. Severity Guide
- Critical: System unusable, data loss, payment/auth broken.
- High: Core business flow broken with no practical workaround.
- Medium: Important behavior incorrect but workaround exists.
- Low: Cosmetic/minor issue with little business impact.

## 9. Priority Guide
- P0: Must fix before release.
- P1: High priority, fix in release cycle.
- P2: Should fix soon.
- P3: Nice to have.

## 10. Defect Logging Minimum Fields
- Defect ID
- Linked Test ID
- Module
- Summary
- Steps to Reproduce
- Expected Result
- Actual Result
- Severity
- Priority
- Environment
- Screenshot/Video Evidence

## 11. Execution Process
1. Run smoke suite first.
2. Execute module-wise functional tests.
3. Execute negative and regression tests.
4. Update QA_TEST_CASES.csv after each test execution.
5. Log defects for all failed tests.
6. Perform retest for resolved defects.
7. Publish execution summary.

## 12. Daily QA Reporting Template
- Date:
- Build Version:
- Total Executed:
- Passed:
- Failed:
- Blocked:
- Open Critical/High Defects:
- Key Risks:
- Next Actions:

## 13. Traceability
Detailed test inventory and execution tracking are maintained in:
- QA/QA_TEST_CASES.csv

## 14. Notes for Testers
- Always attach evidence for Fail and Blocked status.
- Keep Actual Result concise and factual.
- Update Defect ID once ticket is created.
- Do not overwrite historical execution rows without agreement.
