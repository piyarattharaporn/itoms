# V1 to V2 Migration Record

## Scope

- Source Firebase project: `itmos-4aff7`
- Target Firebase project: `itoms-v2`
- Migration method: local one-time migration using Firebase CLI Auth export and Firestore REST batch writes
- No Managed Firestore Export/Import, Cloud Functions, or production backend was used

## Migrated data

The source inventory contained 26 Firestore documents:

- `users`: 3
- `properties`: 3
- `memberships`: 4
- `tickets`: 2
- `cctvNvrInventory`: 8
- `cctvDailyChecks`: 2
- `requestUsers`: 2
- `softwareLicenses`: 2

Firebase Authentication contained 3 accounts. The V2 account for the matching Gmail address was preserved to avoid a duplicate account; the other two V1 accounts were imported with their original UIDs and password hash parameters.

## UID mapping

The matching Gmail account had a different UID in V2. All references to the old UID were rewritten in migrated document fields and membership document IDs. No old UID references remain in the V2 Firestore export verification.

## Verification

- Firestore document counts match the V1 inventory: 26 documents
- Authentication account count matches: 3 accounts
- Target document paths are unique
- Old UID references: 0
- V2 production Firestore export completed after migration
- V1 data was not deleted

## Operational notes

- The migration bypassed client Firestore Rules through an authenticated administrative migration process; this was a one-time operation only.
- Future migrations must create a fresh source/target snapshot, run a dry-run mapping, and verify counts and UID references before writing.
- Existing V2 application Rules, App Check enforcement, Spark plan, and Hosting configuration were not relaxed.
