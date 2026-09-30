import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { GlobalRole, PropertyRole } from '../auth/types'
import {
  isPriority,
  isProblemType,
  isTicketStatus,
  ticketIssueAreas,
  type TicketEvent,
  type TicketRecord,
} from './types'
import { recordUsageEvent } from '../../lib/telemetry'
import type { CursorPage } from '../../lib/pagination'

export interface TicketAccess {
  uid: string
  globalRole: GlobalRole
  propertyRole?: PropertyRole
  propertyId: string
  allProperties: boolean
}

export interface AssignableEngineer {
  uid: string
  displayName: string
  propertyId: string
}

export function formatAssignableEngineerLabel(engineer: AssignableEngineer): string {
  return engineer.displayName || engineer.uid
}

function requiredFirestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return null
}

function parseTicket(id: string, data: DocumentData): TicketRecord | null {
  if (
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.requesterUid !== 'string' ||
    typeof data.requesterName !== 'string' ||
    typeof data.requesterEmail !== 'string' ||
    typeof data.department !== 'string' ||
    typeof data.location !== 'string' ||
    typeof data.assetId !== 'string' ||
    !isProblemType(data.problemType) ||
    !isPriority(data.priority) ||
    !isTicketStatus(data.status) ||
    typeof data.description !== 'string' ||
    typeof data.assignedEngineerUid !== 'string' ||
    typeof data.lastEventId !== 'string'
  )
    return null

  const storedProblemType = data.problemType
  const storedCategory = typeof data.problemCategory === 'string' ? data.problemCategory : ''
  const legacySeparator = ' / '
  const legacySeparatorIndex = storedProblemType.indexOf(legacySeparator)
  const problemCategory =
    storedCategory || (legacySeparatorIndex > 0 ? storedProblemType.slice(0, legacySeparatorIndex) : '')
  const problemType =
    !storedCategory && legacySeparatorIndex > 0
      ? storedProblemType.slice(legacySeparatorIndex + legacySeparator.length)
      : storedProblemType

  return {
    id,
    schemaVersion: data.schemaVersion === 3 ? 3 : data.schemaVersion === 2 ? 2 : 1,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    requesterUid: data.requesterUid,
    requesterName: data.requesterName,
    requesterEmail: data.requesterEmail,
    department: data.department,
    issueArea:
      typeof data.issueArea === 'string' &&
      ticketIssueAreas.includes(data.issueArea as (typeof ticketIssueAreas)[number])
        ? (data.issueArea as TicketRecord['issueArea'])
        : 'Uncategorized',
    location: data.location,
    assetId: data.assetId,
    problemCategory,
    problemType,
    channel:
      typeof data.channel === 'string' && data.channel.length > 0 && data.channel.length <= 80 ? data.channel : 'Line',
    priority: data.priority,
    status: data.status,
    description: data.description,
    resolutionNotes: typeof data.resolutionNotes === 'string' ? data.resolutionNotes : '',
    assignedEngineerUid: data.assignedEngineerUid,
    assignedAt: asDate(data.assignedAt),
    assignedByUid: typeof data.assignedByUid === 'string' ? data.assignedByUid : '',
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    completedAt: asDate(data.completedAt),
    lastEventId: data.lastEventId,
    ...(typeof data.slaPolicyId === 'string' ? { slaPolicyId: data.slaPolicyId } : {}),
    ...(typeof data.slaPolicyVersion === 'string' ? { slaPolicyVersion: data.slaPolicyVersion } : {}),
    ...(typeof data.slaResponseTargetMinutes === 'number'
      ? { slaResponseTargetMinutes: data.slaResponseTargetMinutes }
      : {}),
    ...(typeof data.slaResolutionTargetMinutes === 'number'
      ? { slaResolutionTargetMinutes: data.slaResolutionTargetMinutes }
      : {}),
    ...(data.slaStartedAt ? { slaStartedAt: asDate(data.slaStartedAt) } : {}),
    ...(data.slaResponseDueAt ? { slaResponseDueAt: asDate(data.slaResponseDueAt) } : {}),
    ...(data.slaResolutionDueAt ? { slaResolutionDueAt: asDate(data.slaResolutionDueAt) } : {}),
    ...(data.slaResponseMetAt ? { slaResponseMetAt: asDate(data.slaResponseMetAt) } : {}),
    ...(data.slaResolutionMetAt ? { slaResolutionMetAt: asDate(data.slaResolutionMetAt) } : {}),
    ...(data.slaResponseStatus === 'pending' ||
    data.slaResponseStatus === 'met' ||
    data.slaResponseStatus === 'breached' ||
    data.slaResponseStatus === 'cancelled'
      ? { slaResponseStatus: data.slaResponseStatus }
      : {}),
    ...(data.slaResolutionStatus === 'running' ||
    data.slaResolutionStatus === 'paused' ||
    data.slaResolutionStatus === 'met' ||
    data.slaResolutionStatus === 'breached' ||
    data.slaResolutionStatus === 'cancelled'
      ? { slaResolutionStatus: data.slaResolutionStatus }
      : {}),
    ...(data.slaState === 'running' ||
    data.slaState === 'paused' ||
    data.slaState === 'met' ||
    data.slaState === 'cancelled'
      ? { slaState: data.slaState }
      : {}),
    ...(data.slaPauseReason === 'Waiting for User' ||
    data.slaPauseReason === 'Waiting for Vendor' ||
    data.slaPauseReason === ''
      ? { slaPauseReason: data.slaPauseReason }
      : {}),
    ...(typeof data.slaPausedAt !== 'undefined' ? { slaPausedAt: asDate(data.slaPausedAt) } : {}),
    ...(typeof data.slaPausedMinutes === 'number' ? { slaPausedMinutes: data.slaPausedMinutes } : {}),
    ...(typeof data.slaResponseBreached === 'boolean' ? { slaResponseBreached: data.slaResponseBreached } : {}),
    ...(typeof data.slaResolutionBreached === 'boolean' ? { slaResolutionBreached: data.slaResolutionBreached } : {}),
    ...(data.slaLastEvaluatedAt ? { slaLastEvaluatedAt: asDate(data.slaLastEvaluatedAt) } : {}),
  }
}

