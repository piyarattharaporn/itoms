import { describe, expect, it } from 'vitest'
import { validateTicketEditCommand } from '../../shared/ticket-contracts'

const validEdit = {
  location: 'Front Office',
  department: 'IT',
  assetId: 'ASSET-001',
  description: 'Corrected the work area after confirming the physical location.',
  priority: 'High',
  reason: 'The original location was entered incorrectly.',
  idempotencyKey: 'edit-command-1',
}

describe('ticket edit command contract', () => {
  it('accepts the controlled operational edit fields', () => {
    expect(validateTicketEditCommand(validEdit).ok).toBe(true)
  })

  it('rejects injected fields, invalid priority, and a short reason', () => {
    const result = validateTicketEditCommand({
      ...validEdit,
      priority: 'Urgent',
      reason: 'x',
      injectedField: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toEqual(
        expect.arrayContaining(['injectedField', 'priority', 'reason']),
      )
    }
  })
})
