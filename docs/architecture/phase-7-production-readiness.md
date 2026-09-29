# Phase 7 — Production Architecture & Go-Live Readiness

## Scope

Phase 7 closed the repository-level gaps before production provisioning. The
Production Firebase project is provisioned, Cloud Firestore App Check
enforcement is enabled, and the static Vite build plus Rules/indexes are
deployed to the approved Hosting site. No trusted backend, scheduled worker,
or production data migration has been deployed.

The Phase Fix 5 per-NVR collection Rules/index and CCTV UI changes are verified
locally but are not included in a new Production Hosting/Firestore deployment
yet. They require a separate explicit release approval.

## Delivered in the repository

- Production configuration preflight rejects emulator projects, placeholders, and missing App Check. It validates an HTTPS backend only when the optional Trusted Backend flag is enabled.
- The browser fails closed when Production App Check is enabled without a real reCAPTCHA Enterprise site key.
- The trusted server remains explicitly Emulator-only and rejects wildcard CORS origins, invalid ports, and missing emulator hosts.
- Hosting configuration retains baseline security headers. Final CSP, domain, and HSTS values require review against the approved Firebase Hosting domain and App Check/auth flows.
- Disaster recovery and monitoring runbooks define the evidence required before go-live.
- Phase 7 guardrail tests run together with the trusted boundary tests.
- Spark-only client mutation and Rules tests cover the no-backend operating path.
- The approved Spark-only Hosting release is `https://itoms-v2.web.app`.

## Recommended target architecture

1. Firebase Auth and Firestore remain the system of record for the current migration stage.
2. The static Vite client is served from Firebase Hosting or an approved equivalent.
3. The current Spark-only production path uses Rules-protected client mutations. A small HTTPS Trusted Backend remains an optional future boundary for stronger audit/SLA guarantees.
4. A managed scheduler invokes SLA/escalation workers. The worker is idempotent and writes correlation IDs for every action.
5. Cloud Monitoring and an approved error-monitoring destination provide the operational source of truth.
6. Firestore export/backup is configured with an approved retention policy and tested restore path.

Cloud Run is the preferred backend target when a containerized API and worker are required. Firebase Cloud Functions remains a valid alternative when the team prefers Firebase-managed operations. A Linux Docker server behind Mikrotik/DDNS is not the default recommendation because the team would own TLS, patching, secrets, public exposure, failover, backups, and monitoring.

## Go-live gates

The following must be approved and evidenced before any Production deployment:

- Approved Firebase project, region, billing plan, data classification, and access owners.
- Production App Check site key registered for the exact Hosting/custom domains; enforcement tested with valid and invalid clients.
- If a Trusted Backend is enabled later, it must be deployed privately or behind an approved HTTPS edge, with service identity and secret rotation.
- Firestore Rules and indexes reviewed against the target project; no Test Mode rules.
- Distributed rate limiting and abuse protection at the edge/API layer.
- Backup retention, RTO/RPO, restore drill, and rollback owner approved.
- Alerts routed to an owned channel with a tested notification path.
- Representative-data load/performance test completed.
- Role/membership review and initial Super Admin bootstrap procedure approved.

## Safe production configuration flow

```sh
cp .env.production.example .env.production
# Fill only approved project/App Check values; backend values are optional in Spark-only mode.
npm run check:production-config
npm run build
```

The preflight is a local validation only. It does not log in, read Firebase, deploy, or verify Console-side enforcement. Those checks remain explicit go-live tasks.

## Known limitations after Phase 7

- The repository still contains no deployed Production backend or scheduled worker.
- In Spark-only mode, SLA breach state is calculated client-side and is not continuously evaluated or contractual.
- App Check is initialized by the client only; Cloud Firestore enforcement is now enabled in Firebase Console and must be validated against a production-configured client before user rollout.
- Client telemetry is not a quota, billing, security, or incident source of truth.
- The local rate limiter is not suitable for multiple instances.
- Spark operations provide manual CSV export of the currently loaded bounded CCTV summary only; scheduled export, retention automation, and full historical export remain unavailable.
