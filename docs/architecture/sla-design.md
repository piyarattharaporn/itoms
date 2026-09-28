# SLA Design

## Scope

The Lotus IT Portal uses a Property-aware, priority-based SLA model for four Properties and a six-person support team. SLA is measured as two independent clocks:

- First Response: the first valid transition out of `Pending`.
- Resolution: the time until the Ticket is completed.

The current calendar is `24x7`. All persisted timestamps are UTC and are displayed in `Asia/Bangkok`.

## Default policy

| Priority | First Response | Resolution |
| -------- | -------------: | ---------: |
| Critical |     30 minutes |    4 hours |
| High     |         1 hour |    8 hours |
| Medium   |        4 hours |   24 hours |
| Low      |        8 hours |   48 hours |

Each Ticket stores a snapshot of the selected policy. Changing a Property policy therefore does not rewrite historical Tickets.

## Property override

The backend accepts an optional policy configuration on the Property document. The configuration is read only while creating a Ticket; it is copied into the Ticket SLA snapshot and is never re-read for that Ticket.

```json
{
  "slaPolicy": {
    "id": "property-standard",
    "version": 2,
    "calendar": "24x7",
    "targets": {
      "Critical": { "responseMinutes": 15, "resolutionMinutes": 120 },
      "High": { "responseMinutes": 30, "resolutionMinutes": 480 },
      "Medium": { "responseMinutes": 240, "resolutionMinutes": 1440 },
      "Low": { "responseMinutes": 480, "resolutionMinutes": 2880 }
    }
  }
}
```

Invalid or incomplete overrides fall back to the default policy. Policy values must be positive integer minutes and cannot exceed one year. The Property administration UI and Rules validation for this configuration are Phase 2 work.

## Ticket snapshot fields

New backend-created Tickets store:

- `slaPolicyId`, `slaPolicyVersion`
- `slaResponseTargetMinutes`, `slaResolutionTargetMinutes`
- `slaStartedAt`, `slaResponseDueAt`, `slaResolutionDueAt`
- `slaResponseMetAt`, `slaResolutionMetAt`
- `slaResponseStatus`: `pending`, `met`, `breached`, or `cancelled`
- `slaResolutionStatus`: `running`, `paused`, `met`, `breached`, or `cancelled`
- `slaPausedAt`, `slaPauseReason`, `slaPausedMinutes`
- `slaResponseBreached`, `slaResolutionBreached`, `slaLastEvaluatedAt`

Legacy Tickets remain readable. If they do not contain SLA fields, the client derives a safe display fallback from priority and `createdAt`; the first trusted backend mutation upgrades the SLA fields.

## Pause and state rules

`Waiting for User` and `Waiting for Vendor` pause only the Resolution clock. The Response clock is complete once the Ticket leaves `Pending` and its due timestamp never moves during a pause.

```text
Pending -> In Progress -> Monitoring -> Completed
                      \-> Waiting for User   -> In Progress
                      \-> Waiting for Vendor -> In Progress
Any active state -> Cancelled
```

Response and Resolution outcomes are stored independently because a Ticket can have a late response and an on-time resolution, or can be resolved after both targets were breached.

## Spark limitation

The Spark-only client path remains intentionally non-contractual: Firestore Rules protect the mutation shape, but there is no trusted scheduler. The UI can calculate a live due state, while trusted breach fields are evaluated on the next backend mutation. Automatic escalation, notification, and continuous breach evaluation require a separately approved worker/backend phase.

## Delivery phases

### Phase 1 — SLA correctness foundation

- Property override input and immutable Ticket snapshot.
- Independent Response and Resolution statuses.
- Resolution-only pause/resume behavior.
- Legacy Ticket fallback and focused integration tests.

### Phase 2 — Operations and reporting

- Super Admin policy management UI with versioning and validation.
- Property policy read/write Rules boundary.
- Due-soon and breach dashboards by Property, priority, and engineer.
- SLA summary API/report and justified Firestore indexes.

### Phase 3 — Trusted enforcement

- Business-hours and holiday calendars.
- Scheduled breach evaluation and escalation.
- Notification delivery, retry/idempotency, monitoring, and monthly compliance reports.
