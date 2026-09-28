import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

const projectId = 'demo-lotus-it-portal-local'
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 18080, rules },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'users/requester-1'), { globalRole: 'member', active: true }),
      setDoc(doc(db, 'users/support-1'), { globalRole: 'member', active: true }),
      setDoc(doc(db, 'users/support-2'), { globalRole: 'member', active: true }),
      setDoc(doc(db, 'users/executive-1'), { globalRole: 'member', active: true }),
      setDoc(doc(db, 'users/admin-1'), { globalRole: 'superAdmin', active: true }),
      setDoc(doc(db, 'properties/PROP-1'), { code: 'P1', name: 'Property One', active: true }),
      setDoc(doc(db, 'properties/PROP-2'), { code: 'P2', name: 'Property Two', active: true }),
      setDoc(doc(db, 'memberships/requester-1__PROP-1'), {
        userId: 'requester-1', propertyId: 'PROP-1', propertyCode: 'P1', propertyName: 'Property One', role: 'requester', active: true,
      }),
      setDoc(doc(db, 'memberships/support-1__PROP-1'), {
        userId: 'support-1', propertyId: 'PROP-1', propertyCode: 'P1', propertyName: 'Property One', role: 'supportEngineer', active: true,
      }),
      setDoc(doc(db, 'memberships/support-2__PROP-2'), {
        userId: 'support-2', propertyId: 'PROP-2', propertyCode: 'P2', propertyName: 'Property Two', role: 'supportEngineer', active: true,
      }),
      setDoc(doc(db, 'memberships/executive-1__PROP-1'), {
        userId: 'executive-1', propertyId: 'PROP-1', propertyCode: 'P1', propertyName: 'Property One', role: 'clientExecutive', active: true,
      }),
      setDoc(doc(db, 'tickets/ticket-own'), { propertyId: 'PROP-1', requesterUid: 'requester-1' }),
      setDoc(doc(db, 'tickets/ticket-other'), { propertyId: 'PROP-1', requesterUid: 'someone-else' }),
      setDoc(doc(db, 'tickets/ticket-cross-property'), { propertyId: 'PROP-2', requesterUid: 'requester-1' }),
      setDoc(doc(db, 'tickets/ticket-to-update'), {
        propertyId: 'PROP-1', propertyCode: 'P1', requesterUid: 'requester-1', requesterName: 'Requester',
        requesterEmail: 'requester@example.test', department: 'IT', issueArea: 'Other', location: 'Office',
        assetId: '', problemCategory: 'Network', problemType: 'WiFi Connections', channel: 'Line', priority: 'Medium',
        status: 'Pending', description: 'Network access is unavailable', assignedEngineerUid: '',
        createdAt: new Date('2026-09-24T00:00:00.000Z'), updatedAt: new Date('2026-09-24T00:00:00.000Z'), lastEventId: 'old-event',
      }),
      setDoc(doc(db, 'assets/asset-1'), { propertyId: 'PROP-1' }),
      setDoc(doc(db, 'assets/damaged-asset'), { propertyId: 'PROP-1', status: 'Under Repair', updatedAt: new Date() }),
      setDoc(doc(db, 'pmSchedules/pm-1'), { propertyId: 'PROP-1' }),
      setDoc(doc(db, 'cctvDailyChecks/check-1'), { propertyId: 'PROP-1' }),
      setDoc(doc(db, 'cctvNvrInventory/nvr-1'), { propertyId: 'PROP-1' }),
      setDoc(doc(db, 'infrastructureIncidents/incident-1'), { propertyId: 'PROP-1' }),
    ])
  })
})

after(async () => {
  await testEnv.cleanup()
})

