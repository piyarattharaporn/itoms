# Spark-only Production Direction

## Decision

The current target is Firebase services on the Spark plan only. Do not upgrade billing, deploy Cloud Run/Cloud Functions, or depend on a scheduled backend in this stage.

The production path is:

```text
Browser
  -> Firebase Auth
  -> App Check
  -> Firestore Rules
  -> Firestore Standard (asia-southeast3)
```

Firebase Hosting may serve the static Vite build. The project must remain within the published Spark quotas and must be monitored for reads, writes, deletes, storage, egress, and Authentication abuse.

## What works on this path

- Email/Google Authentication after the providers and Authorized Domains are configured.
- Property- and role-scoped Firestore reads.
- Cursor-paginated Ticket Board, User Directory, Audit Log, and related lists.
- Ticket creation, status changes, and assignment through bounded client writes protected by Firestore Rules.
- Append-only operational events and audit records from the client.
- App Check enforcement for Cloud Firestore.
- Client-side SLA indicators based on priority and ticket timestamps.
- Emulator-based Rules, build, restore, and role-boundary testing.

## Explicit limitations

- Client-created Audit Logs are append-only to normal users but are not tamper-proof. A user with a valid account can fabricate a structurally valid event within their permitted Property.
- Client timestamps and SLA calculations are advisory. There is no trusted worker to continuously evaluate breaches, pause clocks, or send notifications.
- No email, LINE, Slack, webhook, or push notification worker is active.
- No automatic user provisioning, role assignment, data export, scheduled backup, PITR, or managed restore drill is available in Spark-only mode.
- Search is bounded client-side over the loaded page. Full-text/server-side search remains future work.
- A malicious client can consume Firestore quota within the limits allowed by Rules; App Check reduces abuse but is not an accounting source of truth.

## Spark safety rules

- Keep `VITE_ENABLE_TRUSTED_BACKEND=false` in `.env.production`.
- Never add service-account credentials to the browser or repository.
- Keep Firestore Rules deny-by-default for every collection and allow only the narrow Spark mutations documented in the Rules.
- Keep page sizes capped; do not raise limits to hide query design problems.
- Do not store ticket descriptions, email addresses, or personal data in telemetry.
- Treat the Firebase Console quota/billing views as the source of truth.
- Do not call SLA state contractual until a trusted worker and notification path exist.

## Upgrade trigger

Revisit Blaze only when at least one of these becomes necessary:

1. Contractual SLA timers, escalations, or notifications.
2. Trusted/tamper-resistant audit evidence.
3. Scheduled exports, PITR, retention automation, or production restore objectives.
4. A backend API for server-side search, provisioning, rate limiting, or integrations.

Until then, the Spark-only path is the intentional operating model, not an incomplete deployment.
