import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'

const target = process.env.PHASE_FIX_1_1_TARGET ?? 'local'
const action = process.argv[2] ?? 'scan'
const productionProjectId = 'itoms-v2'
const localProjectId = process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-lotus-it-portal-local'
const firestorePort = Number(process.env.VITE_FIRESTORE_EMULATOR_PORT) || 18080
const samplePrefix = 'PHASE-FIX-1-1-SAMPLE-'

const requiredUpdatedAtCollections = [
  'tickets',
  'rcaRecords',
  'assets',
  'ticketAssetOptions',
  'operationalTodos',
  'requestUsers',
  'softwareLicenses',
  'pmSchedules',
  'infrastructureIncidents',
  'cctvNvrInventory',
  'cctvDailyChecks',
]

const intentionallyCreatedAtOnlyCollections = ['auditEvents']
let localDatabase
const sampleDocuments = {
  tickets: [
    {
      id: `${samplePrefix}TICKET-VALID`,
      includeUpdatedAt: true,
      fields: {
        schemaVersion: 3,
        department: 'Phase Fix 1.1 QA',
        issueArea: 'Office / Corporate',
        location: 'Phase Fix 1.1 Lab',
        problemCategory: 'Hardware',
        problemType: 'Legacy compatibility check',
        channel: 'Internal QA',
        priority: 'Low',
        status: 'Completed',
        description: 'Phase Fix 1.1 valid sample with updatedAt',
        resolutionNotes: 'Removed after verification',
        createdAt: new Date('2026-09-28T00:00:00.000Z'),
        updatedAt: new Date('2026-09-29T00:00:00.000Z'),
      },
    },
    {
      id: `${samplePrefix}TICKET-LEGACY-NO-UPDATED-AT`,
      includeUpdatedAt: false,
      fields: {
        schemaVersion: 1,
        department: 'Phase Fix 1.1 QA',
        issueArea: 'Office / Corporate',
        location: 'Phase Fix 1.1 Legacy Lab',
        problemCategory: 'Helpdesk',
        problemType: 'Legacy compatibility check',
        channel: 'Internal QA',
        priority: 'Low',
        status: 'Completed',
        description: 'Phase Fix 1.1 legacy sample intentionally missing updatedAt',
        resolutionNotes: 'Removed after verification',
        createdAt: new Date('2026-09-27T00:00:00.000Z'),
      },
    },
  ],
  rcaRecords: [
    {
      id: `${samplePrefix}RCA-VALID`,
      includeUpdatedAt: true,
      fields: {
        schemaVersion: 1,
        taskTitle: 'Phase Fix 1.1 valid sample',
        taskCategory: 'Hardware',
        taskPriority: 'Low',
        incidentSummary: 'Valid RCA compatibility sample',
        rootCause: 'Test data only',
        impact: 'No production impact',
        status: 'Draft',
        createdAt: new Date('2026-09-28T00:00:00.000Z'),
        updatedAt: new Date('2026-09-29T00:00:00.000Z'),
      },
    },
    {
      id: `${samplePrefix}RCA-LEGACY-NO-UPDATED-AT`,
      includeUpdatedAt: false,
      fields: {
        schemaVersion: 1,
        taskTitle: 'Phase Fix 1.1 legacy RCA sample',
        taskCategory: 'Helpdesk',
        taskPriority: 'Low',
        incidentSummary: 'Legacy RCA compatibility sample intentionally missing updatedAt',
        rootCause: 'Test data only',
        impact: 'No production impact',
        status: 'Draft',
        createdAt: new Date('2026-09-27T00:00:00.000Z'),
      },
    },
  ],
}

function assertTarget() {
  if (!['local', 'production'].includes(target)) {
    throw new Error('PHASE_FIX_1_1_TARGET must be local or production')
  }
  if (target === 'production' && process.env.PHASE_FIX_1_1_CONFIRM !== productionProjectId) {
    throw new Error(
      `Production sampling is blocked. Set PHASE_FIX_1_1_CONFIRM=${productionProjectId} for this explicitly approved test.`,
    )
  }
}

function timestampValue(value) {
  return { timestampValue: value.toISOString() }
}

function stringValue(value) {
  return { stringValue: value }
}

function integerValue(value) {
  return { integerValue: String(value) }
}

function toRestValue(value) {
  if (value instanceof Date) return timestampValue(value)
  if (typeof value === 'string') return stringValue(value)
  if (typeof value === 'number') return Number.isInteger(value) ? integerValue(value) : { doubleValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (value === null) return { nullValue: 'NULL_VALUE' }
  throw new Error(`Unsupported sample field type: ${typeof value}`)
}

function toRestFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, toRestValue(value)]))
}

function fromRestValue(value) {
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('nullValue' in value) return null
  return undefined
}

function fromRestFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromRestValue(value)]))
}

function documentIdFromName(name) {
  return name.split('/').at(-1)
}

function firebaseCliAccessToken() {
  const tokenFromEnv = process.env.FIRESTORE_REST_BEARER_TOKEN
  if (tokenFromEnv) return tokenFromEnv

  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  if (!config.tokens?.access_token) {
    throw new Error('Firebase CLI access token is unavailable; run firebase login or set FIRESTORE_REST_BEARER_TOKEN.')
  }
  return config.tokens.access_token
}

function productionBaseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${productionProjectId}/databases/(default)/documents`
}

async function productionRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${firebaseCliAccessToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!response.ok) throw new Error(`Firestore REST ${response.status}: ${await response.text()}`)
  if (response.status === 204) return null
  return response.json()
}

function localDb() {
  if (localDatabase) return localDatabase
  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`
  initializeApp({ projectId: localProjectId })
  localDatabase = getFirestore()
  return localDatabase
}

