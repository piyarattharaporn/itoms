import { t } from '../../lib/i18n';
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { subscribeToDamagedAssets, type AssetRecord } from './assetService'

function todayBangkok() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function serviceLabel(asset: AssetRecord) {
  if (asset.serviceType === 'Warranty Claim') return t('ส่งเคลมประกัน')
  if (asset.serviceType === 'Vendor Repair') return t('ส่งซ่อม Vendor')
  if (asset.serviceType === 'Internal Repair') return t('ซ่อมภายใน')
  return t('รอประเมิน / รอซ่อม')
}

export function DamagedAssetsPage({ selectedPropertyId, onOpenAssets }: { selectedPropertyId: string; onOpenAssets: () => void }) {
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
  const [repairFilter, setRepairFilter] = useState<'all' | 'waiting'>('all')

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canRead) { setAssets([]); setLoading(false); setError(t("ไม่มีสิทธิ์เข้าถึง Property ที่เลือก")); return }
    setLoading(true); setError(null)
    return subscribeToDamagedAssets(selectedPropertyId, allProperties, (items) => {
      setAssets(items); setLoading(false)
    }, () => { setError(t("โหลดรายการ Asset ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes")); setLoading(false) })
  }, [accessState, canRead, selectedPropertyId, allProperties])

  const damaged = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return assets.filter((asset) => asset.status === 'Under Repair'
      && (!term || [asset.propertyCode, asset.assetTag, asset.name, asset.category, asset.location, asset.serviceVendor, asset.serviceNotes]
        .some((value) => value.toLocaleLowerCase().includes(term))))
      .sort((a, b) => (a.expectedReturnOn || '9999-99-99').localeCompare(b.expectedReturnOn || '9999-99-99'))
  }, [assets, search])

  const overdue = damaged.filter((asset) => asset.expectedReturnOn && asset.expectedReturnOn < todayBangkok()).length
  const claims = damaged.filter((asset) => asset.serviceType === 'Warranty Claim').length
  const waitingRepair = damaged.filter((asset) => !asset.serviceType)
  const visibleDamaged = repairFilter === 'waiting' ? waitingRepair : damaged

  if (accessState === 'loading') return <p className="py-10 text-center text-sm text-slate-500" role="status">{t("กำลังตรวจสอบสิทธิ์…")}</p>
  if (!canRead) return <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">{t(error)}</p>

  return <div className="space-y-5">
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-lotus-700">{t("Asset Service")}</p><div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-slate-900">{t("อุปกรณ์เสียหายที่กำลังรอซ่อม")}</h2>{!canManage && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100">{t('บัญชีนี้ดูรายการได้อย่างเดียว')}</span>}</div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{t("รายการ Asset ที่ตั้งสถานะเป็น Under Repair เรียงตามกำหนดรับคืน")}</p></div><div className="grid w-full gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto] lg:w-auto"><label className="sr-only" htmlFor="damaged-asset-search">{t("ค้นหาอุปกรณ์เสียหาย")}</label><input className="form-input min-w-0 w-full" id="damaged-asset-search" onChange={(event) => setSearch(event.target.value)} placeholder={t("ค้นหา Asset…")} value={search} />{canManage && <button className="min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onOpenAssets} type="button">{t("จัดการในหน้า Assets")}</button>}</div></div>
      <div aria-label={t('กรองสถานะซ่อม')} className="mt-4 flex flex-wrap gap-2" role="group"><button aria-pressed={repairFilter === 'all'} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${repairFilter === 'all' ? 'bg-lotus-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setRepairFilter('all')} type="button">{t('อุปกรณ์ที่เสียทั้งหมด')} <span className="ml-1 tabular-nums">{damaged.length}</span></button><button aria-pressed={repairFilter === 'waiting'} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${repairFilter === 'waiting' ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => setRepairFilter('waiting')} type="button">{t('เสีย / รอซ่อม')} <span className="ml-1 tabular-nums">{waitingRepair.length}</span></button></div>
    </section>

    {!loading && !error && <div className="grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-amber-950"><p className="text-sm font-medium">{t("อุปกรณ์กำลังซ่อม")}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{damaged.length}</p></article><article className={`rounded-2xl border p-4 ${overdue ? 'border-rose-200 bg-rose-50 text-rose-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><p className="text-sm font-medium">{t("เลยกำหนดรับคืน")}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{overdue}</p></article><article className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-violet-950"><p className="text-sm font-medium">{t("ส่งเคลมประกัน")}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{claims}</p></article></div>}

    {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{t(error)}</p>}
    {loading ? <p className="py-10 text-center text-sm text-slate-500" role="status">{t("กำลังโหลดรายการอุปกรณ์…")}</p> : visibleDamaged.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{search ? t("ไม่พบอุปกรณ์ตามคำค้นหา") : repairFilter === 'waiting' ? t("ไม่มีอุปกรณ์ที่รอซ่อม") : t("ไม่มี Asset ที่อยู่ระหว่างซ่อมใน Property นี้")}</p> : <section className="grid gap-3 lg:grid-cols-2">{visibleDamaged.map((asset) => {
      const isOverdue = Boolean(asset.expectedReturnOn && asset.expectedReturnOn < todayBangkok())
      return <article className={`min-w-0 rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${isOverdue ? 'border-rose-200 shadow-rose-100/50' : 'border-slate-200/80 shadow-slate-200/30'}`} key={asset.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-xs font-semibold tracking-wide text-lotus-700">{asset.propertyCode} · {asset.assetTag}</p><h3 className="mt-1 break-words font-semibold text-slate-900">{asset.name}</h3><p className="mt-1 text-sm text-slate-500">{t(asset.category)} · {asset.location}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${isOverdue ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-100'}`}>{isOverdue ? t(" · เลยกำหนด") : t("กำลังซ่อม")}</span></div>
        <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 rounded-2xl bg-slate-50/80 p-3 text-sm"><div className="min-w-0"><dt className="text-xs text-slate-500">{t("Vendor / Model: ")}</dt><dd className="mt-1 break-words font-medium text-slate-800">{[asset.vendor, asset.model].filter(Boolean).join(' / ') || '—'}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">{t("Serial: ")}</dt><dd className="mt-1 break-all font-medium text-slate-800">{asset.serialNumber || '—'}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">{t("การดำเนินการ:")}</dt><dd className="mt-1 break-words font-medium text-slate-800">{serviceLabel(asset)}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">{t("ผู้รับซ่อม:")}</dt><dd className="mt-1 break-words font-medium text-slate-800">{asset.serviceVendor || '—'}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">{t("ส่งซ่อมเมื่อ:")}</dt><dd className="mt-1 font-medium text-slate-800">{asset.serviceSentOn || '—'}</dd></div><div className="min-w-0"><dt className="text-xs text-slate-500">{t("กำหนดรับคืน:")}</dt><dd className={`mt-1 break-words font-semibold ${isOverdue ? 'text-rose-700' : 'text-slate-800'}`}>{asset.expectedReturnOn || t('ไม่ระบุ')}{isOverdue ? t(" · เลยกำหนด") : ''}</dd></div></dl>
        {asset.serviceNotes && <p className="mt-3 break-words rounded-xl border border-slate-100 bg-white p-3 text-sm leading-6 text-slate-700">{asset.serviceNotes}</p>}
      </article>
    })}</section>}
    <p className="text-xs text-slate-500">{t("หน้านี้แสดง Asset 100 รายการล่าสุดที่อ่านได้ตามสิทธิ์ Property")}</p>
  </div>
}
