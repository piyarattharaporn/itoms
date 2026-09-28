import {
  collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  where, writeBatch, type DocumentData, type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export type PmFrequency = 'Weekly' | 'Monthly' | 'Quarterly'
export type PmOutcome = 'Completed' | 'Needs Attention'

export interface PmSchedule {
  id: string
  propertyId: string
  propertyCode: string
  title: string
  location: string
  frequency: PmFrequency
  checklistItems: string[]
  nextDueOn: string
  active: boolean
  createdBy: string
  lastRunOn: string
  lastRunId: string
}

export interface PmScheduleInput {
  propertyId: string
  propertyCode: string
  title: string
  location: string
  frequency: PmFrequency
  checklistItems: string[]
  nextDueOn: string
  active: boolean
}

export interface PmChecklistResult {
  item: string
  checked: boolean
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function isFrequency(value: unknown): value is PmFrequency {
  return value === 'Weekly' || value === 'Monthly' || value === 'Quarterly'
}

function parseSchedule(id: string, data: DocumentData): PmSchedule | null {
  if (
    typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' ||
    typeof data.title !== 'string' || typeof data.location !== 'string' ||
    !isFrequency(data.frequency) || !Array.isArray(data.checklistItems) ||
    !data.checklistItems.every((item: unknown) => typeof item === 'string') ||
    typeof data.nextDueOn !== 'string' || typeof data.active !== 'boolean' ||
    typeof data.createdBy !== 'string' || typeof data.lastRunOn !== 'string' ||
    typeof data.lastRunId !== 'string'
  ) return null
  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    title: data.title,
    location: data.location,
    frequency: data.frequency,
    checklistItems: data.checklistItems,
    nextDueOn: data.nextDueOn,
    active: data.active,
    createdBy: data.createdBy,
    lastRunOn: data.lastRunOn,
    lastRunId: data.lastRunId,
  }
}

export function subscribeToSchedules(propertyId: string, allProperties: boolean, onSchedules: (items: PmSchedule[]) => void, onError: () => void) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('nextDueOn', 'asc'), limit(100))
  return onSnapshot(query(collection(firestore(), 'pmSchedules'), ...constraints), (snapshot) => {
    onSchedules(snapshot.docs.map((item) => parseSchedule(item.id, item.data())).filter((item): item is PmSchedule => item !== null))
  }, onError)
}

function validateSchedule(input: PmScheduleInput): PmScheduleInput {
  const schedule = {
    ...input,
    propertyCode: input.propertyCode.trim(),
    title: input.title.trim(),
    location: input.location.trim(),
    checklistItems: input.checklistItems.map((item) => item.trim()).filter(Boolean),
  }
  if (!schedule.propertyId || !schedule.propertyCode || !schedule.title || !schedule.nextDueOn) throw new Error('กรุณากรอก Property, ชื่องาน และวันกำหนด PM')
  if (schedule.title.length > 160 || schedule.location.length > 160) throw new Error('ชื่อหรือ Location ยาวเกินกำหนด')
  if (schedule.checklistItems.length < 1 || schedule.checklistItems.length > 10) throw new Error('Checklist ต้องมี 1–10 รายการในรุ่นปัจจุบัน')
  if (schedule.checklistItems.some((item) => item.length > 200)) throw new Error('Checklist แต่ละรายการต้องไม่เกิน 200 ตัวอักษร')
  if (!isFrequency(schedule.frequency)) throw new Error('รอบ PM ไม่ถูกต้อง')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(schedule.nextDueOn)) throw new Error('รูปแบบวันกำหนด PM ไม่ถูกต้อง')
  return schedule
}

export async function createSchedule(input: PmScheduleInput, actorUid: string) {
  const schedule = validateSchedule(input)
  const ref = doc(collection(firestore(), 'pmSchedules'))
  await writeBatch(firestore()).set(ref, {
    ...schedule,
    createdBy: actorUid,
    lastRunOn: '',
    lastRunId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).commit()
  return ref.id
}

export async function updateSchedule(scheduleId: string, input: PmScheduleInput) {
  const schedule = validateSchedule(input)
  const ref = doc(firestore(), 'pmSchedules', scheduleId)
  await writeBatch(firestore()).update(ref, { ...schedule, updatedAt: serverTimestamp() }).commit()
}

function nextDate(current: string, frequency: PmFrequency): string {
  const [year, month, day] = current.split('-').map(Number)
  const monthDelta = frequency === 'Weekly' ? 0 : frequency === 'Monthly' ? 1 : 3
  if (frequency === 'Weekly') {
    const date = new Date(Date.UTC(year, month - 1, day + 7, 12))
    return date.toISOString().slice(0, 10)
  }
  const targetMonth = month - 1 + monthDelta
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = targetMonth % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

export async function completeSchedule(
  schedule: PmSchedule,
  actorUid: string,
  checklistResults: PmChecklistResult[],
  notes: string,
) {
  const firestoreDb = firestore()
  if (checklistResults.length !== schedule.checklistItems.length) throw new Error('Checklist ไม่ตรงกับ PM Schedule')
  const scheduleRef = doc(firestoreDb, 'pmSchedules', schedule.id)
  const runRef = doc(collection(scheduleRef, 'runs'))

  await runTransaction(firestoreDb, async (transaction) => {
    const snapshot = await transaction.get(scheduleRef)
    if (!snapshot.exists()) throw new Error('ไม่พบ PM Schedule นี้')
    const current = parseSchedule(snapshot.id, snapshot.data())
    if (!current || !current.active) throw new Error('PM Schedule นี้ถูกปิดใช้งาน')
    if (current.nextDueOn !== schedule.nextDueOn) throw new Error('มีผู้บันทึก PM รอบนี้ไปแล้ว กรุณาโหลดข้อมูลล่าสุด')

    const checkedValues = checklistResults.map((item, index) => {
      if (item.item !== current.checklistItems[index] || typeof item.checked !== 'boolean') {
        throw new Error('ผล Checklist ไม่ตรงกับ PM Schedule')
      }
      return item.checked
    })
    const outcome: PmOutcome = checkedValues.every(Boolean) ? 'Completed' : 'Needs Attention'
    transaction.set(runRef, {
      propertyId: current.propertyId,
      propertyCode: current.propertyCode,
      scheduleTitle: current.title,
      dueOn: current.nextDueOn,
      checklistItems: current.checklistItems,
      performedBy: actorUid,
      completedOn: serverTimestamp(),
      outcome,
      checklistResults: checkedValues,
      notes: notes.trim(),
    })
    transaction.update(scheduleRef, {
      lastRunOn: current.nextDueOn,
      lastRunId: runRef.id,
      nextDueOn: nextDate(current.nextDueOn, current.frequency),
      updatedAt: serverTimestamp(),
    })
  })
  return runRef.id
}
