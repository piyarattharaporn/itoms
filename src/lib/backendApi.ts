import type { User } from 'firebase/auth'
import type { CreateTicketCommand } from '../../shared/ticket-contracts'

export const trustedBackendEnabled = import.meta.env.VITE_ENABLE_TRUSTED_BACKEND === 'true'
const baseUrl = (import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '')

async function postCommand<T>(user: User, path: string, payload: Record<string, unknown>): Promise<T> {
  const token = await user.getIdToken()
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({})) as { message?: string; error?: string }
  if (!response.ok) throw new Error(data.message || data.error || 'Trusted Backend command failed')
  return data as T
}

export function postTicketCreation(user: User, input: Omit<CreateTicketCommand, 'idempotencyKey'>) {
  return postCommand<{ ticketId: string; eventId: string; action: string }>(user, '/v1/tickets', { ...input, idempotencyKey: crypto.randomUUID() })
}

export function postTicketAssignment(user: User, ticketId: string, engineerUid: string) {
  return postCommand<{ ticketId: string; eventId: string; action: string }>(user, `/v1/tickets/${encodeURIComponent(ticketId)}/assign`, { engineerUid, idempotencyKey: crypto.randomUUID() })
}

export function postTicketStatus(user: User, ticketId: string, nextStatus: string, resolutionNotes = '') {
  return postCommand<{ ticketId: string; eventId: string; action: string; status: string }>(user, `/v1/tickets/${encodeURIComponent(ticketId)}/status`, { nextStatus, resolutionNotes, idempotencyKey: crypto.randomUUID() })
}
