import { getLanguage, t } from '../../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { subscribeToCctvChecks, type CctvDailyCheck } from '../infrastructure/cctvDailyCheckService'

function todayInBangkok() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function CctvCount({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string
  value: number | string
  tone: 'neutral' | 'good' | 'attention'
  compact?: boolean
}) {
  const colors =
    tone === 'good'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
      : tone === 'attention'
        ? 'border-amber-100 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'
  return (
    <article className={`rounded-xl border ${compact ? 'p-3' : 'p-4'} ${colors}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${compact ? 'text-xl' : 'text-2xl'}`}>{value}</p>
    </article>
  )
}

export function CctvOverview({
  selectedPropertyId,
  onOpenCctv,
  compact = false,
}: {
  selectedPropertyId: string
  onOpenCctv: () => void
  compact?: boolean
}) {
  const { profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const enabledProperties = properties.filter((property) => property.cctvEnabled !== false)
  const enabledPropertyIds = enabledProperties.map((property) => property.id)
  const enabledPropertyKey = enabledPropertyIds.join('|')
  const today = todayInBangkok()
  const [checks, setChecks] = useState<CctvDailyCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (accessState !== 'ready' || !canRead) {
      setChecks([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    return subscribeToCctvChecks(
      allProperties ? 'all' : selectedPropertyId,
      allProperties,
      (items) => {
        setChecks(items)
        setLoading(false)
      },
      () => {
        setError(true)
        setLoading(false)
      },
      undefined,
      allProperties ? enabledPropertyIds : undefined,
    )
  }, [accessState, canRead, allProperties, selectedPropertyId, enabledPropertyKey])

  const summary = useMemo(() => {
    const todayChecks = checks.filter((check) => check.checkedOn === today)
    const checkedByProperty = new Map(todayChecks.map((check) => [check.propertyId, check]))
    const scopedProperties = allProperties
      ? enabledProperties
      : properties.filter((property) => property.id === selectedPropertyId)
    const totals = todayChecks.reduce(
      (sum, check) => ({
        nvrTotal: sum.nvrTotal + check.nvrTotal,
        nvrOnline: sum.nvrOnline + check.nvrOnline,
        cameraTotal: sum.cameraTotal + check.cameraTotal,
        cameraOnline: sum.cameraOnline + check.cameraOnline,
        retentionBelowTarget:
          sum.retentionBelowTarget +
          check.nvrDetails.filter(
            (nvr) =>
              nvr.targetRetentionDays != null &&
              nvr.targetRetentionDays > 0 &&
              nvr.retentionDays < nvr.targetRetentionDays,
          ).length,
      }),
      { nvrTotal: 0, nvrOnline: 0, cameraTotal: 0, cameraOnline: 0, retentionBelowTarget: 0 },
    )
    const rows = scopedProperties.map((property) => ({
      id: property.id,
      code: property.code,
      name: property.name,
      check: checkedByProperty.get(property.id),
    }))
    return { ...totals, rows, checkedCount: rows.filter((row) => row.check).length }
  }, [checks, today, allProperties, properties, selectedPropertyId])

  if (!canRead) return null

  const offlineNvr = summary.nvrTotal - summary.nvrOnline
  const offlineCameras = summary.cameraTotal - summary.cameraOnline
  const unchecked = summary.rows.length - summary.checkedCount
  const hasOffline = offlineNvr > 0 || offlineCameras > 0
  const hasCctvIssue = hasOffline || summary.retentionBelowTarget > 0

  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white ${compact ? 'p-4' : 'p-5'} shadow-sm shadow-slate-200/30`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="rounded-xl bg-sky-50 p-2 text-sky-700">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M14 10l7-4v12l-7-4M3 6h11v12H3zM7 18v3h7" />
              </svg>
            </span>
            <h2 className="font-semibold">{t('สถานะ CCTV วันนี้')}</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {t('ผลตรวจ NVR และกล้องของวันที่')} {today}
          </p>
        </div>
        <button
          className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-lotus-700 hover:bg-lotus-50 focus:outline-none focus:ring-2 focus:ring-lotus-300"
          onClick={onOpenCctv}
          type="button"
        >
          {t('เปิดหน้า CCTV')}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {t('โหลดสรุป CCTV ไม่สำเร็จ ตรวจสอบสิทธิ์และ Firestore Index')}
        </p>
      )}
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลดสถานะ CCTV…')}
        </p>
      ) : (
        !error && (
          <>
            <div className={`mt-4 grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-5'}`}>
              {compact ? (
                <>
                  <CctvCount
                    compact
                    label="NVR Online / Offline"
                    value={`${summary.nvrOnline} / ${offlineNvr}`}
                    tone={offlineNvr ? 'attention' : 'good'}
                  />
                  <CctvCount
                    compact
                    label={t('กล้อง Online / Offline')}
                    value={`${summary.cameraOnline} / ${offlineCameras}`}
                    tone={offlineCameras ? 'attention' : 'good'}
                  />
                </>
              ) : (
                <>
                  <CctvCount label="NVR Online" value={summary.nvrOnline} tone="good" />
                  <CctvCount label="NVR Offline" value={offlineNvr} tone={offlineNvr ? 'attention' : 'good'} />
                  <CctvCount label={t('กล้อง Online')} value={summary.cameraOnline} tone="good" />
                  <CctvCount
                    label={t('กล้อง Offline')}
                    value={offlineCameras}
                    tone={offlineCameras ? 'attention' : 'good'}
                  />
                  <CctvCount
                    label={t('NVR ที่ย้อนหลังต่ำกว่าเป้าหมาย')}
                    value={summary.retentionBelowTarget}
                    tone={summary.retentionBelowTarget ? 'attention' : 'good'}
                  />
                </>
              )}
            </div>
            <div
              className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${unchecked || hasCctvIssue ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}
            >
              <p className="font-medium">
                {unchecked
                  ? getLanguage() === 'en'
                    ? `${unchecked} ${unchecked === 1 ? 'property' : 'properties'} not checked yet`
                    : `ยังไม่ได้ตรวจ ${unchecked} Property`
                  : hasOffline
                    ? t('พบอุปกรณ์ Offline โปรดติดตาม')
                    : summary.retentionBelowTarget
                      ? t('พบ NVR ที่มีวันย้อนหลังต่ำกว่าเป้าหมาย')
                      : t('ตรวจครบแล้ว · อุปกรณ์ Online ครบ')}
              </p>
              <p className="text-xs">
                {summary.checkedCount}/{summary.rows.length} Property · {summary.nvrTotal} NVR · {summary.cameraTotal}{' '}
                {t('กล้อง')}
              </p>
            </div>
            {!compact && (
              <ul className="mt-3 divide-y divide-slate-100">
                {summary.rows.slice(0, compact ? 2 : undefined).map((row) => {
                  const offline = row.check
                    ? row.check.nvrTotal > row.check.nvrOnline || row.check.cameraTotal > row.check.cameraOnline
                    : false
                  const retentionRisk =
                    row.check?.nvrDetails.some(
                      (nvr) =>
                        nvr.targetRetentionDays != null &&
                        nvr.targetRetentionDays > 0 &&
                        nvr.retentionDays < nvr.targetRetentionDays,
                    ) ?? false
                  const statusText = !row.check
                    ? t('ยังไม่ตรวจวันนี้')
                    : offline
                      ? getLanguage() === 'en'
                        ? `Offline ${row.check.nvrTotal - row.check.nvrOnline} NVR · ${row.check.cameraTotal - row.check.cameraOnline} cameras`
                        : `Offline ${row.check.nvrTotal - row.check.nvrOnline} NVR · ${row.check.cameraTotal - row.check.cameraOnline} กล้อง`
                      : retentionRisk
                        ? t('วันย้อนหลังต่ำกว่าเป้าหมาย')
                        : t('Online ครบ')
                  const statusColor =
                    !row.check || offline || retentionRisk
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-emerald-50 text-emerald-800'
                  return (
                    <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm" key={row.id}>
                      <span className="min-w-0">
                        <span className="font-semibold">{row.code}</span>
                        <span className="ml-2 text-slate-500">{row.name}</span>
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                        {statusText}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {compact && (
              <p className="mt-2 text-xs text-slate-400">
                {summary.checkedCount}/{summary.rows.length} Property · {summary.retentionBelowTarget} {t('รายการ')}{' '}
                {t('ต่ำกว่าเป้าหมาย')}
              </p>
            )}
            {summary.rows.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">{t('ไม่พบ Property ในขอบเขตบัญชีนี้')}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {t('ตัวเลขมาจากผลตรวจที่ทีมบันทึกวันนี้ ระบบยังไม่ได้เชื่อมต่อดึงสถานะจาก NVR โดยตรง')}
            </p>
          </>
        )
      )}
    </section>
  )
}
