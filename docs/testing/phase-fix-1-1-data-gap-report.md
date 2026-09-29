# Phase Fix 1.1 Data Gap Report

Date: 2026-09-29

## Scope

This report covers the `updatedAt` compatibility check and index source-of-truth
review. It deliberately distinguishes production records from temporary
sampling records.

## Production read-only scan before sampling

The required `updatedAt` collections had no missing `updatedAt` documents:

| Collection                | Documents scanned | Missing `updatedAt` |
| ------------------------- | ----------------: | ------------------: |
| `tickets`                 |                 8 |                   0 |
| `rcaRecords`              |                 0 |                   0 |
| `assets`                  |                 2 |                   0 |
| `ticketAssetOptions`      |                 3 |                   0 |
| `operationalTodos`        |                 2 |                   0 |
| `requestUsers`            |                 7 |                   0 |
| `softwareLicenses`        |                 3 |                   0 |
| `pmSchedules`             |                 0 |                   0 |
| `infrastructureIncidents` |                 1 |                   0 |
| `cctvNvrInventory`        |                 8 |                   0 |
| `cctvDailyChecks`         |                 3 |                   0 |

`auditEvents` had 34 documents without `updatedAt`. This is expected because
Audit Log uses immutable `createdAt` ordering and is excluded from the
`updatedAt` migration scope.

## Sampling verification

The verification creates two Ticket samples and two RCA samples per target:

- one valid document with `updatedAt`;
- one legacy-shaped document intentionally without `updatedAt`.

Expected scan result after seed:

| Target              | Ticket samples | Ticket missing | RCA samples | RCA missing |
| ------------------- | -------------: | -------------: | ----------: | ----------: |
| Local Emulator      |              2 |              1 |           2 |           1 |
| Production Firebase |              2 |              1 |           2 |           1 |

After the scan, the script deletes only the four exact IDs with the
`PHASE-FIX-1-1-SAMPLE-` prefix and scans again. Expected cleanup result:
zero sampling documents remaining in both targets.

Actual verification result: **PASS** for Local Emulator and **PASS** for
Production Firebase. Both targets detected the two intentional legacy-shaped
documents during the seeded scan, then reported zero sample documents after
cleanup. The final Production scan reported zero missing `updatedAt` documents
in every required collection.

## Index review

Production contained one additional valid query index for
`tickets(propertyId ASC, createdAt DESC)`. It was added to
`firestore.indexes.json`; no production index was deleted.

## Conclusion

No production backfill is required based on the read-only scan. The legacy
compatibility risk is covered by a repeatable detection test and documented
cleanup gate. The remaining Rules expression-budget warning is separate hardening
work and is not masked by this sampling run.

## Regression verification after cleanup

- Quality gate: PASS — Unit 15/15, contract, lint, and format
- Production build: PASS
- Firestore Rules: PASS — 26/26
- Trusted server: PASS — 10/10
- Baseline browser E2E: PASS — 16/16
- Full menu sampling E2E: PASS — 2/2