async function listDocuments(collection) {
  if (target === 'local') {
    const snapshot = await localDb().collection(collection).get()
    return snapshot.docs.map((document) => ({ id: document.id, fields: document.data() }))
  }

  const documents = []
  let nextPageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '1000' })
    if (nextPageToken) query.set('pageToken', nextPageToken)
    const body = await productionRequest(`${productionBaseUrl()}/${collection}?${query}`)
    for (const document of body.documents ?? []) {
      documents.push({ id: documentIdFromName(document.name), fields: fromRestFields(document.fields) })
    }
    nextPageToken = body.nextPageToken ?? ''
  } while (nextPageToken)
  return documents
}

async function writeDocument(collection, id, fields) {
  if (target === 'local') {
    await localDb().doc(`${collection}/${id}`).set(fields)
    return
  }

  const url = `${productionBaseUrl()}/${collection}/${encodeURIComponent(id)}?currentDocument.exists=false`
  await productionRequest(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toRestFields(fields) }),
  })
}

async function deleteDocument(collection, id) {
  if (target === 'local') {
    await localDb().doc(`${collection}/${id}`).delete()
    return
  }
  await productionRequest(`${productionBaseUrl()}/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

async function contextFields() {
  if (target === 'local') {
    return {
      propertyId: 'LOCAL',
      propertyCode: 'LOCAL',
      requesterUid: 'phase-fix-1-1-local-requester',
      requesterName: 'Phase Fix 1.1 Local QA',
      requesterEmail: 'phase-fix-1-1-local@example.test',
    }
  }

  const tickets = await listDocuments('tickets')
  const existing = tickets.find((ticket) => ticket.fields.propertyId && ticket.fields.requesterUid)
  if (!existing) throw new Error('Cannot safely seed Production: no existing Ticket context was found.')
  return {
    propertyId: existing.fields.propertyId,
    propertyCode: existing.fields.propertyCode ?? existing.fields.propertyId,
    requesterUid: existing.fields.requesterUid,
    requesterName: existing.fields.requesterName ?? 'Phase Fix 1.1 QA',
    requesterEmail: existing.fields.requesterEmail ?? 'phase-fix-1-1@example.test',
  }
}

function withContext(fields, context) {
  return { ...context, ...fields }
}

async function seed() {
  const context = await contextFields()
  for (const [collection, documents] of Object.entries(sampleDocuments)) {
    for (const sample of documents) {
      const fields = withContext(sample.fields, context)
      await writeDocument(collection, sample.id, fields)
      console.log(
        `seeded ${target} ${collection}/${sample.id} (${sample.includeUpdatedAt ? 'valid' : 'legacy-missing-updatedAt'})`,
      )
    }
  }
}

async function scan() {
  const report = {}
  for (const collection of requiredUpdatedAtCollections) {
    const documents = await listDocuments(collection)
    const missing = documents.filter((document) => !document.fields.updatedAt)
    const samples = documents.filter((document) => document.id.startsWith(samplePrefix))
    report[collection] = {
      total: documents.length,
      missingUpdatedAt: missing.length,
      sampleDocuments: samples.length,
      sampleMissingUpdatedAt: samples.filter((document) => !document.fields.updatedAt).length,
      sampleIds: samples.map((document) => document.id),
    }
  }
  const auditDocuments = await listDocuments('auditEvents')
  report.auditEvents = {
    total: auditDocuments.length,
    missingUpdatedAt: auditDocuments.filter((document) => !document.fields.updatedAt).length,
    classification: 'createdAt-only by design; excluded from updatedAt migration scope',
  }
  console.log(
    JSON.stringify({ target, requiredUpdatedAtCollections, intentionallyCreatedAtOnlyCollections, report }, null, 2),
  )
  return report
}

async function cleanup() {
  for (const [collection, documents] of Object.entries(sampleDocuments)) {
    const existing = await listDocuments(collection)
    for (const sample of documents) {
      const document = existing.find((candidate) => candidate.id === sample.id)
      if (!document || !document.id.startsWith(samplePrefix)) continue
      await deleteDocument(collection, sample.id)
      console.log(`removed ${target} ${collection}/${sample.id}`)
    }
  }
}

async function verify() {
  await seed()
  const seededReport = await scan()
  const expected = {
    tickets: { sampleDocuments: 2, sampleMissingUpdatedAt: 1 },
    rcaRecords: { sampleDocuments: 2, sampleMissingUpdatedAt: 1 },
  }
  for (const [collection, values] of Object.entries(expected)) {
    const actual = seededReport[collection]
    if (
      actual.sampleDocuments !== values.sampleDocuments ||
      actual.sampleMissingUpdatedAt !== values.sampleMissingUpdatedAt
    ) {
      throw new Error(`Unexpected ${collection} sampling result: ${JSON.stringify(actual)}`)
    }
  }
  await cleanup()
  const cleanedReport = await scan()
  for (const collection of Object.keys(sampleDocuments)) {
    if (cleanedReport[collection].sampleDocuments !== 0) {
      throw new Error(`Sampling cleanup incomplete for ${target}/${collection}`)
    }
  }
  console.log(`Phase Fix 1.1 sampling verification passed for ${target}; all scoped sample documents were removed.`)
}

assertTarget()

if (action === 'seed') await seed()
else if (action === 'scan') await scan()
else if (action === 'cleanup') await cleanup()
else if (action === 'verify') await verify()
else throw new Error(`Unknown action: ${action}. Use seed, scan, cleanup, or verify.`)
