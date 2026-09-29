import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

export interface CctvDailyCheck {
  id: string
  propertyId: string
  propertyCode: string
  checkedOn: string
  nvrTotal: number
  nvrOnline: number
  cameraTotal: number
  cameraOnline: number
  nvrDetails: CctvNvrDetail[]
  notes: string
  checkedByUid: string
  checkedAt: Date | null
}

export interface CctvNvrDailyCheck extends CctvNvrDetail {
  id: string
  propertyId: string
  propertyCode: string
  checkedOn: string
  checkedByUid: string
  checkedAt: Date | null
}

export interface CctvNvrDetail {
  nvrId: string
  nvrName?: string
  location?: string
  online: boolean
  cameraTotal: number
  cameraOnline: number
  retentionDays: number
  oldestFootageOn?: string
  targetRetentionDays?: number
  notes: string
}

export interface CctvNvrInventoryItem {
  id: string
  propertyId: string
  propertyCode: string
  name: string
  location: string
  cameraTotal: number
  targetRetentionDays: number
  active: boolean
}

export type CctvNvrInventoryInput = Omit<CctvNvrInventoryItem, 'id'>

export type CctvDailyCheckInput = Omit<CctvDailyCheck, 'id' | 'checkedByUid' | 'checkedAt'>

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function')
    return value.toDate()
  return null
}

export function retentionDaysFromOldestDate(checkedOn: string, oldestFootageOn: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(oldestFootageOn)) return null
  const checked = new Date(`${checkedOn}T00:00:00Z`)
  const oldest = new Date(`${oldestFootageOn}T00:00:00Z`)
  if (
    checked.toISOString().slice(0, 10) !== checkedOn ||
    oldest.toISOString().slice(0, 10) !== oldestFootageOn ||
    oldest > checked
  )
    return null
  return Math.floor((checked.getTime() - oldest.getTime()) / 86400000)
}

function normalizeNvrDetail(nvr: CctvNvrDetail): CctvNvrDetail {
  const normalized = {
    ...nvr,
    nvrId: nvr.nvrId.trim(),
    notes: nvr.notes.trim(),
  }
  if (!normalized.oldestFootageOn) delete normalized.oldestFootageOn
  return normalized
}

