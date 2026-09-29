import type { DirectoryMembership, DirectoryUser } from './userDirectoryService'

export interface DirectoryRow {
  user: DirectoryUser
  membership: DirectoryMembership | null
}

export interface DirectoryPropertyGroup {
  key: string
  propertyId: string | null
  propertyCode: string | null
  propertyName: string | null
  kind: 'property' | 'all-properties' | 'unassigned'
  rows: DirectoryRow[]
}

/**
 * Groups the already-filtered directory rows for presentation only.
 * It intentionally does not fetch or merge records outside the loaded page.
 */
export function groupDirectoryRows(
  users: DirectoryUser[],
  membershipsByUser: ReadonlyMap<string, DirectoryMembership[]>,
): DirectoryPropertyGroup[] {
  const groups = new Map<string, DirectoryPropertyGroup>()

  function addRow(group: DirectoryPropertyGroup, row: DirectoryRow) {
    const current = groups.get(group.key)
    if (current) current.rows.push(row)
    else groups.set(group.key, { ...group, rows: [row] })
  }

  users.forEach((user) => {
    const memberships = (membershipsByUser.get(user.uid) ?? [])
      .slice()
      .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.propertyCode.localeCompare(b.propertyCode))

    if (user.globalRole === 'superAdmin') {
      addRow(
        {
          key: 'all-properties',
          propertyId: null,
          propertyCode: null,
          propertyName: null,
          kind: 'all-properties',
          rows: [],
        },
        { user, membership: null },
      )
      return
    }

    if (memberships.length === 0) {
      addRow(
        { key: 'unassigned', propertyId: null, propertyCode: null, propertyName: null, kind: 'unassigned', rows: [] },
        { user, membership: null },
      )
      return
    }

    memberships.forEach((membership) => {
      addRow(
        {
          key: `property:${membership.propertyId}`,
          propertyId: membership.propertyId,
          propertyCode: membership.propertyCode,
          propertyName: membership.propertyName,
          kind: 'property',
          rows: [],
        },
        { user, membership },
      )
    })
  })

  return [...groups.values()].sort((a, b) => {
    if (a.kind !== b.kind) {
      if (a.kind === 'property') return -1
      if (b.kind === 'property') return 1
      if (a.kind === 'all-properties') return -1
      return 1
    }
    return (
      (a.propertyName ?? '').localeCompare(b.propertyName ?? '') ||
      (a.propertyCode ?? '').localeCompare(b.propertyCode ?? '')
    )
  })
}
