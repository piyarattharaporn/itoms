import fs from 'node:fs'
import path from 'node:path'

const productionEnvPath = path.resolve('.env.production')
if (fs.existsSync(productionEnvPath)) {
  const envText = fs.readFileSync(productionEnvPath, 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || match[2].startsWith('#')) continue
    const rawValue = match[2]
    const parsedValue = rawValue.replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[match[1]] === undefined) process.env[match[1]] = parsedValue
  }
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_APPCHECK_SITE_KEY',
]

const errors = []
const value = (name) => process.env[name]?.trim() ?? ''
const isPlaceholder = (input) => !input || input.startsWith('replace-with-') || input.includes('example.com')

for (const name of required) {
  if (isPlaceholder(value(name))) errors.push(`${name} must contain an approved non-placeholder value`)
}

if (value('VITE_USE_FIREBASE_EMULATORS').toLowerCase() === 'true') errors.push('VITE_USE_FIREBASE_EMULATORS must be false')
if (value('VITE_ENABLE_APP_CHECK').toLowerCase() !== 'true') errors.push('VITE_ENABLE_APP_CHECK must be true')
if (value('VITE_FIREBASE_PROJECT_ID').startsWith('demo-')) errors.push('VITE_FIREBASE_PROJECT_ID must not be a demo project')

if (value('VITE_ENABLE_TRUSTED_BACKEND').toLowerCase() === 'true') {
  const backendUrlValue = value('VITE_BACKEND_BASE_URL')
  if (isPlaceholder(backendUrlValue)) errors.push('VITE_BACKEND_BASE_URL is required when Trusted Backend is enabled')
  try {
    const backendUrl = new URL(backendUrlValue)
    if (backendUrl.protocol !== 'https:') errors.push('VITE_BACKEND_BASE_URL must use HTTPS')
    if (['localhost', '127.0.0.1', '::1'].includes(backendUrl.hostname)) errors.push('VITE_BACKEND_BASE_URL must not point to localhost')
  } catch {
    errors.push('VITE_BACKEND_BASE_URL must be a valid URL when Trusted Backend is enabled')
  }
}

if (errors.length > 0) {
  console.error('Production configuration preflight failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Production configuration preflight passed. This command does not deploy or connect to Firebase.')
}
