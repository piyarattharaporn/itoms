# ITOMS Production Project Record

Recorded: 2026-09-26 (Asia/Bangkok)

## Approved project

- Firebase project ID: `itoms-v2`
- Display name: `IT Outsource Managed System`
- Project number: `5992166000`
- Billing plan at setup: Spark (no-cost)
- Firestore edition: Standard
- Firestore database: `(default)`
- Firestore location: `asia-southeast3` (Bangkok)
- Firestore delete protection: enabled
- PITR/managed backup: not enabled; requires a billing decision and separate backup design

## Registered Web app

- Name: `Lotus IT Portal Production Web`
- App ID: `1:5992166000:web:24f113bcda09fac822bab5`
- Firebase Auth domain: `itoms-v2.firebaseapp.com`
- Hosting default site created with the project: `itoms-v2`

The Firebase Web SDK configuration and the reCAPTCHA Enterprise site key are public client configuration, but they are intentionally not copied into this document or committed to source control. The local `.env.production` file remains Git-ignored.

## App Check

- Provider: Fraud Defense / reCAPTCHA Enterprise
- Web app registration: Registered
- Cloud Firestore enforcement: Enforced
- Console note: enforcement may take up to 15 minutes to become fully active
- Registered domain at setup: `itoms-v2.web.app`

The production client must be built with the matching App Check site key before it is exposed to users. A valid App Check token does not replace Firebase Authentication or Firestore Rules.

## Deployment safety note

The repository's current `firebase.json` names the approved Hosting site `itoms-v2`. Before a subsequent Hosting deploy, load the approved production environment, verify the project/site target, and require the production preflight and QA gates to pass.

## Spark-only operating decision

- Keep Spark as the active billing plan. Do not deploy Cloud Run/Cloud Functions or enable scheduled backend work in this stage.
- Use the Firebase-only client mutation path documented in `docs/architecture/spark-only-production.md`.
- Treat SLA, Audit integrity, retention, and restore capabilities according to the documented Spark-only limitations.
- Revisit billing only after a specific backend, notification, backup, or contractual SLA requirement is approved.
