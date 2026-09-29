# Phase Fix 1.1 — Legacy Data Gap Verification

Date: 2026-09-29

## Purpose

Phase Fix 1.1 verifies the data compatibility concern identified in Phase Fix 1:
documents used by `updatedAt`-ordered queries must contain `updatedAt`. The work
uses clearly-prefixed, reversible sampling documents and does not backfill or
rewrite existing production records automatically.

## Data classification

The migration scope covers `tickets`, `rcaRecords`, `assets`,
`ticketAssetOptions`, `operationalTodos`, `requestUsers`, `softwareLicenses`,
`pmSchedules`, `infrastructureIncidents`, `cctvNvrInventory`, and
`cctvDailyChecks`.

`auditEvents` is intentionally `createdAt`-based and is not part of the
`updatedAt` migration scope. Its lack of `updatedAt` is expected schema
behavior, not a missing-data defect.

## Sampling contract

The script `scripts/phase-fix-1-1-sampling.mjs` creates only these documents:

- `PHASE-FIX-1-1-SAMPLE-TICKET-VALID`
- `PHASE-FIX-1-1-SAMPLE-TICKET-LEGACY-NO-UPDATED-AT`
- `PHASE-FIX-1-1-SAMPLE-RCA-VALID`
- `PHASE-FIX-1-1-SAMPLE-RCA-LEGACY-NO-UPDATED-AT`

The `LEGACY-NO-UPDATED-AT` documents intentionally model the old schema. They
are used to prove that the scanner detects a gap; they are not silently included
in an ordered query. The script verifies the expected counts and then deletes
only these exact prefixed document IDs.

## Safe commands

Local Emulator:

```bash
firebase emulators:exec --config firebase.e2e-test.json \
  --project demo-lotus-it-portal-local --only auth,firestore \
  "node scripts/phase-fix-1-1-sampling.mjs verify"
```

Production Firebase requires the explicit project confirmation:

```bash
PHASE_FIX_1_1_TARGET=production \
PHASE_FIX_1_1_CONFIRM=itoms-v2 \
node scripts/phase-fix-1-1-sampling.mjs verify
```

The production command uses the existing Firebase CLI login token without
writing credentials to the repository. It is an admin-level test-data
operation, not an application CRUD or Rules authorization test.

## Index source-of-truth

The production index inventory contained one `tickets(propertyId,
createdAt DESC)` index that was not represented in the repository. It was added
to `firestore.indexes.json`; no index was deleted.

## Result interpretation

- A non-zero missing count in a required collection needs a separately approved,
  bounded backfill after a snapshot and verification.
- A zero missing count means no migration is required for that collection.
- Sampling cleanup is a required post-test gate. A run is not complete if any
  `PHASE-FIX-1-1-SAMPLE-` document remains.
