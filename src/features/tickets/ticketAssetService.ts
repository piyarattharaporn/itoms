import { collection, limit, onSnapshot, orderBy, query, where, type DocumentData } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export interface TicketAssetOption {
  id: string
  propertyId: string
  propertyCode: string
  assetTag: string
  name: string
  category: string
  department: string
  location: string
  status: 'In Service' | 'Under Repair' | 'Retired'
}

const categoryMap: Record<string, string[]> = {
  'Computer PC': ['Computer'],
  'Computer Laptop': ['Computer'],
  'Office Printer': ['Printer'],
  'POS Printer': ['Printer', 'POS Terminal'],
  'Network Equipments': ['Network Switch', 'Access Point'],
  NAS: ['NAS', 'Server'],
  'CCTV Equipments': ['CCTV DVR', 'CCTV Camera'],
  'WiFi Connections': ['Access Point'],
  'Network Configurations': ['Network Switch', 'Access Point'],
  'OPERA Cloud': ['Computer', 'Server'],
  'Symphony Cloud': ['POS Terminal'],
  'Sun Cloud': ['Computer', 'Server'],
  Helpdesk: [],
  'CCTV System': ['CCTV DVR', 'CCTV Camera'],
  'Door Lock System': ['Door Lock Encoder'],
  Network: ['Network Switch', 'Access Point'],
  'Printer/POS': ['Printer', 'POS Terminal'],
  'Simphony Cloud': ['POS Terminal'],
  Software: [],
}

export function categoriesForProblem(problemCategory: string, problemType: string, availableCategories: string[]) {
  if (problemType in categoryMap) return categoryMap[problemType].filter((category) => availableCategories.includes(category))
  if (problemCategory === 'Helpdesk') return []
  if (problemCategory === 'Other' || problemCategory === 'Hardware') return availableCategories
  const normalized = problemType.toLocaleLowerCase()
  const inferred = availableCategories.filter((category) => {
    const value = category.toLocaleLowerCase()
    return normalized.includes(value) || value.includes(normalized)
  })
  return inferred.length ? inferred : availableCategories
}

function firestore() {
  if (!db) throw new Error('Firestore ยังไม่ได้ตั้งค่า กรุณาเปิด Firebase Emulator')
  return db
}

function parseOption(id: string, data: DocumentData): TicketAssetOption | null {
  if (
    typeof data.propertyId !== 'string' || typeof data.propertyCode !== 'string' ||
    typeof data.assetTag !== 'string' || typeof data.name !== 'string' ||
    typeof data.category !== 'string' || typeof data.location !== 'string' ||
    !['In Service', 'Under Repair', 'Retired'].includes(data.status)
  ) return null
  return { id, propertyId: data.propertyId, propertyCode: data.propertyCode, assetTag: data.assetTag, name: data.name, category: data.category, department: typeof data.department === 'string' ? data.department : '', location: data.location, status: data.status }
}

export function subscribeToTicketAssets(propertyId: string, onAssets: (assets: TicketAssetOption[]) => void, onError: () => void) {
  return onSnapshot(query(collection(firestore(), 'ticketAssetOptions'), where('propertyId', '==', propertyId), orderBy('updatedAt', 'desc'), limit(100)), (snapshot) => {
    onAssets(snapshot.docs.map((item) => parseOption(item.id, item.data())).filter((item): item is TicketAssetOption => item !== null))
  }, onError)
}
