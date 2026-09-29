import { getSlaSnapshot } from '../tickets/sla'
import type { TicketRecord } from '../tickets/types'

export interface PerformanceEngineerRow {
  uid: string
  displayName: string
  assigned: number
  completed: number
  open: number
  breached: number
  slaEligible: number
  slaMet: number
}

export interface PerformanceCountRow {
  label: string
  count: number
  share: number
}

export interface PerformanceSnapshot {
  total: number
  completed: number
  open: number
  cancelled: number
  unassigned: number
  breached: number
  slaEligible: number
  slaMet: number
  averageResolutionMinutes: number | null
  byEngineer: PerformanceEngineerRow[]
  byProperty: PerformanceCountRow[]
  byCategory: PerformanceCountRow[]
  byLocation: PerformanceCountRow[]
}

function addCount(map: Map<string, number>, label: string) {
  const normalized = label.trim() || 'Uncategorized'
  map.set(normalized, (map.get(normalized) ?? 0) + 1)
}

function toRows(map: Map<string, number>, total: number): PerformanceCountRow[] {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'en'))
    .map(([label, count]) => ({ label, count, share: total > 0 ? Math.round((count / total) * 100) : 0 }))
}

export function buildPerformanceSnapshot(
  tickets: TicketRecord[],
  engineerLabels: ReadonlyMap<string, string> = new Map(),
  now = new Date(),
): PerformanceSnapshot {
  const byEngineer = new Map<string, PerformanceEngineerRow>()
  const byProperty = new Map<string, number>()
  const byCategory = new Map<string, number>()
  const byLocation = new Map<string, number>()
  let completed = 0
  let open = 0
  let cancelled = 0
  let unassigned = 0
  let breached = 0
  let slaEligible = 0
  let slaMet = 0
  let resolutionMinutes = 0
  let resolvedCount = 0

  for (const ticket of tickets) {
    addCount(byProperty, ticket.propertyCode)
    addCount(byCategory, ticket.problemCategory || ticket.problemType)
    addCount(byLocation, ticket.location)

    const isCompleted = ticket.status === 'Completed'
    const isCancelled = ticket.status === 'Cancelled'
    if (isCompleted) completed += 1
    else if (isCancelled) cancelled += 1
    else open += 1

    const assignedUid = ticket.assignedEngineerUid.trim()
    if (!assignedUid) unassigned += 1
    const engineerKey = assignedUid || 'unassigned'
    const existing = byEngineer.get(engineerKey) ?? {
      uid: engineerKey,
      displayName: assignedUid ? engineerLabels.get(assignedUid) || assignedUid : 'Unassigned',
      assigned: 0,
      completed: 0,
      open: 0,
      breached: 0,
      slaEligible: 0,
      slaMet: 0,
    }
    if (assignedUid) existing.assigned += 1
    if (isCompleted) existing.completed += 1
    else if (!isCancelled) existing.open += 1

    const sla = getSlaSnapshot(ticket, now)
    if (!isCancelled && ticket.createdAt) {
      slaEligible += 1
      existing.slaEligible += 1
      if (sla.state === 'met') {
        slaMet += 1
        existing.slaMet += 1
      }
      if (sla.state === 'breached') {
        breached += 1
        existing.breached += 1
      }
    }
    if (isCompleted && ticket.createdAt && ticket.updatedAt && ticket.updatedAt >= ticket.createdAt) {
      resolutionMinutes += Math.round((ticket.updatedAt.getTime() - ticket.createdAt.getTime()) / 60000)
      resolvedCount += 1
    }
    byEngineer.set(engineerKey, existing)
  }

  return {
    total: tickets.length,
    completed,
    open,
    cancelled,
    unassigned,
    breached,
    slaEligible,
    slaMet,
    averageResolutionMinutes: resolvedCount > 0 ? Math.round(resolutionMinutes / resolvedCount) : null,
    byEngineer: [...byEngineer.values()].sort(
      (left, right) => right.assigned - left.assigned || left.displayName.localeCompare(right.displayName, 'en'),
    ),
    byProperty: toRows(byProperty, tickets.length),
    byCategory: toRows(byCategory, tickets.length),
    byLocation: toRows(byLocation, tickets.length),
  }
}

export function formatDurationMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function buildPerformanceCsv(
  tickets: TicketRecord[],
  engineerLabels: ReadonlyMap<string, string> = new Map(),
): string {
  const header = [
    'Task ID',
    'Property',
    'Category',
    'Location',
    'Priority',
    'Status',
    'Assignee',
    'Created At',
    'Updated At',
  ]
  const rows = tickets.map((ticket) => [
    `${ticket.propertyCode}-${ticket.id.toUpperCase()}`,
    ticket.propertyCode,
    ticket.problemCategory || ticket.problemType,
    ticket.location,
    ticket.priority,
    ticket.status,
    ticket.assignedEngineerUid
      ? engineerLabels.get(ticket.assignedEngineerUid) || ticket.assignedEngineerUid
      : 'Unassigned',
    ticket.createdAt?.toISOString() ?? '',
    ticket.updatedAt?.toISOString() ?? '',
  ])
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}
