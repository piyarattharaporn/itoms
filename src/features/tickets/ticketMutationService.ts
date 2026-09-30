import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../../lib/firebase'
import {
  validateCreateTicketCommand,
  validateTicketAssignmentCommand,
  validateTicketEditCommand,
  validateTicketStatusCommand,
} from '../../../shared/ticket-contracts'
import type { TicketRecord, TicketStatus } from './types'
import { statusTransitions } from './types'

function requiredFirestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาตรวจสอบ Firebase configuration')
  return db
}

function randomKey() {
  return crypto.randomUUID()
}

function assertValid(result: { ok: boolean; issues?: unknown[] }): asserts result is { ok: true; value: Record<string, unknown> } {
  if (!result.ok) throw new Error('ข้อมูล Task ไม่ถูกต้องหรือมี field ที่ไม่ได้รับอนุญาต')
}

function readStatus(value: unknown): TicketStatus {
  if (typeof value !== 'string') throw new Error('Ticket status ไม่ถูกต้อง')
  return value as TicketStatus
}

function assertStatusTransition(from: TicketStatus, to: TicketStatus) {
  if (!statusTransitions(from).includes(to)) throw new Error(`ไม่สามารถเปลี่ยนสถานะจาก ${from} เป็น ${to}`)
}

export async function createTicketWithFirebase(user: User, input: Record<string, unknown>) {
  const firestore = requiredFirestore()
  const parsed = validateCreateTicketCommand({ ...input, idempotencyKey: randomKey() })
  assertValid(parsed)

  const ticketRef = doc(collection(firestore, 'tickets'))
  const eventRef = doc(collection(ticketRef, 'events'))
  const auditRef = doc(collection(firestore, 'auditEvents'))
  const correlationId = randomKey()
  const batch = writeBatch(firestore)

  batch.set(ticketRef, {
    schemaVersion: 2,
    propertyId: parsed.value.propertyId,
    propertyCode: parsed.value.propertyCode,
    requesterUid: user.uid,
    requesterName: parsed.value.requesterName,
    requesterEmail: parsed.value.requesterEmail,
    department: parsed.value.department,
    issueArea: parsed.value.issueArea,
    location: parsed.value.location,
    assetId: parsed.value.assetId,
    problemCategory: parsed.value.problemCategory,
    problemType: parsed.value.problemType,
    channel: parsed.value.channel,
    priority: parsed.value.priority,
    status: 'Pending',
    description: parsed.value.description,
    resolutionNotes: '',
    assignedEngineerUid: '',
    assignedAt: null,
    assignedByUid: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
    lastEventId: eventRef.id,
  })
  batch.set(eventRef, {
    actorUid: user.uid,
    fromStatus: null,
    toStatus: 'Pending',
    note: 'สร้าง Task',
    type: 'created',
    correlationId,
    createdAt: serverTimestamp(),
  })
  batch.set(auditRef, {
    propertyId: parsed.value.propertyId,
    propertyCode: parsed.value.propertyCode,
    entityType: 'ticket',
    entityId: ticketRef.id,
    sourceEventId: eventRef.id,
    action: 'created',
    actorUid: user.uid,
    summary: 'สร้าง Task',
    correlationId,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return { ticketId: ticketRef.id, eventId: eventRef.id, action: 'created' as const }
}

export async function changeTicketStatusWithFirebase(user: User, ticket: TicketRecord, nextStatus: TicketStatus, resolutionNotes = '') {
  const firestore = requiredFirestore()
  const parsed = validateTicketStatusCommand({ nextStatus, resolutionNotes, idempotencyKey: randomKey() })
  assertValid(parsed)
  if (nextStatus === 'Completed' && resolutionNotes.trim().length < 10) throw new Error('กรุณากรอกวิธีแก้ไขอย่างน้อย 10 ตัวอักษร')

  const ticketRef = doc(firestore, 'tickets', ticket.id)
  const eventRef = doc(collection(ticketRef, 'events'))
  const auditRef = doc(collection(firestore, 'auditEvents'))
  const correlationId = randomKey()

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ticketRef)
    if (!snapshot.exists()) throw new Error('ไม่พบ Task นี้')
    const current = snapshot.data() as DocumentData
    const currentStatus = readStatus(current.status)
    assertStatusTransition(currentStatus, nextStatus)
    if (current.propertyId !== ticket.propertyId) throw new Error('Task อยู่คนละ Property')

    transaction.update(ticketRef, {
      status: nextStatus,
      ...(nextStatus === 'Completed' ? { resolutionNotes: resolutionNotes.trim() } : {}),
      ...(nextStatus === 'Completed' ? { completedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
      lastEventId: eventRef.id,
    })
    transaction.set(eventRef, {
      actorUid: user.uid,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      note: `เปลี่ยนสถานะจาก ${currentStatus} เป็น ${nextStatus}`,
      type: 'statusChanged',
      correlationId,
      createdAt: serverTimestamp(),
    })
    transaction.set(auditRef, {
      propertyId: current.propertyId,
      propertyCode: current.propertyCode,
      entityType: 'ticket',
      entityId: ticket.id,
      sourceEventId: eventRef.id,
      action: 'statusChanged',
      actorUid: user.uid,
      summary: `เปลี่ยนสถานะจาก ${currentStatus} เป็น ${nextStatus}`,
      correlationId,
      createdAt: serverTimestamp(),
    })
  })
  return { ticketId: ticket.id, eventId: eventRef.id, action: 'statusChanged' as const, status: nextStatus }
}

export async function assignTicketWithFirebase(user: User, ticket: TicketRecord, engineerUid: string) {
  const firestore = requiredFirestore()
  const parsed = validateTicketAssignmentCommand({ engineerUid, idempotencyKey: randomKey() })
  assertValid(parsed)
  const normalizedEngineerUid = String(parsed.value.engineerUid)
  const ticketRef = doc(firestore, 'tickets', ticket.id)
  const eventRef = doc(collection(ticketRef, 'events'))
  const auditRef = doc(collection(firestore, 'auditEvents'))
  const correlationId = randomKey()

  const action = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ticketRef)
    if (!snapshot.exists()) throw new Error('ไม่พบ Task นี้')
    const current = snapshot.data() as DocumentData
    if (current.propertyId !== ticket.propertyId) throw new Error('Task อยู่คนละ Property')
    const currentAssignee = typeof current.assignedEngineerUid === 'string' ? current.assignedEngineerUid : ''
    const action = normalizedEngineerUid ? (currentAssignee ? 'reassigned' : 'assigned') : 'unassigned'

    transaction.update(ticketRef, {
      assignedEngineerUid: normalizedEngineerUid,
      assignedAt: normalizedEngineerUid ? serverTimestamp() : null,
      assignedByUid: normalizedEngineerUid ? user.uid : '',
      updatedAt: serverTimestamp(),
      lastEventId: eventRef.id,
    })
    transaction.set(eventRef, {
      actorUid: user.uid,
      fromStatus: current.status,
      toStatus: current.status,
      note: normalizedEngineerUid ? `มอบหมายงานให้ ${normalizedEngineerUid}` : 'ยกเลิกการมอบหมายงาน',
      type: action,
      fromAssignedEngineerUid: currentAssignee,
      toAssignedEngineerUid: normalizedEngineerUid,
      correlationId,
      createdAt: serverTimestamp(),
    })
    transaction.set(auditRef, {
      propertyId: current.propertyId,
      propertyCode: current.propertyCode,
      entityType: 'ticket',
      entityId: ticket.id,
      sourceEventId: eventRef.id,
      action,
      actorUid: user.uid,
      summary: normalizedEngineerUid ? `มอบหมายงานให้ ${normalizedEngineerUid}` : 'ยกเลิกการมอบหมายงาน',
      correlationId,
      createdAt: serverTimestamp(),
    })
    return action
  })
  return { ticketId: ticket.id, eventId: eventRef.id, action }
}

