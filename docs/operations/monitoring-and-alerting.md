# Monitoring and Alerting Design

## Source of truth

| Concern | Source of truth | Client telemetry role |
|---|---|---|
| Firebase/Firestore quota, reads, writes, storage, billing | Firebase Console and Google Cloud Monitoring | None; client counters are advisory |
| Backend availability and latency | Trusted Backend metrics/logs and load balancer | Optional operation timing only |
| Auth failures and abuse | Firebase Auth reports, edge/API logs, security alerts | Sanitized error class only |
| Firestore Rules denials | Cloud/Firebase logs and Rules test evidence | Not a replacement |
| SLA breach and backlog | Trusted Backend worker output and Firestore operational queries | UI indicator only |
| Frontend exceptions/performance | Approved error/performance monitoring service | Must exclude business content |
| Backup success and restore readiness | Backup/export job logs and timed DR drill | None |

## Minimum dashboards

- Firebase project quota and billing trend.
- Backend request count, p50/p95/p99 latency, 4xx/5xx, 429, and dependency failures.
- Ticket command success/failure, idempotency replay, audit write failures, and SLA worker lag.
- Auth sign-in failures, App Check invalid/missing tokens, and Rules denials.
- Backup/export success, age of last successful backup, and restore drill result.

## Alert candidates to approve

Thresholds must be tuned with real baseline traffic, but the alert set should include:

- Backend unavailable or readiness failures for a sustained interval.
- 5xx rate, p95 latency, or Firestore dependency errors above the agreed threshold.
- 429 rate indicating abuse or an incorrectly sized limit.
- App Check invalid-token spike.
- SLA worker lag beyond the contractual evaluation interval.
- Backup older than the approved RPO or failed export.
- Firestore/Auth quota approaching the approved budget.

## Privacy requirements

- Never send ticket descriptions, email addresses, names, access tokens, or raw request bodies to telemetry.
- Use allowlisted feature/error names, bounded numeric values, and correlation IDs only where approved.
- Define retention and access control before enabling a central telemetry adapter.
