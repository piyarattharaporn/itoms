import { describe, expect, it } from 'vitest'
import { getSlaSnapshot } from '../../src/features/tickets/sla'
import type { TicketRecord } from '../../src/features/tickets/types'

function ticket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    id: 'ticket-1',
    schemaVersion: 3,
    propertyId: 'property-1',
    propertyCode: 'P1',
    requesterUid: 'requester-1',
    requesterName: 'Requester',
    requesterEmail: 'requester@example.test',
    department: 'IT',
    issueArea: 'Other',
    location: 'Office',
    assetId: '',
    problemCategory: 'Network',
    problemType: 'WiFi Connections',
    channel: 'Line',
    priority: 'Medium',
    status: 'Pending',
    description: 'Network access is unavailable',
    resolutionNotes: '',
    assignedEngineerUid: '',
    assignedAt: null,
    assignedByUid: '',
    createdAt: new Date('2026-09-28T00:00:00.000Z'),
    updatedAt: new Date('2026-09-28T00:00:00.000Z'),
    completedAt: null,
    lastEventId: 'event-1',
    ...overrides,
  }
}

describe('getSlaSnapshot', () => {
  it('returns pending when a ticket has no creation timestamp', () => {
    expect(getSlaSnapshot(ticket({ createdAt: null })).state).toBe('notStarted')
  })

  it('classifies an active ticket as on track, due soon, or breached', () => {
    const createdAt = new Date('2026-09-28T00:00:00.000Z')
    expect(getSlaSnapshot(ticket({ createdAt }), new Date('2026-09-28T01:00:00.000Z')).state).toBe('onTrack')
    expect(getSlaSnapshot(ticket({ createdAt }), new Date('2026-09-28T22:00:00.000Z')).state).toBe('dueSoon')
    expect(getSlaSnapshot(ticket({ createdAt }), new Date('2026-09-29T00:01:00.000Z')).state).toBe('breached')
  })

  it('keeps completed, paused, and cancelled states deterministic', () => {
    expect(getSlaSnapshot(ticket({ status: 'Completed' })).state).toBe('met')
    expect(getSlaSnapshot(ticket({ status: 'Waiting for User' })).state).toBe('paused')
    expect(getSlaSnapshot(ticket({ status: 'Cancelled' })).state).toBe('notStarted')
  })
})