function parseEvent(id: string, data: DocumentData): TicketEvent | null {
  if (
    typeof data.actorUid !== 'string' ||
    !isTicketStatus(data.toStatus) ||
    !(data.fromStatus === null || isTicketStatus(data.fromStatus)) ||
    typeof data.note !== 'string' ||
    !['created', 'statusChanged', 'assigned', 'reassigned', 'unassigned', 'edited'].includes(data.type)
  )
    return null

  return {
    id,
    actorUid: data.actorUid,
    fromStatus: data.fromStatus,
    toStatus: data.toStatus,
    note: data.note,
    createdAt: asDate(data.createdAt),
    type: data.type,
    ...(typeof data.fromAssignedEngineerUid === 'string'
      ? { fromAssignedEngineerUid: data.fromAssignedEngineerUid }
      : {}),
    ...(typeof data.toAssignedEngineerUid === 'string' ? { toAssignedEngineerUid: data.toAssignedEngineerUid } : {}),
    ...(Array.isArray(data.changedFields)
      ? { changedFields: data.changedFields.filter((value): value is string => typeof value === 'string') }
      : {}),
  }
}

export type TicketPageCursor = QueryDocumentSnapshot<DocumentData> | null

export async function getTicketPage(
  access: TicketAccess,
  pageSize = 25,
  cursor: TicketPageCursor = null,
): Promise<CursorPage<TicketRecord>> {
  const firestore = requiredFirestore()
  pageSize = Math.min(Math.max(pageSize, 1), 50)
  const constraints: QueryConstraint[] = []
  if (!access.allProperties) constraints.push(where('propertyId', '==', access.propertyId))
  if (access.propertyRole === 'requester') constraints.push(where('requesterUid', '==', access.uid))
  constraints.push(orderBy('createdAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  const snapshot = await getDocs(query(collection(firestore, 'tickets'), ...constraints))
  recordUsageEvent('ticket_page_loaded', { count: snapshot.size, pageSize })
  return {
    items: snapshot.docs
      .map((ticket) => parseTicket(ticket.id, ticket.data()))
      .filter((ticket): ticket is TicketRecord => ticket !== null),
    nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  }
}

/** Bounded completed-task feed used by RCA review. Search/filter remains client-side
 * within the loaded page until the trusted backend provides server-side search. */
export async function getCompletedTicketPage(
  access: TicketAccess,
  pageSize = 25,
  cursor: TicketPageCursor = null,
): Promise<CursorPage<TicketRecord>> {
  const firestore = requiredFirestore()
  pageSize = Math.min(Math.max(pageSize, 1), 50)
  const constraints: QueryConstraint[] = [where('status', '==', 'Completed')]
  if (!access.allProperties) constraints.push(where('propertyId', '==', access.propertyId))
  constraints.push(orderBy('updatedAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  const snapshot = await getDocs(query(collection(firestore, 'tickets'), ...constraints))
  const items = snapshot.docs
    .map((ticket) => parseTicket(ticket.id, ticket.data()))
    .filter((ticket): ticket is TicketRecord => ticket !== null)
  recordUsageEvent('completed_ticket_page_loaded', { count: items.length, pageSize })
  return {
    items,
    nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  }
}

export function subscribeToTickets(
  access: TicketAccess,
  onTickets: (tickets: TicketRecord[]) => void,
  onError: (error: Error) => void,
) {
  const firestore = requiredFirestore()
  const constraints: QueryConstraint[] = []

  if (!access.allProperties) constraints.push(where('propertyId', '==', access.propertyId))
  if (access.propertyRole === 'requester') constraints.push(where('requesterUid', '==', access.uid))
  constraints.push(orderBy('createdAt', 'desc'), limit(50))

  const ticketQuery = query(collection(firestore, 'tickets'), ...constraints)
  return onSnapshot(
    ticketQuery,
    (snapshot) => {
      onTickets(
        snapshot.docs
          .map((ticket) => parseTicket(ticket.id, ticket.data()))
          .filter((ticket): ticket is TicketRecord => ticket !== null),
      )
    },
    (cause) =>
      onError(
        new Error(
          cause.code === 'permission-denied'
            ? 'Firestore Rules ปฏิเสธการอ่าน Task ตรวจสอบสิทธิ์ Property'
            : 'โหลด Task ไม่สำเร็จ',
        ),
      ),
  )
}

export function subscribeToTicketEvents(
  ticketId: string,
  onEvents: (events: TicketEvent[]) => void,
  onError: (error: Error) => void,
) {
  const firestore = requiredFirestore()
  const eventsQuery = query(collection(firestore, 'tickets', ticketId, 'events'), orderBy('createdAt', 'asc'))
  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      onEvents(
        snapshot.docs
          .map((event) => parseEvent(event.id, event.data()))
          .filter((event): event is TicketEvent => event !== null),
      )
    },
    () => onError(new Error('โหลดประวัติ Task ไม่สำเร็จ')),
  )
}

export async function getAssignableEngineers(propertyId: string | 'all', includeUserProfiles = false) {
  const firestore = requiredFirestore()
  const constraints =
    propertyId === 'all'
      ? [where('role', '==', 'supportEngineer'), where('active', '==', true), limit(200)]
      : [
          where('propertyId', '==', propertyId),
          where('role', '==', 'supportEngineer'),
          where('active', '==', true),
          orderBy('userId', 'asc'),
          limit(50),
        ]
  const snapshot = await getDocs(query(collection(firestore, 'memberships'), ...constraints))
  const candidates = snapshot.docs
    .map((item) => {
      const data = item.data()
      if (typeof data.userId !== 'string' || typeof data.propertyId !== 'string') return null
      return {
        uid: data.userId,
        displayName:
          typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : data.userId,
        propertyId: data.propertyId,
      }
    })
    .filter((engineer): engineer is AssignableEngineer => engineer !== null)

  if (includeUserProfiles) {
    const resolved = await Promise.all(
      candidates.map(async (engineer) => {
        if (engineer.displayName !== engineer.uid) return engineer
        try {
          const profile = await getDoc(doc(firestore, 'users', engineer.uid))
          const displayName = profile.data()?.displayName
          return typeof displayName === 'string' && displayName.trim()
            ? { ...engineer, displayName: displayName.trim() }
            : engineer
        } catch {
          return engineer
        }
      }),
    )
    return resolved.sort((left, right) => left.displayName.localeCompare(right.displayName, 'en'))
  }

  return candidates.sort((left, right) => left.displayName.localeCompare(right.displayName, 'en'))
}
