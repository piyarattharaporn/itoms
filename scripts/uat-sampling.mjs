import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const targetProject = 'itoms-uat'
const samplePrefix = 'uat-sample-'
const action = process.argv[2] ?? 'reset-and-seed'
const collections = [
  'properties',
  'tickets',
  'assets',
  'ticketAssetOptions',
  'infrastructureIncidents',
  'pmSchedules',
  'softwareLicenses',
  'operationalTodos',
  'auditEvents',
]

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

function baseUrl() {
  return `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents`
}

async function firestoreRequest(url, options = {}) {
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

function toRestValue(value) {
  if (value === null) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toRestValue) } }
  if (value && typeof value === 'object') {
    return {
      mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toRestValue(item)])) },
    }
  }
  throw new Error(`Unsupported sample field: ${typeof value}`)
}

function toRestFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toRestValue(item)]))
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

function documentId(name) {
  return name.split('/').at(-1)
}

async function listDocuments(collection) {
  const documents = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '1000' })
    if (pageToken) query.set('pageToken', pageToken)
    const body = await firestoreRequest(`${baseUrl()}/${collection}?${query}`)
    for (const document of body.documents ?? []) {
      documents.push({ id: documentId(document.name), fields: fromRestFields(document.fields) })
    }
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return documents
}

