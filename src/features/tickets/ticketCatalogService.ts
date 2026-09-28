import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export const defaultProblemTypeGroups: Record<string, string[]> = {
  Hardware: ['Computer PC', 'Computer Laptop', 'Office Printer', 'POS Printer', 'Network Equipments', 'Server', 'NAS', 'CCTV Equipments'],
  Software: ['OPERA Cloud', 'Symphony Cloud', 'Sun Cloud'],
  Network: ['WiFi Connections', 'Network Configurations'],
  Helpdesk: ['Helpdesk'],
}

export const problemTypeSeparator = ' / '
export const makeProblemType = (group: string, item: string) => `${group}${problemTypeSeparator}${item}`
export const splitProblemType = (value: string) => {
  const separatorIndex = value.indexOf(problemTypeSeparator)
  return separatorIndex < 0
    ? { group: 'Other', item: value }
    : { group: value.slice(0, separatorIndex), item: value.slice(separatorIndex + problemTypeSeparator.length) }
}

export const defaultProblemTypes = Object.entries(defaultProblemTypeGroups)
  .flatMap(([group, items]) => items.map((item) => makeProblemType(group, item)))

const legacyProblemTypeMap: Record<string, string[]> = {
  Hardware: defaultProblemTypeGroups.Hardware.map((item) => makeProblemType('Hardware', item)),
  Software: defaultProblemTypeGroups.Software.map((item) => makeProblemType('Software', item)),
  Network: defaultProblemTypeGroups.Network.map((item) => makeProblemType('Network', item)),
  'OPERA Cloud': [makeProblemType('Software', 'OPERA Cloud')],
  'Simphony Cloud': [makeProblemType('Software', 'Symphony Cloud')],
  'CCTV System': [makeProblemType('Hardware', 'CCTV Equipments')],
  'Door Lock System': [makeProblemType('Hardware', 'Door Lock Equipments')],
  'Printer/POS': [makeProblemType('Hardware', 'POS Printer')],
  'Interface Communications': [makeProblemType('Software', 'Interface Communications')],
  Other: [makeProblemType('Helpdesk', 'Helpdesk')],
}

function normalizeProblemTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [...defaultProblemTypes]
  const values = value.filter((item): item is string => typeof item === 'string')
  if (values.length === 0) return []
  if (values.every((item) => item.includes(problemTypeSeparator))) return [...new Set(values)]
  const migrated = new Set(defaultProblemTypes)
  for (const item of values) {
    const mapped = legacyProblemTypeMap[item]
    if (mapped) mapped.forEach((type) => migrated.add(type))
    else migrated.add(makeProblemType('Other', item))
  }
  return [...migrated]
}

export const defaultDepartments = [
  'Front Office', 'Housekeeping', 'Food & Beverage', 'Kitchen', 'Engineering',
  'Finance & Accounting', 'Human Resources', 'Sales & Marketing', 'Security', 'Spa', 'IT', 'Other',
]

export const defaultAssetCategories = [
  'Computer', 'POS Terminal', 'CCTV DVR', 'CCTV Camera', 'Network Switch',
  'Access Point', 'Door Lock Encoder', 'Printer', 'UPS', 'Server', 'Other',
]

export const defaultTicketChannels = ['Line', 'Message Box', 'Personal Call', 'Other']
export const defaultTodoCategories = ['General', 'Meeting Room']

