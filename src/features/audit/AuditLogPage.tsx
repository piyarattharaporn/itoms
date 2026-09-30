import { useEffect, useMemo, useState } from 'react'
import { DataFreshnessBar } from '../../components/DataFreshnessBar'
import { ViewModeToggle, useDataViewMode } from '../../components/ViewModeToggle'
import { getLocale, t } from '../../lib/i18n'
import { useAuth } from '../auth/AuthProvider'
import { resolveActivityActorLabels } from '../activity/activityLogService'
import { getAuditPage, type AuditPageCursor, type AuditRecord } from './auditService'

function dateTime(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat(getLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Bangkok',
      }).format(value)
    : t('กำลังบันทึกเวลา…')
}

function actorLabel(item: AuditRecord, labels: ReadonlyMap<string, string>) {
  return labels.get(item.actorUid) || t('ไม่ระบุชื่อ')
}

export function AuditLogPage({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { profile, memberships, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [items, setItems] = useState<AuditRecord[]>([])
  const [cursor, setCursor] = useState<AuditPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actorLabels, setActorLabels] = useState<Map<string, string>>(new Map())
  const [viewMode, setViewMode] = useDataViewMode('itoms.auditLog.view')
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (accessState === 'loading') return
    if (!canRead || (!allProperties && !selectedPropertyId)) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setItems([])
    setCursor(null)
    setHasMore(false)
    setLastUpdated(null)
    let cancelled = false
    void getAuditPage({ uid: profile?.uid ?? '', propertyId: selectedPropertyId, allProperties, isSuperAdmin })
      .then((page) => {
        if (cancelled) return
        setItems(page.items)
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : t('โหลด Audit Log ไม่สำเร็จ'))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessState, canRead, allProperties, selectedPropertyId, profile?.uid, isSuperAdmin, reloadKey])

  useEffect(() => {
    let cancelled = false
    if (!profile || items.length === 0) {
      setActorLabels(new Map())
      return
    }
    void resolveActivityActorLabels(
      items.map((item) => item.actorUid),
      selectedPropertyId,
      allProperties,
      profile,
    ).then((labels) => {
      if (!cancelled) setActorLabels(labels)
    })
    return () => {
      cancelled = true
    }
  }, [allProperties, items, profile, selectedPropertyId])

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const page = await getAuditPage(
        { uid: profile?.uid ?? '', propertyId: selectedPropertyId, allProperties, isSuperAdmin },
        30,
        cursor,
      )
      setItems((current) => [...current, ...page.items])
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setLastUpdated(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('โหลด Audit Log ไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  function refresh() {
    setReloadKey((value) => value + 1)
  }

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return items.filter(
      (item) =>
        !term ||
        [item.propertyCode, item.entityId, item.action, actorLabel(item, actorLabels), item.summary].some((value) =>
          value.toLocaleLowerCase().includes(term),
        ),
    )
  }, [actorLabels, items, search])
  if (accessState === 'loading')
    return <p className="py-10 text-center text-sm text-slate-500">{t('กำลังตรวจสอบสิทธิ์…')}</p>
  if (!canRead)
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {t('หน้านี้เปิดให้ Super Admin และ IT Support Engineer ตามสิทธิ์ Property')}
      </p>
    )
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('Audit Log')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('ประวัติการเปลี่ยนแปลงแบบ append-only ที่ Trusted Backend บันทึกพร้อม correlation ID')}
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
            {items.length} {t('รายการที่โหลดแล้ว')}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-slate-700" htmlFor="audit-search">
            {t('ค้นหา')}
            <input
              className="form-input mt-1 w-full"
              id="audit-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Property, งาน, ผู้ดำเนินการ, รายละเอียด')}
              type="search"
              value={search}
            />
          </label>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </section>
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{t(error)}</p>}
      <DataFreshnessBar lastUpdated={lastUpdated} loading={loading} onRefresh={refresh} />
      {loading && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          {t('กำลังโหลด Audit Log…')}
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {t('ไม่พบ Audit Log')}
        </p>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('การดำเนินการ')}</th>
                <th className="px-4 py-3">{t('Property')}</th>
                <th className="px-4 py-3">{t('รายการ')}</th>
                <th className="px-4 py-3">{t('รายละเอียด')}</th>
                <th className="px-4 py-3">{t('ผู้ดำเนินการ:')}</th>
                <th className="px-4 py-3">{t('วันที่')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((item) => (
                <tr className="align-top hover:bg-slate-50/70" key={item.id}>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-lotus-50 px-2.5 py-1 text-xs font-semibold text-lotus-800">
                      {item.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.propertyCode}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {item.entityType} · {item.entityId}
                  </td>
                  <td className="max-w-80 px-4 py-3">
                    <p className="font-medium text-slate-800">{item.summary}</p>
                    {item.correlationId && (
                      <p className="mt-1 break-all text-[11px] text-slate-400">Correlation: {item.correlationId}</p>
                    )}
                  </td>
                  <td className="max-w-48 px-4 py-3 text-xs text-slate-600">{actorLabel(item, actorLabels)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ol className="space-y-3">
          {visible.map((item) => (
            <li className="rounded-2xl border border-slate-200 bg-white p-4" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-lotus-50 px-2.5 py-1 text-xs font-semibold text-lotus-800">
                      {item.action}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.propertyCode} · {item.entityType} · {item.entityId}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-800">{item.summary}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {t('ผู้ดำเนินการ:')} {actorLabel(item, actorLabels)}
                  </p>
                  {item.correlationId && (
                    <p className="mt-1 break-all text-[11px] text-slate-400">Correlation: {item.correlationId}</p>
                  )}
                </div>
                <time className="text-xs text-slate-500">{dateTime(item.createdAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
      {hasMore && (
        <div className="text-center">
          <button
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-lotus-700 hover:bg-lotus-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => void loadMore()}
            type="button"
          >
            {loading ? t('กำลังโหลด…') : t('โหลดรายการถัดไป')}
          </button>
        </div>
      )}
      <p className="rounded-xl border border-amber-100 bg-amber-50/70 p-4 text-xs leading-5 text-slate-600">
        {t(
          'Audit Log สำหรับ Ticket ถูกเขียนโดย Trusted Backend แบบ append-only พร้อม correlation ID แล้ว แต่ยังต้องมี retention, export, verification และ backup policy ก่อนใช้เป็นหลักฐานทางสัญญาหรือข้อพิพาท',
        )}
      </p>
    </div>
  )
}
