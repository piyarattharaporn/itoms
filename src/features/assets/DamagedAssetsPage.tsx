import { t } from '../../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { DataFreshnessBar } from '../../components/DataFreshnessBar'
import { ViewModeToggle, useDataViewMode } from '../../components/ViewModeToggle'
import { useAuth } from '../auth/AuthProvider'
import { getAssetPage, type AssetPageCursor, type AssetRecord } from './assetService'

function todayBangkok() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function serviceLabel(asset: AssetRecord) {
  if (asset.status === 'Retired') return t('เลิกใช้งานแล้ว')
  if (asset.status === 'Damaged' && !asset.serviceType) return t('รอประเมิน / รอซ่อม')
  if (asset.serviceType === 'Warranty Claim') return t('ส่งเคลมประกัน')
  if (asset.serviceType === 'Vendor Repair') return t('ส่งซ่อม Vendor')
  if (asset.serviceType === 'Internal Repair') return t('ซ่อมภายใน')
  return t('รอประเมิน / รอซ่อม')
}

function statusBadge(asset: AssetRecord) {
  if (asset.status === 'Retired') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  if (asset.status === 'Damaged') return 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
  return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
}

export function DamagedAssetsPage({
  selectedPropertyId,
  onOpenAssets,
}: {
  selectedPropertyId: string
  onOpenAssets: () => void
}) {
  const { profile, memberships, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || Boolean(membership)
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useDataViewMode('itoms.damagedAssets.view')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Damaged' | 'Under Repair' | 'Retired'>('all')
  const [nextCursor, setNextCursor] = useState<AssetPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canRead) {
      setAssets([])
      setLoading(false)
      setError(t('ไม่มีสิทธิ์เข้าถึง Property ที่เลือก'))
      return
    }
    setLoading(true)
    setError(null)
    setAssets([])
    setNextCursor(null)
    setHasMore(false)
    setLastUpdated(null)
    let cancelled = false
    void getAssetPage(selectedPropertyId, allProperties, 25, null, true)
      .then((page) => {
        if (cancelled) return
        setAssets(page.items)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('โหลดรายการ Asset ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes'))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessState, canRead, selectedPropertyId, allProperties, reloadKey])

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const page = await getAssetPage(selectedPropertyId, allProperties, 25, nextCursor, true)
      setAssets((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setLastUpdated(new Date())
    } catch {
      setError(t('โหลดรายการเพิ่มไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  function refresh() {
    setReloadKey((value) => value + 1)
  }

  const damaged = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return assets
      .filter(
        (asset) =>
          (statusFilter === 'all' || asset.status === statusFilter) &&
          (!term ||
            [
              asset.propertyCode,
              asset.assetTag,
              asset.name,
              asset.category,
              asset.location,
              asset.serviceVendor,
              asset.serviceNotes,
            ].some((value) => value.toLocaleLowerCase().includes(term))),
      )
      .sort((a, b) => (a.expectedReturnOn || '9999-99-99').localeCompare(b.expectedReturnOn || '9999-99-99'))
  }, [assets, search, statusFilter])

  const allDamaged = assets.filter((asset) => ['Damaged', 'Under Repair', 'Retired'].includes(asset.status))
  const damagedCount = allDamaged.filter((asset) => asset.status === 'Damaged').length
  const underRepairCount = allDamaged.filter((asset) => asset.status === 'Under Repair').length
  const retiredCount = allDamaged.filter((asset) => asset.status === 'Retired').length
  const overdue = allDamaged.filter(
    (asset) => asset.status === 'Under Repair' && asset.expectedReturnOn && asset.expectedReturnOn < todayBangkok(),
  ).length
  const claims = allDamaged.filter(
    (asset) => asset.status === 'Under Repair' && asset.serviceType === 'Warranty Claim',
  ).length
  const visibleDamaged = damaged

  if (accessState === 'loading')
    return (
      <p className="py-10 text-center text-sm text-slate-500" role="status">
        {t('กำลังตรวจสอบสิทธิ์…')}
      </p>
    )
  if (!canRead)
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">
        {t(error)}
      </p>
    )

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-lotus-700">{t('Asset Service')}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{t('อุปกรณ์เสียหายและเลิกใช้งาน')}</h2>
              {!canManage && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100">
                  {t('บัญชีนี้ดูรายการได้อย่างเดียว')}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {t('รวม Asset สถานะเสีย กำลังซ่อม และเลิกใช้งาน พร้อม Label แยกสถานะ')}
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto] lg:w-auto">
            <label className="sr-only" htmlFor="damaged-asset-search">
              {t('ค้นหาอุปกรณ์เสียหาย')}
            </label>
            <input
              className="form-input min-w-0 w-full"
              id="damaged-asset-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('ค้นหา Asset…')}
              value={search}
            />
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            {canManage && (
              <button
                className="min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={onOpenAssets}
                type="button"
              >
                {t('จัดการในหน้า Assets')}
              </button>
            )}
          </div>
        </div>
        <div aria-label={t('กรองสถานะซ่อม')} className="mt-4 flex flex-wrap gap-2" role="group">
          {(
            [
              ['all', 'อุปกรณ์ที่เสียทั้งหมด', allDamaged.length],
              ['Damaged', 'Damaged', damagedCount],
              ['Under Repair', 'Under Repair', underRepairCount],
              ['Retired', 'Retired', retiredCount],
            ] as const
          ).map(([value, label, count]) => (
            <button
              aria-pressed={statusFilter === value}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === value ? 'bg-lotus-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              key={value}
              onClick={() => setStatusFilter(value)}
              type="button"
            >
              {t(label)} <span className="ml-1 tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      </section>

      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-rose-950">
            <p className="text-sm font-medium">{t('Damaged')}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{damagedCount}</p>
          </article>
          <article className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-amber-950">
            <p className="text-sm font-medium">{t('Under Repair')}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{underRepairCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            <p className="text-sm font-medium">{t('Retired')}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{retiredCount}</p>
          </article>
          <article
            className={`rounded-2xl border p-4 ${overdue ? 'border-rose-200 bg-rose-50 text-rose-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
          >
            <p className="text-sm font-medium">{t('เลยกำหนดรับคืน')}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{overdue}</p>
          </article>
          <article className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-violet-950">
            <p className="text-sm font-medium">{t('ส่งเคลมประกัน')}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{claims}</p>
          </article>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {t(error)}
        </p>
      )}
      <DataFreshnessBar lastUpdated={lastUpdated} loading={loading} onRefresh={refresh} />
      {loading && assets.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลดรายการอุปกรณ์…')}
        </p>
      ) : visibleDamaged.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {search ? t('ไม่พบอุปกรณ์ตามคำค้นหา') : t('ไม่มี Asset ที่อยู่ในกลุ่มเสียหายหรือเลิกใช้งานใน Property นี้')}
        </p>
      ) : viewMode === 'table' ? (
        <section className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('Asset')}</th>
                <th className="px-4 py-3">{t('Property')}</th>
                <th className="px-4 py-3">{t('สถานะ')}</th>
                <th className="px-4 py-3">{t('การดำเนินการ:')}</th>
                <th className="px-4 py-3">{t('กำหนดรับคืน:')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleDamaged.map((asset) => {
                const isOverdue = Boolean(
                  asset.status === 'Under Repair' && asset.expectedReturnOn && asset.expectedReturnOn < todayBangkok(),
                )
                return (
                  <tr className="align-top hover:bg-slate-50/70" key={asset.id}>
                    <td className="max-w-64 px-4 py-3">
                      <p className="font-semibold text-slate-900">{asset.name}</p>
                      <p className="mt-1 text-xs text-lotus-700">{asset.assetTag}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t(asset.category)} · {asset.location}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{asset.propertyCode}</p>
                      <p className="mt-1 text-xs text-slate-500">{asset.department || t('ไม่ระบุ')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(asset)}`}
                      >
                        {t(asset.status)}
                      </span>
                    </td>
                    <td className="max-w-48 px-4 py-3">
                      <p className="font-medium text-slate-800">{serviceLabel(asset)}</p>
                      <p className="mt-1 text-xs text-slate-500">{asset.serviceVendor || '—'}</p>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${isOverdue ? 'text-rose-700' : 'text-slate-700'}`}>
                      {asset.expectedReturnOn || '—'}
                      {isOverdue && <span className="mt-1 block text-xs">{t('เลยกำหนด')}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {visibleDamaged.map((asset) => {
            const isOverdue = Boolean(asset.expectedReturnOn && asset.expectedReturnOn < todayBangkok())
            return (
              <article
                className={`min-w-0 rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${isOverdue ? 'border-rose-200 shadow-rose-100/50' : 'border-slate-200/80 shadow-slate-200/30'}`}
                key={asset.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-xs font-semibold tracking-wide text-lotus-700">
                      {asset.propertyCode} · {asset.assetTag}
                    </p>
                    <h3 className="mt-1 break-words font-semibold text-slate-900">{asset.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {t(asset.category)} · {asset.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadge(asset)}`}>
                      {t(asset.status)}
                    </span>
                    {isOverdue && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
                        {t(' · เลยกำหนด')}
                      </span>
                    )}
                  </div>
                </div>
                <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 rounded-2xl bg-slate-50/80 p-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{t('Vendor / Model: ')}</dt>
                    <dd className="mt-1 break-words font-medium text-slate-800">
                      {[asset.vendor, asset.model].filter(Boolean).join(' / ') || '—'}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{t('Serial: ')}</dt>
                    <dd className="mt-1 break-all font-medium text-slate-800">{asset.serialNumber || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{t('การดำเนินการ:')}</dt>
                    <dd className="mt-1 break-words font-medium text-slate-800">{serviceLabel(asset)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{t('ผู้รับซ่อม:')}</dt>
                    <dd className="mt-1 break-words font-medium text-slate-800">{asset.serviceVendor || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{t('ส่งซ่อมเมื่อ:')}</dt>
                    <dd className="mt-1 font-medium text-slate-800">{asset.serviceSentOn || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{t('กำหนดรับคืน:')}</dt>
                    <dd className={`mt-1 break-words font-semibold ${isOverdue ? 'text-rose-700' : 'text-slate-800'}`}>
                      {asset.expectedReturnOn || t('ไม่ระบุ')}
                      {isOverdue ? t(' · เลยกำหนด') : ''}
                    </dd>
                  </div>
                </dl>
                {asset.serviceNotes && (
                  <p className="mt-3 break-words rounded-xl border border-slate-100 bg-white p-3 text-sm leading-6 text-slate-700">
                    {asset.serviceNotes}
                  </p>
                )}
              </article>
            )
          })}
        </section>
      )}
      {hasMore && (
        <div className="text-center">
          <button
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-lotus-700 hover:bg-lotus-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => void loadMore()}
            type="button"
          >
            {loading ? t('กำลังโหลด…') : t('โหลดรายการเพิ่ม')}
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500">
        {t('แสดง Asset เสียหาย/เลิกใช้งานแบบแบ่งหน้า ครั้งละ 25 รายการ; ตัวเลขสรุปเป็นข้อมูลที่โหลดแล้ว')}
      </p>
    </div>
  )
}
