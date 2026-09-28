import { describe, expect, it } from 'vitest'
import { formatAssignableEngineerLabel } from '../../src/features/tickets/ticketService'

describe('ticket assignment labels', () => {
  it('uses the scoped Support Engineer display name', () => {
    expect(formatAssignableEngineerLabel({ uid: 'support-1', displayName: 'Somchai Support' })).toBe('Somchai Support')
  })

  it('falls back to the UID for legacy memberships without a name snapshot', () => {
    expect(formatAssignableEngineerLabel({ uid: 'support-legacy', displayName: '' })).toBe('support-legacy')
  })
})