describe('profile, membership and Property boundaries', () => {
  it('allows self profile and membership reads but denies another user', async () => {
    const db = testEnv.authenticatedContext('requester-1').firestore()
    await assertSucceeds(getDoc(doc(db, 'users/requester-1')))
    await assertSucceeds(getDoc(doc(db, 'memberships/requester-1__PROP-1')))
    await assertFails(getDoc(doc(db, 'users/support-1')))
  })

  it('denies client writes to profiles, memberships, and Properties', async () => {
    const db = testEnv.authenticatedContext('requester-1').firestore()
    await assertFails(setDoc(doc(db, 'users/requester-1'), { globalRole: 'superAdmin', active: true }))
    await assertFails(setDoc(doc(db, 'memberships/requester-1__PROP-2'), { userId: 'requester-1', propertyId: 'PROP-2', role: 'supportEngineer', active: true }))
    await assertFails(setDoc(doc(db, 'properties/PROP-3'), { code: 'P3', active: true }))
  })

  it('allows Super Admin directory reads while denying collection listings to regular users', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    const memberDb = testEnv.authenticatedContext('requester-1').firestore()
    await assertSucceeds(getDocs(collection(adminDb, 'users')))
    await assertSucceeds(getDocs(collection(adminDb, 'memberships')))
    await assertFails(getDocs(collection(memberDb, 'users')))
    await assertFails(getDocs(collection(memberDb, 'memberships')))
  })

  it('allows only assigned Property reads', async () => {
    const db = testEnv.authenticatedContext('requester-1').firestore()
    await assertSucceeds(getDoc(doc(db, 'properties/PROP-1')))
    await assertFails(getDoc(doc(db, 'properties/PROP-2')))
  })
})

