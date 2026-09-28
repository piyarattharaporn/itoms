import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export const incidentTypes = ['CCTV', 'Network', 'ISP', 'Power', 'WiFi', 'Server', 'Update', 'Maintenance', 'Other'] as const
export const incidentImpacts = ['Low', 'Medium', 'High', 'Critical'] as const
export const incidentStatuses = ['Open', 'Monitoring', 'Restored'] as const

export type IncidentType = (typeof incidentTypes)[number]
export type IncidentImpact = (typeof incidentImpacts)[number]
export type IncidentStatus = (typeof incidentStatuses)[number]

export interface InfrastructureIncident {
  id: string
  propertyId: string
  propertyCode: string
  type: IncidentType
  title: string
  location: string
  impact: IncidentImpact
  description: string
  status: IncidentStatus
  reportedByUid: string
  startedAt: Date | null
  restoredAt: Date | null
  resolutionNotes: string
  updatedAt: Date | null
  lastEventId: string
}

export interface IncidentInput {
  propertyId: string
  propertyCode: string
  type: IncidentType
  title: string
  location: string
  impact: IncidentImpact
  description: string
}

export interface IncidentEvent {
  id: string
  actorUid: string
  fromStatus: IncidentStatus | null
  toStatus: IncidentStatus
  note: string
  createdAt: Date | null
  type: 'reported' | 'statusChanged'
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate()
  return null
}

function parseIncident(id: string, data: DocumentData): InfrastructureIncident | null {
  if (
    typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' ||
    !incidentTypes.includes(data.type) || typeof data.title !== 'string' || typeof data.location !== 'string' ||
    !incidentImpacts.includes(data.impact) || typeof data.description !== 'string' ||
    !incidentStatuses.includes(data.status) || typeof data.reportedByUid !== 'string' ||
    typeof data.resolutionNotes !== 'string' || typeof data.lastEventId !== 'string'
  ) return null

  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    type: data.type,
    title: data.title,
    location: data.location,
    impact: data.impact,
    description: data.description,
    status: data.status,
    reportedByUid: data.reportedByUid,
    startedAt: asDate(data.startedAt),
    restoredAt: asDate(data.restoredAt),
    resolutionNotes: data.resolutionNotes,
    updatedAt: asDate(data.updatedAt),
    lastEventId: data.lastEventId,
  }
}

function parseEvent(id: string, data: DocumentData): IncidentEvent | null {
  if (
    typeof data.actorUid !== 'string' ||
    !(data.fromStatus === null || incidentStatuses.includes(data.fromStatus)) ||
    !incidentStatuses.includes(data.toStatus) || typeof data.note !== 'string' ||
    (data.type !== 'reported' && data.type !== 'statusChanged')
  ) return null
  return {
    id,
    actorUid: data.actorUid,
    fromStatus: data.fromStatus,
    toStatus: data.toStatus,
    note: data.note,
    createdAt: asDate(data.createdAt),
    type: data.type,
  }
}

export function subscribeToIncidents(
  propertyId: string,
  allProperties: boolean,
  onIncidents: (incidents: InfrastructureIncident[]) => void,
  onError: () => void,
  dateRange?: { start: string; endExclusive: string },
) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  if (dateRange) {
    constraints.push(
      where('startedAt', '>=', Timestamp.fromDate(new Date(`${dateRange.start}T00:00:00+07:00`))),
      where('startedAt', '<', Timestamp.fromDate(new Date(`${dateRange.endExclusive}T00:00:00+07:00`))),
    )
  }
  constraints.push(orderBy('startedAt', 'desc'), limit(dateRange ? 500 : 100))
  return onSnapshot(query(collection(firestore(), 'infrastructureIncidents'), ...constraints), (snapshot) => {
    onIncidents(snapshot.docs.map((item) => parseIncident(item.id, item.data())).filter((item): item is InfrastructureIncident => item !== null))
  }, onError)
}

