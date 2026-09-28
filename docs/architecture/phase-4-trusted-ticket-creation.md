# Phase 4 — Trusted Ticket Creation & Shared Contracts

Date: 2026-09-26

## Delivered

- Added a shared TypeScript ticket contract under `shared/ticket-contracts.ts`.
- Added strict boundary validation for Ticket creation, Assignment, and Status commands.
- Added `POST /v1/tickets` to the Emulator-only Trusted Backend.
- Ticket creation now writes the Ticket, initial domain event, Audit Event, and idempotency operation in one Firestore transaction.
- The backend derives `requesterUid` from the verified Firebase ID token instead of accepting it from the request body.
- Property, active profile, membership role, property code, and dynamic catalog values are checked before the write.
- Frontend Ticket creation uses the backend when `VITE_ENABLE_TRUSTED_BACKEND=true`; otherwise the Spark-only Rules-protected client mutation path is used.
- Unknown or injected request fields return a safe `422 validation_error` response.

## Trust boundary change

When the feature flag is enabled, Ticket creation, Assignment, and Status changes use the backend and the backend writes the Audit Event with Admin SDK authority. When it is disabled, Spark-only Ticket mutations and append-only operational audit writes are allowed by narrow Rules; these records are not trusted/tamper-proof.

## Compatibility and migration

1. Keep the feature flag disabled for the normal Spark-only Firebase workflow.
2. Run Auth/Firestore Emulators plus `npm run server:dev` and enable the flag in local `.env.local` for Phase 4 acceptance testing.
3. Compare backend-created documents with existing schema-version 1/2 readers.
4. Promote the flag only in a staging environment after API, role, retry, and restore tests pass.
5. Rules tests cover the Spark-only mutation boundary and deny injected fields, cross-Property assignments, updates, and deletes.

## Deliberate limitations

- Backend remains emulator-only; no Docker, Cloud Run, TLS, public DNS, or production credential was created.
- SLA clock persistence, scheduled evaluation, notifications, provisioning, and other domain mutations remain future backend work.
- The current in-memory HTTP process has no distributed rate limiter; production must add edge/application rate controls.
- Firestore remains the source of truth and no data migration is required for existing tickets.

## Verification

- `npm run build`: passed.
- `npm run server:build`: passed.
- `npm run test:server`: passed, 3 tests, 0 failures.
- Existing `npm run test:rules`: passed, 16 tests, 0 failures.
- The post-Phase 4 snapshot was extracted into a fresh temporary directory and passed frontend build, backend build, Trusted Backend tests 3/3, and Rules tests 16/16 from the restored directory.
