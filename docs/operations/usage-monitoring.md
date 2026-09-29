# Usage monitoring

The portal now emits a small set of client-side counters (`ticket_page_loaded`, `ticket_created`, `ticket_status_changed`, `ticket_assigned`, `user_directory_page_loaded`, and `audit_page_loaded`). The instrumentation is deliberately disabled by default and excludes descriptions, names, email addresses, and ticket identifiers.

Enable it only after approving the privacy and retention approach:

```env
VITE_ENABLE_USAGE_TELEMETRY=true
```

This flag currently exposes browser events for an approved telemetry adapter; it does not create a new Firestore write stream. Firebase quota and billing decisions must use Firebase Console / Google Cloud Monitoring, because client counters can be blocked, duplicated, or forged. A future trusted backend can consume these events and aggregate them by day, property, feature, latency, and error class.

## Spark quota review checklist

Review these views at least weekly during pilot usage, and before importing or
exporting a large data set:

- Firebase Console → Firestore Usage: reads, writes, deletes, storage, and
  current quota consumption.
- Firebase Console → Firestore Indexes: index build failures and unused or
  unexpectedly expensive composite indexes.
- Firebase Console → Authentication: sign-ins, provider errors, and abuse
  patterns.
- Firebase Console → App Check: valid/invalid token traffic and enforcement
  failures.
- Google Cloud Monitoring: Firestore request latency, error rate, and quota
  alerts when the project exposes the relevant metric for the selected plan.

Client telemetry is an operational hint only. It must never be used as the
source of truth for billing, quota, security, or retention decisions.
