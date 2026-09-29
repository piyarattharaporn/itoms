import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export interface ActivityRecord {
  id: string
  entityId: string
  propertyId: string
  propertyCode: string
  title: string
  actorUid: string
  fromStatus: string | null
  toStatus: string
  note: string
  action: string
  createdAt: Date | null
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function')
    return value.toDate()
  return null
}

async function latestTicketEvents(documents: DocumentData[], eventCache: Map<string, DocumentData | null>) {
  return Promise.all(
    documents.map(async (item) => {
      if (typeof item.id !== 'string' || typeof item.lastEventId !== 'string' || !item.lastEventId) return null
      const cacheKey = `${item.id}/${item.lastEventId}`
      let event = eventCache.get(cacheKey)
      if (event === undefined) {
        const eventRef = doc(firestore(), 'tickets', item.id, 'events', item.lastEventId)
        const snapshot = await getDoc(eventRef)
        event = snapshot.exists() ? snapshot.data() : null
        eventCache.set(cacheKey, event)
      }
      if (!event) return null
      if (typeof event.actorUid !== 'string' || typeof event.toStatus !== 'string' || typeof event.note !== 'string')
        return null
      if (!(event.fromStatus === null || typeof event.fromStatus === 'string')) return null
      if (
        typeof item.propertyId !== 'string' ||
        typeof item.propertyCode !== 'string' ||
        typeof item.problemType !== 'string'
      )
        return null
      return {
        id: `ticket-${item.id}-${item.lastEventId}`,
        entityId: item.id,
        propertyId: item.propertyId,
        propertyCode: item.propertyCode,
        title: `${typeof item.problemCategory === 'string' && item.problemCategory ? `${item.problemCategory} / ` : ''}${item.problemType} · ${typeof item.location === 'string' ? item.location : 'ไม่ระบุสถานที่'}`,
        actorUid: event.actorUid,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        action: event.type === 'created' ? 'สร้าง Task' : 'อัปเดต Task',
        createdAt: asDate(event.createdAt),
      } satisfies ActivityRecord
    }),
  )
}

export function subscribeToActivityLog(
  propertyId: string,
  allProperties: boolean,
  onActivities: (items: ActivityRecord[]) => void,
  onError: () => void,
) {
  const dbClient = firestore()
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('updatedAt', 'desc'), limit(50))

  let documents: DocumentData[] = []
  // Ticket events are immutable. Cache the latest event per ticket revision so
  // a parent-ticket snapshot does not repeat the same N+1 reads on every update.
  const eventCache = new Map<string, DocumentData | null>()
  let revision = 0
  let stopped = false
  async function refresh() {
    const currentRevision = ++revision
    try {
      const activities = await latestTicketEvents(documents, eventCache)
      if (stopped || currentRevision !== revision) return
      onActivities(
        activities
          .filter((item): item is ActivityRecord => item !== null)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      )
    } catch {
      if (!stopped && currentRevision === revision) onError()
    }
  }

  const unsubscribe = onSnapshot(
    query(collection(dbClient, 'tickets'), ...constraints),
    (snapshot) => {
      documents = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))
      void refresh()
    },
    onError,
  )
  return () => {
    stopped = true
    unsubscribe()
  }
}
