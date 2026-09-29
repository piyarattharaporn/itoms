# Lotus IT Portal

Local MVP for IT Outsource Management built with Vite, React, TypeScript, Tailwind CSS, and Firebase client SDK. It serves as a static single-page app on Firebase Hosting and uses Firebase Authentication and Cloud Firestore. Hosting is deployed to the approved `itoms-v2` project; this repository does not contain production credentials, a production environment file, or a deployed trusted backend.

## Requirements

- Node.js 20 or newer
- npm
- Java runtime for Firebase Emulator Suite

## Local development

```sh
npm install
cp .env.example .env.local
npm run emulators
```

In another terminal, run `npm run dev`. Local configuration uses the `demo-lotus-it-portal-local` project ID and Firebase Auth/Firestore Emulators. Keep `VITE_USE_FIREBASE_EMULATORS=true`; app code only connects to emulators in Vite development mode. Emulator ports: Auth `9099`, Firestore `8080`, Emulator UI `4000`.

The default Production direction is Firebase + Spark only. Ticket creation, assignment, status changes, and operational audit events use a bounded Firestore client path protected by Rules. The optional Phase 3–6 Trusted Backend remains emulator-only and can be enabled locally with `VITE_ENABLE_TRUSTED_BACKEND=true` for boundary testing; it is not required for the Spark-only workflow. The HTTP contract is documented in `docs/api/openapi.yaml`.

Ticket operational corrections use the Controlled Edit flow documented in [`docs/architecture/controlled-ticket-edit.md`](docs/architecture/controlled-ticket-edit.md). Only Support Engineers and Super Admins can edit bounded operational fields; completed records require a reason, cancelled records cannot be edited, and hard delete remains denied.

Phase 7 adds production configuration guardrails and go-live runbooks. The Firebase project and App Check enforcement are configured in Console, and the static application is deployed to `https://itoms-v2.web.app`. Before every approved production build, run `npm run check:production-config` after loading `.env.production`; the command validates configuration locally and never deploys. See [`docs/architecture/spark-only-production.md`](docs/architecture/spark-only-production.md).

To persist local emulator data between sessions, run `npm run emulators:import`. Emulator data, `.env.local`, and production env files are ignored by Git. Never import production data into the local emulator.

Run Firestore Rules tests locally with:

```sh
npm run test:rules
```

For the controlled Phase Fix 1.1 legacy-schema check, use the dedicated
sampling script. It reports documents missing `updatedAt`, creates only
`PHASE-FIX-1-1-SAMPLE-` records, verifies the expected gap, and removes those
records after the check. Production mode requires an explicit project
confirmation; never use it as a general data migration command. See
[`docs/architecture/phase-fix-1-1.md`](docs/architecture/phase-fix-1-1.md).

## Quality checks

The repository includes the following repeatable QA commands:

```sh
npm run test:unit       # Vitest + React Testing Library
npm run test:e2e        # Playwright browser smoke, accessibility, and responsive snapshots
npm run test:a11y       # Playwright + axe WCAG A/AA scan
npm run test:responsive # Responsive layout and screenshot regression at mobile/tablet/desktop widths
npm run test:e2e:phase4 # Emulator E2E, visual regression, accessibility, and local performance budget
npm run test:e2e:visual # Authenticated visual baselines for Dashboard, Task, Calendar, and Settings
npm run test:performance # Authenticated dashboard timing and viewport budget on the Emulator
npm run lint            # ESLint
npm run format:check    # Prettier checks for QA/config files
npm run test:contract   # OpenAPI document and trusted-server route contract
npm run test:load       # Local static preview load test; never targets Production Firebase by default
```

`npm run test:quality` runs the unit, OpenAPI, lint, and formatting gates used by the Hosting predeploy hook. Playwright tests use placeholder Firebase configuration and do not connect to a real Firebase project.

## Production Firebase setup

The approved project record is documented in [`docs/operations/production-project-record.md`](docs/operations/production-project-record.md). The project and Web app were created in Firebase Console, Firestore was provisioned in `asia-southeast3`, Cloud Firestore App Check enforcement was enabled, and Hosting is deployed to `itoms-v2`.

