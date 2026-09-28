# Security Boundaries

## Rules principles

1. Deny by default.
2. Authenticate first, then resolve active profile and property membership.
3. Check authorization from existing trusted documents, not from mutable request fields.
4. Validate the complete document shape on create and update.
5. Keep immutable fields immutable.
6. Use affected-key allowlists for updates.
7. Bind related event documents to the parent document with `getAfter()`.
8. Never use App Check as a replacement for Authentication or Rules.

## Write trust model

The browser is an untrusted writer. Client-side validation improves user experience only; Firestore Rules are the enforcement boundary. App Check is an additional abuse filter and does not decide which property or role a user may access.

## Current write categories

- Client writes allowed: scoped operational records such as Tickets, Assets, PM, CCTV checks, incidents, licenses, catalog settings, and operational todos, subject to role and property checks.
- Client writes denied: user profiles, memberships, properties, and all unmodeled collections.
- Append-only domain events: Ticket and infrastructure incident events.
- Trusted backend required later: full audit events, SLA breach processing, notifications, and privileged directory projections.

## Phase 1 test obligations

- Cross-property reads and writes must fail.
- Role escalation and self-membership changes must fail.
- Unknown fields must fail.
- Wrong types, oversized strings, invalid dates, invalid enum values, and malformed nested list items must fail.
- Parent/event mismatches and status-transition mismatches must fail.
- Deletion of protected operational records and immutable event records must fail.
