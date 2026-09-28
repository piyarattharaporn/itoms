import {
  collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, writeBatch,
  updateDoc, where, type DocumentData, type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export type TodoKind = string
export type TodoRepeat = 'None' | 'Weekly' | 'Monthly'

export interface OperationalTodo {
  id: string
  propertyId: string
  propertyCode: string
  title: string
  kind: TodoKind
  startDate: string
  dueTime: string
  room: string
  assignee: string
  repeat: TodoRepeat
  checklistText: string
  active: boolean
  createdBy: string
  createdAt: Date | null
  updatedAt: Date | null
}

export interface OperationalTodoCompletion {
  id: string
  taskId: string
  propertyId: string
  propertyCode: string
  occurrenceDate: string
  completed: boolean
  completedByUid: string
  completedAt: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}

export interface OperationalTodoInput {
  title: string
  kind: TodoKind
  startDate: string
  dueTime: string
  room: string
  assignee: string
  repeat: TodoRepeat
  checklistText: string
}

export interface OperationalTodoSettings {
  propertyId: string
  propertyCode: string
  meetingRoomCareEnabled: boolean
  updatedBy: string
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate()
  return null
}

function parseTodo(id: string, data: DocumentData): OperationalTodo | null {
  if (typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' ||
    typeof data.title !== 'string' || typeof data.kind !== 'string' || !data.kind.trim() || data.kind.length > 80 ||
    typeof data.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) ||
    typeof data.dueTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.dueTime) ||
    typeof data.room !== 'string' || typeof data.assignee !== 'string' ||
    !['None', 'Weekly', 'Monthly'].includes(data.repeat) || typeof data.checklistText !== 'string' ||
    typeof data.active !== 'boolean' || typeof data.createdBy !== 'string') return null
  return {
    id, propertyId: data.propertyId, propertyCode: data.propertyCode, title: data.title, kind: data.kind,
    startDate: data.startDate, dueTime: data.dueTime, room: data.room, assignee: data.assignee,
    repeat: data.repeat, checklistText: data.checklistText, active: data.active, createdBy: data.createdBy,
    createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt),
  }
}

function parseCompletion(id: string, data: DocumentData): OperationalTodoCompletion | null {
  if (typeof data.taskId !== 'string' || typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' ||
    typeof data.occurrenceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.occurrenceDate) ||
    typeof data.completed !== 'boolean' || typeof data.completedByUid !== 'string') return null
  return {
    id, taskId: data.taskId, propertyId: data.propertyId, propertyCode: data.propertyCode,
    occurrenceDate: data.occurrenceDate, completed: data.completed, completedByUid: data.completedByUid,
    completedAt: asDate(data.completedAt), createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt),
  }
}

export function bangkokDateOnly(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function shiftTodoDate(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function todoOccursOn(todo: OperationalTodo, dateOnly: string) {
  if (!todo.active || dateOnly < todo.startDate) return false
  if (todo.repeat === 'None') return dateOnly === todo.startDate
  const [startYear, startMonth, startDay] = todo.startDate.split('-').map(Number)
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (todo.repeat === 'Weekly') {
    const elapsedDays = (Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(`${todo.startDate}T00:00:00Z`)) / 86_400_000
    return elapsedDays >= 0 && elapsedDays % 7 === 0
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return year * 12 + month >= startYear * 12 + startMonth && day === Math.min(startDay, lastDay)
}

export function todoCompletionId(taskId: string, dateOnly: string) {
  return `${taskId}__${dateOnly}`
}

export function canEditTodoOccurrence(todo: OperationalTodo, occurrenceDate: string, now = Date.now()) {
  const startsAt = Date.parse(`${occurrenceDate}T${todo.dueTime}:00+07:00`)
  return Number.isFinite(startsAt) && now < startsAt
}

export function subscribeToOperationalTodos(propertyId: string, allProperties: boolean, onTodos: (items: OperationalTodo[]) => void, onError: () => void) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('startDate', 'desc'), limit(1000))
  return onSnapshot(query(collection(firestore(), 'operationalTodos'), ...constraints), (snapshot) => {
    onTodos(snapshot.docs.map((item) => parseTodo(item.id, item.data())).filter((item): item is OperationalTodo => item !== null))
  }, onError)
}

export function subscribeToOperationalTodoCompletions(
  propertyId: string,
  allProperties: boolean,
  fromDate: string,
  throughDate: string,
  onCompletions: (items: OperationalTodoCompletion[]) => void,
  onError: () => void,
) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(where('occurrenceDate', '>=', fromDate), where('occurrenceDate', '<=', throughDate), limit(1000))
  return onSnapshot(query(collection(firestore(), 'operationalTodoCompletions'), ...constraints), (snapshot) => {
    onCompletions(snapshot.docs.map((item) => parseCompletion(item.id, item.data())).filter((item): item is OperationalTodoCompletion => item !== null))
  }, onError)
}

