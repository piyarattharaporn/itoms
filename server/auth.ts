import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'
import { HttpError } from './errors.js'

export interface Actor {
  uid: string
  globalRole: 'superAdmin' | 'member' | 'unknown'
  active: boolean
}

export interface PropertyMembership {
  userId: string
  propertyId: string
  role: 'supportEngineer' | 'clientExecutive' | 'requester'
  active: boolean
}

export async function authenticate(auth: Auth, authorization: string | undefined): Promise<Actor> {
  if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'unauthenticated', 'Bearer token is required')
  try {
    const decoded = await auth.verifyIdToken(authorization.slice('Bearer '.length))
    return { uid: decoded.uid, globalRole: 'unknown', active: true }
  } catch {
    throw new HttpError(401, 'unauthenticated', 'Authentication token is invalid')
  }
}

export async function loadActor(db: Firestore, actor: Actor): Promise<Actor> {
  const snapshot = await db.doc(`users/${actor.uid}`).get()
  if (!snapshot.exists || snapshot.data()?.active !== true) throw new HttpError(403, 'inactive_profile', 'Active ITOMS profile is required')
  const globalRole = snapshot.data()?.globalRole
  if (globalRole !== 'superAdmin' && globalRole !== 'member') throw new HttpError(403, 'invalid_profile', 'Profile role is invalid')
  return { ...actor, globalRole, active: true }
}

export async function loadMembership(db: Firestore, uid: string, propertyId: string): Promise<PropertyMembership | null> {
  const snapshot = await db.doc(`memberships/${uid}__${propertyId}`).get()
  return membershipFromData(snapshot.exists ? snapshot.data() : undefined, uid, propertyId)
}

export function membershipFromData(data: Record<string, unknown> | undefined, uid: string, propertyId: string): PropertyMembership | null {
  if (!data) return null
  if (data.userId !== uid || data.propertyId !== propertyId || typeof data.role !== 'string') return null
  if (!['supportEngineer', 'clientExecutive', 'requester'].includes(data.role)) return null
  return { userId: uid, propertyId, role: data.role as PropertyMembership['role'], active: data.active === true }
}

export function requireSupportMembership(actor: Actor, membership: PropertyMembership | null) {
  if (actor.globalRole === 'superAdmin') return null
  if (!membership?.active || membership.role !== 'supportEngineer') throw new HttpError(403, 'forbidden', 'Support Engineer access is required for this Property')
  return membership
}

export async function requireSupport(db: Firestore, actor: Actor, propertyId: string) {
  if (actor.globalRole === 'superAdmin') return null
  const membership = await loadMembership(db, actor.uid, propertyId)
  return requireSupportMembership(actor, membership)
}

export async function requireAuditRead(db: Firestore, actor: Actor, propertyId: string | null) {
  if (actor.globalRole === 'superAdmin') return
  if (!propertyId) throw new HttpError(400, 'property_required', 'propertyId is required for non-admin Audit queries')
  const membership = await loadMembership(db, actor.uid, propertyId)
  if (!membership?.active || membership.role !== 'supportEngineer') throw new HttpError(403, 'forbidden', 'Support Engineer access is required for this Property')
}
