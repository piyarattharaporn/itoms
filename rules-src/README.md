# Firestore Rules source

The deployable `firestore.rules` file is generated from the fragments in this directory.

Run:

```bash
npm run rules:assemble
```

Fragments are ordered lexicographically. Keep shared helpers before domain validators, and keep terminal `match` blocks after the validators they use. Phase 1 keeps the existing authorization behavior unchanged; security behavior changes should be reviewed and tested separately.
