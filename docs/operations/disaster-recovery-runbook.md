# Disaster Recovery Runbook

This runbook is a go-live template. It does not perform a backup or restore against a Production project.

## Decisions required

| Decision | Required value | Owner/evidence |
|---|---|---|
| RPO | Approved maximum data loss window | Business owner + export evidence |
| RTO | Approved maximum recovery time | Operations owner + timed drill |
| Retention | Daily/weekly/monthly retention and deletion policy | Data owner/legal review |
| Region | Firestore and backup region | Architecture approval |
| Access | Separate break-glass restore identity | Security review |
| Validation | Record counts, Rules, indexes, and application smoke tests | Restore report |

## Required production procedure

1. Declare the incident and record an incident/correlation ID.
2. Freeze destructive administration and preserve relevant logs.
3. Identify the last known-good Firestore export/snapshot and verify its checksum/metadata.
4. Restore into an isolated project or database first; never overwrite the source as the first action.
5. Validate Authentication configuration, Rules, indexes, profiles, memberships, Properties, Tickets, events, and Audit Events.
6. Run application smoke tests and the Rules negative-test suite against the isolated target.
7. Obtain the recovery owner’s approval before switching DNS/Hosting/backend configuration.
8. Record elapsed restore time, data loss window, failed records, and follow-up actions.

## Repository evidence already available

- Local snapshot and full restore build test are maintained under `snapshots/`.
- Firestore Rules tests cover deny-by-default and cross-Property boundaries.
- Trusted mutation tests cover idempotency and linked audit events.

These local artifacts are not substitutes for a Production export/restore drill. Production evidence must be generated after the project, service identity, retention policy, and backup destination are approved.
