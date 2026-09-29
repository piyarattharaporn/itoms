# Phase Fix 1 — Query Stability & Read Efficiency

Date: 2026-09-29

## Scope delivered

- Completed Task pages now order by `updatedAt` at Firestore instead of sorting
  after the page has already been fetched. This keeps cursor pagination aligned
  with the visible order.
- RCA pages now order by `updatedAt` at Firestore. The existing Property-scoped
  index is used; no data migration is required.
- Activity Log keeps its existing bounded realtime contract and Property access
  rules, but caches immutable latest Ticket events per `ticketId/lastEventId`
  during each subscription. Parent-ticket snapshots no longer re-read the same
  event repeatedly.
- Added the two composite indexes required by the Completed Task queries.

## Compatibility

- Existing Ticket and RCA documents remain readable. No destructive migration or
  backfill is performed.
- Documents missing `updatedAt` may not appear in an `orderBy('updatedAt')`
  query. Current write paths persist this field; legacy records require a
  separately approved bounded backfill if they are found in production.
- Activity Log remains limited to the latest 50 Tickets and still performs one
  initial event read per distinct Ticket revision. Full event aggregation and
  server-side search remain backend work.

## Deferred work

- Cursor pagination for Asset, PM, License, Incident, CCTV inventory, Request
  User and operational To-do screens.
- Dashboard aggregate/read model so charts are based on all matching history
  rather than the latest bounded realtime Ticket feed.
- Server-side search/filtering and a trusted aggregation boundary.

## Verification gate

- `npm run test:quality`
- `npm run test:server`
- `npm run test:rules`
- `npm run build`
- Browser smoke/E2E against the local Emulator before deployment