function prepareDailyCheckInput(input: CctvDailyCheckInput, maxNvrDetails = 5): CctvDailyCheckInput {
  const value: CctvDailyCheckInput = {
    ...input,
    propertyCode: input.propertyCode.trim(),
    notes: input.notes.trim(),
    nvrDetails: input.nvrDetails.map(normalizeNvrDetail),
  }
  if (!value.propertyId || !value.propertyCode || !/^\d{4}-\d{2}-\d{2}$/.test(value.checkedOn)) {
    throw new Error('กรุณาเลือก Property และวันที่ตรวจสอบ')
  }
  if (value.nvrDetails.length > maxNvrDetails)
    throw new Error(`เพิ่ม NVR ได้ไม่เกิน ${maxNvrDetails} เครื่องต่อ Property ในรุ่นปัจจุบัน`)

  const nvrIds = new Set<string>()
  for (const nvr of value.nvrDetails) {
    if (!nvr.nvrId || nvr.nvrId.length > 80) throw new Error('กรุณาระบุชื่อหรือรหัส NVR (ไม่เกิน 80 ตัวอักษร)')
    if (nvrIds.has(nvr.nvrId.toLowerCase())) throw new Error(`รหัส NVR ${nvr.nvrId} ซ้ำกัน`)
    nvrIds.add(nvr.nvrId.toLowerCase())
    if (
      !Number.isInteger(nvr.cameraTotal) ||
      nvr.cameraTotal < 0 ||
      nvr.cameraTotal > 20000 ||
      !Number.isInteger(nvr.cameraOnline) ||
      nvr.cameraOnline < 0 ||
      nvr.cameraOnline > nvr.cameraTotal
    )
      throw new Error(`จำนวนกล้องของ ${nvr.nvrId} ไม่ถูกต้อง`)
    if (!Number.isInteger(nvr.retentionDays) || nvr.retentionDays < 0 || nvr.retentionDays > 3650)
      throw new Error(`จำนวนวันย้อนหลังของ ${nvr.nvrId} ต้องอยู่ระหว่าง 0 ถึง 3,650 วัน`)
    if (nvr.oldestFootageOn) {
      const retentionDays = retentionDaysFromOldestDate(value.checkedOn, nvr.oldestFootageOn)
      if (retentionDays == null) throw new Error(`วันที่ภาพเก่าสุดของ ${nvr.nvrId} ไม่ถูกต้องหรืออยู่หลังวันที่ตรวจ`)
      nvr.retentionDays = retentionDays
    }
    if (nvr.notes.length > 500) throw new Error(`หมายเหตุของ ${nvr.nvrId} ต้องไม่เกิน 500 ตัวอักษร`)
    if (!nvr.online && nvr.cameraOnline > 0) throw new Error(`NVR ${nvr.nvrId} Offline จึงระบุกล้อง Online ไม่ได้`)
  }

  if (value.nvrDetails.length > 0) {
    value.nvrTotal = value.nvrDetails.length
    value.nvrOnline = value.nvrDetails.filter((nvr) => nvr.online).length
    value.cameraTotal = value.nvrDetails.reduce((sum, nvr) => sum + nvr.cameraTotal, 0)
    value.cameraOnline = value.nvrDetails.reduce((sum, nvr) => sum + nvr.cameraOnline, 0)
  }
  for (const [label, count] of [
    ['จำนวน NVR', value.nvrTotal],
    ['NVR Online', value.nvrOnline],
    ['จำนวนกล้อง', value.cameraTotal],
    ['กล้อง Online', value.cameraOnline],
  ] as const) {
    if (!Number.isInteger(count) || count < 0 || count > 20000)
      throw new Error(`${label} ต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 20,000`)
  }
  if (value.nvrOnline > value.nvrTotal) throw new Error('จำนวน NVR Online ต้องไม่เกินจำนวน NVR ทั้งหมด')
  if (value.cameraOnline > value.cameraTotal) throw new Error('จำนวนกล้อง Online ต้องไม่เกินจำนวนกล้องทั้งหมด')
  if (value.notes.length > 1000) throw new Error('หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร')
  return value
}

function persistedNvrDetails(value: unknown): CctvNvrDetail[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is CctvNvrDetail =>
      item &&
      typeof item.nvrId === 'string' &&
      typeof item.online === 'boolean' &&
      Number.isInteger(item.cameraTotal) &&
      Number.isInteger(item.cameraOnline) &&
      Number.isInteger(item.retentionDays) &&
      typeof item.notes === 'string',
  )
}

function parseCheck(id: string, data: DocumentData): CctvDailyCheck | null {
  if (
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.checkedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.checkedOn) ||
    !Number.isInteger(data.nvrTotal) ||
    !Number.isInteger(data.nvrOnline) ||
    !Number.isInteger(data.cameraTotal) ||
    !Number.isInteger(data.cameraOnline) ||
    typeof data.notes !== 'string' ||
    typeof data.checkedByUid !== 'string'
  )
    return null
  const nvrDetails = Array.isArray(data.nvrDetails)
    ? data.nvrDetails
        .filter(
          (item): item is CctvNvrDetail =>
            item &&
            typeof item.nvrId === 'string' &&
            typeof item.online === 'boolean' &&
            Number.isInteger(item.cameraTotal) &&
            Number.isInteger(item.cameraOnline) &&
            Number.isInteger(item.retentionDays) &&
            typeof item.notes === 'string' &&
            (item.oldestFootageOn == null || typeof item.oldestFootageOn === 'string'),
        )
        .map((item) => {
          if (typeof item.oldestFootageOn === 'string') return { ...item, oldestFootageOn: item.oldestFootageOn }
          const { oldestFootageOn: _legacyMissingDate, ...legacyItem } = item
          return legacyItem
        })
    : []
  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    checkedOn: data.checkedOn,
    nvrTotal: data.nvrTotal,
    nvrOnline: data.nvrOnline,
    cameraTotal: data.cameraTotal,
    cameraOnline: data.cameraOnline,
    notes: data.notes,
    checkedByUid: data.checkedByUid,
    nvrDetails,
    checkedAt: asDate(data.checkedAt),
  }
}