async function writeDocument(collection, id, fields) {
  await firestoreRequest(`${baseUrl()}/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toRestFields(fields) }),
  })
}

async function deleteDocument(collection, id) {
  await firestoreRequest(`${baseUrl()}/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

function sampleDate(daysOffset = 0) {
  return new Date(Date.now() + daysOffset * 86_400_000)
}

function dateOnly(daysOffset = 0) {
  return sampleDate(daysOffset).toISOString().slice(0, 10)
}

function sampleProperty() {
  return {
    code: 'UAT',
    name: 'ITOMS UAT Sample Property',
    active: true,
    cctvEnabled: true,
    slaPolicy: {
      id: 'uat-sample-policy',
      version: 1,
      calendar: '24x7',
      targets: {
        Critical: { responseMinutes: 30, resolutionMinutes: 240 },
        High: { responseMinutes: 60, resolutionMinutes: 480 },
        Medium: { responseMinutes: 240, resolutionMinutes: 1440 },
        Low: { responseMinutes: 480, resolutionMinutes: 2880 },
      },
    },
    updatedAt: sampleDate(),
  }
}

function sampleAsset(id, values) {
  return {
    propertyId: 'uat-sample-property',
    propertyCode: 'UAT',
    department: 'IT Operations',
    vendor: 'UAT Vendor',
    model: 'UAT-Model-01',
    spec: 'Sampling record for UAT only',
    detail: 'Safe synthetic data. Do not use as an operational record.',
    usedBy: '',
    serialNumber: `${id.toUpperCase()}-SERIAL`,
    warrantyExpiresOn: dateOnly(180),
    ownershipType: 'Owned',
    lessorName: '',
    leaseContractNumber: '',
    leaseStartDate: '',
    leaseEndDate: '',
    monthlyRentalCost: null,
    serviceType: '',
    serviceVendor: '',
    serviceSentOn: '',
    expectedReturnOn: '',
    serviceNotes: '',
    createdBy: 'uat-sample-admin',
    updatedAt: sampleDate(),
    ...values,
  }
}

function sampleTicket(id, values) {
  const createdAt = sampleDate(-1)
  return {
    schemaVersion: 3,
    propertyId: 'uat-sample-property',
    propertyCode: 'UAT',
    requesterUid: 'uat-sample-requester',
    requesterName: 'UAT Requester',
    requesterEmail: 'uat.requester@example.test',
    department: 'IT Operations',
    issueArea: 'Office / Corporate',
    location: 'UAT Front Office',
    assetId: '',
    problemCategory: 'Hardware',
    problemType: 'Computer PC',
    channel: 'Email',
    priority: 'Medium',
    status: 'Pending',
    description: 'ตัวอย่างงาน UAT สำหรับทดสอบการสร้าง มอบหมาย และติดตาม SLA',
    resolutionNotes: '',
    assignedEngineerUid: 'uat-sample-engineer',
    assignedAt: createdAt,
    assignedByUid: 'uat-sample-admin',
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    lastEventId: `${id}-event-created`,
    slaPolicyId: 'uat-sample-policy',
    slaPolicyVersion: '1',
    slaResponseTargetMinutes: 240,
    slaResolutionTargetMinutes: 1440,
    slaStartedAt: createdAt,
    slaResponseDueAt: sampleDate(0.1),
    slaResolutionDueAt: sampleDate(1),
    slaResponseMetAt: null,
    slaResolutionMetAt: null,
    slaResponseStatus: 'pending',
    slaResolutionStatus: 'running',
    slaState: 'running',
    slaPauseReason: '',
    slaPausedAt: null,
    slaPausedMinutes: 0,
    slaResponseBreached: false,
    slaResolutionBreached: false,
    slaLastEvaluatedAt: sampleDate(),
    ...values,
  }
}

const samples = {
  properties: { 'uat-sample-property': sampleProperty() },
  ticketAssetOptions: {
    'uat-sample-camera': {
      propertyId: 'uat-sample-property',
      propertyCode: 'UAT',
      name: 'UAT CCTV Camera',
      category: 'อุปกรณ์ CCTV',
      location: 'UAT South Wing',
      assetTag: 'UAT-CCTV-001',
      active: true,
      updatedAt: sampleDate(),
    },
  },
  assets: {
    'uat-sample-camera': sampleAsset('uat-sample-camera', {
      assetTag: 'UAT-CCTV-001',
      name: 'UAT CCTV Camera',
      category: 'อุปกรณ์ CCTV',
      location: 'UAT South Wing',
      status: 'Damaged',
      serviceType: 'Internal Repair',
      serviceNotes: 'Sampling damaged asset for UAT.',
    }),
    'uat-sample-printer': sampleAsset('uat-sample-printer', {
      assetTag: 'UAT-PRN-001',
      name: 'UAT Office Printer',
      category: 'Office Printer',
      location: 'UAT Back Office',
      status: 'In Service',
    }),
  },
  tickets: {
    'uat-sample-ticket-open': sampleTicket('uat-sample-ticket-open', {
      status: 'In Progress',
      priority: 'High',
      problemType: 'CCTV',
      assetId: 'uat-sample-camera',
      location: 'UAT South Wing',
      description: 'กล้อง UAT South Wing ไม่แสดงภาพ ใช้สำหรับทดสอบงานที่ยังไม่เสร็จ',
    }),
    'uat-sample-ticket-completed': sampleTicket('uat-sample-ticket-completed', {
      status: 'Completed',
      priority: 'Low',
      problemType: 'Office Printer',
      assetId: 'uat-sample-printer',
      completedAt: sampleDate(-0.5),
      slaResponseStatus: 'met',
      slaResolutionStatus: 'met',
      slaState: 'met',
      slaResponseMetAt: sampleDate(-0.9),
      slaResolutionMetAt: sampleDate(-0.5),
      description: 'เครื่องพิมพ์ UAT พิมพ์ช้า แก้ไขแล้วสำหรับทดสอบ Completed และ RCA',
    }),
  },
  infrastructureIncidents: {
    'uat-sample-incident-open': {
      propertyId: 'uat-sample-property',
      propertyCode: 'UAT',
      type: 'CCTV',
      title: 'UAT CCTV incident',
      location: 'UAT South Wing',
      impact: 'Medium',
      description: 'Synthetic open incident for UAT workflow testing.',
      status: 'Open',
      reportedByUid: 'uat-sample-admin',
      startedAt: sampleDate(-0.2),
      restoredAt: null,
      resolutionNotes: '',
      updatedAt: sampleDate(),
      lastEventId: 'uat-sample-incident-event',
    },
  },
  pmSchedules: {
    'uat-sample-pm': {
      propertyId: 'uat-sample-property',
      propertyCode: 'UAT',
      title: 'UAT CCTV monthly inspection',
      location: 'UAT South Wing',
      frequency: 'Monthly',
      checklistItems: ['ตรวจภาพกล้อง', 'ตรวจสายสัญญาณ', 'บันทึกผลการตรวจ'],
      nextDueOn: dateOnly(7),
      active: true,
      createdBy: 'uat-sample-admin',
      lastRunOn: '',
      lastRunId: '',
    },
  },
  softwareLicenses: {
    'uat-sample-license': {
      propertyId: 'uat-sample-property',
      propertyCode: 'UAT',
      productName: 'UAT Microsoft 365',
      vendor: 'UAT Vendor',
      licenseType: 'Subscription',
      expiresOn: dateOnly(30),
      quantity: 10,
      renewalOwner: 'UAT Support',
      status: 'Active',
      notes: 'Synthetic license record for UAT.',
    },
  },
  operationalTodos: {
    'uat-sample-todo': {
      propertyId: 'uat-sample-property',
      propertyCode: 'UAT',
      title: 'ตรวจสอบผล UAT รายวัน',
      category: 'Operations',
      location: 'UAT Control Room',
      dueOn: dateOnly(1),
      priority: 'Medium',
      active: true,
      createdBy: 'uat-sample-admin',
      updatedAt: sampleDate(),
    },
  },
}

async function seed() {
  for (const [collection, documents] of Object.entries(samples)) {
    for (const [id, fields] of Object.entries(documents)) {
      await writeDocument(collection, id, fields)
      console.log(`seeded ${collection}/${id}`)
    }
  }
}

async function reset() {
  for (const collection of collections) {
    const documents = await listDocuments(collection)
    for (const document of documents.filter(({ id }) => id.startsWith(samplePrefix))) {
      await deleteDocument(collection, document.id)
      console.log(`removed ${collection}/${document.id}`)
    }
  }
}

if (!['seed', 'reset', 'reset-and-seed'].includes(action)) {
  throw new Error('Usage: node scripts/uat-sampling.mjs [seed|reset|reset-and-seed]')
}

if (action === 'reset' || action === 'reset-and-seed') await reset()
if (action === 'seed' || action === 'reset-and-seed') await seed()
console.log(`UAT sampling action completed: ${action}`)
