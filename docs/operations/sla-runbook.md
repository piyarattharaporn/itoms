# SLA Operations Runbook

## Scope

This runbook describes the Spark-safe SLA behavior for the Lotus IT Portal. It applies to four Properties and the current six-person support team.

## Daily operation

1. Open the Dashboard and select the required Property or `All properties`.
2. Review `ติดตาม SLA` for open, due-soon, breached, and completed work.
3. Open the Ticket Board and sort the action queue by Priority and age.
4. For `Waiting for User` or `Waiting for Vendor`, record the reason in the status history and return the Ticket to `In Progress` when the dependency is cleared.
5. Use the SLA summary endpoint for a bounded operational report:

```text
GET /v1/sla-summary?propertyId={propertyId}&limit=500
```

The endpoint is available only through the trusted emulator/backend boundary and permits Super Admin access across Properties. Support Engineers and Client Executives must provide a Property scope.

## Policy changes

- Only Super Admin can change a Property SLA policy.
- A saved policy creates a new version and affects only Tickets created afterward.
- A policy must define all four priorities, use the `24x7` calendar, and contain positive integer minute targets.
- Never edit SLA snapshot fields on an existing Ticket to repair a policy change. Correct the policy and create a new version instead.

## Breach interpretation

- Response breach means the first valid response happened after the response deadline, or the Ticket has not yet received a response and its deadline has passed.
- Resolution breach means the Ticket was completed after the resolution deadline, or an open Ticket is currently past that deadline.
- Cancelled Tickets are excluded from SLA compliance totals.
- Waiting states pause only Resolution SLA. Response deadline and response outcome remain unchanged.

## Spark limitation and manual escalation

The Spark-only production client has no trusted scheduler. The browser calculates live due states from the stored deadline, while trusted breach fields are persisted on the next backend mutation. This means the system must not be marketed as continuous contractual SLA enforcement.

Until a separately approved worker/backend is available, the Support Lead should review the Dashboard at least at the start and end of each operating shift. Critical breaches should be escalated manually through the approved company channel; no notification service is configured by this project.

## Evidence and review

Before releasing a policy change or SLA-related code:

- Run `npm run test:quality`.
- Run `npm run test:server` and `npm run test:rules` against emulators.
- Run `npm run test:e2e` and `npm run test:e2e:emulator`.
- Confirm the policy version and effective time in the Property document.
- Confirm a new Ticket snapshots the policy and an existing Ticket retains its previous snapshot.

## Future trusted enforcement

Business-hour calendars, holiday exceptions, scheduled breach evaluation, notification delivery, escalation retries, and monthly contractual compliance reports require an approved trusted worker/backend. They remain intentionally outside the Firebase Spark deployment.
