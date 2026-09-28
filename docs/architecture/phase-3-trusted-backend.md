# Phase 3 — Trusted Backend Boundary

Date: 2026-09-26

## Delivered scope

This phase adds a local/emulator-only Node.js TypeScript boundary. It is deliberately not deployed and refuses to start unless both `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are present.

Implemented commands:

- `POST /v1/tickets/{id}/assign`
- `POST /v1/tickets/{id}/status`
- `GET /v1/audit-events`
- `GET /health`

The commands verify Firebase ID tokens, load the active ITOMS profile, enforce Support Engineer/Property scope, use Firestore transactions, write Ticket event + Audit event together, and record an idempotency operation. Responses include a correlation ID at the HTTP boundary.

The browser integration is behind `VITE_ENABLE_TRUSTED_BACKEND=false`. When enabled in Emulator development, Ticket Creation, Assignment, Status, and Completion commands use the local backend API. In the Spark-only operating mode, the disabled state uses the bounded Firestore Rules client mutation path; this path is intentionally weaker than a trusted backend and is documented separately.

## Trust boundary

The backend owns authorization decisions for its commands. Firestore Rules still remain deny-by-default and are not weakened. Admin SDK writes bypass Firestore Rules, so the backend's authorization and validation code is security-critical and must be reviewed like Rules.

## Idempotency

Each mutation requires an 8–128 character idempotency key. The backend stores the command result under an actor-scoped operation document. Repeating the same key and command returns the original result; reusing it for another command/entity returns a conflict.

## Deliberate limitations

- The service is emulator-only in this phase.
- It does not yet own Ticket creation, user provisioning, SLA clock persistence, scheduled workers, notifications, or retention jobs.
- The current status/assignment command duplicates part of the client domain contract. Before production, shared contracts and authorization tests must be consolidated to prevent drift.
- Audit writes are trusted only when made through this boundary; old client audit records remain readable but are not retroactively trusted.
- No Docker image, Cloud Run service, Cloud Function, public DNS, TLS, or Production credential was created.

## Local usage

Start the backend and its Auth/Firestore Emulators:

```sh
npm run server:dev
```

Build the backend contract without running it:

```sh
npm run server:build
```

Run the integration test:

```sh
npm run test:server
```

## Verification recorded

On 2026-09-26, `npm run server:build`, `npm run build`, and `npm run test:server` passed. The existing `npm run test:rules` suite also passed 16/16. A post-Phase 3 snapshot was extracted into a fresh temporary directory and passed backend build, frontend build, trusted-boundary tests 2/2, and Rules tests 16/16 from the restored directory.

The emulator test output still includes a non-failing Admin SDK metadata lookup warning in this offline environment. The Rules suite also logs expected denied-write evaluation messages, including the existing 1000-expression complexity warning for malformed CCTV payloads; no test was permitted by that warning.
