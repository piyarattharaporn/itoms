import { getLocale, t } from '../../lib/i18n';
import { useEffect, useMemo, useState } from 'react'
import { ViewModeToggle, useDataViewMode } from '../../components/ViewModeToggle'
import { useAuth } from '../auth/AuthProvider'
import { subscribeToActivityLog, type ActivityRecord } from './activityLogService'

function dateTime(value: Date | null) {
  if (!value) return t('กำลังบันทึกเวลา…')
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(value)
}

function displayId(activity: ActivityRecord) {
  return `${activity.propertyCode}-${activity.entityId.toUpperCase()}`
}

export function ActivityLogPage({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { profile, memberships, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useDataViewMode('itoms.activityLog.view')

  useEffect(() => {
    if (accessState === 'loading') return
    if (!canRead || (!allProperties && !selectedPropertyId)) { setActivities([]); setLoading(false); return }
    setLoading(true); setError(null)
    return subscribeToActivityLog(allProperties ? 'all' : selectedPropertyId, allProperties, (items) => { setActivities(items); setError(null); setLoading(false) }, () => {
      setActivities([]); setError(t("โหลด Activities Log ไม่สำเร็จ ตรวจสอบสิทธิ์และ Firestore Index")); setLoading(false)
    })
  }, [accessState, canRead, allProperties, selectedPropertyId])

  const visibleActivities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('th')
    return activities.filter((item) => !term || [displayId(item), item.propertyCode, item.title, item.note, item.actorUid, item.toStatus].some((value) => value.toLocaleLowerCase('th').includes(term)))
  }, [activities, search])

  if (accessState === 'loading') return <p className="py-10 text-center text-sm text-slate-500" role="status">{t("กำลังตรวจสอบสิทธิ์…")}</p>
  if (!canRead) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">{t("หน้านี้เปิดให้ Super Admin, IT Support Engineer และ Client Executive ตามสิทธิ์ Property")}</p>

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{t('Activities Log')}</h2><p className="mt-1 text-sm text-slate-500">{t("ประวัติการสร้างและเปลี่ยนสถานะ Task ตามสิทธิ์ Property")}</p></div><span className="rounded-full bg-lotus-50 px-3 py-1.5 text-xs font-semibold text-lotus-800">{t("แสดงกิจกรรมล่าสุดไม่เกิน 50 รายการ")}</span></div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium text-slate-700" htmlFor="activity-search">{t("ค้นหา")}<input className="form-input mt-1 w-full" id="activity-search" onChange={(event) => setSearch(event.target.value)} placeholder={t("เลขที่งาน, หัวข้อ, ผู้ดำเนินการ")} type="search" value={search} /></label><ViewModeToggle mode={viewMode} onChange={setViewMode} /></div>
    </section>

    {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{t(error)}</p>}
    {loading ? <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500" role="status">{t("กำลังโหลดกิจกรรม…")}</p> : visibleActivities.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t("ไม่พบกิจกรรมตามตัวกรอง")}</p> : viewMode === 'table' ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-[900px] w-full border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-3">{t('Task')}</th><th className="px-4 py-3">{t('กิจกรรม')}</th><th className="px-4 py-3">{t('สถานะ')}</th><th className="px-4 py-3">{t('ผู้ดำเนินการ:')}</th><th className="px-4 py-3">{t('วันที่')}</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleActivities.map((activity) => <tr className="align-top hover:bg-slate-50/70" key={activity.id}><td className="px-4 py-3"><p className="font-semibold text-lotus-700">{displayId(activity)}</p><p className="mt-1 text-xs text-slate-500">{activity.propertyCode}</p></td><td className="max-w-80 px-4 py-3"><p className="font-semibold text-slate-900">{t(activity.action)}</p><p className="mt-1 text-xs text-slate-600">{activity.title}</p>{activity.note && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{activity.note.replaceAll('Ticket', 'Task')}</p>}</td><td className="px-4 py-3 text-slate-700">{activity.fromStatus ? `${t(activity.fromStatus)} → ` : ''}<strong>{t(activity.toStatus)}</strong></td><td className="max-w-48 break-all px-4 py-3 text-slate-700">{activity.actorUid}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(activity.createdAt)}</td></tr>)}</tbody></table></div> : <ol aria-label={t("รายการกิจกรรมล่าสุด")} className="space-y-3">{visibleActivities.map((activity) => {
      return <li className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5" key={activity.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">{t('Task')}</span><span className="text-xs font-semibold text-lotus-700">{displayId(activity)}</span><span className="text-xs text-slate-500">{activity.propertyCode}</span></div><h3 className="mt-2 break-words font-semibold text-slate-900">{t(activity.action)} · {activity.title}</h3></div><time className="shrink-0 text-xs text-slate-500">{dateTime(activity.createdAt)}</time></div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600"><span>{activity.fromStatus ? `${t(activity.fromStatus)} → ` : ''}<strong className="font-semibold text-slate-800">{t(activity.toStatus)}</strong></span><span>{t("ผู้ดำเนินการ:")} <span className="break-all">{activity.actorUid}</span></span></div>
        {activity.note && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{activity.note.replaceAll('Ticket', 'Task')}</p>}
      </li>
    })}</ol>}
  </div>
}
