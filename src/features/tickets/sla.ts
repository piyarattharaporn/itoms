import type { TicketRecord, TicketStatus } from './types'
import {
  getSlaPolicy as getSharedSlaPolicy,
  isSlaPauseStatus,
  type SlaPolicy as SharedSlaPolicy,
} from '../../../shared/sla-contracts'

export type SlaState = 'notStarted' | 'onTrack' | 'dueSoon' | 'breached' | 'met' | 'paused'
export type SlaPauseReason = 'Waiting for User' | 'Waiting for Vendor'

export type SlaPolicy = SharedSlaPolicy

export function getSlaPolicy(priority: TicketRecord['priority']): SlaPolicy {
  return getSharedSlaPolicy(priority)
}

export function isSlaPaused(status: TicketStatus): status is SlaPauseReason {
  return isSlaPauseStatus(status)
}

export function getSlaSnapshot(ticket: TicketRecord, now = new Date()) {
  const policy = getSlaPolicy(ticket.priority)
  if (!ticket.createdAt)
    return {
      state: 'notStarted' as const,
      dueAt: null,
      responseDueAt: null,
      remainingMinutes: null,
      responseRemainingMinutes: null,
      responseStatus: 'pending' as const,
      resolutionStatus: 'running' as const,
      policy,
    }
  const responseDueAt = ticket.slaResponseDueAt ?? new Date(ticket.createdAt.getTime() + policy.responseMinutes * 60000)
  const dueAt = ticket.slaResolutionDueAt ?? new Date(ticket.createdAt.getTime() + policy.resolutionMinutes * 60000)
  const responseStatus =
    ticket.slaResponseStatus ??
    (ticket.slaResponseMetAt ? (ticket.slaResponseBreached ? 'breached' : 'met') : 'pending')
  const resolutionStatus =
    ticket.slaResolutionStatus ??
    (ticket.slaState === 'paused' || isSlaPaused(ticket.status)
      ? 'paused'
      : ticket.slaResolutionMetAt
        ? ticket.slaResolutionBreached
          ? 'breached'
          : 'met'
        : 'running')
  if (ticket.status === 'Cancelled' || ticket.slaState === 'cancelled')
    return {
      state: 'notStarted' as const,
      dueAt: null,
      responseDueAt: null,
      remainingMinutes: null,
      responseRemainingMinutes: null,
      responseStatus: responseStatus === 'pending' ? ('cancelled' as const) : responseStatus,
      resolutionStatus: 'cancelled' as const,
      policy,
    }
  if (ticket.status === 'Completed')
    return {
      state: resolutionStatus === 'breached' || ticket.slaResolutionBreached ? ('breached' as const) : ('met' as const),
      dueAt,
      responseDueAt,
      remainingMinutes: null,
      responseRemainingMinutes: null,
      responseStatus,
      resolutionStatus,
      policy,
    }

  const remainingMinutes = Math.round((dueAt.getTime() - now.getTime()) / 60000)
  const responseRemainingMinutes =
    responseStatus === 'pending' ? Math.round((responseDueAt.getTime() - now.getTime()) / 60000) : null
  const dueSoonThresholdMinutes = Math.min(120, Math.max(1, Math.round(policy.resolutionMinutes * 0.2)))
  const state: SlaState =
    resolutionStatus === 'paused' && !ticket.slaResolutionBreached
      ? 'paused'
      : resolutionStatus === 'breached' || ticket.slaResolutionBreached || remainingMinutes <= 0
        ? 'breached'
        : remainingMinutes <= dueSoonThresholdMinutes
          ? 'dueSoon'
          : 'onTrack'
  return {
    state,
    dueAt,
    responseDueAt,
    remainingMinutes,
    responseRemainingMinutes,
    responseStatus,
    resolutionStatus,
    policy,
  }
}

export function slaStateLabel(state: SlaState) {
  if (state === 'met') return 'SLA met'
  if (state === 'breached') return 'SLA breached'
  if (state === 'dueSoon') return 'SLA due soon'
  if (state === 'paused') return 'SLA paused'
  if (state === 'onTrack') return 'SLA on track'
  return 'SLA pending'
}