export interface TicketCatalog {
  propertyId: string
  propertyCode: string
  problemTypes: string[]
  departments: string[]
  assetCategories: string[]
  channels: string[]
  todoCategories: string[]
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

export function subscribeToTicketCatalog(propertyId: string, onCatalog: (catalog: TicketCatalog) => void, onError: () => void) {
  return onSnapshot(doc(firestore(), 'ticketCatalogs', propertyId), (snapshot) => {
    const data = snapshot.data()
    onCatalog({
      propertyId,
      propertyCode: typeof data?.propertyCode === 'string' ? data.propertyCode : '',
      problemTypes: normalizeProblemTypes(data?.problemTypes),
      departments: Array.isArray(data?.departments) ? data.departments.filter((value): value is string => typeof value === 'string') : [...defaultDepartments],
      assetCategories: Array.isArray(data?.assetCategories) ? data.assetCategories.filter((value): value is string => typeof value === 'string') : [...defaultAssetCategories],
      channels: Array.isArray(data?.channels) ? data.channels.filter((value): value is string => typeof value === 'string') : [...defaultTicketChannels],
      todoCategories: Array.isArray(data?.todoCategories) ? data.todoCategories.filter((value): value is string => typeof value === 'string') : [...defaultTodoCategories],
    })
  }, onError)
}

export type TicketCatalogListField = 'problemTypes' | 'departments' | 'assetCategories' | 'channels' | 'todoCategories'

function catalogValues(data: Record<string, unknown> | undefined, field: TicketCatalogListField) {
  if (field === 'problemTypes') return normalizeProblemTypes(data?.problemTypes)
  const defaults = field === 'departments' ? defaultDepartments
    : field === 'assetCategories' ? defaultAssetCategories
      : field === 'channels' ? defaultTicketChannels : defaultTodoCategories
  return Array.isArray(data?.[field]) ? (data[field] as unknown[]).filter((item): item is string => typeof item === 'string') : [...defaults]
}

export async function addTicketCatalogOption(propertyId: string, propertyCode: string, field: TicketCatalogListField, rawValue: string, actorUid: string) {
  const value = rawValue.trim()
  if (!propertyId || !propertyCode || !actorUid) throw new Error('ไม่พบข้อมูลผู้ใช้หรือ Property')
  if (!value || value.length > 80) throw new Error('กรุณากรอกชื่อรายการ 1–80 ตัวอักษร')

  await runTransaction(firestore(), async (transaction) => {
    const ref = doc(firestore(), 'ticketCatalogs', propertyId)
    const snapshot = await transaction.get(ref)
    const data = snapshot.data()
    const problemTypes = catalogValues(data, 'problemTypes')
    const departments = catalogValues(data, 'departments')
    const assetCategories = catalogValues(data, 'assetCategories')
    const channels = catalogValues(data, 'channels')
    const todoCategories = catalogValues(data, 'todoCategories')
    const current = field === 'problemTypes' ? problemTypes : field === 'departments' ? departments : field === 'assetCategories' ? assetCategories : field === 'channels' ? channels : todoCategories
    if (current.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) throw new Error('มีรายการชื่อนี้อยู่แล้ว')
    if (current.length >= 100) throw new Error('รายการประเภทนี้ครบ 100 รายการแล้ว')
    const updated = [...current, value]
    const payload = {
      propertyId,
      propertyCode,
      problemTypes: field === 'problemTypes' ? updated : problemTypes,
      departments: field === 'departments' ? updated : departments,
      assetCategories: field === 'assetCategories' ? updated : assetCategories,
      channels: field === 'channels' ? updated : channels,
      todoCategories: field === 'todoCategories' ? updated : todoCategories,
      updatedAt: serverTimestamp(),
    }
    if (snapshot.exists()) transaction.update(ref, payload)
    else transaction.set(ref, { ...payload, createdBy: actorUid, createdAt: serverTimestamp() })
  })
}

export async function renameTicketCatalogOption(propertyId: string, propertyCode: string, field: TicketCatalogListField, oldValue: string, rawValue: string, actorUid: string) {
  const value = rawValue.trim()
  if (!propertyId || !propertyCode || !actorUid) throw new Error('ไม่พบข้อมูลผู้ใช้หรือ Property')
  if (!value || value.length > 80) throw new Error('กรุณากรอกชื่อรายการ 1–80 ตัวอักษร')
  await runTransaction(firestore(), async (transaction) => {
    const ref = doc(firestore(), 'ticketCatalogs', propertyId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('ไม่พบรายการตั้งค่าของ Property นี้')
    const data = snapshot.data()
    const values = catalogValues(data, field)
    const index = values.indexOf(oldValue)
    if (index < 0) throw new Error('รายการนี้ถูกแก้ไขหรือถูกนำออกจากข้อมูลแล้ว กรุณาโหลดหน้าใหม่')
    if (values.some((item, itemIndex) => itemIndex !== index && item.toLocaleLowerCase() === value.toLocaleLowerCase())) throw new Error('มีรายการชื่อนี้อยู่แล้ว')
    const updated = values.slice()
    updated[index] = value
    transaction.update(ref, {
      [field]: updated,
      updatedAt: serverTimestamp(),
      ...(!Array.isArray(data.channels) && field !== 'channels' ? { channels: [...defaultTicketChannels] } : {}),
      ...(!Array.isArray(data.todoCategories) && field !== 'todoCategories' ? { todoCategories: [...defaultTodoCategories] } : {}),
    })
  })
}

export async function removeTicketCatalogOption(propertyId: string, field: TicketCatalogListField, value: string) {
  await runTransaction(firestore(), async (transaction) => {
    const ref = doc(firestore(), 'ticketCatalogs', propertyId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('ไม่พบรายการตั้งค่าของ Property นี้')
    const data = snapshot.data()
    const values = catalogValues(data, field)
    if (!values.includes(value)) throw new Error('ไม่พบรายการที่ต้องการลบ')
    transaction.update(ref, {
      [field]: values.filter((item) => item !== value),
      updatedAt: serverTimestamp(),
      ...(!Array.isArray(data.channels) && field !== 'channels' ? { channels: [...defaultTicketChannels] } : {}),
      ...(!Array.isArray(data.todoCategories) && field !== 'todoCategories' ? { todoCategories: [...defaultTodoCategories] } : {}),
    })
  })
}

export async function renameProblemTypeGroup(propertyId: string, oldGroup: string, rawGroup: string) {
  const group = rawGroup.trim()
  if (!group || group.length > 80) throw new Error('กรุณากรอกชื่อหมวด 1–80 ตัวอักษร')
  await runTransaction(firestore(), async (transaction) => {
    const ref = doc(firestore(), 'ticketCatalogs', propertyId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('ไม่พบรายการตั้งค่าของ Property นี้')
    const data = snapshot.data()
    const values = normalizeProblemTypes(data.problemTypes)
    if (values.some((value) => splitProblemType(value).group.toLocaleLowerCase() === group.toLocaleLowerCase() && splitProblemType(value).group !== oldGroup)) throw new Error('มีหมวดชื่อนี้อยู่แล้ว')
    const updated = values.map((value) => {
      const parsed = splitProblemType(value)
      return parsed.group === oldGroup ? makeProblemType(group, parsed.item) : value
    })
    transaction.update(ref, { problemTypes: [...new Set(updated)], channels: Array.isArray(data.channels) ? data.channels : [...defaultTicketChannels], updatedAt: serverTimestamp() })
  })
}

export async function removeProblemTypeGroup(propertyId: string, group: string) {
  await runTransaction(firestore(), async (transaction) => {
    const ref = doc(firestore(), 'ticketCatalogs', propertyId)
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) throw new Error('ไม่พบรายการตั้งค่าของ Property นี้')
    const data = snapshot.data()
    const values = normalizeProblemTypes(data.problemTypes)
    const updated = values.filter((value) => splitProblemType(value).group !== group)
    if (updated.length === values.length) throw new Error('ไม่พบหมวดที่ต้องการลบ')
    transaction.update(ref, { problemTypes: updated, channels: Array.isArray(data.channels) ? data.channels : [...defaultTicketChannels], updatedAt: serverTimestamp() })
  })
}
