import { collection, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { CursorPage } from '../../lib/pagination'
import { recordUsageEvent } from '../../lib/telemetry'

export type AuditAction = 'created' | 'statusChanged' | 'assigned' | 'reassigned' | 'unassigned'

export interface AuditRecord {
  id: string
  propertyId: string
  propertyCode: string
  entityType: string
  entityId: string
  action: AuditAction
  sourceEventId: string
  actorUid: string
  summary: string
  correlationId: string
  createdAt: Date | null
}

export interface AuditAccess { uid: string; propertyId: string; allProperties: boolean; isSuperAdmin: boolean }
export type AuditPageCursor = QueryDocumentSnapshot<DocumentData> | null

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate() : null
}

function parseAudit(id: string, data: DocumentData): AuditRecord | null {
  if (typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' || typeof data.entityType !== 'string' || typeof data.entityId !== 'string' || typeof data.actorUid !== 'string' || typeof data.summary !== 'string' || !['created', 'statusChanged', 'assigned', 'reassigned', 'unassigned'].includes(data.action)) return null
  return { id, propertyId: data.propertyId, propertyCode: data.propertyCode, entityType: data.entityType, entityId: data.entityId, sourceEventId: typeof data.sourceEventId === 'string' ? data.sourceEventId : '', action: data.action, actorUid: data.actorUid, summary: data.summary, correlationId: typeof data.correlationId === 'string' ? data.correlationId : '', createdAt: asDate(data.createdAt) }
}

export async function getAuditPage(access: AuditAccess, pageSize = 30, cursor: AuditPageCursor = null): Promise<CursorPage<AuditRecord>> {
  pageSize = Math.min(Math.max(pageSize, 1), 50)
  const constraints = [] as Parameters<typeof query>[1][]
  if (!access.allProperties) constraints.push(where('propertyId', '==', access.propertyId))
  constraints.push(orderBy('createdAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(pageSize))
  const snapshot = await getDocs(query(collection(firestore(), 'auditEvents'), ...constraints))
  const items = snapshot.docs.map((item) => parseAudit(item.id, item.data())).filter((item): item is AuditRecord => item !== null)
  recordUsageEvent('audit_page_loaded', { count: items.length, pageSize })
  return { items, nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null, hasMore: snapshot.docs.length === pageSize }
}
