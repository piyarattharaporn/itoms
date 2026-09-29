# Phase 0–6 — Spark Reporting and Service Review

Date: 2026-09-30

## Decision

ITOMS continues on Firebase Spark as a bounded/manual operational reporting
system. The system is intended to help the IT Outsource team, Outsource
management, and the customer's Owner/Property Management review work volume,
service quality, and evidence for contract decisions. It is not a replacement
for a trusted SLA worker, a financial system, or an unlimited data warehouse.

This phase extends the existing system; it does not introduce a new backend,
Cloud Functions, Storage, scheduled notifications, or a new Firestore
collection.

## Phase outcomes

| Phase                     | Outcome                                                                   | Status on Spark                                     |
| ------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| 0. Role and KPI contract  | Role map, metric definitions, scope and limitations                       | Implemented as the contract below                   |
| 1. Role-based workspace   | Performance report entry point for IT and authorized Property users       | Implemented                                         |
| 2. KPI data contract      | Uses existing Ticket/RCA fields with legacy-safe parsing                  | Implemented; no migration required                  |
| 3. Team performance       | Assignee displayName, workload, completion, SLA advisory, unassigned work | Implemented as bounded report                       |
| 4. Customer/Property view | Property, category, location and workload breakdown                       | Implemented as bounded report                       |
| 5. Quality and feedback   | RCA/resolution quality signals and explicit missing-data roadmap          | MVP implemented; feedback workflow remains deferred |
| 6. Monthly service review | Period selector and manual CSV export of currently loaded rows            | Implemented as bounded/manual export                |

## Current role mapping

The current authorization model has three Property roles and one global role.
The requested personas map as follows until a separate role model is approved:

| Persona                              | Current access mapping | Reporting use                                               |
| ------------------------------------ | ---------------------- | ----------------------------------------------------------- |
| IT Outsource Engineer                | `supportEngineer`      | Team workload, open work, SLA advisory, quality evidence    |
| Outsource management                 | `superAdmin`           | All-Property operational report and export                  |
| Customer Owner / Property Management | `clientExecutive`      | Read-only Property-scoped performance and quality view      |
| Requester                            | `requester`            | No management report access; can follow own service request |

The application does not pretend that `superAdmin` is a perfect replacement
for an Outsource Manager or that `clientExecutive` is a perfect replacement
for Owner and Property Manager. Splitting those personas into separate roles
requires a Rules review, seed migration, and a separate approval.

## KPI contract

- **Tasks in period**: Tickets with a valid `createdAt` inside the selected
  period and present in the loaded pages.
- **Completed/Open/Cancelled**: Current Ticket status in the same bounded set.
- **Unassigned**: Empty `assignedEngineerUid`.
- **SLA met/breached**: Existing client-side SLA calculation for loaded Tickets.
  This is advisory and not contractual enforcement.
- **Average resolution**: Approximation from `createdAt` to `updatedAt` for
  completed Tickets. It is not a trusted resolution timestamp.
- **Quality signal**: Resolution notes and RCA records currently visible in
  the bounded RCA page. Customer rating, reopen count, and first-time-fix are
  not claimed until their workflow and data model are approved.

## Read and cost boundary

- Ticket report pages load a maximum of 50 rows per request.
- `Load more` is explicit; no screen reads an unlimited collection to create a
  dashboard number.
- Search, filter, summary counts, and exports describe loaded rows only.
- CSV export is a manual operational extract of the current loaded view, not a
  backup, retention policy, or complete historical export.
- Firebase Console/Google Cloud usage remains the source of truth for reads,
  writes, storage, errors, and billing/quota status.

## Acceptance checks

1. A Support Engineer can see the report only within the selected Property.
2. A Client Executive can see a read-only Property report.
3. A Super Admin can select all Properties and export the loaded report.
4. Assignees display `displayName` where available; UID remains a secondary
   technical reference.
5. Empty, legacy, and unassigned data do not break the report.
6. The report never describes client-side SLA as a contractual commitment.
7. No new write permission or production backend is required.

## Next boundary

If management needs complete month-over-month figures, contractual SLA,
notifications, immutable audit evidence, customer feedback, or automatic
retention, move the aggregation and trusted writes behind the approved Phase 7
backend boundary. Do not increase client page size to solve that requirement.
