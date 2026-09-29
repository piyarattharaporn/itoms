import { getLocale, t } from '../../lib/i18n'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DataFreshnessBar } from '../../components/DataFreshnessBar'
import { useAuth } from '../auth/AuthProvider'
import {
  completeSchedule,
  createSchedule,
  getSchedulePage,
  updateSchedule,
  type PmChecklistResult,
  type PmFrequency,
  type PmPageCursor,
  type PmSchedule,
  type PmScheduleInput,
} from './pmService'

const blankSchedule: PmScheduleInput = {
  propertyId: '',
  propertyCode: '',
  title: '',
  location: '',
  frequency: 'Monthly',
  checklistItems: [],
  nextDueOn: '',
  active: true,
}

function todayBangkok() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function formatDueDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  )
}

function ScheduleForm({
  initial,
  properties,
  allowPropertySelect,
  onCancel,
  onSubmit,
}: {
  initial: PmScheduleInput
  properties: ReturnType<typeof useAuth>['properties']
  allowPropertySelect: boolean
  onCancel: () => void
  onSubmit: (input: PmScheduleInput) => Promise<void>
}) {
  const [title, setTitle] = useState(initial.title)
  const [location, setLocation] = useState(initial.location)
  const [propertyId, setPropertyId] = useState(initial.propertyId)
  const [frequency, setFrequency] = useState<PmFrequency>(initial.frequency)
  const [checklistText, setChecklistText] = useState(initial.checklistItems.join('\n'))
  const [nextDueOn, setNextDueOn] = useState(initial.nextDueOn || todayBangkok())
  const [active, setActive] = useState(initial.active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const property = properties.find((item) => item.id === propertyId)
    if (!property) {
      setError(t('เลือก Property ที่มีสิทธิ์ก่อนบันทึก'))
      setSaving(false)
      return
    }
    try {
      await onSubmit({
        propertyId: property.id,
        propertyCode: property.code,
        title,
        location,
        frequency,
        checklistItems: checklistText.split('\n'),
        nextDueOn,
        active,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึก PM Schedule ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5" onSubmit={submit}>
      <h3 className="font-semibold">{initial.title ? t('แก้ไข PM Schedule') : t('สร้าง PM Schedule')}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {allowPropertySelect && (
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="pm-property">
              {t('Property')}
            </label>
            <select
              className="form-select"
              id="pm-property"
              onChange={(event) => setPropertyId(event.target.value)}
              required
              value={propertyId}
            >
              <option disabled value="">
                {t('เลือก Property')}
              </option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code} · {property.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="pm-title">
            {t('ชื่องาน PM')}
          </label>
          <input
            className="form-input"
            id="pm-title"
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="pm-location">
            {t('Location')}
          </label>
          <input
            className="form-input"
            id="pm-location"
            maxLength={160}
            onChange={(event) => setLocation(event.target.value)}
            value={location}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="pm-frequency">
            {t('รอบการทำงาน')}
          </label>
          <select
            className="form-select"
            id="pm-frequency"
            onChange={(event) => setFrequency(event.target.value as PmFrequency)}
            value={frequency}
          >
            <option value="Weekly">{t('รายสัปดาห์')}</option>
            <option value="Monthly">{t('รายเดือน')}</option>
            <option value="Quarterly">{t('รายไตรมาส')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="pm-due">
            {t('กำหนดครั้งถัดไป')}
          </label>
          <input
            className="form-input"
            id="pm-due"
            onChange={(event) => setNextDueOn(event.target.value)}
            required
            type="date"
            value={nextDueOn}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium" htmlFor="pm-checklist">
          {t('Checklist (หนึ่งรายการต่อบรรทัด)')}
        </label>
        <textarea
          className="form-input min-h-28 resize-y"
          id="pm-checklist"
          maxLength={8000}
          placeholder={t('ตรวจสอบเวลา DVR\nตรวจอุณหภูมิห้อง Server\nทดสอบ UPS')}
          required
          onChange={(event) => setChecklistText(event.target.value)}
          value={checklistText}
        />
        <p className="mt-1 text-xs text-slate-500">{t('ใส่ได้ 1–30 รายการ')}</p>
      </div>
      {initial.title && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" />
          {t('เปิดใช้งาน Schedule')}
        </label>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={onCancel} type="button">
          {t('ยกเลิก')}
        </button>
        <button
          className="rounded-lg bg-lotus-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lotus-700 disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? t('กำลังบันทึก…') : t('บันทึก Schedule')}
        </button>
      </div>
    </form>
  )
}

function RunChecklist({
  schedule,
  onCancel,
  onComplete,
}: {
  schedule: PmSchedule
  onCancel: () => void
  onComplete: (results: PmChecklistResult[], notes: string) => Promise<void>
}) {
  const [checked, setChecked] = useState<boolean[]>(schedule.checklistItems.map(() => false))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onComplete(
        schedule.checklistItems.map((item, index) => ({ item, checked: checked[index] })),
        notes,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกผล PM ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5" onSubmit={submit}>
      <h4 className="font-semibold">
        {t('บันทึก Checklist ·')} {schedule.title}
      </h4>
      <ul className="mt-3 space-y-2">
        {schedule.checklistItems.map((item, index) => (
          <li key={`${index}-${item}`}>
            <label className="flex items-start gap-2 text-sm">
              <input
                checked={checked[index]}
                className="mt-0.5"
                onChange={(event) =>
                  setChecked((values) =>
                    values.map((value, itemIndex) => (itemIndex === index ? event.target.checked : value)),
                  )
                }
                type="checkbox"
              />
              {item}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium" htmlFor={`pm-notes-${schedule.id}`}>
          {t('หมายเหตุ / สิ่งที่ต้องติดตาม')}
        </label>
        <textarea
          className="form-input min-h-20"
          id={`pm-notes-${schedule.id}`}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {t('หากมีรายการที่ยังไม่ผ่าน ระบบจะบันทึกผลเป็น Needs Attention และเลื่อนรอบตามกำหนด')}
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={onCancel} type="button">
          {t('ยกเลิก')}
        </button>
        <button
          className="rounded-lg bg-lotus-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lotus-700 disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? t('กำลังบันทึก…') : t('บันทึกผลและเลื่อนรอบ')}
        </button>
      </div>
    </form>
  )
}

export function PmManager({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const selectedMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const canManage = isSuperAdmin || selectedMembership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [schedules, setSchedules] = useState<PmSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<PmSchedule | null>(null)
  const [running, setRunning] = useState<PmSchedule | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<PmPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canManage) {
      setSchedules([])
      setLoading(false)
      setError(t('หน้านี้เปิดให้ IT Support Engineer และ Super Admin เท่านั้น'))
      return
    }
    setLoading(true)
    setError(null)
    setSchedules([])
    setNextCursor(null)
    setHasMore(false)
    setLastUpdated(null)
    let cancelled = false
    void getSchedulePage(selectedPropertyId, allProperties, 25)
      .then((page) => {
        if (cancelled) return
        setSchedules(page.items)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('โหลด PM Schedule ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes'))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessState, canManage, selectedPropertyId, allProperties, reloadKey])

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const page = await getSchedulePage(selectedPropertyId, allProperties, 25, nextCursor)
      setSchedules((current) => [...current, ...page.items])
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

  const today = todayBangkok()
  const sortedSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.active).sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn)),
    [schedules],
  )

  async function saveSchedule(input: PmScheduleInput) {
    if (!firebaseUser) throw new Error(t('กรุณาเข้าสู่ระบบใหม่'))
    if (editing) {
      await updateSchedule(editing.id, input)
      setNotice(`อัปเดต PM Schedule “${input.title}” แล้ว`)
      setEditing(null)
    } else {
      await createSchedule(input, firebaseUser.uid)
      setNotice(`สร้าง PM Schedule “${input.title}” แล้ว`)
      setShowCreate(false)
    }
    setReloadKey((value) => value + 1)
  }

  async function saveRun(schedule: PmSchedule, results: PmChecklistResult[], notes: string) {
    if (!firebaseUser) throw new Error(t('กรุณาเข้าสู่ระบบใหม่'))
    const runId = await completeSchedule(schedule, firebaseUser.uid, results, notes)
    setRunning(null)
    setNotice(`บันทึก PM แล้ว (Run ${runId})`)
    setReloadKey((value) => value + 1)
  }

  if (accessState === 'loading')
    return (
      <p className="py-10 text-center text-sm text-slate-500" role="status">
        {t('กำลังตรวจสอบสิทธิ์…')}
      </p>
    )
  if (!canManage)
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">
        {t(error)}
      </p>
    )

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{t('Preventive Maintenance')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('จัดตาราง Checklist และบันทึกผล PM ซ้ำตามรอบ')}</p>
          </div>
          <button
            className="rounded-lg bg-lotus-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lotus-700"
            onClick={() => {
              setEditing(null)
              setShowCreate((value) => !value)
            }}
            type="button"
          >
            {showCreate ? t('ปิดฟอร์ม') : t('สร้าง PM Schedule')}
          </button>
        </div>
        {notice && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            {t(notice)}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {t(error)}
          </p>
        )}
        <DataFreshnessBar lastUpdated={lastUpdated} loading={loading} onRefresh={refresh} />
        {showCreate && (
          <ScheduleForm
            allowPropertySelect={allProperties}
            initial={{
              ...blankSchedule,
              propertyId: allProperties ? '' : selectedPropertyId,
              propertyCode: properties.find((property) => property.id === selectedPropertyId)?.code ?? '',
              nextDueOn: today,
            }}
            onCancel={() => setShowCreate(false)}
            onSubmit={saveSchedule}
            properties={
              allProperties ? properties : properties.filter((property) => property.id === selectedPropertyId)
            }
          />
        )}
        {editing && (
          <ScheduleForm
            allowPropertySelect={false}
            initial={{
              propertyId: editing.propertyId,
              propertyCode: editing.propertyCode,
              title: editing.title,
              location: editing.location,
              frequency: editing.frequency,
              checklistItems: editing.checklistItems,
              nextDueOn: editing.nextDueOn,
              active: editing.active,
            }}
            onCancel={() => setEditing(null)}
            onSubmit={saveSchedule}
            properties={properties}
          />
        )}
      </section>

      {loading && schedules.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลดตาราง PM…')}
        </p>
      ) : sortedSchedules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {t('ยังไม่มี PM Schedule ที่เปิดใช้งาน')}
        </p>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sortedSchedules.map((schedule) => {
            const overdue = schedule.nextDueOn < today
            const dueToday = schedule.nextDueOn === today
            return (
              <article className="rounded-2xl border border-slate-200/80 bg-white p-5" key={schedule.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-lotus-700">
                      {schedule.propertyCode} · {t(schedule.frequency)}
                    </p>
                    <h3 className="mt-1 font-semibold">{schedule.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{schedule.location || 'ไม่ระบุ Location'}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-rose-50 text-rose-800' : dueToday ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
                  >
                    {overdue ? t('เลยกำหนด') : dueToday ? t('ถึงกำหนดวันนี้') : t('ตามแผน')}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  {t('กำหนดครั้งถัดไป:')}{' '}
                  <strong className="font-semibold text-slate-900">{formatDueDate(schedule.nextDueOn)}</strong>
                </p>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  {t('Checklist')} {schedule.checklistItems.length} {t('รายการ')}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {schedule.checklistItems.slice(0, 4).map((item, index) => (
                    <li key={`${index}-${item}`}>{item}</li>
                  ))}
                </ul>
                {schedule.checklistItems.length > 4 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {t('และอีก')} {schedule.checklistItems.length - 4} {t('รายการ')}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button
                    className="rounded-lg bg-lotus-600 px-3 py-2 text-sm font-medium text-white hover:bg-lotus-700"
                    onClick={() => {
                      setRunning(running?.id === schedule.id ? null : schedule)
                      setEditing(null)
                    }}
                    type="button"
                  >
                    {running?.id === schedule.id ? t('ปิด Checklist') : t('บันทึกผล PM')}
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    onClick={() => {
                      setEditing(schedule)
                      setShowCreate(false)
                      setRunning(null)
                    }}
                    type="button"
                  >
                    {t('แก้ไข Schedule')}
                  </button>
                </div>
                {running?.id === schedule.id && (
                  <RunChecklist
                    onCancel={() => setRunning(null)}
                    onComplete={(results, notes) => saveRun(schedule, results, notes)}
                    schedule={schedule}
                  />
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
      <p className="text-xs text-slate-500">{t('แสดง PM Schedule แบบแบ่งหน้า ครั้งละ 25 รายการ')}</p>
    </div>
  )
}