describe('Ticket, Asset, and PM access', () => {
  it('allows Property members to query only damaged Assets in their own Property', async () => {
    const executiveDb = testEnv.authenticatedContext('executive-1').firestore()
    const requesterDb = testEnv.authenticatedContext('requester-1').firestore()
    const damagedOnlyQuery = (db) => query(
      collection(db, 'assets'),
      where('propertyId', '==', 'PROP-1'),
      where('status', '==', 'Under Repair'),
      orderBy('updatedAt', 'desc'),
      limit(100),
    )

    const executiveAssets = await assertSucceeds(getDocs(damagedOnlyQuery(executiveDb)))
    assert.equal(executiveAssets.size, 1)
    await assertSucceeds(getDocs(damagedOnlyQuery(requesterDb)))
    await assertFails(getDocs(query(
      collection(executiveDb, 'assets'),
      where('propertyId', '==', 'PROP-1'),
      orderBy('updatedAt', 'desc'),
      limit(100),
    )))
    await assertFails(getDocs(query(
      collection(executiveDb, 'assets'),
      where('propertyId', '==', 'PROP-2'),
      where('status', '==', 'Under Repair'),
      orderBy('updatedAt', 'desc'),
      limit(100),
    )))
  })

  it('limits Requesters to their own Tickets in their assigned Property', async () => {
    const db = testEnv.authenticatedContext('requester-1').firestore()
    await assertSucceeds(getDoc(doc(db, 'tickets/ticket-own')))
    await assertFails(getDoc(doc(db, 'tickets/ticket-other')))
    await assertFails(getDoc(doc(db, 'tickets/ticket-cross-property')))
  })

  it('allows narrow Spark-only Ticket creation and support status updates', async () => {
    const requesterDb = testEnv.authenticatedContext('requester-1').firestore()
    const ticketRef = doc(requesterDb, 'tickets/new-ticket')
    const eventRef = doc(requesterDb, 'tickets/new-ticket/events/initial-event')
    const batch = writeBatch(requesterDb)
    batch.set(ticketRef, {
      schemaVersion: 2,
      propertyId: 'PROP-1', propertyCode: 'P1', requesterUid: 'requester-1', requesterName: 'Requester',
      requesterEmail: 'requester@example.test', department: 'IT', issueArea: 'Other', location: 'Office',
      assetId: '', problemCategory: 'Network', problemType: 'WiFi Connections', channel: 'Line', priority: 'Medium', status: 'Pending', description: 'Network access is unavailable',
      resolutionNotes: '', assignedEngineerUid: '', assignedAt: null, assignedByUid: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastEventId: eventRef.id,
    })
    batch.set(eventRef, {
      actorUid: 'requester-1', fromStatus: null, toStatus: 'Pending', note: 'Created', type: 'created', createdAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())

    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    const updateBatch = writeBatch(supportDb)
    const statusEvent = doc(supportDb, 'tickets/ticket-to-update/events/status-event')
    updateBatch.update(doc(supportDb, 'tickets/ticket-to-update'), {
      status: 'In Progress', updatedAt: serverTimestamp(), lastEventId: statusEvent.id,
    })
    updateBatch.set(statusEvent, {
      actorUid: 'support-1', fromStatus: 'Pending', toStatus: 'In Progress', note: 'Assigned',
      type: 'statusChanged', createdAt: serverTimestamp(),
    })
    await assertSucceeds(updateBatch.commit())

    const requesterUpdate = writeBatch(requesterDb)
    const forbiddenEvent = doc(requesterDb, 'tickets/ticket-to-update/events/requester-event')
    requesterUpdate.update(doc(requesterDb, 'tickets/ticket-to-update'), {
      status: 'Completed', updatedAt: serverTimestamp(), lastEventId: forbiddenEvent.id,
    })
    requesterUpdate.set(forbiddenEvent, {
      actorUid: 'requester-1', fromStatus: 'In Progress', toStatus: 'Completed', note: 'Close',
      type: 'statusChanged', createdAt: serverTimestamp(),
    })
    await assertFails(requesterUpdate.commit())
  })

  it('rejects malformed Ticket fields, unauthorized assignment changes, and protected deletes', async () => {
    const requesterDb = testEnv.authenticatedContext('requester-1').firestore()
    const malformedTicketRef = doc(requesterDb, 'tickets/malformed-ticket')
    const malformedEventRef = doc(requesterDb, 'tickets/malformed-ticket/events/initial-event')
    const malformedBatch = writeBatch(requesterDb)
    malformedBatch.set(malformedTicketRef, {
      propertyId: 'PROP-1', propertyCode: 'P1', requesterUid: 'requester-1', requesterName: 'Requester',
      requesterEmail: 'not-an-email', department: 'IT', issueArea: 'Other', location: 'Office',
      assetId: '', problemCategory: 'Network', problemType: 'WiFi Connections', channel: 'Line', priority: 'Medium',
      status: 'Pending', description: 'Network access is unavailable', assignedEngineerUid: '',
      injectedField: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastEventId: malformedEventRef.id,
    })
    malformedBatch.set(malformedEventRef, {
      actorUid: 'requester-1', fromStatus: null, toStatus: 'Pending', note: 'Created', type: 'created', createdAt: serverTimestamp(),
    })
    await assertFails(malformedBatch.commit())

    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    await assertFails(updateDoc(doc(supportDb, 'tickets/ticket-to-update'), {
      assignedEngineerUid: 'support-1',
      updatedAt: serverTimestamp(),
    }))
    await assertFails(deleteDoc(doc(supportDb, 'tickets/ticket-to-update')))
    await assertFails(deleteDoc(doc(supportDb, 'tickets/ticket-to-update/events/old-event')))
  })

  it('allows append-only Spark assignment and audit writes but denies tampering', async () => {
    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    const ticketRef = doc(supportDb, 'tickets/ticket-to-update')
    const eventRef = doc(supportDb, 'tickets/ticket-to-update/events/assignment-event')
    const auditRef = doc(supportDb, 'auditEvents/assignment-audit')
    const batch = writeBatch(supportDb)
    batch.update(ticketRef, {
      assignedEngineerUid: 'support-1', assignedAt: serverTimestamp(), assignedByUid: 'support-1',
      updatedAt: serverTimestamp(), lastEventId: eventRef.id,
    })
    batch.set(eventRef, {
      actorUid: 'support-1', fromStatus: 'Pending', toStatus: 'Pending', note: 'Assigned',
      type: 'assigned', fromAssignedEngineerUid: '', toAssignedEngineerUid: 'support-1', createdAt: serverTimestamp(),
    })
    batch.set(auditRef, {
      propertyId: 'PROP-1', propertyCode: 'P1', entityType: 'ticket', entityId: 'ticket-to-update',
      sourceEventId: 'assignment-event', action: 'assigned', actorUid: 'support-1', summary: 'Assigned ticket', createdAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
    await assertSucceeds(setDoc(doc(supportDb, 'auditEvents/assignment-audit-2'), {
      propertyId: 'PROP-1', propertyCode: 'P1', entityType: 'ticket', entityId: 'ticket-to-update',
      sourceEventId: 'assignment-event', action: 'assigned', actorUid: 'support-1', summary: 'Assigned ticket', createdAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(auditRef, { summary: 'tampered' }))
    await assertFails(deleteDoc(auditRef))
  })

  it('denies cross-Property assignment and cross-Property audit reads', async () => {
    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    const crossEvent = doc(supportDb, 'tickets/ticket-to-update/events/cross-property-assignment')
    const crossBatch = writeBatch(supportDb)
    crossBatch.update(doc(supportDb, 'tickets/ticket-to-update'), {
      assignedEngineerUid: 'support-2', assignedAt: serverTimestamp(), assignedByUid: 'support-1',
      updatedAt: serverTimestamp(), lastEventId: crossEvent.id,
    })
    crossBatch.set(crossEvent, {
      actorUid: 'support-1', fromStatus: 'Pending', toStatus: 'Pending', note: 'Cross property',
      type: 'assigned', fromAssignedEngineerUid: '', toAssignedEngineerUid: 'support-2', createdAt: serverTimestamp(),
    })
    await assertFails(crossBatch.commit())

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'auditEvents/audit-p1'), {
        propertyId: 'PROP-1', propertyCode: 'P1', entityType: 'ticket', entityId: 'ticket-to-update', sourceEventId: 'event-p1',
        action: 'statusChanged', actorUid: 'support-1', summary: 'P1', createdAt: new Date(),
      })
      await setDoc(doc(db, 'auditEvents/audit-p2'), {
        propertyId: 'PROP-2', propertyCode: 'P2', entityType: 'ticket', entityId: 'ticket-cross-property', sourceEventId: 'event-p2',
        action: 'statusChanged', actorUid: 'support-2', summary: 'P2', createdAt: new Date(),
      })
    })
    await assertSucceeds(getDoc(doc(supportDb, 'auditEvents/audit-p1')))
    await assertFails(getDoc(doc(supportDb, 'auditEvents/audit-p2')))
    await assertSucceeds(getDocs(query(collection(testEnv.authenticatedContext('admin-1').firestore(), 'auditEvents'), limit(10))))
    await assertFails(setDoc(doc(supportDb, 'auditEvents/injected-audit'), {
      propertyId: 'PROP-1', propertyCode: 'P1', entityType: 'ticket', entityId: 'ticket-to-update', sourceEventId: 'event',
      action: 'statusChanged', actorUid: 'support-1', summary: 'Injected', createdAt: serverTimestamp(), injectedField: true,
    }))
  })

  it('limits Asset reads to Support Engineers and allows read-only PM access for Property Executives', async () => {
    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    const executiveDb = testEnv.authenticatedContext('executive-1').firestore()
    const requesterDb = testEnv.authenticatedContext('requester-1').firestore()
    await assertSucceeds(getDoc(doc(supportDb, 'assets/asset-1')))
    await assertSucceeds(getDoc(doc(supportDb, 'pmSchedules/pm-1')))
    await assertFails(getDoc(doc(executiveDb, 'assets/asset-1')))
    await assertSucceeds(getDoc(doc(executiveDb, 'pmSchedules/pm-1')))
    await assertFails(getDoc(doc(executiveDb, 'pmSchedules/pm-1/runs/run-1')))
    await assertFails(getDoc(doc(requesterDb, 'assets/asset-1')))
    await assertFails(getDoc(doc(requesterDb, 'pmSchedules/pm-1')))
  })

  it('accepts a well-formed PM run and rejects mismatched checklist data', async () => {
    const db = testEnv.authenticatedContext('support-1').firestore()
    const scheduleRef = doc(db, 'pmSchedules/pm-valid')
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'pmSchedules/pm-valid'), {
        propertyId: 'PROP-1', propertyCode: 'P1', title: 'Monthly checks', location: 'IT Room',
        frequency: 'Monthly', checklistItems: ['Check UPS', 'Check cooling'], nextDueOn: '2026-09-24',
        active: true, createdBy: 'support-1', lastRunOn: '', lastRunId: '',
        createdAt: new Date(), updatedAt: new Date(),
      })
    })

    async function recordRun(runId, checklistItems, checklistResults, outcome) {
      const batch = writeBatch(db)
      batch.set(doc(db, `pmSchedules/pm-valid/runs/${runId}`), {
        propertyId: 'PROP-1', propertyCode: 'P1', scheduleTitle: 'Monthly checks', dueOn: '2026-09-24',
        checklistItems, performedBy: 'support-1', completedOn: serverTimestamp(), outcome, checklistResults, notes: '',
      })
      batch.update(scheduleRef, {
        lastRunOn: '2026-09-24', lastRunId: runId, nextDueOn: '2026-10-24', updatedAt: serverTimestamp(),
      })
      return batch.commit()
    }

    await assertFails(recordRun('invalid-types', ['Check UPS', 'Check cooling'], [true, 'yes'], 'Completed'))
    await assertSucceeds(recordRun('valid-run', ['Check UPS', 'Check cooling'], [true, true], 'Completed'))
  })

  it('rejects malformed PM checklist items and invalid date formats', async () => {
    const db = testEnv.authenticatedContext('support-1').firestore()
    await assertFails(setDoc(doc(db, 'pmSchedules/pm-malformed-checklist'), {
      propertyId: 'PROP-1', propertyCode: 'P1', title: 'Malformed checklist', location: 'IT Room',
      frequency: 'Monthly', checklistItems: [{ text: 'not a string item' }], nextDueOn: '2026-09-24',
      active: true, createdBy: 'support-1', lastRunOn: '', lastRunId: '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    await assertFails(setDoc(doc(db, 'pmSchedules/pm-malformed-date'), {
      propertyId: 'PROP-1', propertyCode: 'P1', title: 'Malformed date', location: 'IT Room',
      frequency: 'Monthly', checklistItems: ['Check UPS'], nextDueOn: '2026-09-2',
      active: true, createdBy: 'support-1', lastRunOn: '', lastRunId: '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })
})

describe('CCTV and Infrastructure Incident access is Property-scoped', () => {
  it('lets only Super Admin toggle CCTV per Property and hides disabled-property CCTV from members', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1').firestore()
    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    const executiveDb = testEnv.authenticatedContext('executive-1').firestore()
    const requesterDb = testEnv.authenticatedContext('requester-1').firestore()

    await assertSucceeds(updateDoc(doc(adminDb, 'properties/PROP-1'), {
      cctvEnabled: false,
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(getDoc(doc(adminDb, 'properties/PROP-1')))
    await assertFails(getDoc(doc(supportDb, 'cctvDailyChecks/check-1')))
    await assertFails(getDoc(doc(executiveDb, 'cctvDailyChecks/check-1')))
    await assertFails(getDoc(doc(supportDb, 'cctvNvrInventory/nvr-1')))
    await assertFails(updateDoc(doc(requesterDb, 'properties/PROP-1'), {
      cctvEnabled: true,
      updatedAt: serverTimestamp(),
    }))
    await assertFails(updateDoc(doc(adminDb, 'properties/PROP-1'), {
      cctvEnabled: true,
      code: 'CHANGED',
      updatedAt: serverTimestamp(),
    }))

    await assertSucceeds(updateDoc(doc(adminDb, 'properties/PROP-1'), {
      cctvEnabled: true,
      updatedAt: serverTimestamp(),
    }))
    await assertSucceeds(getDoc(doc(supportDb, 'cctvDailyChecks/check-1')))
    await assertSucceeds(getDoc(doc(executiveDb, 'cctvDailyChecks/check-1')))
  })

  it('allows assigned Support and Executive reads, denies Requesters for Incidents, and rejects malformed writes', async () => {
    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    const executiveDb = testEnv.authenticatedContext('executive-1').firestore()
    const requesterDb = testEnv.authenticatedContext('requester-1').firestore()
    await assertSucceeds(getDoc(doc(supportDb, 'cctvDailyChecks/check-1')))
    await assertSucceeds(getDoc(doc(supportDb, 'infrastructureIncidents/incident-1')))
    await assertSucceeds(getDoc(doc(executiveDb, 'infrastructureIncidents/incident-1')))
    await assertFails(getDoc(doc(requesterDb, 'cctvDailyChecks/check-1')))
    await assertFails(getDoc(doc(requesterDb, 'infrastructureIncidents/incident-1')))
    await assertFails(setDoc(doc(supportDb, 'cctvDailyChecks/new-check'), { propertyId: 'PROP-1' }))
    await assertFails(setDoc(doc(supportDb, 'infrastructureIncidents/new-incident'), { propertyId: 'PROP-1' }))
  })

  it('rejects malformed nested CCTV NVR details and oversized embedded lists', async () => {
    const supportDb = testEnv.authenticatedContext('support-1').firestore()
    await assertSucceeds(setDoc(doc(supportDb, 'cctvDailyChecks/PROP-1_2026-09-24'), {
      propertyId: 'PROP-1', propertyCode: 'P1', checkedOn: '2026-09-24', nvrTotal: 1, nvrOnline: 1,
      cameraTotal: 1, cameraOnline: 1, nvrDetails: [{
        nvrId: 'nvr-1', nvrName: 'Main NVR', location: 'Server Room', online: true,
        cameraTotal: 1, cameraOnline: 1, retentionDays: 30, oldestFootageOn: '2026-08-25',
        targetRetentionDays: 30, notes: '',
      }], notes: '', checkedByUid: 'support-1', checkedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    const malformedDetail = {
      nvrId: 'nvr-1', online: true, cameraTotal: 1, cameraOnline: 1, retentionDays: 30, notes: '', unexpected: true,
    }
    await assertFails(setDoc(doc(supportDb, 'cctvDailyChecks/PROP-1_2026-09-25'), {
      propertyId: 'PROP-1', propertyCode: 'P1', checkedOn: '2026-09-25', nvrTotal: 1, nvrOnline: 1,
      cameraTotal: 1, cameraOnline: 1, nvrDetails: [malformedDetail], notes: '', checkedByUid: 'support-1',
      checkedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
    await assertFails(setDoc(doc(supportDb, 'cctvDailyChecks/PROP-1_2026-09-26'), {
      propertyId: 'PROP-1', propertyCode: 'P1', checkedOn: '2026-09-26', nvrTotal: 0, nvrOnline: 0,
      cameraTotal: 0, cameraOnline: 0, nvrDetails: Array.from({ length: 6 }, (_, index) => ({
        nvrId: `nvr-${index}`, online: false, cameraTotal: 0, cameraOnline: 0, retentionDays: 0, notes: '',
      })), notes: '', checkedByUid: 'support-1', checkedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }))
  })
})
