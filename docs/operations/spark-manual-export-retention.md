# Spark Manual Export and Retention Runbook

## What the Spark-only portal can do

The CCTV page can export the currently loaded monthly CCTV summary as CSV.
This is a user-initiated browser download and is intentionally bounded by the
same Property scope and page/query limits shown on screen.

The export is useful for a working copy, review, or manual retention process.
It is not a backup, legal archive, tamper-proof audit export, or complete
historical extract.

The NVR inventory screen loads at most 200 registered NVR records per Property
in the Spark client. Larger inventories require server-side search or
partitioning rather than an unbounded browser read.

## Manual operating procedure

1. Select the required Property scope.
2. Open CCTV and navigate to the month to be reviewed.
3. Confirm the screen shows the expected loaded-data scope.
4. Select `Export loaded data`.
5. Store the CSV in an approved restricted location with the export date,
   operator, Property scope, and retention expiry recorded separately.
6. Verify the file opens and that the row count matches the loaded summary.
7. Delete expired working copies according to the approved local policy.

Do not place ticket descriptions, personal data, credentials, or service
account keys into a manual export location that is not approved for that data.

## What still requires a future managed process

- Scheduled Firestore export and retention enforcement.
- Point-in-time recovery or managed backup evidence.
- Complete historical export across all Properties.
- Hashing, sealing, legal hold, or tamper-evident archival.
- Automated restore drills and RTO/RPO evidence.
