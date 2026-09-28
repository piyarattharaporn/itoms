import { Timestamp } from 'firebase-admin/firestore'
import { getSlaPolicy, isSlaPauseStatus, type SlaLifecycleState, type SlaPauseReason } from '../shared/sla-contracts.js'
import type { Priority } from '../shared/ticket-contracts.js'

const minuteMs = 60_000

type SlaFields = {
  slaPolicyVersion: string
  slaResponseTargetMinutes: number
  slaResolutionTargetMinutes: number
  slaStartedAt: Timestamp
  slaResponseDueAt: Timestamp
  slaResolutionDueAt: Timestamp
  slaResponseMetAt: Timestamp | null
  slaResolutionMetAt: Timestamp | null
  slaState: SlaLifecycleState
  slaPausedAt: Timestamp | null
  slaPauseReason: SlaPauseReason | ''
  slaPausedMinutes: number
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
  slaLastEvaluatedAt: Timestamp
}

function asTimestamp(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null
}

function asPriority(value: unknown): Priority {
  return value === 'Critical' || value === 'High' || value === 'Low' ? value : 'Medium'
}

function addMillis(value: Timestamp, milliseconds: number) {
  return Timestamp.fromMillis(value.toMillis() + Math.max(0, milliseconds))
}

export function createSlaFields(priorityValue: unknown, startedAt: Timestamp): SlaFields {
  const policy = getSlaPolicy(asPriority(priorityValue))
  return {
    slaPolicyVersion: policy.id,
    slaResponseTargetMinutes: policy.responseMinutes,
    slaResolutionTargetMinutes: policy.resolutionMinutes,
    slaStartedAt: startedAt,
    slaResponseDueAt: addMillis(startedAt, policy.responseMinutes * minuteMs),
    slaResolutionDueAt: addMillis(startedAt, policy.resolutionMinutes * minuteMs),
    slaResponseMetAt: null,
    slaResolutionMetAt: null,
    slaState: 'running',
    slaPausedAt: null,
    slaPauseReason: '',
    slaPausedMinutes: 0,
    slaResponseBreached: false,
    slaResolutionBreached: false,
    slaLastEvaluatedAt: startedAt,
  }
}

function currentSla(ticket: Record<string, unknown>, now: Timestamp): SlaFields {
  const priority = asPriority(ticket.priority)
  const policy = getSlaPolicy(priority)
  const startedAt = asTimestamp(ticket.slaStartedAt) || asTimestamp(ticket.createdAt) || now
  const defaults = createSlaFields(priority, startedAt)
  const responseDueAt = asTimestamp(ticket.slaResponseDueAt) || defaults.slaResponseDueAt
  const resolutionDueAt = asTimestamp(ticket.slaResolutionDueAt) || defaults.slaResolutionDueAt
  const rawPauseReason = ticket.slaPauseReason
  const pauseReason: SlaPauseReason | '' = rawPauseReason === 'Waiting for User' || rawPauseReason === 'Waiting for Vendor' ? rawPauseReason : ''
  const rawState = ticket.slaState
  const state: SlaLifecycleState = rawState === 'paused' || rawState === 'met' || rawState === 'cancelled' ? rawState : 'running'
  return {
    ...defaults,
    slaPolicyVersion: typeof ticket.slaPolicyVersion === 'string' ? ticket.slaPolicyVersion : policy.id,
    slaResponseTargetMinutes: typeof ticket.slaResponseTargetMinutes === 'number' ? ticket.slaResponseTargetMinutes : policy.responseMinutes,
    slaResolutionTargetMinutes: typeof ticket.slaResolutionTargetMinutes === 'number' ? ticket.slaResolutionTargetMinutes : policy.resolutionMinutes,
    slaStartedAt: startedAt,
    slaResponseDueAt: responseDueAt,
    slaResolutionDueAt: resolutionDueAt,
    slaResponseMetAt: asTimestamp(ticket.slaResponseMetAt),
    slaResolutionMetAt: asTimestamp(ticket.slaResolutionMetAt),
    slaState: state,
    slaPausedAt: asTimestamp(ticket.slaPausedAt),
    slaPauseReason: pauseReason,
    slaPausedMinutes: typeof ticket.slaPausedMinutes === 'number' && ticket.slaPausedMinutes >= 0 ? ticket.slaPausedMinutes : 0,
    slaResponseBreached: ticket.slaResponseBreached === true,
    slaResolutionBreached: ticket.slaResolutionBreached === true,
    slaLastEvaluatedAt: asTimestamp(ticket.slaLastEvaluatedAt) || now,
  }
}

export function transitionSla(ticket: Record<string, unknown>, nextStatus: string, now: Timestamp): SlaFields {
  const current = currentSla(ticket, now)
  let next = { ...current, slaLastEvaluatedAt: now }

  if (nextStatus === 'Cancelled') {
    return { ...next, slaState: 'cancelled', slaPausedAt: null, slaPauseReason: '' }
  }

  if (isSlaPauseStatus(nextStatus) && current.slaState === 'running') {
    return { ...next, slaState: 'paused', slaPausedAt: now, slaPauseReason: nextStatus }
  }

  if (!isSlaPauseStatus(nextStatus) && current.slaState === 'paused') {
    const pausedMillis = current.slaPausedAt ? Math.max(0, now.toMillis() - current.slaPausedAt.toMillis()) : 0
    next = {
      ...next,
      slaResponseDueAt: addMillis(current.slaResponseDueAt, pausedMillis),
      slaResolutionDueAt: addMillis(current.slaResolutionDueAt, pausedMillis),
      slaPausedAt: null,
      slaPauseReason: '',
      slaPausedMinutes: current.slaPausedMinutes + Math.floor(pausedMillis / minuteMs),
      slaState: 'running',
    }
  }

  if (nextStatus !== 'Pending' && !next.slaResponseMetAt) next.slaResponseMetAt = now
  next.slaResponseBreached = next.slaResponseBreached || now.toMillis() > next.slaResponseDueAt.toMillis()

  if (nextStatus === 'Completed') {
    next.slaResolutionMetAt = now
    next.slaResolutionBreached = now.toMillis() > next.slaResolutionDueAt.toMillis()
    next.slaState = 'met'
  } else {
    next.slaResolutionBreached = next.slaResolutionBreached || now.toMillis() > next.slaResolutionDueAt.toMillis()
  }
  return next
}
