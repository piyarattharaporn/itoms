import { collection, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { PropertyRole } from '../auth/types'
import type { CursorPage } from '../../lib/pagination'
import { recordUsageEvent } from '../../lib/telemetry'

export interface DirectoryUser {
  uid: string
  displayName: string
  email: string
  globalRole: 'superAdmin' | 'member' | 'unknown'
  active: boolean
}

export interface DirectoryMembership {
  id: string
  userId: string
  propertyId: string
  propertyCode: string
  propertyName: string
  role: PropertyRole
  active: boolean
}

export type DirectoryPageCursor = QueryDocumentSnapshot<DocumentData> | null

function parseUser(uid: string, data: DocumentData): DirectoryUser {
  return {
    uid,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    email: typeof data.email === 'string' ? data.email : '',
    globalRole: data.globalRole === 'superAdmin' || data.globalRole === 'member' ? data.globalRole : 'unknown',
    active: data.active === true,
  }
}

function parseMembership(id: string, data: DocumentData): DirectoryMembership | null {
  if (
    typeof data.userId !== 'string' || typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' || typeof data.propertyName !== 'string' ||
    !['supportEngineer', 'clientExecutive', 'requester'].includes(data.role)
  ) return null
  return {
    id,
    userId: data.userId,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    propertyName: data.propertyName,
    role: data.role as PropertyRole,
    active: data.active === true,
  }
}

/** Loads one page of profiles, then only memberships belonging to that page. */
export async function getUserDirectoryPage(pageSize = 25, cursor: DirectoryPageCursor = null): Promise<CursorPage<{ users: DirectoryUser[]; memberships: DirectoryMembership[] }>> {
  if (!db) throw new Error('Firestore is not configured')
  pageSize = Math.min(Math.max(pageSize, 1), 50)
  const constraints = [orderBy('displayName', 'asc'), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)]
  const userSnapshot = await getDocs(query(collection(db, 'users'), ...constraints))
  const users = userSnapshot.docs.map((item) => parseUser(item.id, item.data()))
  const ids = users.map((item) => item.uid)
  const memberships = ids.length === 0 ? [] : (await getDocs(query(collection(db, 'memberships'), where('userId', 'in', ids)))).docs
    .map((item) => parseMembership(item.id, item.data())).filter((item): item is DirectoryMembership => item !== null)
  recordUsageEvent('user_directory_page_loaded', { count: users.length, pageSize })
  return {
    items: [{ users, memberships }],
    nextCursor: userSnapshot.docs.length === pageSize ? userSnapshot.docs[userSnapshot.docs.length - 1] : null,
    hasMore: userSnapshot.docs.length === pageSize,
  }
}
