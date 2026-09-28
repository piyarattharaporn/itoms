# Phase 1 Rules Hardening Plan

## Implemented in this phase

- Strengthen Ticket create/update validation and apply a full update-shape check to status updates.
- Validate PM checklist item types and bounds.
- Validate CCTV daily-check dates, timestamps, and nested NVR detail shape with a rules-safe bounded list (five embedded details in the current model).
- Tighten common date, identity, email, and text constraints where they are part of an existing write contract.
- Add negative regression tests for cross-property access, role escalation, arbitrary fields, malformed PM/CCTV data, oversized Ticket data, unauthorized assignment changes, and protected deletes.
- Add opt-in Web App Check initialization that stays disabled for Emulator/local development.

## Intentionally not implemented

- Ticket Assignment UI or reassignment events.
- SLA policies, business hours, breach workers, or notifications.
- Cursor pagination or User Directory projection.
- Full Audit Log or client-trusted audit writes.
- Production Firebase configuration or deployment.

## Compatibility note

Firestore Rules cannot iterate arbitrary nested lists. CCTV daily-check NVR details are therefore bounded and structurally validated for the current embedded-list model. A future system that must support more NVRs should move details to a subcollection or a trusted backend projection rather than weakening Rules validation.
