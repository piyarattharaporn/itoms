import { HttpError } from './errors.js'
import { ticketStatuses, type TicketStatus } from '../shared/ticket-contracts.js'

export { ticketStatuses }
export type { TicketStatus }

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && ticketStatuses.includes(value as TicketStatus)
}

export function validStatusTransition(from: string, to: TicketStatus) {
  return (from === 'Pending' && ['In Progress', 'Cancelled'].includes(to))
    || (from === 'In Progress' && ['Monitoring', 'Waiting for Vendor', 'Waiting for User', 'Completed', 'Cancelled'].includes(to))
    || (from === 'Monitoring' && ['In Progress', 'Completed', 'Cancelled'].includes(to))
    || (['Waiting for Vendor', 'Waiting for User'].includes(from) && ['In Progress', 'Cancelled'].includes(to))
}

export function requiredOperationKey(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw new HttpError(400, 'invalid_idempotency_key', 'idempotencyKey must be 8-128 safe characters')
  return value
}

export function requiredText(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) throw new HttpError(400, `invalid_${field}`, `${field} is invalid`)
  return value.trim()
}