export function subscribeToCctvChecks(
  propertyId: string,
  allProperties: boolean,
  onChecks: (checks: CctvDailyCheck[]) => void,
  onError: () => void,
  dateRange?: { start: string; endExclusive: string },
  includedPropertyIds?: string[],
) {
  const groups =
    allProperties && includedPropertyIds
      ? Array.from({ length: Math.ceil(includedPropertyIds.length / 10) }, (_, index) =>
          includedPropertyIds.slice(index * 10, index * 10 + 10),
        )
      : [allProperties ? [] : [propertyId]]
  if (groups.length === 0) {
    onChecks([])
    return () => undefined
  }

  const results = new Map<number, CctvDailyCheck[]>()
  const maxItems = dateRange ? 500 : allProperties ? 100 : 14
  const unsubscribes = groups.map((propertyIds, index) => {
    const constraints: QueryConstraint[] = []
    if (allProperties && includedPropertyIds) constraints.push(where('propertyId', 'in', propertyIds))
    else if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
    if (dateRange)
      constraints.push(where('checkedOn', '>=', dateRange.start), where('checkedOn', '<', dateRange.endExclusive))
    constraints.push(orderBy('checkedOn', 'desc'), limit(maxItems))
    return onSnapshot(
      query(collection(firestore(), 'cctvDailyChecks'), ...constraints),
      (snapshot) => {
        results.set(
          index,
          snapshot.docs
            .map((item) => parseCheck(item.id, item.data()))
            .filter((item): item is CctvDailyCheck => item !== null),
        )
        const merged = new Map<string, CctvDailyCheck>()
        results.forEach((checks) => checks.forEach((check) => merged.set(check.id, check)))
        onChecks([...merged.values()].sort((a, b) => b.checkedOn.localeCompare(a.checkedOn)).slice(0, maxItems))
      },
      onError,
    )
  })
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
}

function parseInventory(id: string, data: DocumentData): CctvNvrInventoryItem | null {
  if (
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.location !== 'string' ||
    !Number.isInteger(data.cameraTotal) ||
    !Number.isInteger(data.targetRetentionDays) ||
    typeof data.active !== 'boolean'
  )
    return null
  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    name: data.name,
    location: data.location,
    cameraTotal: data.cameraTotal,
    targetRetentionDays: data.targetRetentionDays,
    active: data.active,
  }
}

export function subscribeToCctvNvrInventory(
  propertyId: string,
  onItems: (items: CctvNvrInventoryItem[]) => void,
  onError: () => void,
) {
  return onSnapshot(
    query(
      collection(firestore(), 'cctvNvrInventory'),
      where('propertyId', '==', propertyId),
      orderBy('name', 'asc'),
      limit(200),
    ),
    (snapshot) => {
      onItems(
        snapshot.docs
          .map((item) => parseInventory(item.id, item.data()))
          .filter((item): item is CctvNvrInventoryItem => item !== null),
      )
    },
    onError,
  )
}

function parseNvrDailyCheck(id: string, data: DocumentData): CctvNvrDailyCheck | null {
  if (
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.checkedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.checkedOn) ||
    typeof data.nvrId !== 'string' ||
    typeof data.online !== 'boolean' ||
    !Number.isInteger(data.cameraTotal) ||
    !Number.isInteger(data.cameraOnline) ||
    !Number.isInteger(data.retentionDays) ||
    typeof data.notes !== 'string' ||
    typeof data.checkedByUid !== 'string'
  )
    return null
  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    checkedOn: data.checkedOn,
    nvrId: data.nvrId,
    ...(typeof data.nvrName === 'string' ? { nvrName: data.nvrName } : {}),
    ...(typeof data.location === 'string' ? { location: data.location } : {}),
    online: data.online,
    cameraTotal: data.cameraTotal,
    cameraOnline: data.cameraOnline,
    retentionDays: data.retentionDays,
    ...(typeof data.oldestFootageOn === 'string' ? { oldestFootageOn: data.oldestFootageOn } : {}),
    ...(Number.isInteger(data.targetRetentionDays) ? { targetRetentionDays: data.targetRetentionDays } : {}),
    notes: data.notes,
    checkedByUid: data.checkedByUid,
    checkedAt: asDate(data.checkedAt),
  }
}

