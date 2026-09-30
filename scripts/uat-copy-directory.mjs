import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const sourceProject = 'itoms-v2'
const targetProject = 'itoms-uat'
const tempAuthExport = path.join(os.tmpdir(), `itoms-uat-auth-${process.pid}.json`)

function firebaseCliAccessToken() {
  const tokenFromEnv = process.env.FIRESTORE_REST_BEARER_TOKEN
  if (tokenFromEnv) return tokenFromEnv
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (!config.tokens?.access_token) throw new Error('Firebase CLI token unavailable; run firebase login first.')
  return config.tokens.access_token
}

async function request(project, pathSuffix, options = {}) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${pathSuffix}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${firebaseCliAccessToken()}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    },
  )
  if (!response.ok) throw new Error(`Firestore REST ${response.status}: ${await response.text()}`)
  if (response.status === 204) return null
  return response.json()
}

function toRestValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toRestValue) } }
  return {
    mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toRestValue(item)])) },
  }
}

function fromRestValue(value) {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromRestValue)
  if ('mapValue' in value) return fromRestFields(value.mapValue.fields ?? {})
  return null
}

function fromRestFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromRestValue(value)]))
}

async function list(project, collection) {
  const result = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '1000' })
    if (pageToken) query.set('pageToken', pageToken)
    const body = await request(project, `${collection}?${query}`)
    for (const document of body.documents ?? []) {
      result.push({
        id: document.name.split('/').at(-1),
        fields: fromRestFields(document.fields),
      })
    }
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return result
}

async function write(project, collection, id, fields) {
  await request(project, `${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, toRestValue(value)])),
    }),
  })
}

function exportUatAuthUsers() {
  try {
    execFileSync(
      'npx',
      ['-y', 'firebase-tools@latest', 'auth:export', tempAuthExport, '--format=json', '--project', targetProject],
      {
        stdio: 'ignore',
      },
    )
    const payload = JSON.parse(fs.readFileSync(tempAuthExport, 'utf8'))
    return (payload.users ?? []).map((user) => ({ uid: user.localId, email: user.email?.toLowerCase() ?? '' }))
  } finally {
    fs.rmSync(tempAuthExport, { force: true })
  }
}

const [sourceUsers, sourceMemberships, sourceProperties] = await Promise.all([
  list(sourceProject, 'users'),
  list(sourceProject, 'memberships'),
  list(sourceProject, 'properties'),
])
const uatAuthUsers = exportUatAuthUsers()
const authByEmail = new Map(uatAuthUsers.filter((user) => user.email).map((user) => [user.email, user.uid]))
const userIdMap = new Map()
let copiedUsers = 0
let copiedMemberships = 0
const propertyIds = new Set()

for (const sourceUser of sourceUsers) {
  const sourceEmail = typeof sourceUser.fields.email === 'string' ? sourceUser.fields.email.toLowerCase() : ''
  const targetUid = authByEmail.get(sourceEmail)
  if (!targetUid) continue

  userIdMap.set(sourceUser.id, targetUid)
  await write(targetProject, 'users', targetUid, {
    displayName: sourceUser.fields.displayName ?? '',
    email: sourceUser.fields.email ?? '',
    globalRole: sourceUser.fields.globalRole === 'superAdmin' ? 'superAdmin' : 'member',
    active: sourceUser.fields.active !== false,
  })
  copiedUsers += 1
}

for (const membership of sourceMemberships) {
  const targetUid = userIdMap.get(membership.fields.userId)
  if (!targetUid || typeof membership.fields.propertyId !== 'string') continue
  const targetId = `${targetUid}__${membership.fields.propertyId}`
  propertyIds.add(membership.fields.propertyId)
  await write(targetProject, 'memberships', targetId, {
    ...membership.fields,
    userId: targetUid,
    displayName: membership.fields.displayName ?? '',
  })
  copiedMemberships += 1
}

for (const property of sourceProperties) {
  if (!propertyIds.has(property.id)) continue
  await write(targetProject, 'properties', property.id, property.fields)
}

console.log(`UAT directory sync completed: ${copiedUsers} users, ${copiedMemberships} memberships.`)
if (copiedUsers === 0) {
  console.log(
    'No matching UAT Auth accounts found. Each person must sign in to UAT once before running this command again.',
  )
}
