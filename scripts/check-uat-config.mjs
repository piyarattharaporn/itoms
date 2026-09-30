import fs from 'node:fs'
import path from 'node:path'

const uatEnvPath = path.resolve('.env.uat')
if (fs.existsSync(uatEnvPath)) {
  const envText = fs.readFileSync(uatEnvPath, 'utf8')
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
]
const errors = []
const value = (name) => process.env[name]?.trim() ?? ''
const isPlaceholder = (input) => !input || input.startsWith('replace-with-') || input.includes('example.com')

for (const name of required) {
  if (isPlaceholder(value(name))) errors.push(`${name} must contain a non-placeholder UAT value`)
}
if (value('VITE_APP_ENV') !== 'uat') errors.push('VITE_APP_ENV must be uat')
if (value('VITE_FIREBASE_PROJECT_ID') !== 'itoms-uat') errors.push('VITE_FIREBASE_PROJECT_ID must be itoms-uat')
if (value('VITE_USE_FIREBASE_EMULATORS').toLowerCase() === 'true') errors.push('UAT must not use Firebase emulators')

if (errors.length > 0) {
  console.error('UAT configuration preflight failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('UAT configuration preflight passed.')
}
