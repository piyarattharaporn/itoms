import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { initializeApp as initializeAdminApp } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken, type Auth as ClientAuth } from 'firebase/auth'
import { createAdminServices } from './firebase.js'
import { createHttpServer } from './http.js'
import { loadConfig, type ServerConfig } from './config.js'

const projectId = 'demo-lotus-it-portal-local'
let config: ServerConfig
let baseUrl = ''
let token = ''
let clientAuth: ClientAuth
let clientApp: ReturnType<typeof initializeClientApp>
const adminApp = initializeAdminApp({ projectId }, `test-seed-${Date.now()}`)
const adminAuth = getAdminAuth(adminApp)
const adminDb = getFirestore(adminApp)
const services = createAdminServices({ environment: 'emulator', projectId, port: 0, allowedOrigin: 'http://localhost:5173' })
let server: ReturnType<typeof createHttpServer>

before(async () => {
  config = loadConfig({ ...process.env, ITOMS_ENV: 'emulator', ITOMS_BACKEND_PORT: '0', GCLOUD_PROJECT: projectId })
  await Promise.all([
    adminDb.doc('users/support-1').set({ globalRole: 'member', active: true }),
    adminDb.doc('memberships/support-1__PROP-1').set({ userId: 'support-1', propertyId: 'PROP-1', role: 'supportEngineer', active: true }),
    adminDb.doc('properties/PROP-1').set({ code: 'P1', active: true }),
    adminDb.doc('tickets/server-ticket').set({
      propertyId: 'PROP-1', propertyCode: 'P1', status: 'Pending', assignedEngineerUid: '',
      requesterUid: 'requester-1', requesterName: 'Requester', requesterEmail: 'requester@example.test',
      department: 'IT', issueArea: 'Other', location: 'Office', assetId: '', problemCategory: 'Network',
      problemType: 'WiFi Connections', channel: 'Line', priority: 'Medium', description: 'Network access is unavailable',
      resolutionNotes: '', createdAt: new Date(), updatedAt: new Date(), lastEventId: 'seed-event',
    }),
  ])
  server = createHttpServer(config, services)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not expose a port')
  baseUrl = `http://127.0.0.1:${address.port}`

  clientApp = initializeClientApp({ apiKey: 'demo-api-key', authDomain: 'localhost', projectId, appId: 'demo-app-id' }, `client-${Date.now()}`)
  clientAuth = getAuth(clientApp)
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:19099', { disableWarnings: true })
  const credential = await signInWithCustomToken(clientAuth, await adminAuth.createCustomToken('support-1'))
  token = await credential.user.getIdToken()
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await deleteClientApp(clientApp)
})

