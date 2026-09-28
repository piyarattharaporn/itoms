# Lotus IT Portal

## Project conventions

- This repository is the local MVP for Lotus IT Portal, an IT Outsource Management system.
- Use Vite, React, TypeScript, and Tailwind CSS. Keep UI components and Firebase access separated as features are added.
- Keep credentials and secrets out of source control. Use local environment files based on `.env.example`; never commit `.env.local` or service account keys.
- Do not connect to a real Firebase project, create a project, or deploy without an explicit task to do so.
- During development and tests, use Firebase Emulator Suite for Authentication and Firestore. Keep emulator mode opt-in through local environment configuration and do not point development at production data.
- Firestore Security Rules must default to deny. Never use Firestore Test Mode or permissive rules with real data. Ticket, Asset, and PM access have narrow property- and role-aware rules. CCTV daily checks are property-scoped: Support Engineers and Super Admins manage them, while Client Executives have read-only access. Infrastructure Incidents are readable by assigned Client Executives, Support Engineers, and Super Admins; only Support Engineers and Super Admins can manage them. Keep other infrastructure collections denied until their own access model is added.
- Ticket identifiers must use Firestore-generated document IDs or a collision-resistant ID with a random component. Never allocate sequential IDs on a client.
- Do not add Firebase Cloud Storage, Cloud Functions, or external notification services in this phase.
- Firebase Hosting may serve the static Vite build on Spark. Do not assume backend-only features or paid-plan capabilities are available.

## Firebase Spark constraints

- Treat Spark as a no-cost plan with service-specific quotas and eligibility limits; verify current Firebase pricing and feature availability before relying on a capability.
- The client Firebase configuration is public configuration, not a secret. Security depends on Authentication and restrictive Firestore Rules; never put private credentials in browser code.
- Firestore allows self profile/membership reads and property-scoped Ticket/Asset/PM access. Only Super Admin or an assigned Support Engineer can manage Assets and PM. It does not allow client writes to user roles, memberships, or properties.
- Use local emulators for development and automated testing. Do not use Test Mode for real data.
- File uploads, server-side privileged operations, scheduled/background processing, and external notifications are out of scope until a suitable backend and budget are approved.
