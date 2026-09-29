# Phase 2 — Stabilization & Production Readiness

Date: 2026-09-26

## Status

This phase hardens the current client-first MVP. It does not connect a production Firebase project, deploy, or create a backend. The result is suitable for Emulator-based acceptance testing and architecture planning, not contractual SLA operation.

## Completed

- Ticket status updates no longer run the full create-time validator. They allow only the four mutable status fields, preserve all immutable fields through `diff().affectedKeys()`, validate the state transition, timestamp, resolution note, and matching domain event. This reduces Rules expression work while retaining the create-time contract.
- Assignment remains separately guarded: only Super Admin or a Support Engineer in the ticket Property can assign an active Support Engineer membership in that same Property.
- New Audit records now carry `sourceEventId`, linking each client audit record to the Ticket domain event ID without adding a Rules read lookup. The reader tolerates older records without that field so the Phase 3–7 audit history is not hidden.
- Tickets created by the current client write `schemaVersion: 2`. Older documents without the field are read as version 1; no destructive backfill is required.
- Pagination page sizes are clamped to 50 at the service boundary.
- SLA policy is separated from the UI. The current policy is explicitly 24x7, includes response/resolution targets, and marks Waiting for User/Vendor as paused for display.
- Telemetry sanitizes properties to a small allowlist and provides error/performance hooks without storing business content.

## Compatibility and migration

The application uses an expand-and-read-both strategy:

1. Existing tickets without `schemaVersion` remain readable as version 1.
2. New tickets use version 2.
3. Assignment/status writes preserve the existing version and do not require a backfill.
4. A future trusted migration may backfill old documents in bounded batches only after a backup and restore rehearsal.
5. There is no client-side migration that changes existing production data.

## Pagination inventory

| Screen/service | Current behavior                                                    | Phase 2 decision                                                                                                                   |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Ticket Board   | Cursor page, max 50 per request                                     | Ready for MVP; search is page-local                                                                                                |
| User Directory | Cursor profiles + memberships for loaded UIDs                       | Ready for MVP; search is page-local                                                                                                |
| Audit Log      | Cursor page, max 50                                                 | Ready for MVP                                                                                                                      |
| Dashboard      | Bounded realtime listener, latest 50                                | Intentionally bounded until aggregate/read-model backend exists                                                                    |
| Activities Log | Bounded realtime listener, latest 50, reads latest event per ticket | Retain for compatibility; Phase Fix 1 caches immutable event reads per ticket revision; replace with Audit/aggregation query later |
| Ticket history | Realtime subcollection listener without cursor                      | Acceptable for a single ticket; add event pagination if histories grow                                                             |

Server-side search/filter requirements for the backend phase: property/tenant scope must be part of every query, filters must be validated against an allowlist, ordering must be stable, pagination must use a cursor plus a tie-breaker, and search must not fall back to downloading a collection to the browser.

## Audit coverage

Covered today: Ticket creation, status change, assignment, reassignment, and unassignment. Not covered: reads, sign-in events, user/membership provisioning, Asset changes, PM changes, CCTV checks, Infrastructure incidents, Catalog/Property settings, and failed authorization attempts. Those require a trusted audit ingress and retention policy.

## Known Rules risk

The Rules suite passes, but the larger legacy validators can still reach the Firestore expression ceiling on deliberately malformed requests in some unrelated collections. A denied request is safe, but the expression budget is an operational risk. The next backend phase should move complex business validation out of Rules; the immediate follow-up should continue splitting remaining large validators by domain.

## Verification record

- `npm run build`: passed.
- `npm run test:rules`: passed, 16 tests, 0 failures.
- The new tests cover Ticket creation with Audit, same-Property Assignment, cross-Property Assignment denial, cross-Property Audit read denial, Super Admin Audit listing, immutable Audit records, and injected Audit fields.
- Restore verification is performed from the post-Phase 2 snapshot and must include a clean build plus the same Rules suite before this phase is considered reproducible.