export interface TicketEditValues {
  location: string
  department: string
  assetId: string
  description: string
  priority: TicketRecord['priority']
  reason: string
}

export async function editTicketWithFirebase(user: User, ticket: TicketRecord, input: TicketEditValues) {
  const firestore = requiredFirestore()
  const parsed = validateTicketEditCommand({ ...input, idempotencyKey: randomKey() })
  assertValid(parsed)
  const next = parsed.value
  const editableFields = ['location', 'department', 'assetId', 'description', 'priority'] as const
  const changedFields = editableFields.filter((field) => next[field] !== ticket[field])
  if (changedFields.length === 0) throw new Error('ไม่มีข้อมูลที่เปลี่ยนแปลง')
  if (ticket.status === 'Cancelled') throw new Error('ไม่สามารถแก้ไข Task ที่ยกเลิกแล้ว')

  const ticketRef = doc(firestore, 'tickets', ticket.id)
  const eventRef = doc(collection(ticketRef, 'events'))
  const auditRef = doc(collection(firestore, 'auditEvents'))
  const correlationId = randomKey()

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ticketRef)
    if (!snapshot.exists()) throw new Error('ไม่พบ Task นี้')
    const current = snapshot.data() as DocumentData
    if (current.propertyId !== ticket.propertyId) throw new Error('Task อยู่คนละ Property')
    if (current.status === 'Cancelled') throw new Error('ไม่สามารถแก้ไข Task ที่ยกเลิกแล้ว')

    transaction.update(ticketRef, {
      location: next.location,
      department: next.department,
      assetId: next.assetId,
      description: next.description,
      priority: next.priority,
      updatedAt: serverTimestamp(),
      lastEventId: eventRef.id,
    })
    transaction.set(eventRef, {
      actorUid: user.uid,
      fromStatus: current.status,
      toStatus: current.status,
      note: next.reason,
      type: 'edited',
      changedFields,
      correlationId,
      createdAt: serverTimestamp(),
    })
    transaction.set(auditRef, {
      propertyId: current.propertyId,
      propertyCode: current.propertyCode,
      entityType: 'ticket',
      entityId: ticket.id,
      sourceEventId: eventRef.id,
      action: 'edited',
      actorUid: user.uid,
      summary: `แก้ไข Task: ${changedFields.join(', ')} · ${next.reason}`,
      correlationId,
      createdAt: serverTimestamp(),
    })
  })

  return { ticketId: ticket.id, eventId: eventRef.id, action: 'edited' as const, changedFields }
}
