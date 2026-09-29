# Phase Fix 4 — Security and Data Contract Hardening

Date: 2026-09-29

## Objective

Reduce avoidable Firestore Rules evaluation cost and make the Spark-only read
contract explicit, without opening permissions, connecting a new backend, or
changing existing production data.

## Implemented

- Ticket event validation now dispatches by event type after a bounded shape
  check. Created, status, and assignment events do not evaluate unrelated
  branches, and status/assignment event shapes reject fields from another
  event type.
- Ticket creation combines property identity and role checks in one bounded
  access validator, avoiding repeated generic membership evaluation.
- Audit validation reuses the post-write Ticket and event snapshots through
  local bindings and a dedicated link validator. The previous repeated
  `getAfter()` chain is no longer duplicated for every comparison.
- CCTV embedded NVR detail validation removes a duplicated list check and
  rejects over-limit lists before the remaining scalar checks.
- Query/index requirements are documented and verified against
  `firestore.indexes.json` by an executable contract test.
- Rules regression coverage includes injected fields on a status event in
  addition to the existing Ticket, Assignment, Audit, RCA, Asset, PM, CCTV,
  and Incident cases.

## Security decision

No allow rule was widened. Ticket, Assignment, Audit, CCTV, Property, and
cross-Property boundaries remain deny-by-default. Client Audit remains
append-only but is not tamper-proof; trusted audit ingress is still a backend
requirement.

## Known limitation

The Rules emulator still reports expression-budget warnings on deliberately
malformed CCTV payload paths while all assertions deny as expected. The
support-side embedded NVR list is intentionally bounded and fully validated;
the Super Admin path uses a compact top-level guard to support larger NVR
inventory without making the Rules evaluator unsafe. A future backend or a
subcollection-per-NVR design is required for unbounded detail and trusted
validation. This phase does not weaken the current boundary to remove the
warning.

## Deferred to Backend Phase

- Global search and exact historical aggregates.
- Trusted SLA worker, notification, and audit sealing.
- Server-side export, retention, and backup orchestration.
- Full CCTV/NVR detail validation beyond the bounded Spark document shape.
