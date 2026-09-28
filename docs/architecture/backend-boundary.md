# Backend boundary proposal

## Why a trusted boundary may be needed later

The browser is suitable for user interaction and property-scoped reads, but it cannot be the source of truth for contractual SLA clocks, audit evidence, scheduled escalation, quota aggregation, or privileged user provisioning. Firestore Rules can reject invalid shapes and unauthorized writes; they cannot prove that a browser did not fabricate a valid-looking event.

## Current Spark-only transition

The current operating decision is Firebase + Spark only. The browser uses the bounded Rules path for Ticket creation, status, assignment, and operational audit events. This keeps the system deployable without a paid backend, but those client-originated records are not tamper-proof and SLA display is advisory.

## Recommended future transition

Keep the existing React/Vite client and Firestore data model during the next transition. Add one trusted service boundary for privileged operations:

- `POST /tickets/{id}/assign`
- `POST /tickets/{id}/status`
- `GET /tickets` with validated property/filter/cursor parameters
- `GET /audit-events`
- scheduled SLA evaluation and notification jobs
- usage/error aggregation
- user and membership provisioning

The service should authenticate Firebase ID tokens, load current profile/membership state from a trusted context, validate the command, write the Ticket/event/audit records atomically where possible, and emit a correlation ID. The client should stop writing privileged audit/SLA fields directly once this boundary is enabled.

## Hosting options

1. Cloud Run: recommended if the team wants a containerized API with scheduled workers and predictable operational boundaries. It can use the existing Firebase project and service account controls, but generally needs a paid billing setup.
2. Firebase Cloud Functions: smaller operational footprint for Firestore/Auth triggers and scheduled jobs, but it is a new backend capability and was intentionally not created in Phase 2.
3. Linux Docker behind Mikrotik/DDNS: technically possible, but the team then owns TLS, patching, secrets, backups, monitoring, failover, and public exposure. DDNS is not an authorization or audit solution.

Recommendation: do not migrate the whole portal yet. Add a small trusted API/worker boundary first, then reassess Firestore versus PostgreSQL after real query volume and reporting requirements are measured.

## Data ownership rules

- Firestore remains the source of truth for the current MVP until a migration decision is approved.
- Audit events must be written by the trusted boundary and be immutable to normal application identities.
- SLA policy and clock state must be server-owned; client display is advisory.
- Every command needs an idempotency/correlation key so retries cannot duplicate assignment, notification, or audit entries.
- Any schema migration follows expand → backfill → switch → contract, with a restore rehearsal before contract.
