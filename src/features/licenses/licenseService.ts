import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { CursorPage } from '../../lib/pagination'

export const licenseTypes = ['Subscription', 'Maintenance', 'Support', 'Perpetual'] as const
export const licenseStatuses = ['Active', 'Renewal In Progress', 'Not Renewing'] as const
export type LicenseType = (typeof licenseTypes)[number]
export type LicenseStatus = (typeof licenseStatuses)[number]

export interface SoftwareLicense {
  id: string
  propertyId: string
  propertyCode: string
  productName: string
  vendor: string
  licenseType: LicenseType
  expiresOn: string
  quantity: number
  renewalOwner: string
  status: LicenseStatus
  notes: string
}

export type SoftwareLicenseInput = Omit<SoftwareLicense, 'id'>
export type LicensePageCursor = QueryDocumentSnapshot<DocumentData> | null

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseLicense(id: string, data: DocumentData): SoftwareLicense | null {
  if (
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.productName !== 'string' ||
    typeof data.vendor !== 'string' ||
    !licenseTypes.includes(data.licenseType) ||
    !isDateOnly(data.expiresOn) ||
    typeof data.quantity !== 'number' ||
    !Number.isInteger(data.quantity) ||
    typeof data.renewalOwner !== 'string' ||
    !licenseStatuses.includes(data.status) ||
    typeof data.notes !== 'string'
  )
    return null
  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    productName: data.productName,
    vendor: data.vendor,
    licenseType: data.licenseType,
    expiresOn: data.expiresOn,
    quantity: data.quantity,
    renewalOwner: data.renewalOwner,
    status: data.status,
    notes: data.notes,
  }
}

export async function getLicensePage(
  propertyId: string,
  allProperties: boolean,
  pageSize = 25,
  cursor: LicensePageCursor = null,
): Promise<CursorPage<SoftwareLicense>> {
  const boundedPageSize = Math.min(Math.max(pageSize, 1), 50)
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('expiresOn', 'asc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(boundedPageSize))
  const snapshot = await getDocs(query(collection(firestore(), 'softwareLicenses'), ...constraints))
  const items = snapshot.docs
    .map((item) => parseLicense(item.id, item.data()))
    .filter((item): item is SoftwareLicense => item !== null)
  return {
    items,
    nextCursor: snapshot.docs.length === boundedPageSize ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === boundedPageSize,
  }
}

export function subscribeToLicenses(
  propertyId: string,
  allProperties: boolean,
  onLicenses: (licenses: SoftwareLicense[]) => void,
  onError: () => void,
) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('expiresOn', 'asc'), limit(200))
  return onSnapshot(
    query(collection(firestore(), 'softwareLicenses'), ...constraints),
    (snapshot) => {
      onLicenses(
        snapshot.docs
          .map((item) => parseLicense(item.id, item.data()))
          .filter((item): item is SoftwareLicense => item !== null),
      )
    },
    onError,
  )
}

function validate(input: SoftwareLicenseInput): SoftwareLicenseInput {
  // สร้าง payload จาก field ที่อนุญาตชัดเจน ป้องกัน metadata เช่น document id
  // ที่มากับหน้าแก้ไขหลุดเข้าไปใน Firestore และชนกับ Security Rules
  const value: SoftwareLicenseInput = {
    propertyId: input.propertyId.trim(),
    propertyCode: input.propertyCode.trim(),
    productName: input.productName.trim(),
    vendor: input.vendor.trim(),
    licenseType: input.licenseType,
    expiresOn: input.expiresOn.trim(),
    quantity: input.quantity,
    renewalOwner: input.renewalOwner.trim(),
    status: input.status,
    notes: input.notes.trim(),
  }
  if (!value.propertyId || !value.propertyCode || !value.productName || !value.vendor || !value.expiresOn) {
    throw new Error('กรุณากรอก Property, ชื่อ License, Vendor และวันหมดอายุให้ครบ')
  }
  if (
    !licenseTypes.includes(value.licenseType) ||
    !licenseStatuses.includes(value.status) ||
    !isDateOnly(value.expiresOn)
  ) {
    throw new Error('ข้อมูลประเภทหรือวันหมดอายุไม่ถูกต้อง')
  }
  if (!Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 100000)
    throw new Error('จำนวน License ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 100,000')
  if (
    value.productName.length > 160 ||
    value.vendor.length > 160 ||
    value.renewalOwner.length > 160 ||
    value.notes.length > 1000
  ) {
    throw new Error('ข้อมูลบางช่องยาวเกินกำหนด')
  }
  return value
}

export async function createLicense(input: SoftwareLicenseInput, actorUid: string) {
  const license = validate(input)
  const ref = doc(collection(firestore(), 'softwareLicenses'))
  await writeBatch(firestore())
    .set(ref, { ...license, createdBy: actorUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    .commit()
  return ref.id
}

export async function updateLicense(id: string, input: SoftwareLicenseInput) {
  const license = validate(input)
  await writeBatch(firestore())
    .update(doc(firestore(), 'softwareLicenses', id), { ...license, updatedAt: serverTimestamp() })
    .commit()
}

export function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function daysUntilExpiry(expiresOn: string) {
  const today = bangkokToday()
  const todayMs = Date.parse(`${today}T00:00:00.000Z`)
  const expiresMs = Date.parse(`${expiresOn}T00:00:00.000Z`)
  return Math.round((expiresMs - todayMs) / 86_400_000)
}
