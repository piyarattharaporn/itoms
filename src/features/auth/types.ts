import type { SlaPolicyConfig } from '../../../shared/sla-contracts'

export type GlobalRole = 'superAdmin' | 'member'

export type PropertyRole = 'supportEngineer' | 'clientExecutive' | 'requester'

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  globalRole: GlobalRole
  active: boolean
}

export interface PropertyMembership {
  id: string
  userId: string
  propertyId: string
  propertyCode: string
  propertyName: string
  role: PropertyRole
  active: boolean
}

export interface PropertyOption {
  id: string
  code: string
  name: string
  cctvEnabled?: boolean
  slaPolicy?: SlaPolicyConfig | null
}
