import { t } from '../../lib/i18n'
import {
  priorities,
  ticketIssueAreas,
  ticketStatuses,
  type Priority,
  type TicketIssueArea,
  type TicketStatus,
} from '../../../shared/ticket-contracts'
import type { SlaLifecycleState, SlaResolutionStatus, SlaResponseStatus } from '../../../shared/sla-contracts'

export { priorities, ticketIssueAreas, ticketStatuses }
export type { Priority, TicketIssueArea, TicketStatus }

// รายการเริ่มต้นแก้ไข/เพิ่มได้จาก Catalog Settings แยกตาม Property
export const ticketChannels = ['Line', 'Message Box', 'Personal Call', 'Other'] as const
export const legacyTicketChannels = ['Line', 'Message Box', 'Personal Call', 'Other'] as const

export type ProblemType = string
export type TicketChannel = string

export function formatTicketChannel(channel: string): string {
  return channel === 'Line' ? 'LINE' : channel
}

export interface TicketRecord {
  id: string
  schemaVersion: 1 | 2 | 3
  propertyId: string
  propertyCode: string
  requesterUid: string
  requesterName: string
  requesterEmail: string
  department: string
  issueArea: TicketIssueArea | 'Uncategorized'
  location: string
  assetId: string
  problemCategory: string
  problemType: ProblemType
  channel: TicketChannel
  priority: Priority
  status: TicketStatus
  description: string
  resolutionNotes: string
  assignedEngineerUid: string
  assignedAt: Date | null
  assignedByUid: string
  createdAt: Date | null
  updatedAt: Date | null
  completedAt: Date | null
  lastEventId: string
  slaPolicyId?: string
  slaPolicyVersion?: string
  slaResponseTargetMinutes?: number
  slaResolutionTargetMinutes?: number
  slaStartedAt?: Date | null
  slaResponseDueAt?: Date | null
  slaResolutionDueAt?: Date | null
  slaResponseMetAt?: Date | null
  slaResolutionMetAt?: Date | null
  slaResponseStatus?: SlaResponseStatus
  slaResolutionStatus?: SlaResolutionStatus
  slaState?: SlaLifecycleState
  slaPausedAt?: Date | null
  slaPauseReason?: 'Waiting for User' | 'Waiting for Vendor' | ''
  slaPausedMinutes?: number
  slaResponseBreached?: boolean
  slaResolutionBreached?: boolean
  slaLastEvaluatedAt?: Date | null
}

export interface TicketEvent {
  id: string
  actorUid: string
  fromStatus: TicketStatus | null
  toStatus: TicketStatus
  note: string
  createdAt: Date | null
  type: 'created' | 'statusChanged' | 'assigned' | 'reassigned' | 'unassigned' | 'edited'
  fromAssignedEngineerUid?: string
  toAssignedEngineerUid?: string
  changedFields?: string[]
}

export interface CreateTicketInput {
  propertyId: string
  propertyCode: string
  requesterUid: string
  requesterName: string
  requesterEmail: string
  department: string
  issueArea: TicketIssueArea
  location: string
  assetId: string
  problemCategory: string
  problemType: ProblemType
  channel: TicketChannel
  priority: Priority
  description: string
}

export function formatTicketProblem(problemCategory: string, problemType: string) {
  const category = t(problemCategory)
  const type = t(problemType)
  return category ? `${category} / ${type}` : type
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && ticketStatuses.includes(value as TicketStatus)
}

export function isProblemType(value: unknown): value is ProblemType {
  return typeof value === 'string' && value.length > 0 && value.length <= 80
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && priorities.includes(value as Priority)
}

export function statusTransitions(status: TicketStatus): TicketStatus[] {
  switch (status) {
    case 'Pending':
      return ['In Progress', 'Cancelled']
    case 'In Progress':
      return ['Monitoring', 'Waiting for Vendor', 'Waiting for User', 'Completed', 'Cancelled']
    case 'Monitoring':
      return ['In Progress', 'Completed', 'Cancelled']
    case 'Waiting for Vendor':
    case 'Waiting for User':
      return ['In Progress', 'Cancelled']
    case 'Completed':
    case 'Cancelled':
      return []
  }
}
