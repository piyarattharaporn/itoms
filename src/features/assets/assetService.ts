import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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

export type AssetStatus = 'In Service' | 'Damaged' | 'Under Repair' | 'Retired'
export type AssetOwnership = 'Owned' | 'Leased'
export type ServiceType = '' | 'Internal Repair' | 'Warranty Claim' | 'Vendor Repair'

export interface AssetRecord {
  id: string
  propertyId: string
  propertyCode: string
  assetTag: string
  name: string
  category: string
  department: string
  location: string
  vendor: string
  model: string
  spec: string
  detail: string
  usedBy: string
  serialNumber: string
  warrantyExpiresOn: string
  ownershipType: AssetOwnership
  lessorName: string
  leaseContractNumber: string
  leaseStartDate: string
  leaseEndDate: string
  monthlyRentalCost: number | null
  status: AssetStatus
  serviceType: ServiceType
  serviceVendor: string
  serviceSentOn: string
  expectedReturnOn: string
  serviceNotes: string
  createdBy: string
  updatedAt: Date | null
}

export interface AssetInput {
  propertyId: string
  propertyCode: string
  assetTag: string
  name: string
  category: string
  department: string
  location: string
  vendor: string
  model: string
  spec: string
  detail: string
  usedBy: string
  serialNumber: string
  warrantyExpiresOn: string
  ownershipType: AssetOwnership
  lessorName: string
  leaseContractNumber: string
  leaseStartDate: string
  leaseEndDate: string
  monthlyRentalCost: number | null
  status: AssetStatus
  serviceType: ServiceType
  serviceVendor: string
  serviceSentOn: string
  expectedReturnOn: string
  serviceNotes: string
}

export type AssetPageCursor = QueryDocumentSnapshot<DocumentData> | null

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้เชื่อมต่อ กรุณาเปิด Firebase Emulator')
  return db
}

function dateFrom(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function')
    return value.toDate()
  return null
}

function parseAsset(id: string, data: DocumentData): AssetRecord | null {
  const stringFields = ['propertyId', 'propertyCode', 'assetTag', 'name', 'category', 'location', 'createdBy'] as const
  if (
    !stringFields.every((key) => typeof data[key] === 'string') ||
    !['In Service', 'Damaged', 'Under Repair', 'Retired'].includes(data.status)
  )
    return null
  const optionalText = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : '')
  return {
    id,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    assetTag: data.assetTag,
    name: data.name,
    category: data.category,
    department: typeof data.department === 'string' ? data.department : '',
    location: data.location,
    vendor: optionalText('vendor'),
    model: optionalText('model'),
    spec: optionalText('spec'),
    detail: optionalText('detail'),
    usedBy: optionalText('usedBy'),
    serialNumber: optionalText('serialNumber'),
    warrantyExpiresOn: optionalText('warrantyExpiresOn'),
    ownershipType: data.ownershipType === 'Leased' ? 'Leased' : 'Owned',
    lessorName: optionalText('lessorName'),
    leaseContractNumber: optionalText('leaseContractNumber'),
    leaseStartDate: optionalText('leaseStartDate'),
    leaseEndDate: optionalText('leaseEndDate'),
    monthlyRentalCost:
      typeof data.monthlyRentalCost === 'number' && Number.isFinite(data.monthlyRentalCost)
        ? data.monthlyRentalCost
        : null,
    status: data.status as AssetStatus,
    // เอกสาร Asset เก่าที่ยังไม่มีรายละเอียดการส่งซ่อมให้อ่านได้ต่อโดยใช้ค่าเริ่มต้น
    serviceType: ['Internal Repair', 'Warranty Claim', 'Vendor Repair'].includes(data.serviceType)
      ? data.serviceType
      : '',
    serviceVendor: typeof data.serviceVendor === 'string' ? data.serviceVendor : '',
    serviceSentOn: typeof data.serviceSentOn === 'string' ? data.serviceSentOn : '',
    expectedReturnOn: typeof data.expectedReturnOn === 'string' ? data.expectedReturnOn : '',
    serviceNotes: typeof data.serviceNotes === 'string' ? data.serviceNotes : '',
    createdBy: data.createdBy,
    updatedAt: dateFrom(data.updatedAt),
  }
}

function clampPageSize(pageSize: number) {
  return Math.min(Math.max(pageSize, 1), 50)
}

function assetConstraints(
  propertyId: string,
  allProperties: boolean,
  damagedOnly = false,
  cursor: AssetPageCursor = null,
  pageSize = 25,
) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  if (damagedOnly) constraints.push(where('status', 'in', ['Damaged', 'Under Repair', 'Retired']))
  constraints.push(orderBy('updatedAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(clampPageSize(pageSize)))
  return constraints
}

export async function getAssetPage(
  propertyId: string,
  allProperties: boolean,
  pageSize = 25,
  cursor: AssetPageCursor = null,
  damagedOnly = false,
): Promise<CursorPage<AssetRecord>> {
  const snapshot = await getDocs(
    query(
      collection(firestore(), 'assets'),
      ...assetConstraints(propertyId, allProperties, damagedOnly, cursor, pageSize),
    ),
  )
  const items = snapshot.docs
    .map((item) => parseAsset(item.id, item.data()))
    .filter((item): item is AssetRecord => item !== null)
  const boundedPageSize = clampPageSize(pageSize)
  return {
    items,
    nextCursor: snapshot.docs.length === boundedPageSize ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === boundedPageSize,
  }
}

export function subscribeToAssets(
  propertyId: string,
  allProperties: boolean,
  onAssets: (assets: AssetRecord[]) => void,
  onError: () => void,
) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(orderBy('updatedAt', 'desc'), limit(100))
  return onSnapshot(
    query(collection(firestore(), 'assets'), ...constraints),
    (snapshot) => {
      onAssets(
        snapshot.docs
          .map((item) => parseAsset(item.id, item.data()))
          .filter((item): item is AssetRecord => item !== null),
      )
    },
    onError,
  )
}

