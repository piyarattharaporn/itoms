import { getLocale, t } from '../../lib/i18n';
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { daysUntilExpiry, subscribeToLicenses, type SoftwareLicense } from './licenseService'

export function LicenseOverviewSummary({ selectedPropertyId, onOpenDetails, compact = false }: { selectedPropertyId: string; onOpenDetails: () => void; compact?: boolean }) {
  const { profile, memberships, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (accessState !== 'ready' || !canRead) { setLicenses([]); setLoading(false); return }
    setLoading(true)
    setError(false)
    return subscribeToLicenses(selectedPropertyId, allProperties, (items) => { setLicenses(items); setLoading(false) }, () => { setError(true); setLoading(false) })
  }, [accessState, canRead, selectedPropertyId, allProperties])

  const summary = useMemo(() => {
    const expiring = licenses.filter((license) => {
      const days = daysUntilExpiry(license.expiresOn)
      return days >= 0 && days <= 30
    }).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))
    const expired = licenses.filter((license) => daysUntilExpiry(license.expiresOn) < 0)
      .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))
    return { expiring, expired, atRisk: [...expiring, ...expired] }
  }, [licenses])

  if (!canRead) return null
  return <section className={`flex min-w-0 flex-col rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}>
    <div className={`flex items-start gap-3 ${compact ? 'flex-col' : 'flex-wrap justify-between'}`}>
      <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="rounded-xl bg-violet-50 p-2 text-violet-700"><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5V21M8 7h8M8 11h8" /></svg></span><h2 className="min-w-0 break-words font-semibold text-slate-900">{t("License ใกล้หมดอายุหรือหมดอายุแล้ว")}</h2></div><p className="mt-2 text-sm text-slate-500">{t("แสดง License ที่หมดอายุแล้วหรือจะหมดอายุภายใน 30 วัน")}</p></div>
      <button className={`min-h-10 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-lotus-700 hover:bg-lotus-50 focus:outline-none focus:ring-2 focus:ring-lotus-300 sm:text-sm ${compact ? 'w-full' : 'shrink-0'}`} onClick={onOpenDetails} type="button">{t("ดูรายละเอียดใน Asset & Licence")}</button>
    </div>
    {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{t("โหลดสรุป License ไม่สำเร็จ ตรวจสอบสิทธิ์และ Firestore Index")}</p>}
    {loading ? <p className="py-8 text-center text-sm text-slate-500" role="status">{t("กำลังโหลด License…")}</p> : !error && <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <article className={`min-w-0 rounded-2xl border border-amber-100 bg-amber-50/70 text-amber-950 ${compact ? 'p-3' : 'p-4'}`}><p className="text-xs font-medium leading-5">{t("ใกล้หมดอายุใน 30 วัน")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{summary.expiring.length}</p></article>
        <article className={`min-w-0 rounded-2xl border border-rose-100 bg-rose-50/70 text-rose-950 ${compact ? 'p-3' : 'p-4'}`}><p className="text-xs font-medium leading-5">{t("หมดอายุแล้ว")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{summary.expired.length}</p></article>
      </div>
      {summary.atRisk.length === 0 ? <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t("ไม่มี License ที่ใกล้หมดอายุหรือหมดอายุแล้ว")}</p> : <ul className="mt-3 divide-y divide-slate-100">{summary.atRisk.slice(0, compact ? 5 : summary.atRisk.length).map((license) => {
        const days = daysUntilExpiry(license.expiresOn)
        return <li className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" key={license.id}><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{license.productName} <span className="font-normal text-slate-500">· {license.vendor}</span></p><p className="mt-1 break-words text-xs leading-5 text-slate-500">{license.propertyCode} · {t(license.licenseType)} · {license.quantity.toLocaleString(getLocale())} {t("Seats")} · {t("หมดอายุ")} {license.expiresOn}</p></div><span className={`self-start rounded-full px-3 py-1 text-xs font-semibold sm:shrink-0 ${days < 0 ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'}`}>{days < 0 ? t('หมดอายุแล้ว') : days === 0 ? t('หมดอายุวันนี้') : t(`เหลือ ${days} วัน`)}</span></li>
      })}</ul>}
      {compact && summary.atRisk.length > 5 && <p className="mt-2 text-xs text-slate-400">{t("และอีก")} {summary.atRisk.length - 5} {t("License ในหน้า Asset & Licence")}</p>}
      <p className="mt-2 text-xs text-slate-400">{t("สรุปจาก License ล่าสุดสูงสุด 200 รายการ")}</p>
    </>}
  </section>
}
