# Phase Fix 3 — Production Hardening & Data Reliability

Date: 2026-09-29

## Objective

Improve reliability of the Spark-only client application without introducing
Cloud Functions, a trusted backend, Cloud Storage, or a production data
migration. This phase focuses on stale browser state, release freshness, and
making the read model honest about what it has loaded.

## Implemented scope

### 1. Hosting shell freshness

Firebase Hosting now sends `Cache-Control: no-cache, no-store,
must-revalidate` for `/` and keeps `index.html` on a no-cache policy. Hashed
JavaScript and CSS assets remain cacheable and immutable. This keeps a new SPA
shell from being hidden by a long-lived browser cache while preserving the
normal performance benefit of content-hashed assets.

### 2. Refresh and freshness visibility

The following paginated views now show a reusable refresh control and the time
of the last successful page load:

- Asset Registry
- Damaged Assets
- Preventive Maintenance
- Software Licenses
- Request Users
- User Directory
- Audit Log
- RCA & Service Review

The timestamp is a client observation of the last successful read. It is not a
server commit timestamp and does not imply that another user's concurrent
write has been observed.

### 3. Stale-result protection

Initial page requests are guarded with a cancellation flag. When the selected
Property, permission state, or refresh cycle changes, a previous request can
finish in the background but cannot overwrite the new scope's rows, cursor, or
error state. This protects the UI from a common race when moving quickly
between Properties or pressing refresh.

### 4. Honest loaded-row semantics

The existing pagination labels remain explicit: counts and client-side search
are based on rows loaded in the browser. Refresh resets the view to the first
page, so a user can intentionally obtain a fresh bounded snapshot without
silently increasing page size.

## Deliberately out of scope

- Server-side search across the complete collection.
- Global aggregates independent of the loaded page.
- Realtime change feeds for every operational list.
- Trusted SLA workers, notifications, exports, retention, or audit sealing.
- Automatic retry queues and offline write reconciliation.

Those capabilities require a backend or a separately approved data/operations
design. They should not be simulated by unbounded client reads on Spark.

## Operational notes

1. Deploy Hosting after the quality and emulator gates pass, then verify both
   `/` and `/index.html` response headers. A Hosting config change is not
   active until it is deployed.
2. If a user still sees an old shell after deployment, perform a normal hard
   reload once; the no-cache policy prevents recurrence but cannot erase a
   previously cached browser tab that is already running.
3. Firestore composite indexes and Rules remain separate release concerns.
   A missing index or denied query must remain visible as an error; do not
   fall back to a full collection read.
