import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { recordUsageEvent } from '../../lib/telemetry'
import type { CursorPage } from '../../lib/pagination'
import type { TicketRecord } from '../tickets/types'
import { getCompletedTicketPage, type TicketAccess, type TicketPageCursor } from '../tickets/ticketService'

export const rcaStatuses = ['Draft', 'In Review', 'Approved', 'Closed'] as const
export type RcaStatus = (typeof rcaStatuses)[number]

export interface RcaRecord {
  id: string
  schemaVersion: 1
  propertyId: string
  propertyCode: string
  taskId: string
  taskTitle: string
  taskCategory: string
  taskPriority: TicketRecord['priority']
  taskCompletedAt: Date | null
  incidentSummary: string
  rootCause: string
  contributingFactors: string
  fiveWhys: string
  impact: string
  downtimeMinutes: number | null
  correctiveAction: string
  preventiveAction: string
  ownerUid: string
  dueDate: string
  status: RcaStatus
  createdBy: string
  createdAt: Date | null
  updatedAt: Date | null
}

export interface RcaInput {
  propertyId: string
  propertyCode: string
  task: TicketRecord
  incidentSummary: string
  rootCause: string
  contributingFactors: string
  fiveWhys: string
  impact: string
  downtimeMinutes: number | null
  correctiveAction: string
  preventiveAction: string
  ownerUid: string
  dueDate: string
}

export type RcaPageCursor = QueryDocumentSnapshot<DocumentData> | null

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function')
    return value.toDate()
  return null
}

function asStatus(value: unknown): RcaStatus {
  return rcaStatuses.includes(value as RcaStatus) ? (value as RcaStatus) : 'Draft'
}

function parseRca(id: string, data: DocumentData): RcaRecord | null {
  if (
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.taskId !== 'string' ||
    typeof data.taskTitle !== 'string' ||
    typeof data.taskCategory !== 'string' ||
    typeof data.taskPriority !== 'string' ||
    typeof data.incidentSummary !== 'string' ||
    typeof data.rootCause !== 'string' ||
    typeof data.contributingFactors !== 'string' ||
    typeof data.fiveWhys !== 'string' ||
    typeof data.impact !== 'string' ||
    typeof data.correctiveAction !== 'string' ||
    typeof data.preventiveAction !== 'string' ||
    typeof data.ownerUid !== 'string' ||
    typeof data.dueDate !== 'string' ||
    typeof data.createdBy !== 'string'
  )
    return null
  return {
    id,
    schemaVersion: data.schemaVersion === 1 ? 1 : 1,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    taskId: data.taskId,
    taskTitle: data.taskTitle,
    taskCategory: data.taskCategory,
    taskPriority: data.taskPriority as TicketRecord['priority'],
    taskCompletedAt: asDate(data.taskCompletedAt),
    incidentSummary: data.incidentSummary,
    rootCause: data.rootCause,
    contributingFactors: data.contributingFactors,
    fiveWhys: data.fiveWhys,
    impact: data.impact,
    downtimeMinutes: typeof data.downtimeMinutes === 'number' ? data.downtimeMinutes : null,
    correctiveAction: data.correctiveAction,
    preventiveAction: data.preventiveAction,
    ownerUid: data.ownerUid,
    dueDate: data.dueDate,
    status: asStatus(data.status),
    createdBy: data.createdBy,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
  }
}

export async function getCompletedTasksPage(access: TicketAccess, pageSize = 25, cursor: TicketPageCursor = null) {
  return getCompletedTicketPage(access, pageSize, cursor)
}

export async function getRcaPage(
  propertyId: string,
  allProperties: boolean,
  pageSize = 25,
  cursor: RcaPageCursor = null,
): Promise<CursorPage<RcaRecord>> {
  pageSize = Math.min(Math.max(pageSize, 1), 50)
  const constraints = [] as Parameters<typeof query>[1][]
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  const snapshot = await getDocs(query(collection(firestore(), 'rcaRecords'), ...constraints))
  const items = snapshot.docs
    .map((item) => parseRca(item.id, item.data()))
    .filter((item): item is RcaRecord => item !== null)
    .sort(
      (a, b) =>
        (b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0) -
        (a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0),
    )
  recordUsageEvent('rca_page_loaded', { count: items.length, pageSize })
  return {
    items,
    nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  }
}

export async function createRca(userUid: string, input: RcaInput) {
  const firestoreClient = firestore()
  const rcaRef = doc(collection(firestoreClient, 'rcaRecords'))
  await setDoc(rcaRef, {
    schemaVersion: 1,
    propertyId: input.propertyId,
    propertyCode: input.propertyCode,
    taskId: input.task.id,
    taskTitle: `${input.task.problemCategory ? `${input.task.problemCategory} / ` : ''}${input.task.problemType} · ${input.task.location}`,
    taskCategory: input.task.problemCategory || input.task.problemType,
    taskPriority: input.task.priority,
    taskCompletedAt: input.task.updatedAt,
    incidentSummary: input.incidentSummary.trim(),
    rootCause: input.rootCause.trim(),
    contributingFactors: input.contributingFactors.trim(),
    fiveWhys: input.fiveWhys.trim(),
    impact: input.impact.trim(),
    downtimeMinutes: input.downtimeMinutes,
    correctiveAction: input.correctiveAction.trim(),
    preventiveAction: input.preventiveAction.trim(),
    ownerUid: input.ownerUid.trim(),
    dueDate: input.dueDate,
    status: 'Draft',
    createdBy: userUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return rcaRef.id
}

export async function updateRca(
  id: string,
  input: Partial<Omit<RcaInput, 'propertyId' | 'propertyCode' | 'task'>>,
  status: RcaStatus,
) {
  const firestoreClient = firestore()
  await updateDoc(doc(firestoreClient, 'rcaRecords', id), {
    ...input,
    incidentSummary: input.incidentSummary?.trim(),
    rootCause: input.rootCause?.trim(),
    contributingFactors: input.contributingFactors?.trim(),
    fiveWhys: input.fiveWhys?.trim(),
    impact: input.impact?.trim(),
    correctiveAction: input.correctiveAction?.trim(),
    preventiveAction: input.preventiveAction?.trim(),
    ownerUid: input.ownerUid?.trim(),
    status,
    updatedAt: serverTimestamp(),
  })
}
