# ITOMS UAT Sandbox

UAT is a separate Firebase project for onboarding, acceptance testing, and feature trials. It does not share Firestore data with Production.

- Project: `itoms-uat`
- Hosting: <https://itoms-uat.web.app>
- Firestore: Standard, `asia-southeast3`
- UAT build marker: `UAT / SANDBOX` with black/yellow hazard navbar

## Sampling data

Run these commands from the repository root after Firebase CLI login:

```bash
npm run uat:reset-and-seed
```

The reset is scoped to synthetic records whose IDs begin with `uat-sample-`; it does not delete the UAT directory or real UAT records.

Other available commands:

```bash
npm run uat:seed
npm run uat:reset
```

## User access

Production Auth password hashes are never exported into UAT. To copy a user's role and Property access safely:

1. Enable Google Sign-In in UAT (already configured) and have the user sign in at least once at <https://itoms-uat.web.app>.
2. Run `npm run uat:copy-directory`.
3. The script matches by email, writes the UAT UID into `users` and `memberships`, and copies only the matching Property records.

This preserves the Production security model while avoiding credential migration. If no matching UAT Auth account exists, the script makes no directory change and reports that the user must sign in first.

## Release flow

```text
Local / Emulator → UAT Sandbox → UAT acceptance → Production
```

Deploy UAT with:

```bash
npm run deploy:uat
```

The deploy runs Firestore Rules tests, quality checks, UAT configuration validation, and a UAT-mode production build before releasing Rules, Auth configuration, and Hosting.