export function subscribeToCctvNvrDailyChecks(
  propertyId: string,
  allProperties: boolean,
  checkedOn: string,
  onItems: (items: CctvNvrDailyCheck[]) => void,
  onError: () => void,
  includedPropertyIds?: string[],
) {
  const groups =
    allProperties && includedPropertyIds
      ? Array.from({ length: Math.ceil(includedPropertyIds.length / 10) }, (_, index) =>
          includedPropertyIds.slice(index * 10, index * 10 + 10),
        )
      : [allProperties ? [] : [propertyId]]
  if (groups.length === 0) {
    onItems([])
    return () => undefined
  }

  const results = new Map<number, CctvNvrDailyCheck[]>()
  const unsubscribes = groups.map((propertyIds, index) => {
    const constraints: QueryConstraint[] = [where('checkedOn', '==', checkedOn), limit(500)]
    if (allProperties && includedPropertyIds) constraints.unshift(where('propertyId', 'in', propertyIds))
    else if (!allProperties) constraints.unshift(where('propertyId', '==', propertyId))
    return onSnapshot(
      query(collection(firestore(), 'cctvNvrDailyChecks'), ...constraints),
      (snapshot) => {
        results.set(
          index,
          snapshot.docs
            .map((item) => parseNvrDailyCheck(item.id, item.data()))
            .filter((item): item is CctvNvrDailyCheck => item !== null),
        )
        onItems([...results.values()].flat().sort((a, b) => a.nvrId.localeCompare(b.nvrId)))
      },
      onError,
    )
  })
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
}

