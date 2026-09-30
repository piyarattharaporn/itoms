import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getAssignableEngineers, getTicketPage, type TicketPageCursor } from '../tickets/ticketService'
import type { TicketRecord } from '../tickets/types'
import { getRcaPage } from '../rca/rcaService'
import { buildPerformanceCsv, buildPerformanceSnapshot, formatDurationMinutes } from './servicePerformance'
import { getLocale, t } from '../../lib/i18n'

type Period = '7' | '30' | '90' | 'custom'
type ReportView = 'team' | 'property' | 'quality'

function dateLabel(value: Date | null): string {
  return value ? value.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function localDateInputValue(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(value: string, endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  )
  return parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month) - 1 && parsed.getDate() === Number(day)
    ? parsed
    : null
}

function inPeriod(ticket: TicketRecord, start: Date, end: Date) {
  return Boolean(ticket.createdAt && ticket.createdAt >= start && ticket.createdAt <= end)
}

function percent(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '—'
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ServicePerformancePage({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships } = useAuth()
  const allProperties = selectedPropertyId === 'all'
  const selectedMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const canRead =
    profile?.globalRole === 'superAdmin' ||
    selectedMembership?.role === 'supportEngineer' ||
    selectedMembership?.role === 'clientExecutive'
  const propertyRole = allProperties ? undefined : selectedMembership?.role
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [ticketCursor, setTicketCursor] = useState<TicketPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [engineerLabels, setEngineerLabels] = useState<Map<string, string>>(new Map())
  const [rcaTaskIds, setRcaTaskIds] = useState<Set<string>>(new Set())
  const [rcaHasMore, setRcaHasMore] = useState(false)
  const [period, setPeriod] = useState<Period>('30')
  const [customStartDate, setCustomStartDate] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return localDateInputValue(start)
  })
  const [customEndDate, setCustomEndDate] = useState(() => localDateInputValue(new Date()))
  const [view, setView] = useState<ReportView>('team')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async (append = false) => {
    if (!firebaseUser || !profile || !canRead) return
    setLoading(true)
    setError('')
    try {
      const page = await getTicketPage(
        {
          uid: firebaseUser.uid,
          globalRole: profile.globalRole,
          propertyRole,
          propertyId: selectedPropertyId,
          allProperties,
        },
        50,
        append ? ticketCursor : null,
      )
      setTickets((current) => (append ? [...current, ...page.items] : page.items))
      setTicketCursor(page.nextCursor)
      setHasMore(page.hasMore)
      if (!append) {
        const [engineers, rcaPage] = await Promise.all([
          getAssignableEngineers(allProperties ? 'all' : selectedPropertyId, profile.globalRole === 'superAdmin'),
          getRcaPage(selectedPropertyId, allProperties, 50),
        ])
        setEngineerLabels(new Map(engineers.map((engineer) => [engineer.uid, engineer.displayName])))
        setRcaTaskIds(new Set(rcaPage.items.map((item) => item.taskId)))
        setRcaHasMore(rcaPage.hasMore)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'โหลดรายงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTickets([])
    setTicketCursor(null)
    setHasMore(false)
    setRcaTaskIds(new Set())
    void load(false)
    // Loading is intentionally reset when the selected Property changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, canRead])

  const { start, end, hasValidRange } = useMemo(() => {
    if (period === 'custom') {
      const customStart = parseDateInput(customStartDate)
      const customEnd = parseDateInput(customEndDate, true)
      return {
        start: customStart,
        end: customEnd,
        hasValidRange: Boolean(customStart && customEnd && customStart <= customEnd),
      }
    }
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - Number(period))
    startDate.setHours(0, 0, 0, 0)
    return { start: startDate, end: endDate, hasValidRange: true }
  }, [period, customStartDate, customEndDate])
  const periodTickets = useMemo(
    () => (hasValidRange && start && end ? tickets.filter((ticket) => inPeriod(ticket, start, end)) : []),
    [tickets, start, end, hasValidRange],
  )
  const snapshot = useMemo(
    () => buildPerformanceSnapshot(periodTickets, engineerLabels),
    [periodTickets, engineerLabels],
  )
  const completedWithResolution = periodTickets.filter(
    (ticket) => ticket.status === 'Completed' && ticket.resolutionNotes.trim().length > 0,
  ).length
  const completedWithRca = periodTickets.filter(
    (ticket) => ticket.status === 'Completed' && rcaTaskIds.has(ticket.id),
  ).length
  const slaRate = percent(snapshot.slaMet, snapshot.slaEligible)
  const roleLabel = profile?.globalRole === 'superAdmin' ? 'Super Admin' : (selectedMembership?.role ?? 'Member')

  if (!canRead) {
    return (
      <section className="mt-6 rounded-3xl border border-line bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">{t('ไม่มีสิทธิ์ดูรายงานผลงาน')}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t('รายงานนี้เปิดให้ทีม IT และผู้แทน Property ที่ได้รับสิทธิ์เท่านั้น')}
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 space-y-5">
      <header className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lotus-700">
              {t('Spark bounded reporting')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t('Service Performance')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {t('ติดตามคุณภาพและปริมาณงานตามช่วงเวลา โดยใช้เฉพาะข้อมูลที่โหลดแล้วและส่งออกแบบ Manual')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">{t(roleLabel)}</span>
            <span className="rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-800">
              {t('Loaded rows')}: {tickets.length}
            </span>
            <button
              className="min-h-10 rounded-full border border-line bg-white px-4 py-2 font-semibold text-lotus-800 hover:bg-lotus-50"
              onClick={() =>
                download(
                  `itoms-service-performance-${new Date().toISOString().slice(0, 10)}.csv`,
                  buildPerformanceCsv(periodTickets, engineerLabels),
                )
              }
              type="button"
            >
              {t('Export current view')}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold text-slate-600">{t('Report period')}</span>
          {(['7', '30', '90', 'custom'] as Period[]).map((value) => (
            <button
              className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold ${period === value ? 'border-lotus-700 bg-lotus-700 text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'}`}
              key={value}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {value === '7'
                ? t('7 days')
                : value === '30'
                  ? t('30 days')
                  : value === '90'
                    ? t('90 days')
                    : t('Custom range')}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 p-3">
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                {t('From date')}
                <input
                  aria-label={t('From date')}
                  className="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
                  max={customEndDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  type="date"
                  value={customStartDate}
                />
              </label>
              <span className="pb-2 text-sm text-slate-400">—</span>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                {t('To date')}
                <input
                  aria-label={t('To date')}
                  className="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
                  max={localDateInputValue(new Date())}
                  min={customStartDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  type="date"
                  value={customEndDate}
                />
              </label>
            </div>
          )}
          <span className="text-sm text-slate-500">
            {hasValidRange ? `${dateLabel(start)} — ${dateLabel(end)}` : t('กรุณาเลือกช่วงวันที่ให้ถูกต้อง')}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-4">
          {(['team', 'property', 'quality'] as ReportView[]).map((value) => (
            <button
              className={`min-h-10 rounded-xl px-4 py-2 text-sm font-semibold ${view === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              key={value}
              onClick={() => setView(value)}
              type="button"
            >
              {value === 'team'
                ? t('Team performance')
                : value === 'property'
                  ? t('Property and workload')
                  : t('Quality and review')}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {t(error)}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          [t('Tasks in period'), snapshot.total, 'text-ink'],
          [t('Completed'), snapshot.completed, 'text-emerald-700'],
          [t('Open'), snapshot.open, 'text-sky-700'],
          [t('Unassigned'), snapshot.unassigned, 'text-amber-700'],
          [t('SLA met'), slaRate, 'text-lotus-800'],
          [t('Avg resolution'), formatDurationMinutes(snapshot.averageResolutionMinutes), 'text-violet-700'],
        ].map(([label, value, color]) => (
          <article className="rounded-2xl border border-line bg-white p-4 shadow-sm" key={String(label)}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p>
          </article>
        ))}
      </div>

      {view === 'team' && (
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-ink">{t('Team performance by assignee')}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {t('ใช้ displayName เป็นหลัก และเก็บ UID ไว้เป็นข้อมูลอ้างอิงในระบบ')}
              </p>
            </div>
            <span className="text-xs text-slate-500">{t('Current loaded period only')}</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">{t('Assignee')}</th>
                  <th className="px-3 py-3">{t('Assigned')}</th>
                  <th className="px-3 py-3">{t('Completed')}</th>
                  <th className="px-3 py-3">{t('Open')}</th>
                  <th className="px-3 py-3">{t('SLA breached')}</th>
                  <th className="px-3 py-3">{t('SLA met')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {snapshot.byEngineer.map((row) => (
                  <tr key={row.uid} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-ink">{row.displayName}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.uid === 'unassigned' ? t('No assignee') : row.uid}
                      </p>
                    </td>
                    <td className="px-3 py-3 font-semibold">{row.assigned}</td>
                    <td className="px-3 py-3">{row.completed}</td>
                    <td className="px-3 py-3">{row.open}</td>
                    <td className="px-3 py-3 text-rose-700">{row.breached}</td>
                    <td className="px-3 py-3 text-emerald-700">{percent(row.slaMet, row.slaEligible)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'property' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            ['Property / scope', snapshot.byProperty],
            ['Problem category', snapshot.byCategory],
            ['Location / asset', snapshot.byLocation],
          ].map(([title, rows]) => (
            <section className="rounded-3xl border border-line bg-white p-5 shadow-sm" key={String(title)}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink">{t(String(title))}</h3>
                <span className="text-xs text-slate-500">
                  {snapshot.total} {t('tasks')}
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {(rows as { label: string; count: number; share: number }[]).slice(0, 10).map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700">{t(row.label)}</span>
                      <span className="shrink-0 font-semibold text-ink">
                        {row.count} <span className="font-normal text-slate-400">{row.share}%</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-lotus-400"
                        style={{ width: `${Math.max(row.share, row.count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === 'quality' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-ink">{t('Quality signals available now')}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">{t('Completed with resolution note')}</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">
                  {completedWithResolution} <span className="text-sm font-normal">/ {snapshot.completed}</span>
                </p>
              </div>
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-sm text-violet-800">{t('Completed with RCA')}</p>
                <p className="mt-2 text-2xl font-semibold text-violet-800">
                  {completedWithRca} <span className="text-sm font-normal">/ {snapshot.completed}</span>
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <p className="text-sm text-rose-800">{t('SLA breached')}</p>
                <p className="mt-2 text-2xl font-semibold text-rose-800">{snapshot.breached}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-sm text-amber-800">{t('Cancelled')}</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{snapshot.cancelled}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              {t(
                'RCA count is based on the bounded RCA page currently loaded. Resolution time is an operational estimate from createdAt to updatedAt.',
              )}
            </p>
          </section>
          <section className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/40 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-ink">{t('Quality roadmap')}</h3>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                <span className="mr-2 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                  MVP
                </span>
                {t('RCA coverage, resolution notes and SLA advisory are available.')}
              </p>
              <p>
                <span className="mr-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                  NEXT
                </span>
                {t('Customer rating, reopen count and first-time-fix need an approved data model and workflow.')}
              </p>
              <p>
                <span className="mr-2 rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                  LIMIT
                </span>
                {t('This Spark page is for operational reporting, not contractual SLA enforcement.')}
              </p>
            </div>
          </section>
        </div>
      )}

      <footer className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
        <strong>{t('Spark limitation')}:</strong>{' '}
        {t(
          'รายงานนี้อ่านข้อมูลเป็นหน้า ๆ ไม่เกิน 50 งานต่อครั้ง ตัวเลขจึงสะท้อนเฉพาะข้อมูลที่โหลดแล้ว กด Load more เพื่อขยายชุดข้อมูลก่อน Export ได้',
        )}
        {rcaHasMore && <span className="ml-2">{t('RCA page also has more records available.')}</span>}
      </footer>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-500">
          {t('Loaded')} {tickets.length} {t('tasks')} · {periodTickets.length} {t('in selected period')}
        </p>
        <div className="flex gap-2">
          <button
            className="min-h-10 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={loading}
            onClick={() => void load(false)}
            type="button"
          >
            {loading ? t('กำลังโหลดรายการ') : t('Refresh')}
          </button>
          {hasMore && (
            <button
              className="min-h-10 rounded-xl bg-lotus-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lotus-800"
              disabled={loading}
              onClick={() => void load(true)}
              type="button"
            >
              {loading ? t('กำลังโหลดรายการ') : t('Load more')}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
