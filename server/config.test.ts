import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { loadConfig } from './config.js'

const baseEnv = {
  ITOMS_ENV: 'emulator',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099',
  GCLOUD_PROJECT: 'demo-lotus-it-portal-local',
}

describe('Phase 7 production guardrails', () => {
  it('keeps the trusted server emulator-only', () => {
    assert.throws(() => loadConfig({ ...baseEnv, ITOMS_ENV: 'production' }), /emulator-only/)
    assert.throws(() => loadConfig({ ...baseEnv, FIRESTORE_EMULATOR_HOST: '' }), /FIRESTORE_EMULATOR_HOST.*required/)
  })

  it('rejects unsafe origin and invalid port configuration', () => {
    assert.throws(() => loadConfig({ ...baseEnv, ITOMS_ALLOWED_ORIGIN: '*' }), /specific http\(s\) origin/)
    assert.throws(() => loadConfig({ ...baseEnv, ITOMS_BACKEND_PORT: '70000' }), /between 0 and 65535/)
    assert.equal(loadConfig({ ...baseEnv, ITOMS_BACKEND_PORT: '0' }).port, 0)
  })
})
