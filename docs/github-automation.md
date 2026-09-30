# GitHub Automation

The recommended release path for ITOMS is:

```text
Local commit → Pull Request → CI checks → UAT branch → UAT deploy → approval → Production deploy
```

## First-time repository setup

Create a private GitHub repository without adding a README, license, or `.gitignore`, then run:

```bash
git remote add origin https://github.com/<owner>/<repository>.git
git push -u origin main
git switch -c uat
git push -u origin uat
```

The repository contains three workflows:

- `CI`: runs Unit, contract, query-index, lint, format, and build checks for `main`, `uat`, and Pull Requests.
- `Deploy UAT`: runs on pushes to `uat` and deploys `itoms-uat`.
- `Deploy Production`: is manual by default to prevent the first GitHub push from changing Production unexpectedly.

## GitHub Environment configuration

Create two GitHub Environments: `uat` and `production`.

For `uat`, add these Environment variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_APP_ID`

For `production`, add the same variables plus:

- `VITE_FIREBASE_APPCHECK_SITE_KEY`

For both environments, add the Firebase deploy credential as the secret:

- `FIREBASE_SERVICE_ACCOUNT`

The secret must be a dedicated deploy service-account JSON with only the Firebase permissions needed for the target project. Never commit that JSON or any `.env` file containing it.

Configure required reviewers for the `production` Environment before enabling automatic Production triggers. UAT can deploy automatically because it is isolated from the live project. GitHub Environments support approval gates, branch restrictions, secrets, and deployment history.

## Sampling data safety

`Reset UAT Data` remains a local/manual command:

```bash
npm run uat:reset-and-seed
```

It is intentionally not part of the Deploy workflow, so a normal UAT deploy cannot delete existing UAT test data.