1. Use the approved project record and copy the registered Web app configuration to `.env.production` (copy `.env.production.example` first). The web API key and app ID are public client configuration, not private credentials; never put service account keys or other secrets in the Vite app. `.env.production` is Git-ignored.
2. The **Cloud Firestore Standard edition** database is provisioned in the approved region with delete protection and deny-by-default Rules. Do not load production records until the backend, Auth providers, indexes, backup plan, and restore owner are approved.
3. In Authentication, enable Email/Password and Google providers. Add the eventual Firebase Hosting domain and any approved custom domain to Authorized Domains. Google sign-in requires the provider and allowed domains to be configured in the Firebase Console. Phone sign-in is not part of this MVP.
4. Bootstrap the initial Super Admin and access records through an authorized Firebase Console/admin process. Client writes to `users`, `memberships`, and `properties` are denied by Rules. Provision a `users/{uid}` profile with `globalRole: "superAdmin"` and `active: true`, and active Property documents with their matching Membership records. Include the user's current `displayName` snapshot on each active `memberships` document so scoped assignment pickers can show names without exposing other user profiles. Never grant a role from client code.
5. Copy `.firebaserc.example` to `.firebaserc` and replace its placeholder with the approved project ID, or always pass `--project` explicitly. Do not commit production config files containing project-specific deployment state.
6. Build using `.env.production`, then deploy only after reviewing the target project and access records. The current `firebase.json` targets the approved Hosting site `itoms-v2`:

   ```sh
   cp .env.production.example .env.production
   # Edit .env.production with the approved Firebase Web App config.
   firebase deploy --project <approved-project-id> --only firestore:rules,firestore:indexes,hosting
   ```

   Firebase CLI runs the Firestore Rules Emulator tests and production build through the configured predeploy hooks. A failed hook stops deployment. This command does not deploy Auth provider settings; configure those in Firebase Console as described above.

   Before this deployment step, complete `npm run check:production-config`, the App Check verification, and the Spark quota/role review in `docs/operations/production-readiness-checklist.md`. This repository intentionally cannot complete Console-side provider, quota, retention, or access approvals automatically.

## Security and scope

- Firestore Rules default to deny. Ticket, Asset, PM, User Directory, and Property access is limited by active profile, Property membership, and role. Infrastructure collections remain denied.
- User roles, memberships, and Properties cannot be written from the client. Initial provisioning and role changes require trusted administrative access.
- Ticket IDs use Firestore-generated document IDs; there are no client-side sequential counters.
- No Cloud Storage, Cloud Functions, scheduled jobs, or external notification service is deployed yet.
- Google sign-in can create an Authentication identity before a profile exists; users without an active Firestore profile cannot enter the app or read protected data. There is no backend sign-up blocking or user provisioning workflow in this Spark MVP.
- User Directory uses cursor pagination and reads memberships only for the currently loaded profile page. It does not enumerate Authentication users or show last sign-in time.
- Ticket SLA uses a client-side 24x7 indicator in Spark-only mode. It is not contractual: there is no trusted breach worker, escalation, notification, business-hours calendar, or server-owned clock. Tickets created through the optional Emulator Trusted Backend can still carry the existing backend-owned SLA fields.
- Production configuration now fails closed when App Check is enabled without a real site key or when the project is an emulator/demo project. If the optional Trusted Backend is enabled, its URL must also be HTTPS. These are build-time guardrails, not proof that Firebase Console enforcement or monitoring has been configured.
- Audit Log covers Ticket create/status/assignment events, includes a source event reference and client correlation ID in Spark-only mode, and is append-only to normal client identities. It is not cryptographically tamper-proof and has no automatic retention/export/verification worker.
- Usage telemetry is opt-in, content-free, and sanitized. Firebase/Google Cloud Console remains the source of truth for quotas, errors, and billing until a central monitoring pipeline is approved.
- File uploads, trusted server operations, scheduled reminders, automated user provisioning, and managed backups are deferred because the target remains Spark-only.

## Current Spark no-cost limits

According to Firebase's current pricing page (checked 2026-09-24), Firebase Hosting includes 10 GB storage and 360 MB/day data transfer. Firestore Standard includes 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month network egress. Quotas are project-level and can change; review [Firebase pricing](https://firebase.google.com/pricing) before launch. Exceeding no-cost limits may require upgrading or restrict service, so watch usage as properties and users are added.

## Build and local preview

```sh
npm run build
npm run preview
```

Firebase Hosting serves the static `dist` output and rewrites app routes to `index.html`. Its predeploy hook runs the QA gates, production configuration check, and build; Firestore Rules' predeploy hook runs the local Rules tests. The approved Hosting site is `itoms-v2`.
