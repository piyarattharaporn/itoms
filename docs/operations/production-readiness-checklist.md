# Production readiness checklist

## Current Phase 7 gate

- [x] Emulator-only development path remains available
- [x] Firestore Rules deny by default
- [x] Assignment is Property- and Role-scoped
- [x] Ticket schema has backward-compatible version handling
- [x] Ticket/User Directory/Audit page sizes are bounded
- [x] Audit records have a domain-event reference
- [x] Telemetry redacts non-allowlisted properties
- [x] Build passes
- [x] Rules tests pass
- [x] Snapshot restore build passes
- [x] Trusted Backend owns Ticket mutation and Audit Event writes in Emulator mode
- [x] Backend-owned SLA policy/deadline/pause state MVP is covered by integration tests
- [x] Process-local mutation rate limiting returns bounded `429` responses in Emulator mode
- [x] Production configuration preflight fails closed for emulator, placeholder, missing App Check, and non-HTTPS backend values
- [x] Trusted server rejects wildcard CORS and invalid runtime configuration
- [x] Disaster recovery and monitoring runbooks are documented
- [x] Production Firebase project and Web app provisioned; see `docs/operations/production-project-record.md`
- [x] Spark-only client mutation path and Rules tests pass
- [ ] App Check site key and enforcement tested with a production-configured client
- [x] Trusted Backend is explicitly disabled for Spark-only Production
- [ ] Spark quota and abuse review completed
- [ ] Manual snapshot/restore procedure and RTO/RPO limitation accepted
- [ ] Firebase Console usage/error monitoring reviewed
- [ ] Data retention/deletion policy approved
- [ ] Load/performance test with representative data completed
- [ ] Role/access review completed

## Go-live blockers

Do not describe the system as contractual SLA or tamper-proof audit in Spark-only mode. The client mutation path is Rules-protected but client-originated; the repository checks do not constitute a production deployment or a managed backup/restore guarantee.

## Required evidence before go-live

1. Rules test report and cross-Property negative tests.
2. Production App Check verification.
3. Restore drill report with measured RTO/RPO.
4. Backend command/audit idempotency tests.
5. Monitoring screenshots or exported alert test results.
6. Approved data classification and retention record.
