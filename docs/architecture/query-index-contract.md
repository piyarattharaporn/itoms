# Query and Index Contract

Date: 2026-09-29

This document is the Phase Fix 4 read-scalability contract for the Spark-only
client. It records which bounded client queries are allowed and which
composite indexes must exist. It does not turn client-side filtering into
server-side search.

## Rules

- Every property-scoped query includes `propertyId == selectedPropertyId`.
- An all-Property view is still bounded by a page size or an explicit summary
  limit; it must not fall back to an unbounded collection read.
- Cursor pagination uses a stable `orderBy` field and a document cursor.
- Search performed after loading rows is explicitly page-local.
- A missing index is surfaced as an error; the UI must not hide it by reading
  the whole collection.
- Aggregates across all historical rows and global search remain backend/read
  model requirements and are not approximated by larger page sizes.

## Composite index inventory

| Collection                   | Query shape                                      | Current use                      |
| ---------------------------- | ------------------------------------------------ | -------------------------------- |
| `tickets`                    | `status + createdAt desc`                        | all-Property Ticket Board        |
| `tickets`                    | `propertyId + createdAt desc`                    | property Ticket Board            |
| `tickets`                    | `propertyId + status + createdAt desc`           | filtered property board          |
| `tickets`                    | `status + updatedAt desc`                        | completed/recent views           |
| `tickets`                    | `propertyId + status + updatedAt desc`           | completed property view          |
| `tickets`                    | `propertyId + updatedAt desc`                    | bounded activity/dashboard reads |
| `tickets`                    | `propertyId + requesterUid + createdAt desc`     | requester board                  |
| `rcaRecords`                 | `propertyId + updatedAt desc`                    | RCA review                       |
| `auditEvents`                | `propertyId + createdAt desc + document id desc` | stable Audit pagination          |
| `assets`                     | `status + updatedAt desc`                        | all-Property damaged view        |
| `assets`                     | `propertyId + updatedAt desc`                    | Asset Registry                   |
| `assets`                     | `propertyId + status + updatedAt desc`           | damaged/repair/retired view      |
| `ticketAssetOptions`         | `propertyId + updatedAt desc`                    | Task Asset selector              |
| `requestUsers`               | `propertyId + createdAt desc`                    | Request User list                |
| `softwareLicenses`           | `propertyId + expiresOn asc`                     | license expiry list              |
| `pmSchedules`                | `propertyId + nextDueOn asc`                     | PM schedule list                 |
| `infrastructureIncidents`    | `propertyId + startedAt desc`                    | incident list                    |
| `cctvDailyChecks`            | `propertyId + checkedOn desc`                    | CCTV history                     |
| `cctvNvrInventory`           | `propertyId + name asc`                          | NVR inventory                    |
| `operationalTodos`           | `propertyId + startDate desc`                    | calendar todos                   |
| `operationalTodoCompletions` | `propertyId + occurrenceDate asc`                | calendar completion state        |

The executable contract is `scripts/verify-query-index-contract.mjs` and is
run by `npm run test:query-contract`.

## Bounded surfaces still needing backend support

The following surfaces intentionally remain bounded client views:

- Dashboard and Activities Log summaries.
- CCTV daily history and Incident Log summary reads.
- RCA filtering and completed-task selection.
- User Directory membership expansion for the loaded profile page.
- Calendar todos and completion state.

Phase Backend should provide validated search endpoints or materialized read
models for global search, historical reporting, and exact cross-Property
aggregates. It should preserve tenant scope, allowlisted filters, stable
cursor pagination, and a clear consistency timestamp.
