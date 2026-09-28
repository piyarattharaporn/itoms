import { useEffect, useMemo, useState } from 'react'
import { t } from '../../lib/i18n'
import { useAuth } from '../auth/AuthProvider'
import { subscribeToSchedules, type PmSchedule } from './pmService'

function bangkokToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function shiftDate(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function PmOverviewSummary({
  selectedPropertyId,
  compact = false,
}: {
  selectedPropertyId: string
  compact?: boolean
}) {
  const { profile, memberships, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [schedules, setSchedules] = useState<PmSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (accessState !== 'ready' || !canRead) {
      setSchedules([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    return subscribeToSchedules(
      selectedPropertyId,
      allProperties,
      (items) => {
        setSchedules(items)
        setLoading(false)
      },
      () => {
        setSchedules([])
        setError(true)
        setLoading(false)
      },
    )
  }, [accessState, canRead, selectedPropertyId, allProperties])

  const summary = useMemo(() => {
    const today = bangkokToday()
    const active = schedules.filter((schedule) => schedule.active)
    const overdue = active.filter((schedule) => schedule.nextDueOn < today)
    const dueSoon = active.filter(
      (schedule) => schedule.nextDueOn >= today && schedule.nextDueOn <= shiftDate(today, 7),
    )
    const upcoming = active.filter((schedule) => schedule.nextDueOn >= today).slice(0, 4)
    return { active, overdue, dueSoon, upcoming }
  }, [schedules])

  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 font-semibold text-slate-900">{t('สรุปงาน PM')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('สถานะตาราง PM ของ Property · ดูได้อย่างเดียว')}</p>
        </div>
        {selectedPropertyId === 'all' && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            {t('ทุก Property')}
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          {t('โหลดสรุป PM ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes')}
        </p>
      ) : loading ? (
        <p className="mt-5 py-8 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลดสรุป PM…')}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <article className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t('ตารางที่เปิดใช้งาน')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{summary.active.length}</p>
            </article>
            <article className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t('ครบกำหนดใน 7 วัน')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{summary.dueSoon.length}</p>
            </article>
            <article className={`rounded-xl p-3 ${summary.overdue.length ? 'bg-rose-50' : 'bg-slate-50'}`}>
              <p className="text-xs text-slate-500">{t('เลยกำหนด')}</p>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${summary.overdue.length ? 'text-rose-800' : 'text-slate-900'}`}
              >
                {summary.overdue.length}
              </p>
            </article>
          </div>

          {summary.upcoming.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              {t('ไม่มี PM Schedule ที่กำลังจะถึงกำหนด')}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {summary.upcoming.slice(0, compact ? 2 : 4).map((schedule) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={schedule.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{schedule.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {schedule.propertyCode} · {schedule.location || t('ไม่ระบุ Location')} · {t(schedule.frequency)}
                    </p>
                  </div>
                  <time className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    {schedule.nextDueOn}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