export function subscribeToOperationalTodoSettings(propertyId: string, onSettings: (settings: OperationalTodoSettings | null) => void, onError: () => void) {
  return onSnapshot(doc(firestore(), 'operationalTodoSettings', propertyId), (snapshot) => {
    if (!snapshot.exists()) { onSettings(null); return }
    const data = snapshot.data()
    if (data.propertyId !== propertyId || typeof data.propertyCode !== 'string' || typeof data.meetingRoomCareEnabled !== 'boolean' || typeof data.updatedBy !== 'string') {
      onError(); return
    }
    onSettings({ propertyId, propertyCode: data.propertyCode, meetingRoomCareEnabled: data.meetingRoomCareEnabled, updatedBy: data.updatedBy })
  }, onError)
}

export async function createOperationalTodo(propertyId: string, propertyCode: string, input: OperationalTodoInput, actorUid: string) {
  const value = validateTodoInput(input)
  if (!propertyId.trim() || !propertyCode.trim() || !actorUid) throw new Error('Property/user is required')
  const reference = doc(collection(firestore(), 'operationalTodos'))
  const batch = writeBatch(firestore())
  batch.set(reference, { ...value, propertyId: propertyId.trim(), propertyCode: propertyCode.trim(), active: true, createdBy: actorUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  await batch.commit()
  return reference.id
}

function normalizedTodoInput(input: OperationalTodoInput) {
  return {
    title: input.title.trim(), kind: input.kind, startDate: input.startDate, dueTime: input.dueTime,
    room: input.kind === 'Meeting Room' ? input.room.trim() : '', assignee: input.assignee.trim(), repeat: input.repeat,
    checklistText: input.kind === 'Meeting Room' ? input.checklistText.trim() : '',
  }
}

function validateTodoInput(input: OperationalTodoInput) {
  const value = normalizedTodoInput(input)
  if (!value.title || value.title.length > 160 || !value.assignee || value.assignee.length > 120 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.startDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.dueTime) ||
    value.kind.length > 80 || value.room.length > 120 || value.checklistText.length > 1200 || (value.kind === 'Meeting Room' && !value.room)) {
    throw new Error('กรุณาตรวจสอบชื่อ วันที่ เวลา ผู้รับผิดชอบ และห้องประชุม')
  }
  return value
}

export async function updateOperationalTodo(todo: OperationalTodo, occurrenceDate: string, input: OperationalTodoInput) {
  if (!canEditTodoOccurrence(todo, occurrenceDate)) throw new Error('This task occurrence has already started')
  const value = validateTodoInput(input)
  await updateDoc(doc(firestore(), 'operationalTodos', todo.id), { ...value, updatedAt: serverTimestamp() })
}

export async function archiveOperationalTodo(todoId: string) {
  await updateDoc(doc(firestore(), 'operationalTodos', todoId), { active: false, updatedAt: serverTimestamp() })
}

export async function setOperationalTodoCompletion(todo: OperationalTodo, occurrenceDate: string, completed: boolean, actorUid: string) {
  const database = firestore()
  const reference = doc(database, 'operationalTodoCompletions', todoCompletionId(todo.id, occurrenceDate))
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (snapshot.exists()) {
      const existing = snapshot.data()
      if (existing.taskId !== todo.id || existing.propertyId !== todo.propertyId || existing.occurrenceDate !== occurrenceDate) throw new Error('Completion record mismatch')
      transaction.update(reference, {
        completed, completedByUid: completed ? actorUid : '', completedAt: completed ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
      return
    }
    if (!completed) return
    transaction.set(reference, {
      taskId: todo.id, propertyId: todo.propertyId, propertyCode: todo.propertyCode, occurrenceDate,
      completed: true, completedByUid: actorUid, completedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  })
}

export async function saveOperationalTodoSettings(propertyId: string, propertyCode: string, meetingRoomCareEnabled: boolean, actorUid: string) {
  const database = firestore()
  const reference = doc(database, 'operationalTodoSettings', propertyId)
  await runTransaction(database, async (transaction) => {
    const snapshot = await transaction.get(reference)
    if (snapshot.exists()) {
      if (snapshot.data().propertyCode !== propertyCode) throw new Error('Property code mismatch')
      transaction.update(reference, { meetingRoomCareEnabled, updatedBy: actorUid, updatedAt: serverTimestamp() })
      return
    }
    transaction.set(reference, {
      propertyId, propertyCode, meetingRoomCareEnabled, updatedBy: actorUid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  })
}
