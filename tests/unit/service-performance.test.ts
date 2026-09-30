import { describe, expect, it } from 'vitest'
import {
  buildPerformanceCsv,
  buildPerformanceSnapshot,
  formatDurationMinutes,
} from '../../src/features/reporting/servicePerformance'
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
    department: 'Front Office',
    issueArea: 'Other',
    location: 'Front Office',
    assetId: '',
    problemCategory: 'Hardware',
    problemType: 'Computer PC',
    channel: 'Line',
    priority: 'Medium',
    status: 'Pending',
    description: 'Printer issue',
    resolutionNotes: '',
    assignedEngineerUid: '',
    assignedAt: null,
    assignedByUid: '',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T01:00:00.000Z'),
    completedAt: null,
    lastEventId: 'event-1',
    ...overrides,
  }
}

describe('service performance reporting', () => {
  it('aggregates bounded ticket rows by assignee and quality state', () => {
    const snapshot = buildPerformanceSnapshot(
      [
        ticket({
          id: 'one',
          assignedEngineerUid: 'eng-1',
          status: 'Completed',
          completedAt: new Date('2026-09-01T02:00:00.000Z'),
          updatedAt: new Date('2026-09-03T02:00:00.000Z'),
        }),
        ticket({ id: 'two', assignedEngineerUid: 'eng-1', status: 'Pending', location: 'Office' }),
        ticket({ id: 'three', status: 'Cancelled', propertyCode: 'P2' }),
      ],
      new Map([['eng-1', 'Aom']]),
      new Date('2026-09-02T00:00:00.000Z'),
    )

    expect(snapshot.total).toBe(3)
    expect(snapshot.completed).toBe(1)
    expect(snapshot.open).toBe(1)
    expect(snapshot.cancelled).toBe(1)
    expect(snapshot.unassigned).toBe(1)
    expect(snapshot.averageResolutionMinutes).toBe(120)
    expect(
      buildPerformanceSnapshot([ticket({ status: 'Completed', updatedAt: new Date('2026-09-04T00:00:00.000Z') })])
        .averageResolutionMinutes,
    ).toBeNull()
    expect(snapshot.byEngineer[0]).toMatchObject({ displayName: 'Aom', assigned: 2, completed: 1, open: 1 })
    expect(snapshot.byProperty).toEqual(expect.arrayContaining([{ label: 'P1', count: 2, share: 67 }]))
  })

  it('keeps duration and CSV export deterministic', () => {
    expect(formatDurationMinutes(null)).toBe('—')
    expect(formatDurationMinutes(1500)).toBe('1d 1h')
    const csv = buildPerformanceCsv([ticket({ description: 'ignored, field' })], new Map())
    expect(csv).toContain('Task ID,Property,Category')
    expect(csv).toContain('P1-TICKET-1')
    expect(csv).not.toContain('ignored, field')
  })
})
