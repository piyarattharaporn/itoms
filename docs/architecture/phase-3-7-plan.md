# Phase 3–7 implementation note

## Delivered in this phase

- Assignment: Support Engineer/Super Admin can assign a ticket to an active Support Engineer membership in the same Property. The write is protected by a ticket update + immutable ticket event pair.
- SLA: Phase 6 persists a backend-owned 24x7 policy snapshot, response/resolution deadlines, response/resolution timestamps, pause/resume duration, and lifecycle state. The UI still presents operational status only; it is not a contractual timer until a production worker, policy governance, and notification controls exist.
- Pagination: Ticket Board and User Directory use cursor pagination. User Directory reads one page of `users`, then only memberships for the page's UIDs; it no longer subscribes to both whole collections.
- Full audit log: ticket creation, status changes, assignment, reassignment, and unassignment append an `auditEvents` record and are shown in the Audit Log page. Spark-only mode writes these records from the client under narrow Rules; the optional Trusted Backend writes them with Admin SDK authority.
- Usage monitoring: low-volume, content-free client instrumentation is available through `recordUsageEvent`. It is disabled by default and does not replace Firebase/Google Cloud quota monitoring.

## Explicit limitations

The local Trusted Backend still owns Ticket mutations, Audit Event writes, and persisted SLA state when explicitly enabled in Emulator mode. The default Spark-only path uses client mutations with Rules validation, client-side SLA display, and no scheduled breach evaluation, automatic escalation, notifications, or tamper-proof evidence.

## Operational checks

1. Keep `VITE_ENABLE_USAGE_TELEMETRY=false` in local/emulator environments.
2. Review Firebase Console usage and Cloud Firestore query/index health as the source of truth.
3. Use the Audit Log for operational traceability, not as the sole source for legal/contractual disputes.
4. When the ticket volume grows, add server-side search/filtering or move to a backend/API boundary rather than increasing client page sizes.

## Phase 7 production-readiness boundary

Phase 7 adds repository-side preflight checks, emulator-only server guardrails, and go-live runbooks. It does not deploy a Production Firebase project or backend. Production App Check enforcement, distributed rate limiting, scheduled SLA workers, backup/restore evidence, monitoring, data retention, and access review remain explicit approval gates.
