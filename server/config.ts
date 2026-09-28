export interface ServerConfig {
  environment: 'emulator'
  projectId: string
  port: number
  allowedOrigin: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const environment = env.ITOMS_ENV ?? 'emulator'
  if (environment !== 'emulator') throw new Error('Phase 3 backend is emulator-only. Set ITOMS_ENV=emulator.')
  if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Refusing to start: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST are required.')
  }
  const port = Number(env.ITOMS_BACKEND_PORT ?? 8787)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('ITOMS_BACKEND_PORT must be an integer between 0 and 65535.')
  const allowedOrigin = env.ITOMS_ALLOWED_ORIGIN ?? 'http://localhost:5173'
  if (allowedOrigin === '*' || !/^https?:\/\//.test(allowedOrigin)) {
    throw new Error('ITOMS_ALLOWED_ORIGIN must be a specific http(s) origin; wildcard origins are not allowed.')
  }
  return {
    environment,
    projectId: env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? 'demo-lotus-it-portal-local',
    port,
    allowedOrigin,
  }
}
