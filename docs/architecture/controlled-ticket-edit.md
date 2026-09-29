# Controlled Ticket Edit

## Decision

Task records can be corrected after creation through a controlled edit flow. The flow is intentionally narrower than a general-purpose update form.

## Editable fields

Support Engineers and Super Admins can edit only:

- work area (`location`)
- department
- linked Asset ID
- problem description
- priority

The form requires a reason. Status, requester identity, Property, timestamps, assignment, issue category, reporting channel, and SLA timestamps are not editable through this path.

## Status policy

- `Pending`, `In Progress`, `Monitoring`, `Waiting for Vendor`, and `Waiting for User`: operational correction is allowed.
- `Completed`: correction is allowed, but the UI identifies it as a correction and records a reason.
- `Cancelled`: correction is denied. Cancellation is the soft-delete/terminal record path; hard delete remains denied.
- Requesters, Client Executives, and users without an active Property role cannot edit.

## Audit behavior

The client mutation service writes the Ticket update, an `edited` domain event, and an `edited` `auditEvents` record in one Firestore transaction path. The event contains the changed field names, reason, actor UID, and correlation ID.

Firestore Rules validate the Ticket update and edit event independently, including role, Property, allowed fields, bounded values, status restriction, and timestamp/last-event binding. In Spark mode, Rules cannot require an unrelated audit document in the same client write without exceeding Firestore's Rules expression limit. Therefore the audit record is guaranteed by the application mutation path, not cryptographically enforced by Rules. A trusted backend remains required for tamper-resistant evidence.

The audit stores changed field names and the reason, not a complete before/after value diff. A future trusted backend can add redacted value history, approval workflow, or immutable export if operational or contractual evidence requires it.

## Verification

- Rules tests cover Support Engineer edits, Completed corrections, requester denial, Cancelled denial, injected fields, malformed events, and hard-delete denial.
- Contract tests cover the allowed field set, invalid priority, short reason, and injected fields.
- `npm run build`, `npm run test:unit`, `npm run test:rules`, `npm run test:i18n`, `npm run lint`, and `npm run format:check` are required before release.
