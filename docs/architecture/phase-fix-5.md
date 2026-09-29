# Phase Fix 5 — Spark Operational Limits

Date: 2026-09-29

## Objective

Keep the approved Firebase Spark operating model usable as CCTV/NVR data grows
without opening Firestore Rules, downloading unbounded collections, or adding
a trusted backend in this phase.

## Implemented

- Added `cctvNvrDailyChecks`, one document per Property/date/NVR. This removes
  the legacy embedded `nvrDetails` list as the only detail source.
- Kept `cctvDailyChecks` as a backward-compatible aggregate for dashboards,
  calendar summaries, and older records.
- Added Property/role-scoped Rules and a composite index for the per-NVR
  collection.
- CCTV daily-check UI reads per-NVR records for the selected date and uses the
  individual NVR save action for Properties above the aggregate embedded-list
  limit.
- Added a manual CSV export for the loaded monthly CCTV summary. The export
  contains operational counts only and does not claim to be a full historical
  export.
- Added an explicit Spark/bounded-data notice to the CCTV screen.
- Added a quota review checklist covering Firestore, Authentication, App
  Check, indexes, and Cloud Monitoring.

## Data compatibility

No existing `cctvDailyChecks` documents are deleted or rewritten. Older daily
records continue to render from their aggregate fields and embedded details.
New per-NVR records are additive. A future migration may backfill historical
per-NVR documents only after a snapshot, dry run, and restore verification.

## Bounded limits that remain intentional

- Per-NVR detail reads are capped at 500 records per Property/date query.
- All-Property reads split `in` queries into groups of ten Property IDs.
- NVR inventory display is capped at 200 registered records per Property in the Spark client; larger inventories need server-side search or partitioning before increasing limits.
- Monthly CSV export covers only aggregate documents loaded by the current
  screen; it does not query all history or bypass Firestore Rules.
- Scheduled retention, full export, exact historical aggregation, and trusted
  quota accounting remain outside Spark-only scope.

## Decision boundary

This phase improves the data shape for larger NVR inventories but does not
make client writes tamper-proof. If the system requires contractual SLA,
immutable audit evidence, scheduled retention/export, or unbounded global
reporting, move to the trusted backend boundary rather than raising client
limits again.

## Release status

This phase is verified against the local Firebase Emulator and production Vite
build. The new `cctvNvrDailyChecks` Rules/index and CCTV UI are not deployed to
Production in this phase; deploy them only as an explicitly reviewed release.