export function subscribeToIncidentEvents(
  incidentId: string,
  onEvents: (events: IncidentEvent[]) => void,
  onError: () => void,
) {
  const eventsQuery = query(collection(firestore(), 'infrastructureIncidents', incidentId, 'events'), orderBy('createdAt', 'asc'))
  return onSnapshot(eventsQuery, (snapshot) => {
    onEvents(snapshot.docs.map((item) => parseEvent(item.id, item.data())).filter((item): item is IncidentEvent => item !== null))
  }, onError)
}

function normalize(input: IncidentInput): IncidentInput {
  return {
    ...input,
    title: input.title.trim(),
    location: input.location.trim(),
    description: input.description.trim(),
  }
}

function validate(input: IncidentInput) {
  const incident = normalize(input)
  if (!incident.propertyId || !incident.propertyCode || !incident.title || !incident.location) {
    throw new Error('กรุณากรอก Property, หัวข้อเหตุขัดข้อง และ Location ให้ครบ')
  }
  if (!incidentTypes.includes(incident.type) || !incidentImpacts.includes(incident.impact)) throw new Error('ประเภทเหตุหรือ Impact ไม่ถูกต้อง')
  if (incident.title.length > 160 || incident.location.length > 160 || incident.description.length < 10 || incident.description.length > 3000) {
    throw new Error('หัวข้อ/Location ต้องไม่เกิน 160 ตัวอักษร และรายละเอียดต้องมี 10–3,000 ตัวอักษร')
  }
  return incident
}

export async function createIncident(input: IncidentInput, actorUid: string) {
  const incident = validate(input)
  const incidentRef = doc(collection(firestore(), 'infrastructureIncidents'))
  const eventRef = doc(collection(incidentRef, 'events'))
  const batch = writeBatch(firestore())
  batch.set(incidentRef, {
    ...incident,
    status: 'Open',
    reportedByUid: actorUid,
    startedAt: serverTimestamp(),
    restoredAt: null,
    resolutionNotes: '',
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id,
  })
  batch.set(eventRef, {
    actorUid,
    fromStatus: null,
    toStatus: 'Open',
    note: 'บันทึกเหตุขัดข้อง',
    type: 'reported',
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return incidentRef.id
}

export async function changeIncidentStatus(
  incident: InfrastructureIncident,
  nextStatus: IncidentStatus,
  actorUid: string,
  note: string,
) {
  const allowed = incident.status === 'Open'
    ? ['Monitoring', 'Restored']
    : incident.status === 'Monitoring'
      ? ['Open', 'Restored']
      : []
  if (!allowed.includes(nextStatus)) throw new Error('ไม่สามารถเปลี่ยนสถานะเหตุการณ์นี้ได้')

  const cleanNote = note.trim()
  if (nextStatus === 'Restored' && cleanNote.length < 5) throw new Error('กรุณาบันทึกวิธีแก้ไขอย่างน้อย 5 ตัวอักษรก่อนปิดเหตุการณ์')
  if (cleanNote.length > 1000) throw new Error('บันทึกเหตุการณ์ต้องไม่เกิน 1,000 ตัวอักษร')

  const incidentRef = doc(firestore(), 'infrastructureIncidents', incident.id)
  const eventRef = doc(collection(incidentRef, 'events'))
  const batch = writeBatch(firestore())
  batch.update(incidentRef, {
    status: nextStatus,
    restoredAt: nextStatus === 'Restored' ? serverTimestamp() : null,
    resolutionNotes: nextStatus === 'Restored' ? cleanNote : incident.resolutionNotes,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id,
  })
  batch.set(eventRef, {
    actorUid,
    fromStatus: incident.status,
    toStatus: nextStatus,
    note: cleanNote || `เปลี่ยนสถานะเป็น ${nextStatus}`,
    type: 'statusChanged',
    createdAt: serverTimestamp(),
  })
  await batch.commit()
}
