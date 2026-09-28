import { collection, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, type DocumentData, type QueryConstraint } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export interface RequestUserRecord {
  id: string
  propertyId: string
  propertyCode: string
  email: string
  name: string | null
  department: string
  active: boolean
  createdAt: Date | null
}

export interface RequestUserInput {
  propertyId: string
  propertyCode: string
  email: string
  name?: string | null
  department: string
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้ตั้งค่า กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate()
  return null
}

function parseRequestUser(id: string, data: DocumentData): RequestUserRecord | null {
  if (
    typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' ||
    typeof data.email !== 'string' || typeof data.department !== 'string' ||
    typeof data.active !== 'boolean'
  ) return null
  return { id, propertyId: data.propertyId, propertyCode: data.propertyCode, email: data.email, name: typeof data.name === 'string' && data.name ? data.name : null, department: data.department, active: data.active, createdAt: asDate(data.createdAt) }
}

export function subscribeToRequestUsers(propertyId: string, allProperties: boolean, onUsers: (users: RequestUserRecord[]) => void, onError: () => void) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('createdAt', 'desc'), limit(200))
  return onSnapshot(query(collection(firestore(), 'requestUsers'), ...constraints), (snapshot) => {
    onUsers(snapshot.docs.map((item) => parseRequestUser(item.id, item.data())).filter((item): item is RequestUserRecord => item !== null))
  }, onError)
}

function normalize(input: RequestUserInput): RequestUserInput {
  const email = input.email.trim().toLocaleLowerCase()
  const name = input.name?.trim() || null
  if (!input.propertyId || !input.propertyCode || !input.department.trim()) throw new Error('กรุณาเลือก Property และแผนก')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('กรุณากรอก Email ให้ถูกต้อง')
  if (name && name.length > 120) throw new Error('ชื่อต้องไม่เกิน 120 ตัวอักษร')
  return { propertyId: input.propertyId, propertyCode: input.propertyCode, email, name, department: input.department.trim() }
}

function requestUserId(propertyId: string, email: string) {
  // ID ผูกกับอีเมลต่อ Property เพื่อป้องกันลงทะเบียนซ้ำในขอบเขตเดียวกัน
  return `${propertyId}__${encodeURIComponent(email)}`
}

export async function createRequestUser(input: RequestUserInput, actorUid: string) {
  if (!actorUid) throw new Error('กรุณาเข้าสู่ระบบใหม่')
  const user = normalize(input)
  const ref = doc(firestore(), 'requestUsers', requestUserId(user.propertyId, user.email))
  await runTransaction(firestore(), async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists()) throw new Error('Email นี้อยู่ในรายการของ Property นี้แล้ว')
    transaction.set(ref, { ...user, active: true, createdBy: actorUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  })
}

export async function setRequestUserActive(id: string, active: boolean) {
  await runTransaction(firestore(), async (transaction) => {
    const ref = doc(firestore(), 'requestUsers', id)
    const existing = await transaction.get(ref)
    if (!existing.exists()) throw new Error('ไม่พบ Request User รายการนี้')
    transaction.update(ref, { active, updatedAt: serverTimestamp() })
  })
}

export async function updateRequestUserName(id: string, name: string) {
  const normalizedName = name.trim()
  if (normalizedName.length > 120) throw new Error('ชื่อต้องไม่เกิน 120 ตัวอักษร')
  await updateDoc(doc(firestore(), 'requestUsers', id), {
    name: normalizedName || null,
    updatedAt: serverTimestamp(),
  })
}
