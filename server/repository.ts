import { FieldPath, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import type { Actor } from './auth.js'
import { membershipFromData, requireAuditRead, requireSupportMembership } from './auth.js'
import { HttpError } from './errors.js'
import { isTicketStatus, validStatusTransition } from './domain.js'
import { validateCreateTicketCommand, validateTicketAssignmentCommand, validateTicketStatusCommand, type CreateTicketCommand } from '../shared/ticket-contracts.js'
import { createSlaFields, transitionSla } from './sla.js'

function operationId(uid: string, key: string) {
  return Buffer.from(`${uid}:${key}`).toString('base64url')
}

type BackendTicket = Record<string, unknown> & {
  propertyId: string
  propertyCode: string
  status: string
  priority: string
  assignedEngineerUid: string
}

function ticketSnapshotData(snapshot: FirebaseFirestore.DocumentSnapshot): BackendTicket {
  if (!snapshot.exists) throw new HttpError(404, 'ticket_not_found', 'Ticket was not found')
  const data = snapshot.data() ?? {}
  if (typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' || typeof data.status !== 'string') throw new HttpError(409, 'invalid_ticket_shape', 'Ticket schema is not compatible with the backend boundary')
  return { ...data, priority: typeof data.priority === 'string' ? data.priority : 'Medium', assignedEngineerUid: typeof data.assignedEngineerUid === 'string' ? data.assignedEngineerUid : '' } as BackendTicket
}

function invalidContract(): never {
  throw new HttpError(422, 'validation_error', 'Request fields are invalid')
}

function activeStringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : []
}

const defaultProblemTypes = [
  'Hardware / Computer PC', 'Hardware / Computer Laptop', 'Hardware / Office Printer',
  'Hardware / POS Printer', 'Hardware / Network Equipments', 'Hardware / Server',
  'Hardware / NAS', 'Hardware / CCTV Equipments', 'Hardware / Door Lock Equipments',
  'Software / OPERA Cloud', 'Software / Symphony Cloud', 'Software / Sun Cloud',
  'Software / Interface Communications', 'Network / WiFi Connections',
  'Network / Network Configurations', 'Helpdesk / Helpdesk',
]
const legacyProblemTypes = ['Hardware', 'OPERA Cloud', 'Simphony Cloud', 'CCTV System', 'Door Lock System', 'Network', 'Printer/POS', 'Interface Communications', 'Software', 'Other']
const defaultDepartments = ['Front Office', 'Housekeeping', 'Food & Beverage', 'Kitchen', 'Engineering', 'Finance & Accounting', 'Human Resources', 'Sales & Marketing', 'Security', 'Spa', 'IT', 'Other']
const defaultChannels = ['Line', 'Message Box', 'Personal Call', 'Other']

function validateCatalogCommand(command: CreateTicketCommand, catalog: Record<string, unknown> | undefined) {
  const problemTypes = activeStringList(catalog?.problemTypes)
  const departments = activeStringList(catalog?.departments)
  const channels = activeStringList(catalog?.channels)
  const selectedProblem = `${command.problemCategory} / ${command.problemType}`
  const problemAllowed = (problemTypes.length > 0 && (problemTypes.includes(selectedProblem) || (problemTypes.some((item) => legacyProblemTypes.includes(item)) && (defaultProblemTypes.includes(selectedProblem) || problemTypes.includes(command.problemType)))))
    || (problemTypes.length === 0 && defaultProblemTypes.includes(selectedProblem))
  if (!problemAllowed) throw new HttpError(422, 'invalid_catalog_value', 'Problem type is not available for this Property')
  if (command.department && !defaultDepartments.includes(command.department) && !departments.includes(command.department)) throw new HttpError(422, 'invalid_catalog_value', 'Department is not available for this Property')
  if (!defaultChannels.includes(command.channel) && !channels.includes(command.channel)) throw new HttpError(422, 'invalid_catalog_value', 'Channel is not available for this Property')
}

function requireTicketCreator(actor: Actor, membership: ReturnType<typeof membershipFromData>) {
  if (actor.globalRole === 'superAdmin') return
  if (!membership?.active || !['supportEngineer', 'requester'].includes(membership.role)) throw new HttpError(403, 'forbidden', 'Ticket creation is not allowed for this Property')
}

async function existingOperation(db: Firestore, actor: Actor, key: string, command: string, entityId: string | null) {
  const snapshot = await db.doc(`backendOperations/${operationId(actor.uid, key)}`).get()
  if (!snapshot.exists) return null
  const data = snapshot.data() ?? {}
  if (data.command !== command || (entityId !== null && data.entityId !== entityId)) throw new HttpError(409, 'idempotency_conflict', 'Idempotency key was already used for another command')
  return data.response as Record<string, string>
}

export async function assignTicket(db: Firestore, actor: Actor, ticketId: string, input: Record<string, unknown>, correlationId = 'backend') {
  const parsed = validateTicketAssignmentCommand(input)
  if (!parsed.ok) invalidContract()
  const { engineerUid, idempotencyKey: key } = parsed.value
  const command = 'ticket.assign'
  const prior = await existingOperation(db, actor, key, command, ticketId)
  if (prior) return prior
  const ticketRef = db.doc(`tickets/${ticketId}`)
  const operationRef = db.doc(`backendOperations/${operationId(actor.uid, key)}`)

  return db.runTransaction(async (transaction) => {
    const operationSnapshot = await transaction.get(operationRef)
    if (operationSnapshot.exists) {
      const data = operationSnapshot.data() ?? {}
      if (data.command !== command || data.entityId !== ticketId) throw new HttpError(409, 'idempotency_conflict', 'Idempotency key was already used for another command/entity')
      return data.response as { ticketId: string; eventId: string; action: string }
    }
    const ticketSnapshot = await transaction.get(ticketRef)
    const ticket = ticketSnapshotData(ticketSnapshot)
    const actorMembershipSnapshot = actor.globalRole === 'superAdmin' ? null : await transaction.get(db.doc(`memberships/${actor.uid}__${ticket.propertyId}`))
    const actorMembership = actorMembershipSnapshot ? membershipFromData(actorMembershipSnapshot.exists ? actorMembershipSnapshot.data() : undefined, actor.uid, ticket.propertyId) : null
    requireSupportMembership(actor, actorMembership)
    if (engineerUid) {
      const membershipSnapshot = await transaction.get(db.doc(`memberships/${engineerUid}__${ticket.propertyId}`))
      const membership = membershipFromData(membershipSnapshot.exists ? membershipSnapshot.data() : undefined, engineerUid, ticket.propertyId)
      if (!membership?.active || membership.role !== 'supportEngineer') throw new HttpError(400, 'invalid_assignee', 'Assignee must be an active Support Engineer in the same Property')
    }
    const eventRef = ticketRef.collection('events').doc()
    const auditRef = db.collection('auditEvents').doc()
    const action = engineerUid ? (ticket.assignedEngineerUid ? 'reassigned' : 'assigned') : 'unassigned'
    transaction.update(ticketRef, {
      assignedEngineerUid: engineerUid,
      assignedAt: engineerUid ? FieldValue.serverTimestamp() : null,
      assignedByUid: engineerUid ? actor.uid : '',
      updatedAt: FieldValue.serverTimestamp(),
      lastEventId: eventRef.id,
    })
    transaction.create(eventRef, {
      actorUid: actor.uid, fromStatus: ticket.status, toStatus: ticket.status,
      note: engineerUid ? `มอบหมายงานให้ ${engineerUid}` : 'ยกเลิกการมอบหมายงาน', type: action,
      fromAssignedEngineerUid: ticket.assignedEngineerUid, toAssignedEngineerUid: engineerUid,
      correlationId, createdAt: FieldValue.serverTimestamp(),
    })
    transaction.create(auditRef, {
      propertyId: ticket.propertyId, propertyCode: ticket.propertyCode, entityType: 'ticket', entityId: ticketId,
      sourceEventId: eventRef.id, action, actorUid: actor.uid,
      summary: engineerUid ? `มอบหมายงานให้ ${engineerUid}` : 'ยกเลิกการมอบหมายงาน', correlationId, createdAt: FieldValue.serverTimestamp(),
    })
    const response = { ticketId, eventId: eventRef.id, action }
    transaction.create(operationRef, { command, entityId: ticketId, actorUid: actor.uid, response, createdAt: FieldValue.serverTimestamp() })
    return response
  })
}

export async function changeTicketStatus(db: Firestore, actor: Actor, ticketId: string, input: Record<string, unknown>, correlationId = 'backend') {
  const parsed = validateTicketStatusCommand(input)
  if (!parsed.ok) invalidContract()
  const { nextStatus, resolutionNotes, idempotencyKey: key } = parsed.value
  if (!isTicketStatus(nextStatus)) throw new HttpError(422, 'invalid_status', 'nextStatus is invalid')
  const command = 'ticket.status'
  const prior = await existingOperation(db, actor, key, command, ticketId)
  if (prior) return prior
  const ticketRef = db.doc(`tickets/${ticketId}`)
  const operationRef = db.doc(`backendOperations/${operationId(actor.uid, key)}`)

  return db.runTransaction(async (transaction) => {
    const operationSnapshot = await transaction.get(operationRef)
    if (operationSnapshot.exists) {
      const data = operationSnapshot.data() ?? {}
      if (data.command !== command || data.entityId !== ticketId) throw new HttpError(409, 'idempotency_conflict', 'Idempotency key was already used for another command/entity')
      return data.response as { ticketId: string; eventId: string; action: string; status: string }
    }
    const ticketSnapshot = await transaction.get(ticketRef)
    const ticket = ticketSnapshotData(ticketSnapshot)
    const actorMembershipSnapshot = actor.globalRole === 'superAdmin' ? null : await transaction.get(db.doc(`memberships/${actor.uid}__${ticket.propertyId}`))
    const actorMembership = actorMembershipSnapshot ? membershipFromData(actorMembershipSnapshot.exists ? actorMembershipSnapshot.data() : undefined, actor.uid, ticket.propertyId) : null
    requireSupportMembership(actor, actorMembership)
    if (!validStatusTransition(ticket.status, nextStatus)) throw new HttpError(409, 'invalid_transition', 'Ticket status transition is not allowed')
    if (nextStatus === 'Completed' && (resolutionNotes.length < 10 || resolutionNotes.length > 4000)) throw new HttpError(400, 'resolution_required', 'At least 10 characters of resolution notes are required')
    const now = Timestamp.now()
    const sla = transitionSla(ticket, nextStatus, now)
    const eventRef = ticketRef.collection('events').doc()
    const auditRef = db.collection('auditEvents').doc()
    const update = { schemaVersion: 3, status: nextStatus, updatedAt: FieldValue.serverTimestamp(), lastEventId: eventRef.id, ...sla, ...(nextStatus === 'Completed' ? { resolutionNotes } : {}) }
    transaction.update(ticketRef, update)
    transaction.create(eventRef, {
      actorUid: actor.uid, fromStatus: ticket.status, toStatus: nextStatus,
      note: `เปลี่ยนสถานะจาก ${ticket.status} เป็น ${nextStatus}`, type: 'statusChanged', correlationId, createdAt: FieldValue.serverTimestamp(),
    })
    transaction.create(auditRef, {
      propertyId: ticket.propertyId, propertyCode: ticket.propertyCode, entityType: 'ticket', entityId: ticketId,
      sourceEventId: eventRef.id, action: 'statusChanged', actorUid: actor.uid,
      summary: `เปลี่ยนสถานะจาก ${ticket.status} เป็น ${nextStatus}`, correlationId, createdAt: FieldValue.serverTimestamp(),
    })
    const response = { ticketId, eventId: eventRef.id, action: 'statusChanged', status: nextStatus }
    transaction.create(operationRef, { command, entityId: ticketId, actorUid: actor.uid, response, createdAt: FieldValue.serverTimestamp() })
    return response
  })
}

export async function createTicket(db: Firestore, actor: Actor, input: Record<string, unknown>, correlationId = 'backend') {
  const parsed = validateCreateTicketCommand(input)
  if (!parsed.ok) invalidContract()
  const command = parsed.value
  const operationCommand = 'ticket.create'
  const prior = await existingOperation(db, actor, command.idempotencyKey, operationCommand, null)
  if (prior) return prior
  const ticketRef = db.collection('tickets').doc()
  const operationRef = db.doc(`backendOperations/${operationId(actor.uid, command.idempotencyKey)}`)

  return db.runTransaction(async (transaction) => {
    const operationSnapshot = await transaction.get(operationRef)
    if (operationSnapshot.exists) {
      const data = operationSnapshot.data() ?? {}
      if (data.command !== operationCommand) throw new HttpError(409, 'idempotency_conflict', 'Idempotency key was already used for another command')
      return data.response as { ticketId: string; eventId: string; action: string }
    }
    const propertySnapshot = await transaction.get(db.doc(`properties/${command.propertyId}`))
    const property = propertySnapshot.data() ?? {}
    if (!propertySnapshot.exists || property.active !== true || property.code !== command.propertyCode) throw new HttpError(403, 'invalid_property', 'Property is not available')
    const membershipSnapshot = actor.globalRole === 'superAdmin' ? null : await transaction.get(db.doc(`memberships/${actor.uid}__${command.propertyId}`))
    const membership = membershipSnapshot ? membershipFromData(membershipSnapshot.exists ? membershipSnapshot.data() : undefined, actor.uid, command.propertyId) : null
    requireTicketCreator(actor, membership)
    const catalogSnapshot = await transaction.get(db.doc(`ticketCatalogs/${command.propertyId}`))
    validateCatalogCommand(command, catalogSnapshot.exists ? catalogSnapshot.data() : undefined)

    const eventRef = ticketRef.collection('events').doc()
    const auditRef = db.collection('auditEvents').doc()
    const now = Timestamp.now()
    const sla = createSlaFields(command.priority, now)
    transaction.create(ticketRef, {
      schemaVersion: 3,
      propertyId: command.propertyId,
      propertyCode: command.propertyCode,
      requesterUid: actor.uid,
      requesterName: command.requesterName,
      requesterEmail: command.requesterEmail,
      department: command.department,
      issueArea: command.issueArea,
      location: command.location,
      assetId: command.assetId,
      problemCategory: command.problemCategory,
      problemType: command.problemType,
      channel: command.channel,
      priority: command.priority,
      status: 'Pending',
      description: command.description,
      resolutionNotes: '',
      assignedEngineerUid: '',
      createdAt: now,
      updatedAt: FieldValue.serverTimestamp(),
      lastEventId: eventRef.id,
      ...sla,
    })
    transaction.create(eventRef, {
      actorUid: actor.uid, fromStatus: null, toStatus: 'Pending', note: 'สร้าง Task', type: 'created', correlationId, createdAt: FieldValue.serverTimestamp(),
    })
    transaction.create(auditRef, {
      propertyId: command.propertyId, propertyCode: command.propertyCode, entityType: 'ticket', entityId: ticketRef.id,
      sourceEventId: eventRef.id, action: 'created', actorUid: actor.uid, summary: 'สร้าง Task', correlationId, createdAt: FieldValue.serverTimestamp(),
    })
    const response = { ticketId: ticketRef.id, eventId: eventRef.id, action: 'created' }
    transaction.create(operationRef, { command: operationCommand, entityId: ticketRef.id, actorUid: actor.uid, response, createdAt: FieldValue.serverTimestamp() })
    return response
  })
}

export async function listAuditEvents(db: Firestore, actor: Actor, params: URLSearchParams) {
  const propertyId = params.get('propertyId')
  await requireAuditRead(db, actor, propertyId)
  const pageSize = Math.min(Math.max(Number(params.get('limit') ?? 30) || 30, 1), 50)
  let auditQuery = db.collection('auditEvents').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize)
  if (propertyId) auditQuery = db.collection('auditEvents').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize)
  const cursor = params.get('cursor')
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt: number; id: string }
      const timestamp = Timestamp.fromMillis(parsed.createdAt)
      auditQuery = propertyId
        ? db.collection('auditEvents').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').startAfter(timestamp, parsed.id).limit(pageSize)
        : db.collection('auditEvents').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').startAfter(timestamp, parsed.id).limit(pageSize)
    } catch { throw new HttpError(400, 'invalid_cursor', 'cursor is invalid') }
  }
  const snapshot = await auditQuery.get()
  const items = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
  const last = snapshot.docs.at(-1)
  const lastDate = last?.get('createdAt')
  const nextCursor = snapshot.size === pageSize && last && lastDate instanceof Timestamp
    ? Buffer.from(JSON.stringify({ createdAt: lastDate.toMillis(), id: last.id })).toString('base64url')
    : null
  return { items, nextCursor }
}