export async function saveCctvNvrInventory(input: CctvNvrInventoryInput, actorUid: string, existingId?: string) {
  const value = { ...input, name: input.name.trim(), location: input.location.trim() }
  if (!value.propertyId || !value.propertyCode || !value.name || value.name.length > 100)
    throw new Error('กรุณาระบุ Property และชื่อ NVR (ไม่เกิน 100 ตัวอักษร)')
  if (value.location.length > 160) throw new Error('Location ต้องไม่เกิน 160 ตัวอักษร')
  if (!Number.isInteger(value.cameraTotal) || value.cameraTotal < 1 || value.cameraTotal > 20000)
    throw new Error('จำนวนกล้องที่ติดตั้งต้องอยู่ระหว่าง 1 ถึง 20,000')
  if (!Number.isInteger(value.targetRetentionDays) || value.targetRetentionDays < 0 || value.targetRetentionDays > 3650)
    throw new Error('เป้าหมายวันย้อนหลังต้องอยู่ระหว่าง 0 ถึง 3,650 วัน')
  if (!actorUid) throw new Error('กรุณาเข้าสู่ระบบใหม่')
  const ref = existingId
    ? doc(firestore(), 'cctvNvrInventory', existingId)
    : doc(collection(firestore(), 'cctvNvrInventory'))
  if (!existingId) {
    await setDoc(ref, { ...value, createdBy: actorUid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    return
  }
  await runTransaction(firestore(), async (transaction) => {
    const existing = await transaction.get(ref)
    if (!existing.exists()) throw new Error('ไม่พบ NVR ที่เลือก')
    transaction.update(ref, { ...value, createdBy: existing.data().createdBy, updatedAt: serverTimestamp() })
  })
}

export async function deactivateCctvNvr(id: string) {
  const ref = doc(firestore(), 'cctvNvrInventory', id)
  await runTransaction(firestore(), async (transaction) => {
    const existing = await transaction.get(ref)
    if (!existing.exists()) throw new Error('ไม่พบ NVR ที่เลือก')
    transaction.update(ref, { active: false, updatedAt: serverTimestamp() })
  })
}

export async function saveCctvDailyCheck(input: CctvDailyCheckInput, actorUid: string, maxNvrDetails = 5) {
  const value = prepareDailyCheckInput(input, maxNvrDetails)
  if (!actorUid) throw new Error('กรุณาเข้าสู่ระบบใหม่')

  // ใช้หนึ่งเอกสารต่อ Property ต่อวันเพื่อกันการบันทึกซ้ำ และอนุญาตให้แก้ผลตรวจของวันนั้นได้
  const checkId = `${value.propertyId}_${value.checkedOn}`
  const ref = doc(firestore(), 'cctvDailyChecks', checkId)
  await runTransaction(firestore(), async (transaction) => {
    const existing = await transaction.get(ref)
    const checked = {
      ...value,
      checkedByUid: actorUid,
      checkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (existing.exists()) transaction.update(ref, checked)
    else transaction.set(ref, { ...checked, createdAt: serverTimestamp() })
  })
}

export async function saveCctvDailyCheckNvr(input: CctvDailyCheckInput, nvr: CctvNvrDetail, actorUid: string) {
  if (!actorUid) throw new Error('กรุณาเข้าสู่ระบบใหม่')
  const normalized = prepareDailyCheckInput({ ...input, nvrDetails: [nvr] }, 1)
  const detail = normalized.nvrDetails[0]
  const aggregateRef = doc(firestore(), 'cctvDailyChecks', `${input.propertyId}_${input.checkedOn}`)
  const nvrRef = doc(firestore(), 'cctvNvrDailyChecks', `${input.propertyId}_${input.checkedOn}_${detail.nvrId}`)
  await runTransaction(firestore(), async (transaction) => {
    const [existingAggregate, existingNvr] = await Promise.all([transaction.get(aggregateRef), transaction.get(nvrRef)])
    const aggregateData = existingAggregate.exists() ? existingAggregate.data() : {}
    const currentDetails = persistedNvrDetails(aggregateData.nvrDetails)
    // Legacy aggregate documents may already contain this NVR before the
    // scalable per-NVR document existed. Treat it as the previous value so
    // the first per-NVR save does not double-count aggregate totals.
    const previous = existingNvr.exists()
      ? parseNvrDailyCheck(nvrRef.id, existingNvr.data())
      : (currentDetails.find((item) => item.nvrId === detail.nvrId) ?? null)
    const previousNvrTotal = previous ? 1 : 0
    const previousNvrOnline = previous?.online ? 1 : 0
    const previousCameraTotal = previous?.cameraTotal ?? 0
    const previousCameraOnline = previous?.cameraOnline ?? 0
    const embeddedDetails = currentDetails.some((item) => item.nvrId === detail.nvrId)
      ? currentDetails.map((item) => (item.nvrId === detail.nvrId ? detail : item))
      : currentDetails.length < 5
        ? [...currentDetails, detail]
        : currentDetails
    const aggregate = {
      ...normalized,
      nvrTotal: Math.max(
        0,
        (Number.isInteger(aggregateData.nvrTotal) ? aggregateData.nvrTotal : 0) - previousNvrTotal + 1,
      ),
      nvrOnline: Math.max(
        0,
        (Number.isInteger(aggregateData.nvrOnline) ? aggregateData.nvrOnline : 0) -
          previousNvrOnline +
          (detail.online ? 1 : 0),
      ),
      cameraTotal: Math.max(
        0,
        (Number.isInteger(aggregateData.cameraTotal) ? aggregateData.cameraTotal : 0) -
          previousCameraTotal +
          detail.cameraTotal,
      ),
      cameraOnline: Math.max(
        0,
        (Number.isInteger(aggregateData.cameraOnline) ? aggregateData.cameraOnline : 0) -
          previousCameraOnline +
          detail.cameraOnline,
      ),
      nvrDetails: embeddedDetails,
      checkedByUid: actorUid,
      checkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (existingAggregate.exists()) transaction.update(aggregateRef, aggregate)
    else transaction.set(aggregateRef, { ...aggregate, createdAt: serverTimestamp() })
    const nvrCheck = {
      ...detail,
      propertyId: input.propertyId,
      propertyCode: input.propertyCode.trim(),
      checkedOn: input.checkedOn,
      checkedByUid: actorUid,
      checkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (existingNvr.exists()) transaction.update(nvrRef, nvrCheck)
    else transaction.set(nvrRef, { ...nvrCheck, createdAt: serverTimestamp() })
  })
}
