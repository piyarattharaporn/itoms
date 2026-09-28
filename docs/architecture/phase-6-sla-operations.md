# Phase 6 — Trusted SLA State & Operations Boundary

Date: 2026-09-26

## Delivered

- Added shared SLA contracts under `shared/sla-contracts.ts` so the UI and backend use one policy definition.
- Added backend-owned policy snapshots for new Tickets: policy ID, response target, resolution target, start time, due timestamps, and lifecycle state.
- New Tickets use `schemaVersion: 3`; existing schema-version 1/2 Tickets remain readable.
- Status transitions persist response met time and resolution met time.
- `Waiting for User` and `Waiting for Vendor` pause the SLA clock with a trusted `slaPausedAt` timestamp and reason.
- Returning to an active status adds the elapsed pause duration to both due timestamps and records accumulated pause minutes.
- Completed and Cancelled states are persisted as terminal SLA states. Breach flags are evaluated by the trusted backend during a mutation.
- Client SLA display prefers persisted backend fields and falls back safely for legacy Tickets with no SLA fields.
- Server integration tests cover creation, pause, resume, and legacy Ticket compatibility.
- Emulator backend mutations have a bounded in-memory rate limiter and return `429` with `Retry-After` when the burst limit is exceeded.

## SLA policy v1

The current emulator policy is 24x7 and is intentionally a versioned operational default:

| Priority | Response target | Resolution target |
|---|---:|---:|
| Critical | 30 minutes | 4 hours |
| High | 1 hour | 8 hours |
| Medium | 4 hours | 24 hours |
| Low | 8 hours | 48 hours |

The policy is stored as a snapshot on the Ticket so later policy changes do not rewrite historical intent. Property-specific calendars and business hours are not implemented yet.

## Migration behavior

- No backfill is required for the current phase.
- A legacy Ticket without SLA fields is parsed using its priority and created time for display.
- The first backend status transition upgrades the Ticket to `schemaVersion: 3` and persists SLA fields.
- Existing `createdAt`, status, assignment, event, and audit fields are not deleted or rewritten unnecessarily.

## Trust boundary and limitations

The backend owns timestamps during Ticket commands, but there is no scheduled worker. A Ticket can become overdue between commands; the system will persist the breach flag on the next backend mutation, not continuously. This is not contractual SLA enforcement.

Production still needs a trusted scheduler/worker, business-hours calendar, policy approval workflow, notification/escalation channel, clock/latency monitoring, idempotent evaluation, and a clear definition of whether waiting states pause response, resolution, or both.

The current rate limiter is process-local and intentionally lightweight for Emulator development. It is not sufficient for multiple backend instances; production must enforce limits at an edge/API gateway and retain an application-level identity-aware limiter.

## Verification

- `npm run build`: passed.
- `npm run server:build`: passed.
- `npm run test:server`: passed, including `running → paused → running` SLA lifecycle assertions.
- `node --test server/rate-limit.test.ts`: passed for burst bounds and key isolation.
- `npm run test:rules`: remains 16/16; client Ticket/Audit writes stay denied.