describe('Phase 3–6 trusted boundary', () => {
  it('refuses unauthenticated mutations and exposes emulator-only health', async () => {
    const health = await fetch(`${baseUrl}/health`)
    assert.equal(health.status, 200)
    assert.deepEqual((await health.json()).productionEnabled, false)
    const response = await fetch(`${baseUrl}/v1/tickets/server-ticket/assign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ engineerUid: 'support-1', idempotencyKey: 'phase3-unauth' }) })
    assert.equal(response.status, 401)
  })

  it('performs an idempotent assignment and status command with linked audit events', async () => {
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    const assignBody = { engineerUid: 'support-1', idempotencyKey: 'phase3-assign-001' }
    const assigned = await fetch(`${baseUrl}/v1/tickets/server-ticket/assign`, { method: 'POST', headers, body: JSON.stringify(assignBody) })
    assert.equal(assigned.status, 200)
    const firstResult = await assigned.json()
    const repeated = await fetch(`${baseUrl}/v1/tickets/server-ticket/assign`, { method: 'POST', headers, body: JSON.stringify(assignBody) })
    assert.equal(repeated.status, 200)
    assert.deepEqual(await repeated.json(), firstResult)
    assert.equal((await adminDb.doc('tickets/server-ticket').get()).data()?.assignedEngineerUid, 'support-1')
    const assignmentAudit = (await adminDb.collection('auditEvents').where('sourceEventId', '==', firstResult.eventId).limit(1).get()).docs[0]
    assert.match(assignmentAudit?.data()?.correlationId, /^[0-9a-f-]{36}$/)

    const status = await fetch(`${baseUrl}/v1/tickets/server-ticket/status`, { method: 'POST', headers, body: JSON.stringify({ nextStatus: 'In Progress', idempotencyKey: 'phase3-status-001' }) })
    assert.equal(status.status, 200)
    const waiting = await fetch(`${baseUrl}/v1/tickets/server-ticket/status`, { method: 'POST', headers, body: JSON.stringify({ nextStatus: 'Waiting for User', idempotencyKey: 'phase6-status-pause-001' }) })
    assert.equal(waiting.status, 200)
    const pausedTicket = (await adminDb.doc('tickets/server-ticket').get()).data() ?? {}
    assert.equal(pausedTicket.slaState, 'paused')
    assert.equal(pausedTicket.slaPauseReason, 'Waiting for User')
    const pausedDueAt = pausedTicket.slaResolutionDueAt.toMillis()
    assert.ok(pausedTicket.slaPausedAt)

    const resumed = await fetch(`${baseUrl}/v1/tickets/server-ticket/status`, { method: 'POST', headers, body: JSON.stringify({ nextStatus: 'In Progress', idempotencyKey: 'phase6-status-resume-001' }) })
    assert.equal(resumed.status, 200)
    const resumedTicket = (await adminDb.doc('tickets/server-ticket').get()).data() ?? {}
    assert.equal(resumedTicket.slaState, 'running')
    assert.equal(resumedTicket.slaPauseReason, '')
    assert.ok(resumedTicket.slaResolutionDueAt.toMillis() >= pausedDueAt)
    assert.ok(resumedTicket.slaPausedMinutes >= 0)

    const audit = await fetch(`${baseUrl}/v1/audit-events?propertyId=PROP-1&limit=10`, { headers })
    assert.equal(audit.status, 200)
    assert.ok(((await audit.json()).items as unknown[]).length >= 2)

    const summary = await fetch(`${baseUrl}/v1/sla-summary?propertyId=PROP-1&limit=50`, { headers })
    assert.equal(summary.status, 200)
    const summaryBody = await summary.json() as { totals: { total: number; open: number }; byPriority: Array<{ key: string; total: number }> }
    assert.ok(summaryBody.totals.total >= 1)
    assert.ok(summaryBody.totals.open >= 1)
    assert.ok(summaryBody.byPriority.some((row) => row.key === 'Medium'))

    const unscopedSummary = await fetch(`${baseUrl}/v1/sla-summary`, { headers })
    assert.equal(unscopedSummary.status, 400)

    const completed = await fetch(`${baseUrl}/v1/tickets/server-ticket/status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nextStatus: 'Completed',
        resolutionNotes: 'Verified the network service and restored connectivity for the requester.',
        idempotencyKey: 'phase-fix-completed-at-001',
      }),
    })
    assert.equal(completed.status, 200)
    const completedTicket = (await adminDb.doc('tickets/server-ticket').get()).data() ?? {}
    assert.ok(completedTicket.completedAt)
  })

  it('creates a Ticket through the trusted boundary and rejects injected fields', async () => {
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    const createBody = {
      propertyId: 'PROP-1', propertyCode: 'P1', requesterName: 'Requester', requesterEmail: 'requester@example.test',
      department: 'IT', issueArea: 'Other', location: 'Office', assetId: '', problemCategory: 'Network',
      problemType: 'WiFi Connections', channel: 'Line', priority: 'Medium', description: 'Network access is unavailable',
      idempotencyKey: 'phase4-create-001',
    }
    const created = await fetch(`${baseUrl}/v1/tickets`, { method: 'POST', headers, body: JSON.stringify(createBody) })
    assert.equal(created.status, 201)
    const firstResult = await created.json() as { ticketId: string; eventId: string; action: string }
    assert.equal(firstResult.action, 'created')
    const repeated = await fetch(`${baseUrl}/v1/tickets`, { method: 'POST', headers, body: JSON.stringify(createBody) })
    assert.equal(repeated.status, 201)
    assert.deepEqual(await repeated.json(), firstResult)
    const ticket = await adminDb.doc(`tickets/${firstResult.ticketId}`).get()
    assert.equal(ticket.data()?.requesterUid, 'support-1')
    assert.equal(ticket.data()?.status, 'Pending')
    assert.equal(ticket.data()?.schemaVersion, 3)
    assert.equal(ticket.data()?.slaState, 'running')
    assert.equal(ticket.data()?.slaResponseTargetMinutes, 240)
    assert.equal(ticket.data()?.slaResolutionTargetMinutes, 1440)
    assert.ok(ticket.data()?.slaResponseDueAt)
    assert.ok(ticket.data()?.slaResolutionDueAt)
    const event = await adminDb.doc(`tickets/${firstResult.ticketId}/events/${firstResult.eventId}`).get()
    assert.equal(event.exists, true)
    assert.match(event.data()?.correlationId, /^[0-9a-f-]{36}$/)
    const createAudit = (await adminDb.collection('auditEvents').where('sourceEventId', '==', firstResult.eventId).limit(1).get()).docs[0]
    assert.equal(createAudit?.data()?.correlationId, event.data()?.correlationId)

    const injected = await fetch(`${baseUrl}/v1/tickets`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...createBody, idempotencyKey: 'phase4-create-002', injectedField: true }),
    })
    assert.equal(injected.status, 422)
  })
})
