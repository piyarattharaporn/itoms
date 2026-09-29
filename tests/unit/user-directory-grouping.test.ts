import { describe, expect, it } from 'vitest'
import { groupDirectoryRows } from '../../src/features/users/userDirectoryGrouping'
import type { DirectoryMembership, DirectoryUser } from '../../src/features/users/userDirectoryService'

const user = (uid: string, displayName: string, globalRole: DirectoryUser['globalRole'] = 'member'): DirectoryUser => ({
  uid,
  displayName,
  email: `${uid}@example.test`,
  globalRole,
  active: true,
})
const membership = (
  id: string,
  userId: string,
  propertyId: string,
  propertyCode: string,
  propertyName: string,
): DirectoryMembership => ({ id, userId, propertyId, propertyCode, propertyName, role: 'requester', active: true })

describe('user directory property grouping', () => {
  it('groups memberships by property while preserving users assigned to multiple properties', () => {
    const first = user('u1', 'Alpha')
    const second = user('u2', 'Beta')
    const memberships = new Map([
      ['u1', [membership('m1', 'u1', 'p1', 'P1', 'Palm'), membership('m2', 'u1', 'p2', 'P2', 'Beach')]],
      ['u2', [membership('m3', 'u2', 'p1', 'P1', 'Palm')]],
    ])

    const groups = groupDirectoryRows([first, second], memberships)

    expect(groups.map((group) => [group.key, group.rows.map((row) => row.user.uid)])).toEqual([
      ['property:p2', ['u1']],
      ['property:p1', ['u1', 'u2']],
    ])
  })

  it('keeps global-only users in explicit special groups', () => {
    const groups = groupDirectoryRows([user('admin', 'Admin', 'superAdmin'), user('orphan', 'Orphan')], new Map())

    expect(groups.map((group) => group.kind)).toEqual(['all-properties', 'unassigned'])
    expect(groups[0].rows[0].user.uid).toBe('admin')
    expect(groups[1].rows[0].user.uid).toBe('orphan')
  })
})
