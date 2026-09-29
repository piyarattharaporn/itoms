import { getLanguage, getLocale, t } from '../../lib/i18n'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  retentionDaysFromOldestDate,
  saveCctvDailyCheck,
  saveCctvDailyCheckNvr,
  subscribeToCctvChecks,
  subscribeToCctvNvrDailyChecks,
  type CctvDailyCheck,
  type CctvDailyCheckInput,
  type CctvNvrDetail,
  type CctvNvrDailyCheck,
  type CctvNvrInventoryItem,
} from './cctvDailyCheckService'
import { CctvNvrInventoryManager } from './CctvNvrInventoryManager'
import { recordUsageEvent } from '../../lib/telemetry'

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(rows[0] ?? {})
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = [headers, ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')))]
    .map((row) => row.join(','))
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

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

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7)
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return { start: `${month}-01`, endExclusive: new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10) }
}

function monthTitle(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  )
}

function getWeekdayLabels() {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(getLocale(), { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, index + 1)),
    ),
  )
}

const emptyDraft = (propertyId = '', propertyCode = '', checkedOn = todayInBangkok()): CctvDailyCheckInput => ({
  propertyId,
  propertyCode,
  checkedOn,
  nvrTotal: 0,
  nvrOnline: 0,
  cameraTotal: 0,
  cameraOnline: 0,
  nvrDetails: [],
  notes: '',
})

function checkNeedsAttention(check: CctvDailyCheck) {
  return (
    check.nvrOnline < check.nvrTotal ||
    check.cameraOnline < check.cameraTotal ||
    check.nvrDetails.some(
      (nvr) =>
        nvr.targetRetentionDays != null && nvr.targetRetentionDays > 0 && nvr.retentionDays < nvr.targetRetentionDays,
    )
  )
}

function CounterCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: 'neutral' | 'online' | 'offline'
}) {
  const colors =
    tone === 'online'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
      : tone === 'offline'
        ? 'border-rose-100 bg-rose-50 text-rose-800'
        : 'border-slate-200 bg-slate-50 text-slate-800'
  return (
    <article className={`rounded-2xl border p-4 ${colors}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </article>
  )
}

function formatCheckedAt(value: Date | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(getLocale(), {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(value)
}

function draftNvrFromInventory(item: CctvNvrInventoryItem): CctvNvrDetail {
  return {
    nvrId: item.id,
    nvrName: item.name,
    location: item.location,
    online: true,
    cameraTotal: item.cameraTotal,
    cameraOnline: 0,
    retentionDays: 0,
    oldestFootageOn: '',
    targetRetentionDays: item.targetRetentionDays,
    notes: '',
  }
}

function buildDraftFromInventory(
  propertyId: string,
  propertyCode: string,
  checkedOn: string,
  inventory: CctvNvrInventoryItem[],
  savedCheck?: CctvDailyCheck,
  savedNvrChecks: CctvNvrDailyCheck[] = [],
): CctvDailyCheckInput {
  const savedByNvrId = new Map([
    ...(savedCheck?.nvrDetails ?? []).map((nvr) => [nvr.nvrId, nvr] as const),
    ...savedNvrChecks.map((nvr) => [nvr.nvrId, nvr] as const),
  ])
  const inventoryIds = new Set(inventory.filter((item) => item.active).map((item) => item.id))
  const details = inventory
    .filter((item) => item.active)
    .map((item) => savedByNvrId.get(item.id) ?? draftNvrFromInventory(item))
  const legacyDetails = (savedCheck?.nvrDetails ?? []).filter((nvr) => !inventoryIds.has(nvr.nvrId))
  return {
    ...emptyDraft(propertyId, propertyCode, checkedOn),
    notes: savedCheck?.notes ?? '',
    nvrDetails: [...details, ...legacyDetails],
  }
}

export function CctvDailyCheckPanel({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const enabledProperties = useMemo(() => properties.filter((property) => property.cctvEnabled !== false), [properties])
  const enabledPropertyIds = useMemo(() => enabledProperties.map((property) => property.id), [enabledProperties])
  const firstEnabledPropertyId = enabledPropertyIds[0] ?? ''
  const [targetPropertyId, setTargetPropertyId] = useState(
    selectedPropertyId === 'all' ? (enabledProperties[0]?.id ?? '') : selectedPropertyId,
  )
  const targetProperty = properties.find((property) => property.id === targetPropertyId)
  const membership = memberships.find((item) => item.propertyId === targetPropertyId)
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const canRead =
    (isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive') &&
    (allProperties ? enabledProperties.length > 0 : targetProperty?.cctvEnabled !== false)
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  // Super Admin can manage larger Properties; Support Engineer keeps the stricter MVP cap.
  const maxNvrDetails = isSuperAdmin ? 20 : 5
  const today = todayInBangkok()
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [checks, setChecks] = useState<CctvDailyCheck[]>([])
  const [calendarChecks, setCalendarChecks] = useState<CctvDailyCheck[]>([])
  const [todayNvrChecks, setTodayNvrChecks] = useState<CctvNvrDailyCheck[]>([])
  const [selectedDateNvrChecks, setSelectedDateNvrChecks] = useState<CctvNvrDailyCheck[]>([])
  const [nvrInventory, setNvrInventory] = useState<CctvNvrInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNvrId, setSavingNvrId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<CctvDailyCheckInput>(() =>
    emptyDraft(targetPropertyId, targetProperty?.code ?? '', today),
  )
  const updateNvrInventory = useCallback((items: CctvNvrInventoryItem[]) => setNvrInventory(items), [])

  useEffect(() => {
    if (selectedPropertyId !== 'all') setTargetPropertyId(selectedPropertyId)
    else if (!enabledPropertyIds.includes(targetPropertyId)) setTargetPropertyId(firstEnabledPropertyId)
  }, [enabledPropertyIds, firstEnabledPropertyId, selectedPropertyId, targetPropertyId])

  useEffect(() => {
    if (accessState !== 'ready' || !canRead || !targetPropertyId) {
      setChecks([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    return subscribeToCctvChecks(
      allProperties ? 'all' : targetPropertyId,
      allProperties,
      (items) => {
        setChecks(items)
        setLoading(false)
      },
      () => {
        setError(t('โหลดบันทึก CCTV ไม่สำเร็จ ตรวจสอบสิทธิ์และ Firestore Index'))
        setLoading(false)
      },
      undefined,
      allProperties ? enabledPropertyIds : undefined,
    )
  }, [accessState, allProperties, canRead, enabledPropertyIds, targetPropertyId])

  useEffect(() => {
    if (accessState !== 'ready' || !canRead || !targetPropertyId) {
      setCalendarChecks([])
      return
    }
    setCalendarLoading(true)
    const range = monthRange(visibleMonth)
    return subscribeToCctvChecks(
      allProperties ? 'all' : targetPropertyId,
      allProperties,
      (items) => {
        setCalendarChecks(items)
        setCalendarLoading(false)
      },
      () => {
        setError(t('โหลด Log CCTV ของเดือนนี้ไม่สำเร็จ ตรวจสอบ Firestore Index'))
        setCalendarLoading(false)
      },
      range,
      allProperties ? enabledPropertyIds : undefined,
    )
  }, [accessState, allProperties, canRead, enabledPropertyIds, targetPropertyId, visibleMonth])

  useEffect(() => {
    if (accessState !== 'ready' || !canRead || !targetPropertyId) {
      setTodayNvrChecks([])
      return
    }
    return subscribeToCctvNvrDailyChecks(
      allProperties ? 'all' : targetPropertyId,
      allProperties,
      today,
      setTodayNvrChecks,
      () => setError(t('โหลดรายละเอียด NVR ไม่สำเร็จ ตรวจสอบ Firestore Index')),
      allProperties ? enabledPropertyIds : undefined,
    )
  }, [accessState, allProperties, canRead, enabledPropertyIds, targetPropertyId, today])

  useEffect(() => {
    if (accessState !== 'ready' || !canRead || !targetPropertyId) {
      setSelectedDateNvrChecks([])
      return
    }
    return subscribeToCctvNvrDailyChecks(
      allProperties ? 'all' : targetPropertyId,
      allProperties,
      selectedDate,
      setSelectedDateNvrChecks,
      () => setError(t('โหลดรายละเอียด NVR ไม่สำเร็จ ตรวจสอบ Firestore Index')),
      allProperties ? enabledPropertyIds : undefined,
    )
  }, [accessState, allProperties, canRead, enabledPropertyIds, selectedDate, targetPropertyId])

  const todayChecks = useMemo(() => checks.filter((check) => check.checkedOn === today), [checks, today])
  const selectedTodayCheck = todayChecks.find((check) => check.propertyId === targetPropertyId)
  const selectedTodayNvrChecks = useMemo(
    () => todayNvrChecks.filter((check) => check.propertyId === targetPropertyId),
    [targetPropertyId, todayNvrChecks],
  )
  const selectedDateChecks = calendarChecks
    .filter((check) => check.checkedOn === selectedDate)
    .sort((a, b) => a.propertyCode.localeCompare(b.propertyCode))
  const calendarDays = useMemo(() => {
    const [year, monthNumber] = visibleMonth.split('-').map(Number)
    const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
    const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, index) => `${visibleMonth}-${String(index + 1).padStart(2, '0')}`),
    ]
  }, [visibleMonth])
  const checksByDate = useMemo(() => {
    const grouped = new Map<string, CctvDailyCheck[]>()
    calendarChecks.forEach((check) => grouped.set(check.checkedOn, [...(grouped.get(check.checkedOn) ?? []), check]))
    return grouped
  }, [calendarChecks])

  const draftFromSavedCheck = useMemo(
    () =>
      buildDraftFromInventory(
        targetPropertyId,
        targetProperty?.code ?? '',
        today,
        nvrInventory,
        selectedTodayCheck,
        selectedTodayNvrChecks,
      ),
    [nvrInventory, selectedTodayCheck, selectedTodayNvrChecks, targetProperty?.code, targetPropertyId, today],
  )

  useEffect(() => {
    setDraft(draftFromSavedCheck)
  }, [draftFromSavedCheck])

  const totals = useMemo(
    () =>
      todayChecks.reduce(
        (sum, check) => ({
          properties: sum.properties + 1,
          nvrTotal: sum.nvrTotal + check.nvrTotal,
          nvrOnline: sum.nvrOnline + check.nvrOnline,
          cameraTotal: sum.cameraTotal + check.cameraTotal,
          cameraOnline: sum.cameraOnline + check.cameraOnline,
        }),
        { properties: 0, nvrTotal: 0, nvrOnline: 0, cameraTotal: 0, cameraOnline: 0 },
      ),
    [todayChecks],
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser || !canManage) {
      setError(t('บัญชีนี้ไม่มีสิทธิ์บันทึกผลตรวจ CCTV'))
      return
    }
    if (!targetProperty) {
      setError(t('กรุณาเลือก Property'))
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await saveCctvDailyCheck(
        { ...draft, propertyId: targetProperty.id, propertyCode: targetProperty.code, checkedOn: today },
        firebaseUser.uid,
        maxNvrDetails,
      )
      setNotice(`บันทึกผลตรวจ CCTV ของ ${targetProperty.code} สำหรับวันนี้แล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกผลตรวจ CCTV ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function saveNvr(nvr: CctvNvrDetail) {
    if (!firebaseUser || !canManage) {
      setError(t('บัญชีนี้ไม่มีสิทธิ์บันทึกผลตรวจ CCTV'))
      return
    }
    if (!targetProperty) {
      setError(t('กรุณาเลือก Property'))
      return
    }
    setSavingNvrId(nvr.nvrId)
    setError(null)
    setNotice(null)
    try {
      await saveCctvDailyCheckNvr(
        { ...draft, propertyId: targetProperty.id, propertyCode: targetProperty.code, checkedOn: today },
        nvr,
        firebaseUser.uid,
      )
      setNotice(`บันทึกผลตรวจ NVR ${nvr.nvrName || nvr.nvrId} แล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกผลตรวจ CCTV ไม่สำเร็จ')
    } finally {
      setSavingNvrId(null)
    }
  }

  function exportLoadedCctvData() {
    if (calendarChecks.length === 0) {
      setNotice(t('ยังไม่มีข้อมูล CCTV ที่โหลดสำหรับส่งออก'))
      return
    }
    downloadCsv(
      `itoms-cctv-summary-${visibleMonth}.csv`,
      calendarChecks.map((check) => ({
        propertyCode: check.propertyCode,
        checkedOn: check.checkedOn,
        nvrTotal: check.nvrTotal,
        nvrOnline: check.nvrOnline,
        cameraTotal: check.cameraTotal,
        cameraOnline: check.cameraOnline,
        nvrDetailsLoaded: check.nvrDetails.length,
      })),
    )
    recordUsageEvent('cctv_exported', { feature: 'cctv', count: calendarChecks.length })
    setNotice(t('ส่งออกข้อมูล CCTV ที่โหลดแล้ว'))
  }

  if (!canRead) return null

  const todayTargetChecked = Boolean(selectedTodayCheck)
  const monthIsCurrent = visibleMonth === today.slice(0, 7)
  const activeNvrCount = nvrInventory.filter((item) => item.active).length
  const largeNvrMode = activeNvrCount > maxNvrDetails

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('CCTV Daily Check')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('สรุปจำนวน NVR และกล้อง Online / Offline ·')} {today}
          </p>
        </div>
        {allProperties && (
          <label className="min-w-52 text-sm font-medium text-slate-600" htmlFor="cctv-property">
            {t('Property ที่ต้องการบันทึก')}
            <select
              className="form-select mt-1 w-full"
              id="cctv-property"
              onChange={(event) => setTargetPropertyId(event.target.value)}
              value={targetPropertyId}
            >
              {enabledProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code} · {property.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
        {t(
          'โหมด Spark: สรุปผลตรวจยังเป็นข้อมูลแบบ bounded ส่วนรายละเอียดราย NVR แยกเก็บเป็นรายการต่อเครื่องเพื่อรองรับจำนวนมากขึ้น',
        )}
      </p>

      {allProperties && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CounterCard label={t('NVR ทั้งหมด')} value={totals.nvrTotal} tone="neutral" />
          <CounterCard label={t('NVR Online')} value={totals.nvrOnline} tone="online" />
          <CounterCard
            label={t('NVR Offline')}
            value={totals.nvrTotal - totals.nvrOnline}
            tone={totals.nvrTotal === totals.nvrOnline ? 'online' : 'offline'}
          />
          <CounterCard label={t('กล้องทั้งหมด')} value={totals.cameraTotal} tone="neutral" />
          <CounterCard label={t('กล้อง Online')} value={totals.cameraOnline} tone="online" />
          <CounterCard
            label={t('กล้อง Offline')}
            value={totals.cameraTotal - totals.cameraOnline}
            tone={totals.cameraTotal === totals.cameraOnline ? 'online' : 'offline'}
          />
        </div>
      )}
      {allProperties && (
        <p className="text-xs text-slate-500">
          {t('สรุปจาก')} {totals.properties}/{enabledProperties.length} {t('Property ที่บันทึกผลตรวจแล้ววันนี้')}
        </p>
      )}

      {!allProperties && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CounterCard label={t('NVR ทั้งหมด')} value={selectedTodayCheck?.nvrTotal ?? 0} tone="neutral" />
          <CounterCard label={t('NVR Online')} value={selectedTodayCheck?.nvrOnline ?? 0} tone="online" />
          <CounterCard
            label={t('NVR Offline')}
            value={selectedTodayCheck ? selectedTodayCheck.nvrTotal - selectedTodayCheck.nvrOnline : 0}
            tone={
              selectedTodayCheck && selectedTodayCheck.nvrTotal > selectedTodayCheck.nvrOnline ? 'offline' : 'online'
            }
          />
          <CounterCard label={t('กล้องทั้งหมด')} value={selectedTodayCheck?.cameraTotal ?? 0} tone="neutral" />
          <CounterCard label={t('กล้อง Online')} value={selectedTodayCheck?.cameraOnline ?? 0} tone="online" />
          <CounterCard
            label={t('กล้อง Offline')}
            value={selectedTodayCheck ? selectedTodayCheck.cameraTotal - selectedTodayCheck.cameraOnline : 0}
            tone={
              selectedTodayCheck && selectedTodayCheck.cameraTotal > selectedTodayCheck.cameraOnline
                ? 'offline'
                : 'online'
            }
          />
        </div>
      )}
      {!allProperties && !selectedTodayCheck && !loading && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('ยังไม่มีผลตรวจ CCTV ของวันนี้ ตัวเลขจะแสดงเป็น 0 จนกว่าจะบันทึกผลตรวจ')}
        </p>
      )}

      <section
        aria-labelledby="cctv-calendar-heading"
        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold" id="cctv-calendar-heading">
              {t('ปฏิทินผลตรวจและ Log')}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{t('เลือกวันที่เพื่อดูผลตรวจของวันนั้น')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label={t('เดือนก่อนหน้า')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-lotus-300"
              onClick={() => {
                const next = shiftMonth(visibleMonth, -1)
                setVisibleMonth(next)
                setSelectedDate(`${next}-01`)
              }}
              type="button"
            >
              ‹
            </button>
            <p aria-live="polite" className="min-w-32 text-center text-sm font-semibold">
              {monthTitle(visibleMonth)}
            </p>
            <button
              aria-label={t('เดือนถัดไป')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-lotus-300"
              disabled={monthIsCurrent}
              onClick={() => {
                const next = shiftMonth(visibleMonth, 1)
                setVisibleMonth(next)
                setSelectedDate(`${next}-01`)
              }}
              type="button"
            >
              ›
            </button>
            {!monthIsCurrent && (
              <button
                className="rounded-full px-3 py-2 text-sm font-medium text-lotus-700 hover:bg-lotus-50"
                onClick={() => {
                  setVisibleMonth(today.slice(0, 7))
                  setSelectedDate(today)
                }}
                type="button"
              >
                {t('วันนี้')}
              </button>
            )}
            <button
              className="rounded-full border border-lotus-200 bg-white px-3 py-2 text-sm font-medium text-lotus-700 hover:bg-lotus-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={calendarChecks.length === 0}
              onClick={exportLoadedCctvData}
              type="button"
            >
              {t('ส่งออกข้อมูลที่โหลด')}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t('ส่งออกเฉพาะสรุป CCTV ของเดือนที่โหลดอยู่ ไม่ใช่การ Export ประวัติทั้งหมด')}
        </p>

        <div
          aria-label={t('วันในสัปดาห์')}
          className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 sm:gap-2"
        >
          {getWeekdayLabels().map((day) => (
            <span className="py-2" key={day}>
              {day}
            </span>
          ))}
        </div>
        {calendarLoading ? (
          <p className="py-10 text-center text-sm text-slate-500" role="status">
            {t('กำลังโหลดปฏิทิน…')}
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((date, index) => {
              if (!date) return <span aria-hidden="true" className="min-h-16 sm:min-h-20" key={`blank-${index}`} />
              const dayChecks = checksByDate.get(date) ?? []
              const expectedProperties = allProperties ? enabledProperties.length : 1
              const hasOffline = dayChecks.some(checkNeedsAttention)
              const partial = dayChecks.length > 0 && dayChecks.length < expectedProperties
              const propertyUnit =
                getLanguage() === 'en' ? (expectedProperties === 1 ? 'property' : 'properties') : 'Property'
              const statusText =
                dayChecks.length === 0
                  ? t('ไม่มี Log')
                  : hasOffline && partial
                    ? `${t('มี Offline')} · ${dayChecks.length}/${expectedProperties} ${propertyUnit}`
                    : hasOffline
                      ? t('มี Offline')
                      : partial
                        ? `${t('ตรวจแล้ว')} ${dayChecks.length}/${expectedProperties} ${propertyUnit}`
                        : t('Online ครบ')
              const statusColor =
                dayChecks.length === 0
                  ? 'border-slate-200 bg-white text-slate-600'
                  : hasOffline || partial
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              const isSelected = selectedDate === date
              return (
                <button
                  aria-label={`${Number(date.slice(-2))} ${monthTitle(visibleMonth)} · ${statusText}`}
                  aria-pressed={isSelected}
                  className={`flex min-h-16 flex-col items-start rounded-xl border p-1.5 text-left transition hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-lotus-400 sm:min-h-20 sm:p-2 ${statusColor} ${isSelected ? 'ring-2 ring-lotus-500 ring-offset-1' : ''}`}
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  type="button"
                >
                  <span className="text-sm font-semibold tabular-nums">{Number(date.slice(-2))}</span>
                  <span className="mt-auto hidden max-w-full truncate text-[10px] font-medium sm:block">
                    {statusText}
                  </span>
                  <span className="mt-auto text-[10px] font-medium sm:hidden">
                    {dayChecks.length ? `${dayChecks.length} Log` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div aria-label={t('คำอธิบายสี')} className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            {t('ตรวจแล้ว Online ครบ')}
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            {t('พบ Offline / ตรวจไม่ครบ')}
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            {t('ไม่มี Log')}
          </span>
        </div>
      </section>

      <section aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">
          {t('Log วันที่')}{' '}
          {new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(
            new Date(`${selectedDate}T12:00:00+07:00`),
          )}
        </h3>
        {calendarLoading ? (
          <p className="mt-3 text-sm text-slate-500">{t('กำลังโหลด Log…')}</p>
        ) : selectedDateChecks.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            {t('ไม่มีบันทึก CCTV ในวันที่เลือก')}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {selectedDateChecks.map((check) => {
              const offlineNvr = check.nvrTotal - check.nvrOnline
              const offlineCameras = check.cameraTotal - check.cameraOnline
              const offline = checkNeedsAttention(check)
              const nvrDetailsForDate = selectedDateNvrChecks.filter((item) => item.propertyId === check.propertyId)
              return (
                <li
                  className={`rounded-xl border p-4 ${offline ? 'border-amber-100 bg-amber-50/60' : 'border-emerald-100 bg-emerald-50/50'}`}
                  key={check.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {check.propertyCode}
                      {allProperties
                        ? ` · ${properties.find((property) => property.id === check.propertyId)?.name ?? ''}`
                        : ''}
                    </p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${offline ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}
                    >
                      {offline ? t('มีอุปกรณ์ Offline') : t('Online ครบ')}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      NVR: {t('Online')} {check.nvrOnline}/{check.nvrTotal} · {t('Offline')} {offlineNvr}
                    </p>
                    <p>
                      {t('กล้อง: Online')} {check.cameraOnline}/{check.cameraTotal} · {t('Offline')} {offlineCameras}
                    </p>
                  </div>
                  {nvrDetailsForDate.length > 0 || check.nvrDetails.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-600">{t('รายละเอียดแยกตาม NVR')}</p>
                      {(nvrDetailsForDate.length > 0 ? nvrDetailsForDate : check.nvrDetails).map((nvr) => {
                        const nvrOfflineCameras = nvr.cameraTotal - nvr.cameraOnline
                        return (
                          <article
                            className={`rounded-xl border bg-white/90 p-3 ${nvr.online && nvrOfflineCameras === 0 ? 'border-emerald-100' : 'border-amber-100'}`}
                            key={nvr.nvrId}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-slate-800">{nvr.nvrName || nvr.nvrId}</p>
                                {nvr.location && <p className="text-xs text-slate-500">{nvr.location}</p>}
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${nvr.online ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
                              >
                                {nvr.online ? t('NVR Online') : t('NVR Offline')}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {t('กล้อง Online')} {nvr.cameraOnline}/{nvr.cameraTotal} · Offline {nvrOfflineCameras}{' '}
                              {t('· บันทึกย้อนหลัง')}{' '}
                              {nvr.oldestFootageOn
                                ? `${nvr.retentionDays} ${t('วัน')}`
                                : nvr.retentionDays > 0
                                  ? `${nvr.retentionDays} ${t('วัน')}`
                                  : t('ไม่ระบุ')}
                              {nvr.targetRetentionDays
                                ? ` · ${t('เป้าหมาย')} ${nvr.targetRetentionDays} ${t('วัน')}`
                                : ''}
                            </p>
                            {nvr.oldestFootageOn && (
                              <p className="mt-1 text-xs text-slate-500">
                                {t('วันที่ภาพเก่าสุดที่เปิดดูได้')}:{' '}
                                {new Intl.DateTimeFormat(getLocale(), {
                                  dateStyle: 'medium',
                                  timeZone: 'Asia/Bangkok',
                                }).format(new Date(`${nvr.oldestFootageOn}T12:00:00+07:00`))}
                              </p>
                            )}
                            {nvr.targetRetentionDays != null &&
                              nvr.targetRetentionDays > 0 &&
                              nvr.retentionDays < nvr.targetRetentionDays && (
                                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                  {t('วันย้อนหลังต่ำกว่าเป้าหมาย')}
                                </p>
                              )}
                            {nvr.notes && (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{nvr.notes}</p>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-500">
                      {t('รายการเดิมเก็บเฉพาะยอดรวม จึงไม่มีข้อมูลแยก NVR ย้อนหลัง')}
                    </p>
                  )}
                  {check.notes && (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white/80 p-3 text-sm text-slate-700">
                      {check.notes}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {t('บันทึกล่าสุด')} {formatCheckedAt(check.checkedAt)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {targetProperty && (
        <CctvNvrInventoryManager
          canManage={canManage}
          onItems={updateNvrInventory}
          propertyCode={targetProperty.code}
          propertyId={targetProperty.id}
        />
      )}

      {canManage && (
        <form className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4" onSubmit={submit}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">
              {todayTargetChecked ? t('แก้ไขผลตรวจวันนี้') : t('บันทึกผลตรวจวันนี้')}
              {targetProperty && <span className="ml-2 text-sm font-normal text-slate-500">{targetProperty.code}</span>}
            </h3>
            {selectedTodayCheck && (
              <p className="text-xs text-slate-500">
                {t('บันทึกล่าสุด')} {formatCheckedAt(selectedTodayCheck.checkedAt)}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-medium text-slate-800">{t('ตรวจสุขภาพรายวันแยกตาม NVR')}</h4>
              <p className="text-xs text-slate-500">
                {t('จำนวนกล้องและเป้าหมายวันย้อนหลังดึงจากทะเบียน NVR; กรอกผลที่ตรวจพบจริงในวันนี้')}
              </p>
            </div>
          </div>
          {draft.nvrDetails.length > 0 ? (
            <div className="mt-3 space-y-3">
              {draft.nvrDetails.map((nvr, index) => {
                const saved = Boolean(selectedTodayCheck?.nvrDetails.some((savedNvr) => savedNvr.nvrId === nvr.nvrId))
                return (
                  <article className="rounded-2xl border border-slate-200 bg-white p-4" key={nvr.nvrId || index}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h5 className="font-medium">{nvr.nvrName || nvr.nvrId}</h5>
                        {nvr.location && <p className="text-xs text-slate-500">{nvr.location}</p>}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${saved ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}
                        >
                          {saved ? t('บันทึกแล้ว') : t('ยังไม่ได้บันทึก')}
                        </span>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600">
                          {t('เป้าหมายย้อนหลัง')}{' '}
                          {nvr.targetRetentionDays ? `${nvr.targetRetentionDays} ${t('วัน')}` : t('ยังไม่กำหนด')}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="text-sm font-medium text-slate-600">
                        {t('สถานะ NVR')}
                        <select
                          className="form-select mt-1 w-full"
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              nvrDetails: current.nvrDetails.map((item, row) =>
                                row === index
                                  ? {
                                      ...item,
                                      online: event.target.value === 'online',
                                      cameraOnline: event.target.value === 'online' ? item.cameraOnline : 0,
                                    }
                                  : item,
                              ),
                            }))
                          }
                          value={nvr.online ? 'online' : 'offline'}
                        >
                          <option value="online">{t('Online')}</option>
                          <option value="offline">{t('Offline')}</option>
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-600">
                        {t('จำนวนกล้องตามทะเบียน')}
                        <input
                          className="form-input mt-1 w-full bg-slate-50"
                          readOnly
                          type="number"
                          value={nvr.cameraTotal}
                        />
                      </label>
                      <label className="text-sm font-medium text-emerald-800">
                        {t('กล้อง Online')}
                        <input
                          className="form-input mt-1 w-full"
                          max={nvr.cameraTotal}
                          min="0"
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              nvrDetails: current.nvrDetails.map((item, row) =>
                                row === index ? { ...item, cameraOnline: Number(event.target.value) } : item,
                              ),
                            }))
                          }
                          required
                          type="number"
                          value={nvr.cameraOnline}
                        />
                      </label>
                      <label className="text-sm font-medium text-slate-600">
                        {t('วันที่ภาพเก่าสุดที่เปิดดูได้')}
                        <input
                          className="form-input mt-1 w-full"
                          max={today}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              nvrDetails: current.nvrDetails.map((item, row) => {
                                if (row !== index) return item
                                const oldestFootageOn = event.target.value
                                const calculatedDays = oldestFootageOn
                                  ? retentionDaysFromOldestDate(today, oldestFootageOn)
                                  : null
                                return {
                                  ...item,
                                  oldestFootageOn,
                                  retentionDays:
                                    calculatedDays ??
                                    (oldestFootageOn ? 0 : item.oldestFootageOn ? 0 : item.retentionDays),
                                }
                              }),
                            }))
                          }
                          type="date"
                          value={nvr.oldestFootageOn ?? ''}
                        />
                        <span className="mt-1 block text-xs font-normal text-slate-400">
                          {t('เลือกวันที่ของภาพเก่าสุดที่ทดลองเปิดดูได้ ระบบคำนวณวันย้อนหลังให้')}
                          {nvr.oldestFootageOn && (
                            <span className="ml-1 font-medium text-lotus-700">
                              · {retentionDaysFromOldestDate(today, nvr.oldestFootageOn) ?? 0} {t('วัน')}
                            </span>
                          )}
                        </span>
                      </label>
                      <label className="text-sm font-medium text-slate-600 sm:col-span-2 xl:col-span-4">
                        {t('หมายเหตุ')}
                        <textarea
                          className="form-input mt-1 min-h-10 w-full"
                          maxLength={500}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              nvrDetails: current.nvrDetails.map((item, row) =>
                                row === index ? { ...item, notes: event.target.value } : item,
                              ),
                            }))
                          }
                          value={nvr.notes}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {t('กล้อง Offline:')} {nvr.cameraTotal - nvr.cameraOnline}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <button
                        aria-label={`${t('บันทึก NVR นี้')} ${nvr.nvrName || nvr.nvrId}`}
                        className="rounded-xl border border-lotus-200 px-3 py-2 text-sm font-semibold text-lotus-700 hover:bg-lotus-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={savingNvrId !== null || !targetProperty}
                        onClick={() => void saveNvr(nvr)}
                        type="button"
                      >
                        {savingNvrId === nvr.nvrId ? t('กำลังบันทึก NVR…') : t('บันทึก NVR นี้')}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600">
              <p className="font-medium">{t('ยังไม่มี NVR ที่เปิดใช้งานในทะเบียน')}</p>
              <p className="mt-1 text-xs">{t('เพิ่ม NVR ในทะเบียนด้านบนก่อน ระบบจึงจะแสดงแบบตรวจรายเครื่อง')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium text-slate-600">
                  {t('NVR ทั้งหมด')}
                  <input
                    className="form-input mt-1 w-full"
                    max="20000"
                    min="0"
                    onChange={(event) => setDraft((current) => ({ ...current, nvrTotal: Number(event.target.value) }))}
                    required
                    type="number"
                    value={draft.nvrTotal}
                  />
                </label>
                <label className="text-sm font-medium text-emerald-800">
                  {t('NVR Online')}
                  <input
                    className="form-input mt-1 w-full"
                    max={draft.nvrTotal}
                    min="0"
                    onChange={(event) => setDraft((current) => ({ ...current, nvrOnline: Number(event.target.value) }))}
                    required
                    type="number"
                    value={draft.nvrOnline}
                  />
                </label>
                <label className="text-sm font-medium text-slate-600">
                  {t('กล้องทั้งหมด')}
                  <input
                    className="form-input mt-1 w-full"
                    max="20000"
                    min="0"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, cameraTotal: Number(event.target.value) }))
                    }
                    required
                    type="number"
                    value={draft.cameraTotal}
                  />
                </label>
                <label className="text-sm font-medium text-emerald-800">
                  {t('กล้อง Online')}
                  <input
                    className="form-input mt-1 w-full"
                    max={draft.cameraTotal}
                    min="0"
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, cameraOnline: Number(event.target.value) }))
                    }
                    required
                    type="number"
                    value={draft.cameraOnline}
                  />
                </label>
              </div>
            </div>
          )}
          {draft.nvrDetails.length > 0 && (
            <p className="mt-3 rounded-lg bg-lotus-50 px-3 py-2 text-xs text-lotus-800">
              {t('สรุปยอดรวมอัตโนมัติ: NVR')} {draft.nvrDetails.filter((item) => item.online).length}/
              {draft.nvrDetails.length} {t('Online · กล้อง')}{' '}
              {draft.nvrDetails.reduce((sum, item) => sum + item.cameraOnline, 0)}/
              {draft.nvrDetails.reduce((sum, item) => sum + item.cameraTotal, 0)} Online
            </p>
          )}
          {draft.nvrDetails.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">{t('Offline จะคำนวณจากจำนวนทั้งหมดลบจำนวน Online')}</p>
          )}
          <label className="mt-3 block text-sm font-medium text-slate-600">
            {t('หมายเหตุ เช่น NVR ที่มีปัญหา')}
            <textarea
              className="form-input mt-1 min-h-20 w-full"
              maxLength={1000}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              value={draft.notes}
            />
          </label>
          {error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {t(error)}
            </p>
          )}
          {notice && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
              {t(notice)}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              className="rounded-xl bg-lotus-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-lotus-700 disabled:opacity-50"
              disabled={saving || !targetProperty || largeNvrMode}
              type="submit"
            >
              {saving ? t('กำลังบันทึก…') : t(todayTargetChecked ? 'อัปเดตผลตรวจ' : 'บันทึกผลตรวจ')}
            </button>
          </div>
          {largeNvrMode && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {t(
                'Property นี้มี NVR มากกว่าขีดจำกัดของเอกสารสรุป กรุณาบันทึกแยกทีละ NVR ระบบจะเก็บรายละเอียดในรายการต่อเครื่อง',
              )}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
