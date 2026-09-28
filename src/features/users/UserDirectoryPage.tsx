import { useEffect, useMemo, useState } from 'react'
import { t } from '../../lib/i18n'
import { useAuth } from '../auth/AuthProvider'
import type { PropertyRole } from '../auth/types'
import { getUserDirectoryPage, type DirectoryPageCursor, type DirectoryMembership, type DirectoryUser } from './userDirectoryService'

type RoleFilter = 'all' | 'superAdmin' | 'member'
type PropertyRoleFilter = 'all' | PropertyRole

function roleLabel(role: DirectoryUser['globalRole']) {
  return role === 'superAdmin' ? t('Super Admin') : role === 'member' ? t('สมาชิก') : t('ไม่ทราบ Role')
}

function propertyRoleLabel(role: DirectoryMembership['role']) {
  if (role === 'supportEngineer') return t('IT Support Engineer (Team Admin)')
  if (role === 'clientExecutive') return t('Client Executive')
  return t('Requester')
}

export function UserDirectoryPage() {
  const { profile, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [memberships, setMemberships] = useState<DirectoryMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [propertyRoleFilter, setPropertyRoleFilter] = useState<PropertyRoleFilter>('all')
  const [nextCursor, setNextCursor] = useState<DirectoryPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (accessState === 'loading') return
    if (!isSuperAdmin) {
      setUsers([])
      setMemberships([])
      setLoading(false)
      setError(t('หน้านี้สำหรับ Super Admin เท่านั้น'))
      return
    }
    setLoading(true)
    setError(null)
    setUsers([]); setMemberships([]); setNextCursor(null); setHasMore(false)
    void getUserDirectoryPage().then((page) => {
      const first = page.items[0]
      setUsers(first?.users ?? []); setMemberships(first?.memberships ?? [])
      setNextCursor(page.nextCursor); setHasMore(page.hasMore); setLoading(false)
    }).catch((cause) => { setError(cause instanceof Error ? cause.message : t('โหลด User Directory ไม่สำเร็จ')); setLoading(false) })
  }, [accessState, isSuperAdmin])

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const page = await getUserDirectoryPage(25, nextCursor)
      const next = page.items[0]
      setUsers((current) => [...current, ...(next?.users ?? [])])
      setMemberships((current) => [...current, ...(next?.memberships ?? [])])
      setNextCursor(page.nextCursor); setHasMore(page.hasMore)
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('โหลด User Directory ไม่สำเร็จ')) }
    finally { setLoading(false) }
  }

  const membershipsByUser = useMemo(() => {
    const result = new Map<string, DirectoryMembership[]>()
    memberships.forEach((item) => {
      result.set(item.userId, [...(result.get(item.userId) ?? []), item])
    })
    return result
  }, [memberships])

  const counts = useMemo(() => ({
    superAdmin: users.filter((user) => user.globalRole === 'superAdmin').length,
    members: users.filter((user) => user.globalRole === 'member').length,
    active: users.filter((user) => user.active).length,
    support: memberships.filter((item) => item.active && item.role === 'supportEngineer').length,
    executives: memberships.filter((item) => item.active && item.role === 'clientExecutive').length,
    requesters: memberships.filter((item) => item.active && item.role === 'requester').length,
  }), [users, memberships])

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.globalRole === roleFilter
      const assignedRoles = membershipsByUser.get(user.uid) ?? []
      const matchesPropertyRole = propertyRoleFilter === 'all' || assignedRoles.some((item) => item.role === propertyRoleFilter)
      const matchesSearch = !term || [user.displayName, user.email, user.uid, ...assignedRoles.flatMap((item) => [item.propertyCode, item.propertyName, item.role])]
        .some((value) => value.toLocaleLowerCase().includes(term))
      return matchesRole && matchesPropertyRole && matchesSearch
    }).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email))
  }, [users, membershipsByUser, search, roleFilter, propertyRoleFilter])

  if (accessState === 'loading') return <p className="py-10 text-center text-sm text-slate-500" role="status">{t('กำลังโหลด User Directory…')}</p>
  if (!isSuperAdmin) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">{t(error)}</p>

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-lotus-700">{t("Administration")}</p><h2 className="mt-1 text-lg font-semibold">{t('User Directory')}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{t('ผู้ใช้ที่มี Profile ในระบบและ Role ที่ได้รับมอบหมาย')}</p></div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800"><p className="text-xs text-slate-500">{t('ผู้ใช้ที่โหลดแล้ว')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{users.length}</p></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">{t('บัญชีที่ Active')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{counts.active}</p></article>
        <article className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">{t("Super Admin")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{counts.superAdmin}</p></article>
        <article className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">{t('สมาชิก')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{counts.members}</p></article>
        <article className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">{propertyRoleLabel('supportEngineer')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{counts.support}</p><p className="text-[11px] text-slate-400">{t('จำนวน Active Membership')}</p></article>
        <article className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">{t('Client Executive')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{counts.executives}</p><p className="text-[11px] text-slate-400">{t('จำนวน Active Membership')}</p></article>
        <article className="rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">{t('Requester')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{counts.requesters}</p><p className="text-[11px] text-slate-400">{t('จำนวน Active Membership')}</p></article>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="min-w-56 flex-1 text-sm font-medium text-slate-700" htmlFor="user-directory-search">{t('ค้นหาผู้ใช้')}<input autoComplete="off" className="form-input mt-1 w-full" id="user-directory-search" onChange={(event) => setSearch(event.target.value)} placeholder={t('ชื่อ, Email, UID หรือ Property')} type="search" value={search} /></label>
        <label className="text-sm font-medium text-slate-700" htmlFor="user-directory-role">{t('Global Role')}<select className="form-select mt-1 w-full" id="user-directory-role" onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} value={roleFilter}><option value="all">{t('ทุก Role')}</option><option value="superAdmin">{t("Super Admin")}</option><option value="member">{t('สมาชิก')}</option></select></label>
        <label className="text-sm font-medium text-slate-700" htmlFor="user-directory-property-role">{t('Role ใน Property')}<select className="form-select mt-1 w-full" id="user-directory-property-role" onChange={(event) => setPropertyRoleFilter(event.target.value as PropertyRoleFilter)} value={propertyRoleFilter}><option value="all">{t('ทุก Role')}</option><option value="supportEngineer">{propertyRoleLabel('supportEngineer')}</option><option value="clientExecutive">{t('Client Executive')}</option><option value="requester">{t('Requester')}</option></select></label>
      </div>
    </section>

    {hasMore && <div className="text-center"><button className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-lotus-700 hover:bg-lotus-50 disabled:opacity-50" disabled={loading} onClick={() => void loadMore()} type="button">{loading ? t('กำลังโหลด…') : t('โหลดผู้ใช้ถัดไป')}</button></div>}

    {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{t(error)}</p>}
    {loading ? <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500" role="status">{t('กำลังโหลดผู้ใช้…')}</p> : visibleUsers.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t('ไม่พบผู้ใช้ตามตัวกรอง')}</p> : <section aria-label={t('ผู้ใช้ทั้งหมด')} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100/60">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
          <th className="px-4 py-3 font-semibold">{t('ผู้ใช้')}</th><th className="px-4 py-3 font-semibold">{t('สิทธิ์ระบบ')}</th><th className="px-4 py-3 font-semibold">{t('Role ใน Property')}</th><th className="px-4 py-3 font-semibold">{t("Property")}</th><th className="px-4 py-3 font-semibold">{t('สถานะ')}</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{visibleUsers.flatMap((user) => {
          const assignedRoles = (membershipsByUser.get(user.uid) ?? []).slice().sort((a, b) => a.propertyName.localeCompare(b.propertyName))
          const rows: Array<DirectoryMembership | null> = user.globalRole === 'superAdmin' ? [null] : assignedRoles.length ? assignedRoles : [null]
          return rows.map((membership) => <tr className="align-top hover:bg-slate-50/70" key={`${user.uid}-${membership?.id ?? 'no-membership'}`}>
            <td className="max-w-72 px-4 py-3"><p className="font-semibold text-slate-900">{user.displayName || t('ไม่ระบุชื่อ')}</p><p className="mt-0.5 break-all text-xs text-slate-500">{user.email || t('ไม่มี Email ใน Profile')}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-400">UID: {user.uid}</p></td>
            <td className="px-4 py-3"><span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">{roleLabel(user.globalRole)}</span></td>
            <td className="px-4 py-3 text-slate-700">{membership ? t(propertyRoleLabel(membership.role)) : user.globalRole === 'superAdmin' ? '—' : t('ยังไม่มี Active Membership')}</td>
            <td className="px-4 py-3 font-medium text-slate-800">{user.globalRole === 'superAdmin' ? t('ทุก Property') : membership ? <><span className="font-semibold">{membership.propertyCode}</span><span className="ml-1 text-slate-500">· {membership.propertyName}</span></> : '—'}</td>
            <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{user.active ? t('Active') : t('Inactive')}</span>{membership && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${membership.active ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{membership.active ? t('Membership Active') : t('Membership Inactive')}</span>}</div></td>
          </tr>)
        })}</tbody>
      </table></div>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{t('ผู้ใช้หนึ่งคนอาจมีหลายแถวตามจำนวน Property ที่ได้รับมอบหมาย')}</p>
    </section>}

    <p className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 text-xs leading-5 text-slate-600">{t('หน้านี้แสดง Firestore User Profiles เท่านั้น บัญชี Firebase Authentication ที่ยังไม่มี Profile และเวลา Login ล่าสุดต้องใช้ Backend/Admin SDK จึงจะตรวจสอบได้')}</p>
  </div>
}