export function subscribeToDamagedAssets(
  propertyId: string,
  allProperties: boolean,
  onAssets: (assets: AssetRecord[]) => void,
  onError: () => void,
) {
  const constraints: QueryConstraint[] = []
  if (!allProperties) constraints.push(where('propertyId', '==', propertyId))
  constraints.push(
    where('status', 'in', ['Damaged', 'Under Repair', 'Retired']),
    orderBy('updatedAt', 'desc'),
    limit(100),
  )
  return onSnapshot(
    query(collection(firestore(), 'assets'), ...constraints),
    (snapshot) => {
      onAssets(
        snapshot.docs
          .map((item) => parseAsset(item.id, item.data()))
          .filter((item): item is AssetRecord => item !== null),
      )
    },
    onError,
  )
}

function normalizeAsset(input: AssetInput) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  ) as AssetInput
}

function validateAsset(input: AssetInput) {
  const asset = normalizeAsset(input)
  if (
    !asset.propertyId ||
    !asset.propertyCode ||
    !asset.assetTag ||
    !asset.name ||
    !asset.category ||
    !asset.department ||
    !asset.location
  ) {
    throw new Error('กรุณากรอก Property, Asset Tag, ชื่อ, ประเภท, แผนก และ Location ให้ครบ')
  }
  if (
    asset.assetTag.length > 80 ||
    asset.name.length > 160 ||
    asset.department.length > 80 ||
    asset.location.length > 160 ||
    asset.spec.length > 1000 ||
    asset.detail.length > 2000 ||
    asset.usedBy.length > 160 ||
    asset.lessorName.length > 160 ||
    asset.leaseContractNumber.length > 120
  )
    throw new Error('บางช่องมีความยาวเกินกำหนด')
  if (!['Owned', 'Leased'].includes(asset.ownershipType)) throw new Error('ประเภทการครอบครองไม่ถูกต้อง')
  if (asset.ownershipType === 'Leased' && !asset.lessorName) throw new Error('กรุณาระบุผู้ให้เช่า')
  const isDate = (value: string) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (
    !isDate(asset.leaseStartDate) ||
    !isDate(asset.leaseEndDate) ||
    (asset.leaseStartDate && asset.leaseEndDate && asset.leaseEndDate < asset.leaseStartDate)
  )
    throw new Error('วันที่ในสัญญาเช่าไม่ถูกต้อง')
  if (
    asset.monthlyRentalCost !== null &&
    (!Number.isFinite(asset.monthlyRentalCost) ||
      asset.monthlyRentalCost < 0 ||
      asset.monthlyRentalCost > 1_000_000_000)
  )
    throw new Error('ค่าเช่าต่อเดือนไม่ถูกต้อง')
  return asset
}

export async function createAsset(input: AssetInput, actorUid: string) {
  const asset = validateAsset(input)
  const ref = doc(collection(firestore(), 'assets'))
  const batch = writeBatch(firestore())
  const createdAt = serverTimestamp()
  const updatedAt = serverTimestamp()
  batch.set(ref, {
    ...asset,
    createdBy: actorUid,
    createdAt,
    updatedAt,
  })
  batch.set(doc(firestore(), 'ticketAssetOptions', ref.id), {
    propertyId: asset.propertyId,
    propertyCode: asset.propertyCode,
    assetTag: asset.assetTag,
    name: asset.name,
    category: asset.category,
    department: asset.department,
    location: asset.location,
    status: asset.status,
    createdAt,
    updatedAt,
  })
  await batch.commit()
  return ref.id
}

export async function updateAsset(assetId: string, input: AssetInput) {
  const asset = validateAsset(input)
  const ref = doc(firestore(), 'assets', assetId)
  const optionRef = doc(firestore(), 'ticketAssetOptions', assetId)
  await runTransaction(firestore(), async (transaction) => {
    const existingOption = await transaction.get(optionRef)
    const updatedAt = serverTimestamp()
    transaction.update(ref, { ...asset, updatedAt })
    const option = {
      propertyId: asset.propertyId,
      propertyCode: asset.propertyCode,
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      department: asset.department,
      location: asset.location,
      status: asset.status,
      updatedAt,
    }
    if (existingOption.exists()) transaction.update(optionRef, option)
    else transaction.set(optionRef, { ...option, createdAt: updatedAt })
  })
}

export async function syncTicketAssetOptions(assets: AssetRecord[]) {
  if (assets.length === 0) return 0
  const database = firestore()
  const references = assets.map((asset) => doc(database, 'ticketAssetOptions', asset.id))
  const existing = await Promise.all(references.map((reference) => getDoc(reference)))
  const batch = writeBatch(database)
  assets.forEach((asset, index) => {
    const option = {
      propertyId: asset.propertyId,
      propertyCode: asset.propertyCode,
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      department: asset.department,
      location: asset.location,
      status: asset.status,
      updatedAt: serverTimestamp(),
    }
    if (existing[index].exists()) batch.update(references[index], option)
    else batch.set(references[index], { ...option, createdAt: serverTimestamp() })
  })
  await batch.commit()
  return assets.length
}
