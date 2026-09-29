export const priorities = ['Low', 'Medium', 'High', 'Critical'] as const
export type Priority = (typeof priorities)[number]

export const ticketStatuses = [
  'Pending',
  'In Progress',
  'Monitoring',
  'Waiting for Vendor',
  'Waiting for User',
  'Completed',
  'Cancelled',
] as const
export type TicketStatus = (typeof ticketStatuses)[number]

export const ticketIssueAreas = ['Guest Property Problem', 'BOH (Back of House)', 'Office / Corporate', 'Other'] as const
export type TicketIssueArea = (typeof ticketIssueAreas)[number]

export interface CreateTicketCommand {
  propertyId: string
  propertyCode: string
  requesterName: string
  requesterEmail: string
  department: string
  issueArea: TicketIssueArea
  location: string
  assetId: string
  problemCategory: string
  problemType: string
  channel: string
  priority: Priority
  description: string
  idempotencyKey: string
}

export interface TicketStatusCommand {
  nextStatus: TicketStatus
  resolutionNotes: string
  idempotencyKey: string
}

export interface TicketAssignmentCommand {
  engineerUid: string
  idempotencyKey: string
}

export interface TicketEditCommand {
  location: string
  department: string
  assetId: string
  description: string
  priority: Priority
  reason: string
  idempotencyKey: string
}

export interface ContractIssue {
  field: string
  code: 'required' | 'type' | 'format' | 'length' | 'unknown_field'
}

type RecordInput = Record<string, unknown>

function asRecord(input: unknown): RecordInput | null {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as RecordInput : null
}

function onlyKeys(input: RecordInput, allowed: readonly string[]): ContractIssue[] {
  const accepted = new Set(allowed)
  return Object.keys(input)
    .filter((key) => !accepted.has(key))
    .map((field) => ({ field, code: 'unknown_field' as const }))
}

function requiredString(input: RecordInput, field: string, min: number, max: number, issues: ContractIssue[]) {
  const value = input[field]
  if (typeof value !== 'string') {
    issues.push({ field, code: value == null ? 'required' : 'type' })
    return ''
  }
  const clean = value.trim()
  if (clean.length < min || clean.length > max) issues.push({ field, code: 'length' })
  return clean
}

function idempotencyKey(input: RecordInput, issues: ContractIssue[]) {
  const value = requiredString(input, 'idempotencyKey', 8, 128, issues)
  if (value && !/^[A-Za-z0-9._:-]+$/.test(value)) issues.push({ field: 'idempotencyKey', code: 'format' })
  return value
}

function result<T>(value: T, issues: ContractIssue[]) {
  return issues.length ? { ok: false as const, issues } : { ok: true as const, value }
}

export function validateCreateTicketCommand(input: unknown) {
  const record = asRecord(input)
  if (!record) return { ok: false as const, issues: [{ field: 'body', code: 'type' as const }] }
  const allowed = ['propertyId', 'propertyCode', 'requesterName', 'requesterEmail', 'department', 'issueArea', 'location', 'assetId', 'problemCategory', 'problemType', 'channel', 'priority', 'description', 'idempotencyKey'] as const
  const issues = onlyKeys(record, allowed)
  const propertyId = requiredString(record, 'propertyId', 1, 160, issues)
  const propertyCode = requiredString(record, 'propertyCode', 1, 40, issues)
  const requesterName = requiredString(record, 'requesterName', 1, 120, issues)
  const requesterEmail = requiredString(record, 'requesterEmail', 6, 254, issues).toLowerCase()
  if (requesterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) issues.push({ field: 'requesterEmail', code: 'format' })
  const department = requiredString(record, 'department', 1, 80, issues)
  const location = requiredString(record, 'location', 1, 160, issues)
  const assetId = requiredString(record, 'assetId', 0, 160, issues)
  const problemCategory = requiredString(record, 'problemCategory', 1, 80, issues)
  const problemType = requiredString(record, 'problemType', 1, 80, issues)
  const channel = requiredString(record, 'channel', 1, 80, issues)
  const description = requiredString(record, 'description', 10, 4000, issues)
  const issueArea = record.issueArea
  if (!ticketIssueAreas.includes(issueArea as TicketIssueArea)) issues.push({ field: 'issueArea', code: 'format' })
  const priority = record.priority
  if (!priorities.includes(priority as Priority)) issues.push({ field: 'priority', code: 'format' })
  const key = idempotencyKey(record, issues)
  return result({ propertyId, propertyCode, requesterName, requesterEmail, department, issueArea: issueArea as TicketIssueArea, location, assetId, problemCategory, problemType, channel, priority: priority as Priority, description, idempotencyKey: key }, issues)
}

export function validateTicketStatusCommand(input: unknown) {
  const record = asRecord(input)
  if (!record) return { ok: false as const, issues: [{ field: 'body', code: 'type' as const }] }
  const allowed = ['nextStatus', 'resolutionNotes', 'idempotencyKey'] as const
  const issues = onlyKeys(record, allowed)
  const nextStatus = record.nextStatus
  if (!ticketStatuses.includes(nextStatus as TicketStatus)) issues.push({ field: 'nextStatus', code: 'format' })
  const resolutionNotes = typeof record.resolutionNotes === 'undefined' ? '' : requiredString(record, 'resolutionNotes', 0, 4000, issues)
  const key = idempotencyKey(record, issues)
  return result({ nextStatus: nextStatus as TicketStatus, resolutionNotes, idempotencyKey: key }, issues)
}

export function validateTicketAssignmentCommand(input: unknown) {
  const record = asRecord(input)
  if (!record) return { ok: false as const, issues: [{ field: 'body', code: 'type' as const }] }
  const allowed = ['engineerUid', 'idempotencyKey'] as const
  const issues = onlyKeys(record, allowed)
  const engineerUid = requiredString(record, 'engineerUid', 0, 128, issues)
  const key = idempotencyKey(record, issues)
  return result({ engineerUid, idempotencyKey: key }, issues)
}

export function validateTicketEditCommand(input: unknown) {
  const record = asRecord(input)
  if (!record) return { ok: false as const, issues: [{ field: 'body', code: 'type' as const }] }
  const allowed = ['location', 'department', 'assetId', 'description', 'priority', 'reason', 'idempotencyKey'] as const
  const issues = onlyKeys(record, allowed)
  const location = requiredString(record, 'location', 1, 160, issues)
  const department = requiredString(record, 'department', 0, 80, issues)
  const assetId = requiredString(record, 'assetId', 0, 160, issues)
  const description = requiredString(record, 'description', 10, 4000, issues)
  const priority = record.priority
  if (!priorities.includes(priority as Priority)) issues.push({ field: 'priority', code: 'format' })
  const reason = requiredString(record, 'reason', 3, 500, issues)
  const key = idempotencyKey(record, issues)
  return result({ location, department, assetId, description, priority: priority as Priority, reason, idempotencyKey: key }, issues)
}
