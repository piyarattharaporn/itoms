import { Timestamp } from 'firebase-admin/firestore'
import {
  getSlaPolicy,
  isSlaPauseStatus,
  parseSlaPolicyConfig,
  type SlaLifecycleState,
  type SlaPauseReason,
  type SlaPolicy,
  type SlaResolutionStatus,
  type SlaResponseStatus,
} from '../shared/sla-contracts.js'
import type { Priority } from '../shared/ticket-contracts.js'

const minuteMs = 60_000

type SlaFields = {
  slaPolicyId: string
  slaPolicyVersion: string
  slaResponseTargetMinutes: number
  slaResolutionTargetMinutes: number
  slaStartedAt: Timestamp
  slaResponseDueAt: Timestamp
  slaResolutionDueAt: Timestamp
  slaResponseMetAt: Timestamp | null
  slaResolutionMetAt: Timestamp | null
  slaResponseStatus: SlaResponseStatus
  slaResolutionStatus: SlaResolutionStatus
  slaState: SlaLifecycleState
  slaPausedAt: Timestamp | null
  slaPauseReason: SlaPauseReason | ''
  slaPausedMinutes: number
  slaResponseBreached: boolean
  slaResolutionBreached: boolean
  slaLastEvaluatedAt: Timestamp
}

type RecordInput = Record<string, unknown>

function asTimestamp(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null
}

function asPriority(value: unknown): Priority {
  return value === 'Critical' || value === 'High' || value === 'Low' ? value : 'Medium'
}

function addMillis(value: Timestamp, milliseconds: number) {
  return Timestamp.fromMillis(value.toMillis() + Math.max(0, milliseconds))
}

function propertyPolicy(priority: Priority, propertyValue: unknown): SlaPolicy {
  const property =
    propertyValue && typeof propertyValue === 'object' && !Array.isArray(propertyValue)
      ? (propertyValue as RecordInput)
      : null
  const policy = parseSlaPolicyConfig(property?.slaPolicy)
  const target = policy?.targets[priority]
  if (!policy || !target) return getSlaPolicy(priority)
  return {
    id: `${policy.id}-v${policy.version}-${priority.toLowerCase()}`,
    responseMinutes: target.responseMinutes,
    resolutionMinutes: target.resolutionMinutes,
    calendar: policy.calendar,
  }
}

