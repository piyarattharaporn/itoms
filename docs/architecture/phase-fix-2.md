# Phase Fix 2 — Operational Read Scalability

Date: 2026-09-29

## Objective

Reduce the risk of unbounded client reads on operational pages while keeping the
Spark-only architecture and the existing Firestore Rules unchanged. The
implementation does not add a trusted backend, search service, or Cloud
Functions. Hosting release is handled separately after the verification gate.

## Implemented scope

The following operational pages now use Firestore cursor pagination with a
bounded page size of 25 records (the service clamps callers to a maximum of 50):

- Asset Registry
- Damaged Assets
- Preventive Maintenance schedules
- Software Licenses
- Request Users

Each page uses a property-scoped query when the current user is scoped to one
Property. Super Admin's all-Property view keeps the existing Rules-enforced
scope and reads the same bounded pages. The UI provides an explicit “load more”
action and does not increase the page size to hide a large dataset.

## Query contract

| Domain         | Collection         | Cursor order     | Page size | UI behavior                                                    |
| -------------- | ------------------ | ---------------- | --------: | -------------------------------------------------------------- |
| Assets         | `assets`           | `updatedAt DESC` |        25 | Load more; search is over loaded rows                          |
| Damaged assets | `assets`           | `updatedAt DESC` |        25 | Load more; status is `Damaged`, `Under Repair`, or `Retired`   |
| PM             | `pmSchedules`      | `nextDueOn ASC`  |        25 | Load more; active filter remains client-side for compatibility |
| Licenses       | `softwareLicenses` | `expiresOn ASC`  |        25 | Load more; expiring summary is for loaded rows                 |
| Request Users  | `requestUsers`     | `createdAt DESC` |        25 | Load more; Firestore order is preserved across pages           |

All query paths retain the existing property and role checks. A missing index or
Rules denial is surfaced as an actionable load error; the client does not fall
back to an unbounded collection read.

## Important MVP limitations

1. Search and filters on these pages operate only on records already loaded in
   the browser. They are not full-dataset search.
2. Summary counts on paginated pages represent the loaded rows, not necessarily
   the complete collection. The UI labels this where the summary could be
   misleading.
3. A one-shot page is not a live realtime feed. Scope changes and local writes
   reload the first page; changes made by another session require a refresh or
   another page load.
4. The legacy Asset-to-Task dropdown repair button syncs only the loaded Asset
   rows. New and edited Assets update their option automatically. A complete
   historical rebuild should be a bounded admin operation or trusted backend
   job in a future phase.
5. Firestore cursor pagination is not offset pagination. Records inserted or
   updated between page loads can move between pages; this is expected and the
   UI should not promise a frozen report snapshot.

## Backend boundary for the next phase

When the collections grow beyond a practical client-side working set, add a
trusted backend search/report endpoint with:

- server-owned query validation and property authorization;
- normalized search fields and explicit filter operators;
- stable sort plus a signed/opaque page cursor;
- aggregate counts computed server-side;
- export jobs that are bounded, auditable, and rate-limited.

Until that boundary is approved, keep page size bounded and treat the UI
filters as convenience filters rather than audit-grade reporting.
