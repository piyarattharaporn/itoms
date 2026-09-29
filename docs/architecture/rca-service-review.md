# RCA & Service Review

## MVP scope

The RCA & Service Review page is a separate review workspace for completed ITOMS
Tasks. It does not modify the original Task or its event history. Support
Engineers and Super Admins can create and update RCA drafts within their
Property scope. Client Executives have read-only access; Requesters do not have
access.

Completed Tasks and RCA records use bounded cursor pagination. The current MVP
filters the pages already loaded in the browser. Full-history search, advanced
date/category aggregation, duplicate detection, and recurring-incident analysis
are reserved for a trusted backend/search phase.

## RCA record boundary

RCA records are stored in `rcaRecords` with `schemaVersion: 1` and a snapshot of
the linked Task identity, category, priority, and completion time. The linked
Task remains the source of truth for the original incident and resolution.

The MVP supports:

- incident summary and impact;
- root cause, contributing factors, and 5 Whys;
- corrective and preventive actions;
- owner, due date, downtime minutes, and RCA status.

Attachments, approval workflow, notifications, retention/export, and
tamper-proof audit evidence require a trusted backend and are intentionally not
implemented in the Spark-only client phase.

## Security boundary

Firestore Rules enforce the Property boundary, allowed fields, bounded text and
number values, immutable Task/property/creator identity, append-only deletion
denial, and read-only Client Executive access. Client-created RCA content is
operational data, not contractual evidence, until a trusted writer and an
approval/verification workflow are introduced.