export function createSlaFields(priorityValue: unknown, startedAt: Timestamp, propertyValue?: unknown): SlaFields {
  const priority = asPriority(priorityValue)
  const policy = propertyPolicy(priority, propertyValue)
  return {
    slaPolicyId: policy.id.replace(/-v\d+-[a-z]+$/, ''),
    slaPolicyVersion: policy.id,
    slaResponseTargetMinutes: policy.responseMinutes,
    slaResolutionTargetMinutes: policy.resolutionMinutes,
    slaStartedAt: startedAt,
    slaResponseDueAt: addMillis(startedAt, policy.responseMinutes * minuteMs),
    slaResolutionDueAt: addMillis(startedAt, policy.resolutionMinutes * minuteMs),
    slaResponseMetAt: null,
    slaResolutionMetAt: null,
    slaResponseStatus: 'pending',
    slaResolutionStatus: 'running',
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
  const startedAt = asTimestamp(ticket.slaStartedAt) || asTimestamp(ticket.createdAt) || now
  const defaults = createSlaFields(priority, startedAt)
  const responseDueAt = asTimestamp(ticket.slaResponseDueAt) || defaults.slaResponseDueAt
  const resolutionDueAt = asTimestamp(ticket.slaResolutionDueAt) || defaults.slaResolutionDueAt
  const rawPauseReason = ticket.slaPauseReason
  const pauseReason: SlaPauseReason | '' =
    rawPauseReason === 'Waiting for User' || rawPauseReason === 'Waiting for Vendor' ? rawPauseReason : ''
  const rawState = ticket.slaState
  const state: SlaLifecycleState =
    rawState === 'paused' || rawState === 'met' || rawState === 'cancelled' ? rawState : 'running'
  const responseStatus: SlaResponseStatus =
    ticket.slaResponseStatus === 'pending' ||
    ticket.slaResponseStatus === 'met' ||
    ticket.slaResponseStatus === 'breached' ||
    ticket.slaResponseStatus === 'cancelled'
      ? ticket.slaResponseStatus
      : ticket.slaResponseMetAt
        ? ticket.slaResponseBreached === true
          ? 'breached'
          : 'met'
        : 'pending'
  const resolutionStatus: SlaResolutionStatus =
    ticket.slaResolutionStatus === 'running' ||
    ticket.slaResolutionStatus === 'paused' ||
    ticket.slaResolutionStatus === 'met' ||
    ticket.slaResolutionStatus === 'breached' ||
    ticket.slaResolutionStatus === 'cancelled'
      ? ticket.slaResolutionStatus
      : state === 'cancelled'
        ? 'cancelled'
        : state === 'paused'
          ? 'paused'
          : ticket.slaResolutionMetAt
            ? ticket.slaResolutionBreached === true
              ? 'breached'
              : 'met'
            : 'running'
  return {
    ...defaults,
    slaPolicyId: typeof ticket.slaPolicyId === 'string' ? ticket.slaPolicyId : defaults.slaPolicyId,
    slaPolicyVersion: typeof ticket.slaPolicyVersion === 'string' ? ticket.slaPolicyVersion : defaults.slaPolicyVersion,
    slaResponseTargetMinutes:
      typeof ticket.slaResponseTargetMinutes === 'number'
        ? ticket.slaResponseTargetMinutes
        : defaults.slaResponseTargetMinutes,
    slaResolutionTargetMinutes:
      typeof ticket.slaResolutionTargetMinutes === 'number'
        ? ticket.slaResolutionTargetMinutes
        : defaults.slaResolutionTargetMinutes,
    slaStartedAt: startedAt,
    slaResponseDueAt: responseDueAt,
    slaResolutionDueAt: resolutionDueAt,
    slaResponseMetAt: asTimestamp(ticket.slaResponseMetAt),
    slaResolutionMetAt: asTimestamp(ticket.slaResolutionMetAt),
    slaResponseStatus: responseStatus,
    slaResolutionStatus: resolutionStatus,
    slaState: state,
    slaPausedAt: asTimestamp(ticket.slaPausedAt),
    slaPauseReason: pauseReason,
    slaPausedMinutes:
      typeof ticket.slaPausedMinutes === 'number' && ticket.slaPausedMinutes >= 0 ? ticket.slaPausedMinutes : 0,
    slaResponseBreached: ticket.slaResponseBreached === true,
    slaResolutionBreached: ticket.slaResolutionBreached === true,
    slaLastEvaluatedAt: asTimestamp(ticket.slaLastEvaluatedAt) || now,
  }
}

export function transitionSla(ticket: Record<string, unknown>, nextStatus: string, now: Timestamp): SlaFields {
  const current = currentSla(ticket, now)
  let next = { ...current, slaLastEvaluatedAt: now }

  if (nextStatus === 'Cancelled') {
    return {
      ...next,
      slaState: 'cancelled',
      slaPausedAt: null,
      slaPauseReason: '',
      slaResponseStatus: current.slaResponseStatus === 'pending' ? 'cancelled' : current.slaResponseStatus,
      slaResolutionStatus: 'cancelled',
    }
  }

  if (isSlaPauseStatus(nextStatus) && current.slaResolutionStatus === 'running') {
    next = {
      ...next,
      slaState: 'paused',
      slaResolutionStatus: 'paused',
      slaPausedAt: now,
      slaPauseReason: nextStatus,
    }
  }

  if (!isSlaPauseStatus(nextStatus) && current.slaResolutionStatus === 'paused') {
    const pausedMillis = current.slaPausedAt ? Math.max(0, now.toMillis() - current.slaPausedAt.toMillis()) : 0
    next = {
      ...next,
      slaResolutionDueAt: addMillis(current.slaResolutionDueAt, pausedMillis),
      slaPausedAt: null,
      slaPauseReason: '',
      slaPausedMinutes: current.slaPausedMinutes + Math.floor(pausedMillis / minuteMs),
      slaResolutionStatus: 'running',
      slaState: 'running',
    }
  }

  if (nextStatus !== 'Pending' && !next.slaResponseMetAt) {
    next.slaResponseMetAt = now
    next.slaResponseStatus = now.toMillis() > next.slaResponseDueAt.toMillis() ? 'breached' : 'met'
  }
  next.slaResponseBreached = next.slaResponseBreached || now.toMillis() > next.slaResponseDueAt.toMillis()
  if (next.slaResponseBreached && next.slaResponseStatus !== 'cancelled') next.slaResponseStatus = 'breached'

  if (nextStatus === 'Completed') {
    next.slaResolutionMetAt = now
    next.slaResolutionBreached = now.toMillis() > next.slaResolutionDueAt.toMillis()
    next.slaResolutionStatus = next.slaResolutionBreached ? 'breached' : 'met'
    next.slaState = 'met'
  } else {
    next.slaResolutionBreached = next.slaResolutionBreached || now.toMillis() > next.slaResolutionDueAt.toMillis()
    if (next.slaResolutionBreached && next.slaResolutionStatus !== 'cancelled') next.slaResolutionStatus = 'breached'
    if (next.slaResolutionStatus !== 'paused' && next.slaResolutionStatus !== 'breached') {
      next.slaResolutionStatus = 'running'
      next.slaState = 'running'
    }
  }
  return next
}
