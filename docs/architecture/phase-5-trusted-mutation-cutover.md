# Phase 5 — Trusted Ticket Mutation Cutover

Date: 2026-09-26

## Objective

Move the Ticket write boundary from browser-controlled Firestore batches to the Emulator-only Trusted Backend. This phase closes the client path for Ticket creation, status changes, assignment, Ticket events, and `auditEvents` writes.

## Delivered

- Firestore Rules now allow Ticket and Ticket event reads only; client Ticket creates/updates/event writes are denied.
- `auditEvents` is read-only for client identities. Admin SDK writes from the Trusted Backend remain possible because Admin SDK requests bypass client Rules.
- TicketBoard no longer calls the legacy client mutation functions. Create, status, completion, assignment, reassignment, and unassignment require `VITE_ENABLE_TRUSTED_BACKEND=true` and use the HTTP API.
- Backend Ticket domain events and audit records carry the HTTP `X-Correlation-Id` value as `correlationId`.
- Audit Log displays the correlation ID when it is present.
- Rules tests cover denial of structurally valid client mutations, not only malformed payloads.

## Local acceptance flow

1. Run the server test/emulator profile with `npm run server:dev`.
2. Point the local Vite app at the same emulator ports (`19099` Auth and `18080` Firestore) and set `VITE_ENABLE_TRUSTED_BACKEND=true`.
3. Start Vite and exercise Ticket create, assignment, status change, completion, and Audit Log.
4. Verify that a direct browser Firestore write to `tickets`, `tickets/{id}/events`, or `auditEvents` is denied.

The normal Firebase-only client workflow can still browse data, but it is intentionally not a Ticket mutation workflow after this cutover. A seed/provisioning path is still required for a fresh local emulator.

## Migration and rollback

- Existing Ticket documents are not rewritten. Existing schema-version 1/2 readers remain compatible.
- Existing Audit records remain readable. Client-created historical records are not retroactively trusted; their origin must be treated according to their stored provenance and the pre-Phase 5 limitation.
- Rollback is a source snapshot restore only. Re-opening client Ticket or Audit writes would reduce the trust boundary and must require an explicit security review; it is not a routine operational rollback.

## Security boundary

The backend verifies the Firebase ID token, loads the active profile and current Property membership, validates the command contract, checks the Ticket state transition/assignee, then writes Ticket, domain event, Audit Event, and idempotency operation atomically with Admin SDK authority. Correlation IDs link the HTTP request to the event and audit record but do not make the underlying database immutable or cryptographically signed.

## Remaining limitations

- Backend remains local Emulator-only. There is no production deployment, TLS termination, distributed rate limiter, secret rotation, or HA process supervisor.
- SLA state is now persisted by the Trusted Backend in Phase 6. Scheduled breach evaluation, escalation, notifications, business-hours calendars, and contractual enforcement remain future work.
- Other non-Ticket domain mutations still have their own client Rules and do not automatically gain backend audit coverage.
- Audit retention, export, backup verification, and tamper-evident external archival are not implemented.
