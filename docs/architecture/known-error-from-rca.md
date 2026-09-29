# Known Error from RCA (Spark MVP)

## Purpose

The Known Error Base (KEDB) MVP turns an approved RCA into a searchable,
repeatable support reference without introducing a new top-level menu or a
trusted backend. The first version lives in **RCA & Service Review** so the
source incident, RCA evidence, and Known Error remain in one workflow.

## Workflow

1. A completed Task is reviewed and an RCA is created as `Draft`.
2. A Support Engineer or Super Admin changes the RCA to `Approved` after the
   root cause and corrective direction are ready.
3. The user selects **Create Known Error draft** from that RCA.
4. The form is prefilled from the RCA as a snapshot. The operator can refine
   the title, symptoms, workaround, permanent fix, owner, and review date.
5. The Known Error is saved as `Draft`. Support Engineers and Super Admins can
   later change it to `Published` or `Retired`.

There is one Known Error per source RCA in the MVP. The Firestore document ID
is the `sourceRcaId`, which makes the create operation idempotent at the data
model level and prevents multiple drafts for the same RCA through the normal
client flow.

## Data model

Collection: `knownErrors/{sourceRcaId}`

| Field                                 | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `schemaVersion`                       | Schema version, currently `1`                       |
| `propertyId`, `propertyCode`          | Property scope                                      |
| `sourceRcaId`, `sourceTaskId`         | Traceability to the approved RCA and completed Task |
| `taskTitle`, `taskCategory`           | Snapshot context for list and search display        |
| `title`                               | Short searchable Known Error title                  |
| `symptoms`                            | Observable symptoms and error conditions            |
| `rootCause`                           | Confirmed root cause                                |
| `workaround`                          | Temporary recovery steps                            |
| `permanentFix`                        | Permanent correction or next-step plan              |
| `ownerUid`                            | Support Engineer owner UID, optional                |
| `reviewDueDate`                       | Optional ISO date for review                        |
| `status`                              | `Draft`, `Published`, or `Retired`                  |
| `createdBy`, `createdAt`, `updatedAt` | Ownership and audit timestamps                      |

The source RCA remains the canonical evidence record. Known Error fields are
intentionally copied as a snapshot so later RCA edits do not silently rewrite
the operational guidance already published to the support team.

## Access boundary

- Support Engineers and Super Admins can create and update Known Errors only
  within their Property scope.
- Client Executives can read Known Errors within their Property scope.
- Requesters and users without Property access cannot read them.
- Deletes are denied. Retire a record instead of deleting it.
- A create is accepted only when the source RCA exists, is `Approved`, has the
  same Property/task identity, and the new record is a `Draft`.
- Rules reject injected fields, invalid dates, invalid status values, and
  cross-Property source references.

## Known MVP limitations

- The page loads Known Errors with cursor pagination (25 records, maximum 50).
  Search and counts are limited to records loaded in the browser.
- There is no full-text search, relevance ranking, duplicate detection, or
  synonym/tag model. Backend Search should be designed before the collection
  becomes large.
- Client-created records are protected by Firestore Rules but are not
  tamper-proof evidence. A trusted backend is required for authoritative
  approval, verification, and immutable publication history.
- There is no attachment, approval workflow, notification, review reminder,
  or automatic stale-record handling.
- The owner is stored as a UID; the UI resolves a display label from the
  Property-scoped Support Engineer list.
- Retention, export, verification, and cross-Property knowledge sharing are
  operational policies still to be decided.

## Next evolution

1. Add a dedicated KEDB menu only after usage proves the RCA page is too
   crowded.
2. Add tags, affected service/asset, version, known symptoms, and linked
   incident count with a schema migration.
3. Move publication and review transitions behind a trusted backend when the
   system requires contractual evidence or automated notifications.
4. Add server-side search/filter and a bounded export with an explicit
   retention policy.
