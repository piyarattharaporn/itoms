import { getLocale, t } from '../../lib/i18n'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { subscribeToTickets, type TicketAccess } from '../tickets/ticketService'
import {
  formatTicketChannel,
  formatTicketProblem,
  ticketIssueAreas,
  ticketStatuses,
  type TicketRecord,
} from '../tickets/types'
import { getSlaSnapshot } from '../tickets/sla'
import { PmOverviewSummary } from '../pm/PmOverviewSummary'
import { subscribeToAssets, type AssetRecord } from '../assets/assetService'
import { LicenseOverviewSummary } from '../licenses/LicenseOverviewSummary'
import { CctvOverview } from './CctvOverview'
import { TodoDashboardPreview } from '../todo/TodoCalendar'
import { subscribeToIncidents, type InfrastructureIncident } from '../infrastructure/incidentService'

type Period = '7' | '15' | '1m' | '3m' | 'custom'

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

function shiftCalendarMonths(dateOnly: string, months: number) {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const targetMonth = month - 1 + months
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

function chartDateLabel(dateOnly: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(getLocale(), { ...options, timeZone: 'Asia/Bangkok' }).format(
    new Date(`${dateOnly}T12:00:00+07:00`),
  )
}

function bangkokStartOfDay(dateOnly: string) {
  return Date.parse(`${dateOnly}T00:00:00+07:00`)
}

function isActive(ticket: TicketRecord) {
  return ticket.status !== 'Completed' && ticket.status !== 'Cancelled'
}

function BarList({
  title,
  rows,
  accent = 'bg-lotus-500',
  totalCount,
  maxRows = 6,
}: {
  title: string
  rows: Array<{ label: string; count: number }>
  accent?: string
  totalCount?: number
  maxRows?: number
}) {
  const denominator = totalCount ?? Math.max(1, ...rows.map((row) => row.count))
  const max = totalCount === undefined ? Math.max(1, ...rows.map((row) => row.count)) : Math.max(1, totalCount)
  const visibleRows = rows.slice(0, maxRows)
  const overflowCount = rows.slice(maxRows).reduce((sum, row) => sum + row.count, 0)
  const displayRows = overflowCount > 0 ? [...visibleRows, { label: t('อื่น ๆ'), count: overflowCount }] : visibleRows
  return (
    <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {totalCount !== undefined && (
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {totalCount.toLocaleString(getLocale())} {t('งาน')}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{t('ยังไม่มีข้อมูลในช่วงเวลานี้')}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {displayRows.map((row) => (
            <li className="space-y-1.5" key={row.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-600" title={row.label}>
                  {row.label}
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="font-semibold text-slate-800">{row.count}</span>
                  {totalCount !== undefined && (
                    <span className="text-xs text-slate-400">
                      {Math.round((row.count / Math.max(denominator, 1)) * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span
                  className={`block h-full rounded-full ${accent}`}
                  style={{ width: `${Math.min(100, Math.max(4, (row.count / max) * 100))}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > maxRows && (
        <p className="mt-4 text-xs leading-5 text-slate-400">
          {t('แสดงรายการเด่น')} {maxRows} {t('รายการ')} · {t('รายการที่เหลือรวมไว้ใน อื่น ๆ')}
        </p>
      )}
    </section>
  )
}

function TaskControlSummary({
  assignmentRows,
  priorityRows,
  totalCount,
}: {
  assignmentRows: Array<{ label: string; count: number }>
  priorityRows: Array<{ label: string; count: number }>
  totalCount: number
}) {
  const unassigned = assignmentRows.find((row) => row.label === t('ยังไม่มอบหมาย'))?.count ?? 0
  const assigned = assignmentRows.find((row) => row.label === t('มอบหมายแล้ว'))?.count ?? 0
  const maxPriority = Math.max(1, ...priorityRows.map((row) => row.count))
  const priorityColors: Record<string, string> = {
    [t('Critical')]: 'bg-rose-400',
    [t('High')]: 'bg-orange-400',
    [t('Medium')]: 'bg-amber-300',
    [t('Low')]: 'bg-sky-300',
  }

  return (
    <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800">{t('การมอบหมายและความสำคัญ')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('ดูงานที่ยังไม่มีผู้รับผิดชอบและระดับความสำคัญ')}</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          {totalCount.toLocaleString(getLocale())} {t('งาน')}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={`${unassigned ? 'bg-amber-50' : 'bg-emerald-50'} rounded-xl px-3 py-3`}>
          <p className={`text-xs ${unassigned ? 'text-amber-800' : 'text-emerald-800'}`}>{t('ยังไม่มอบหมาย')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{unassigned}</p>
        </div>
        <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-xs text-slate-500">{t('มอบหมายแล้ว')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{assigned}</p>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">{t('ตามความสำคัญ')}</h3>
          <span className="text-xs text-slate-400">{t('งาน')}</span>
        </div>
        {priorityRows.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {priorityRows.map((row) => (
              <li key={row.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-slate-600" title={row.label}>
                    {row.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="font-semibold text-slate-800">{row.count}</span>
                    <span className="text-xs text-slate-400">
                      {Math.round((row.count / Math.max(totalCount, 1)) * 100)}%
                    </span>
                  </span>
                </div>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${priorityColors[row.label] ?? 'bg-slate-300'}`}
                    style={{ width: `${Math.min(100, Math.max(4, (row.count / maxPriority) * 100))}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{t('ยังไม่มีข้อมูลในช่วงเวลานี้')}</p>
        )}
      </div>
    </section>
  )
}

type MetricIconName = 'clipboard' | 'clock' | 'alert' | 'timer'

function MetricIcon({ name }: { name: MetricIconName }) {
  const paths: Record<MetricIconName, ReactNode> = {
    clipboard: (
      <>
        <rect height="17" rx="2.5" width="14" x="5" y="4" />
        <path d="M9 4.5V3h6v1.5M8.5 9h7M8.5 12.5h7M8.5 16h4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 9 16H3L12 3Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
    timer: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M10 2h4M12 5V3M12 13l3-2M18 7l1.5-1.5" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.35"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}

function Metric({
  label,
  value,
  note,
  tone = 'neutral',
  icon,
  className = '',
}: {
  label: string
  value: string | number
  note: string
  tone?: 'neutral' | 'warning' | 'danger' | 'success'
  icon: MetricIconName
  className?: string
}) {
  const color =
    tone === 'warning'
      ? { surface: 'border-amber-200 bg-amber-50/60', badge: 'bg-amber-100 text-amber-800', marker: 'bg-amber-500' }
      : tone === 'danger'
        ? { surface: 'border-rose-200 bg-rose-50/60', badge: 'bg-rose-100 text-rose-800', marker: 'bg-rose-600' }
        : tone === 'success'
          ? {
              surface: 'border-emerald-200 bg-emerald-50/60',
              badge: 'bg-emerald-100 text-emerald-800',
              marker: 'bg-emerald-600',
            }
          : { surface: 'border-slate-200 bg-white', badge: 'bg-lotus-100 text-lotus-800', marker: 'bg-lotus-600' }
  const watermarkColor =
    tone === 'warning'
      ? 'text-amber-800'
      : tone === 'danger'
        ? 'text-rose-800'
        : tone === 'success'
          ? 'text-emerald-800'
          : 'text-sky-800'
  return (
    <article
      className={`dashboard-kpi relative overflow-hidden rounded-2xl border-l-4 p-4 shadow-sm shadow-slate-200/30 sm:p-5 ${color.surface} ${color.marker.replace('bg-', 'border-l-')} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={`h-7 w-7 shrink-0 ${watermarkColor}`}>
            <MetricIcon name={icon} />
          </span>
          <p className="break-words text-sm font-medium leading-4 text-slate-600">{label}</p>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.marker}`} aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
    </article>
  )
}

const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const statusColors: Record<string, string> = {
  Pending: 'bg-amber-50 text-amber-800',
  'In Progress': 'bg-sky-50 text-sky-800',
  Monitoring: 'bg-violet-50 text-violet-800',
  'Waiting for Vendor': 'bg-orange-50 text-orange-800',
  'Waiting for User': 'bg-indigo-50 text-indigo-800',
  Completed: 'bg-emerald-50 text-emerald-800',
  Cancelled: 'bg-slate-100 text-slate-600',
}

function PendingTickets({
  tickets,
  onOpenTicket,
  onViewAll,
}: {
  tickets: TicketRecord[]
  onOpenTicket: (ticket: TicketRecord) => void
  onViewAll: () => void
}) {
  const groupForTicket = (ticket: TicketRecord) => {
    const snapshot = getSlaSnapshot(ticket)
    if (snapshot.state === 'breached') return { key: 'overdue', label: t('เลยกำหนด'), tone: 'danger' as const }
    if (snapshot.state === 'dueSoon') return { key: 'risk', label: t('ใกล้ครบกำหนด'), tone: 'warning' as const }
    if (ticket.priority === 'Critical') return { key: 'critical', label: t('Critical'), tone: 'critical' as const }
    return null
  }
  const groups = (['overdue', 'risk', 'critical'] as const)
    .map((key) => {
      const groupTickets = tickets
        .filter(isActive)
        .filter((ticket) => groupForTicket(ticket)?.key === key)
        .sort(
          (a, b) =>
            priorityOrder[a.priority] - priorityOrder[b.priority] ||
            (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
        )
      return {
        key,
        label: key === 'overdue' ? t('เลยกำหนด') : key === 'risk' ? t('ใกล้ครบกำหนด') : t('Critical'),
        tone: key === 'overdue' ? ('danger' as const) : key === 'risk' ? ('warning' as const) : ('critical' as const),
        tickets: groupTickets,
      }
    })
    .filter((group) => group.tickets.length > 0)
  const visibleCount = groups.reduce((total, group) => total + Math.min(group.tickets.length, 3), 0)
  const toneClasses = {
    danger: 'bg-rose-50 text-rose-800',
    warning: 'bg-amber-50 text-amber-800',
    critical: 'bg-red-50 text-red-800',
  }
  return (
    <section
      aria-labelledby="dashboard-attention-heading"
      className="dashboard-panel dashboard-command-panel h-fit rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900" id="dashboard-attention-heading">
            {t('งานที่ต้องติดตาม')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('เรียงตามกำหนด SLA และความสำคัญ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            {t('เปิดอยู่')} {tickets.filter(isActive).length}
          </span>
          <button
            className="min-h-10 rounded-full px-3 py-1.5 text-xs font-semibold text-lotus-700 hover:bg-lotus-50 focus:outline-none focus:ring-2 focus:ring-lotus-300"
            onClick={onViewAll}
            type="button"
          >
            {t('ดูรายการทั้งหมด')}
          </button>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="dashboard-empty-state mt-3 flex flex-col gap-3 rounded-xl bg-emerald-50/80 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700"
            >
              ✓
            </span>
            <div>
              <p className="font-semibold text-emerald-900">{t('ไม่มี Task ค้างในรายการที่โหลด')}</p>
            </div>
          </div>
          <button
            className="shrink-0 self-start rounded-lg px-2 py-1 text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:bg-white/70 sm:self-auto"
            onClick={onViewAll}
            type="button"
          >
            {t('ดูรายการทั้งหมด')}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="mb-1 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${group.tone === 'danger' ? 'bg-rose-600' : group.tone === 'warning' ? 'bg-amber-500' : 'bg-red-600'}`}
                />
                <h3 className="text-xs font-semibold text-slate-600">{group.label}</h3>
                <span className="text-xs tabular-nums text-slate-400">{group.tickets.length}</span>
              </div>
              <ul className="space-y-2">
                {group.tickets.slice(0, 3).map((ticket) => (
                  <li
                    className={`dashboard-ticket-item dashboard-ticket-item-${group.tone} grid gap-3 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3 sm:py-2.5`}
                    key={ticket.id}
                  >
                    <button
                      aria-label={`${t('เปิด Task')} ${ticket.propertyCode}-${ticket.id.toUpperCase()} ${t('เพื่อดูและอัปเดต')}`}
                      className="group min-w-0 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-lotus-300"
                      onClick={() => onOpenTicket(ticket)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[11px] font-bold tracking-[0.08em] text-lotus-700">
                          {ticket.propertyCode}-{ticket.id.toUpperCase()}
                        </p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80">
                          {t(ticket.priority)}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-900 group-hover:text-lotus-800">
                        {formatTicketProblem(ticket.problemCategory, ticket.problemType)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="max-w-full truncate">{ticket.location || t('ไม่ระบุสถานที่')}</span>
                        {ticket.assetId && (
                          <span className="max-w-full truncate">
                            {t('Asset')} {ticket.assetId}
                          </span>
                        )}
                        <span>{formatTicketChannel(ticket.channel)}</span>
                        <span className="max-w-full truncate">
                          {ticket.requesterName || ticket.requesterEmail || t('ไม่ระบุผู้แจ้ง')}
                        </span>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses[group.tone]}`}>
                        {group.label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[ticket.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {t(ticket.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {groups.length > 0 && tickets.filter(isActive).length > visibleCount && (
        <p className="mt-3 text-xs text-slate-400">
          {t('และอีก')} {tickets.filter(isActive).length - visibleCount} {t('งานที่ยังเปิด')}
        </p>
      )}
    </section>
  )
}

function IncidentOperations({
  incidents,
  loading,
  onViewAll,
}: {
  incidents: InfrastructureIncident[]
  loading: boolean
  onViewAll: () => void
}) {
  const open = incidents.filter((incident) => incident.status === 'Open')
  const monitoring = incidents.filter((incident) => incident.status === 'Monitoring')
  const restored = incidents.filter((incident) => incident.status === 'Restored')
  const active = [...open, ...monitoring].sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
  const critical = active.filter((incident) => incident.impact === 'Critical')
  const visibleIncidents = active.slice(0, 4)

  return (
    <section
      aria-labelledby="dashboard-incidents-heading"
      className="dashboard-panel dashboard-command-panel h-fit rounded-2xl border border-rose-100 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <MetricIcon name="alert" />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900" id="dashboard-incidents-heading">
              {t('บันทึกเหตุขัดข้อง')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{t('ติดตามเหตุที่ยังไม่กู้คืนและเหตุ Critical')}</p>
          </div>
        </div>
        <button
          className="shrink-0 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300"
          onClick={onViewAll}
          type="button"
        >
          {t('เปิด Incident Log')}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 sm:grid-cols-4 sm:divide-y-0">
        <div className="px-3 py-3 sm:px-4">
          <p className="text-xs text-slate-500">{t('ยังไม่กู้คืน')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-700">{loading ? '—' : active.length}</p>
        </div>
        <div className="px-3 py-3 sm:px-4">
          <p className="text-xs text-slate-500">{t('Critical ที่ยังเปิด')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700">{loading ? '—' : critical.length}</p>
        </div>
        <div className="px-3 py-3 sm:px-4">
          <p className="text-xs text-slate-500">{t('กำลังเฝ้าระวัง')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{loading ? '—' : monitoring.length}</p>
        </div>
        <div className="px-3 py-3 sm:px-4">
          <p className="text-xs text-slate-500">{t('กู้คืนแล้ว')}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{loading ? '—' : restored.length}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">{t('เหตุที่ยังไม่กู้คืน')}</h3>
          <span className="text-xs tabular-nums text-slate-400">
            {active.length} {t('เหตุ')}
          </span>
        </div>
        {loading ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500" role="status">
            {t('กำลังโหลด Incident…')}
          </p>
        ) : visibleIncidents.length === 0 ? (
          <div className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">{t('ไม่มีเหตุที่ยังเปิดอยู่')}</p>
            <p className="mt-1 text-xs text-emerald-700">{t('ไม่พบเหตุขัดข้องที่ต้องติดตามในข้อมูลที่โหลด')}</p>
          </div>
        ) : (
          <ul className="dashboard-incident-list mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {visibleIncidents.map((incident) => (
              <li className="flex items-start justify-between gap-3 px-3.5 py-3" key={incident.id}>
                <button
                  className="min-w-0 flex-1 rounded-lg text-left hover:text-lotus-800 focus:outline-none focus:ring-2 focus:ring-lotus-300"
                  onClick={onViewAll}
                  type="button"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{incident.propertyCode}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {t(incident.type)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${incident.impact === 'Critical' ? 'bg-red-50 text-red-800' : incident.impact === 'High' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {t(incident.impact)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">{incident.title}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{incident.location}</p>
                </button>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${incident.status === 'Monitoring' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'}`}
                >
                  {t(incident.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function StatusSnapshot({ rows }: { rows: Array<{ status: string; count: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const colors: Record<string, string> = {
    Pending: 'bg-amber-400',
    'In Progress': 'bg-sky-400',
    Monitoring: 'bg-violet-400',
    'Waiting for Vendor': 'bg-orange-400',
    'Waiting for User': 'bg-indigo-400',
    Completed: 'bg-emerald-400',
    Cancelled: 'bg-slate-300',
  }
  return (
    <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{t('Task flow')}</p>
          <h2 className="mt-1 font-semibold text-slate-900">{t('สถานะงาน')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('Task ที่สร้างในช่วงเวลาที่เลือก ·')} {total} {t('งาน')}
          </p>
        </div>
        <span className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
          {rows.find((item) => item.status === 'Completed')?.count ?? 0} {t('ปิดแล้ว')}
        </span>
      </div>
      <div
        aria-label={t('สัดส่วน Task ตามสถานะ')}
        className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100"
        role="img"
      >
        {rows
          .filter((row) => row.count > 0)
          .map((row) => (
            <span
              className={`${colors[row.status] ?? 'bg-slate-300'} transition-all`}
              key={row.status}
              style={{ width: `${(row.count / Math.max(total, 1)) * 100}%` }}
              title={`${row.status}: ${row.count}`}
            />
          ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {rows
          .filter((row) => row.count > 0)
          .map((row) => (
            <li className="flex min-w-0 items-center gap-2 text-xs" key={row.status}>
              <i
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${colors[row.status] ?? 'bg-slate-300'}`}
              />
              <span className="truncate text-slate-600">{t(row.status)}</span>
              <span className="ml-auto font-semibold tabular-nums text-slate-800">{row.count}</span>
            </li>
          ))}
      </ul>
      {total === 0 && <p className="mt-4 text-sm text-slate-500">{t('ไม่มี Task ในช่วงเวลานี้')}</p>}
    </section>
  )
}

function SlaOperations({
  summary,
}: {
  summary: {
    eligible: number
    open: number
    dueSoon: number
    breached: number
    responseBreached: number
    resolutionBreached: number
    responseMet: number
    met: number
    byProperty: Array<{ label: string; count: number }>
  }
}) {
  const metRate = summary.eligible ? `${Math.round((summary.met / summary.eligible) * 100)}%` : t('ยังประเมินไม่ได้')
  return (
    <section className="dashboard-panel dashboard-sla-panel rounded-2xl border border-violet-100 bg-violet-50/50 p-5 shadow-sm shadow-slate-200/30 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 font-semibold text-slate-900">{t('ติดตาม SLA')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('Response และ Resolution แยกกันตามข้อมูล Task ที่โหลดได้')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-800">
          <span>{t('สำเร็จ')}</span>
          <strong>{metRate}</strong>
        </span>
      </div>
      <div className="dashboard-sla-metric-grid mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-violet-100 bg-white sm:grid-cols-4">
        {[
          { label: t('งานที่เข้าเกณฑ์'), value: summary.eligible, tone: 'text-slate-900' },
          { label: t('ใกล้ครบกำหนด'), value: summary.dueSoon, tone: 'text-amber-700' },
          { label: t('เกิน SLA'), value: summary.breached, tone: 'text-rose-700' },
          { label: t('เปิดอยู่'), value: summary.open, tone: 'text-sky-700' },
        ].map(({ label, value, tone }) => (
          <div
            className="border-b border-violet-100 px-3 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0"
            key={label}
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.72fr)]">
        <div className="dashboard-sla-detail rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">{t('แยกตามประเภท SLA')}</p>
            <span className="text-xs text-slate-400">{t('งาน')}</span>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              {
                label: t('Response เกิน SLA'),
                count: summary.responseBreached,
                tone: 'text-rose-700',
                color: 'bg-rose-500',
              },
              {
                label: t('Resolution เกิน SLA'),
                count: summary.resolutionBreached,
                tone: 'text-rose-700',
                color: 'bg-rose-500',
              },
              { label: t('Resolution สำเร็จ'), count: summary.met, tone: 'text-emerald-700', color: 'bg-emerald-500' },
            ].map(({ label, count, tone, color }) => (
              <div
                className="dashboard-sla-row flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                key={label}
              >
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <i aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                  <span className="truncate">{label}</span>
                </span>
                <strong className={`tabular-nums ${tone}`}>{count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-sla-properties rounded-xl bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">{t('งานเกิน SLA ตาม Property')}</p>
            <span className="text-xs tabular-nums text-slate-400">
              {summary.breached} {t('งาน')}
            </span>
          </div>
          {summary.byProperty.length === 0 ? (
            <p className="dashboard-sla-empty mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              {t('ยังไม่มีข้อมูลในช่วงเวลานี้')}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.byProperty.slice(0, 4).map((row) => (
                <li className="flex items-center justify-between gap-3 text-sm" key={row.label}>
                  <span className="min-w-0 truncate text-slate-600" title={row.label}>
                    {row.label}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-violet-800">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-violet-900/70">
        {t('ตัวเลขนี้คำนวณจาก Task ล่าสุดที่โหลดตามสิทธิ์และช่วงวันที่เลือก ไม่ใช่ข้อมูลย้อนหลังทั้งหมด')}
      </p>
    </section>
  )
}

function DistributionCard({
  eyebrow,
  title,
  description,
  rows,
  colors,
  ariaLabel,
  formatLabel = t,
}: {
  eyebrow: string
  title: string
  description: string
  rows: Array<{ label: string; count: number }>
  colors: Record<string, string>
  ariaLabel: string
  formatLabel?: (label: string) => string
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const chartRows = rows.filter((row) => row.count > 0)
  return (
    <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
      <div className="mt-1 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{total.toLocaleString(getLocale())}</p>
          <p className="text-xs text-slate-500">{t('งาน')}</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">{t('ไม่มี Task ในช่วงเวลานี้')}</p>
      ) : (
        <>
          <div aria-label={ariaLabel} className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img">
            {chartRows.map((row) => (
              <span
                key={row.label}
                style={{
                  backgroundColor: colors[row.label] ?? '#cbd5e1',
                  width: `${(row.count / total) * 100}%`,
                }}
                title={`${formatLabel(row.label)}: ${row.count} (${Math.round((row.count / total) * 100)}%)`}
              />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {chartRows.map((row) => (
              <li className="flex min-w-0 items-center gap-2 text-xs" key={row.label}>
                <i
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[row.label] ?? '#cbd5e1' }}
                />
                <span className="min-w-0 flex-1 truncate text-slate-600" title={formatLabel(row.label)}>
                  {formatLabel(row.label)}
                </span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {row.count.toLocaleString(getLocale())}
                </span>
                <span className="w-10 text-right tabular-nums text-slate-500">
                  {Math.round((row.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function IssueAreaBreakdown({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const colors: Record<string, string> = {
    'Guest Property Problem': '#b5a3d8',
    'BOH (Back of House)': '#8fc8df',
    'Office / Corporate': '#edc77d',
    Other: '#91c9a4',
    ยังไม่ระบุ: '#cbd5e1',
  }
  return (
    <DistributionCard
      ariaLabel={t('สัดส่วนกลุ่มพื้นที่ของ Task')}
      colors={colors}
      description={t('แยก Guest, BOH และ Office')}
      eyebrow={t('Issue area')}
      rows={rows}
      title={t('ปัญหาตามพื้นที่')}
    />
  )
}

function ChannelBreakdown({ rows }: { rows: Array<{ label: string; count: number }> }) {
  const colors: Record<string, string> = {
    Line: '#91c9a4',
    'Message Box': '#9678C4',
    'Personal Call': '#8fc8df',
    Other: '#edc77d',
  }
  return (
    <DistributionCard
      ariaLabel={t('สัดส่วนช่องทางแจ้ง Task')}
      colors={colors}
      description={t('ช่องทางที่ผู้แจ้งเลือกใน Task')}
      eyebrow={t('Contact channel')}
      formatLabel={formatTicketChannel}
      rows={rows}
      title={t('ช่องทางที่ใช้แจ้ง')}
    />
  )
}

type TrendBucket = { key: string; label: string; tickLabel: string; count: number }

function TaskTrendChart({ buckets, grouping }: { buckets: TrendBucket[]; grouping: 'day' | 'week' | 'month' }) {
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))
  const groupingLabel = grouping === 'day' ? 'รายวัน' : grouping === 'week' ? 'รายสัปดาห์' : 'รายเดือน'
  return (
    <section className="dashboard-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{t('Task trend')}</p>
          <h2 className="mt-1 font-semibold text-slate-900">{t('งานที่สร้างตามช่วงเวลา')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('จำนวน Task ที่แจ้งในช่วงวันที่เลือก')}</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
          {t(groupingLabel)}
        </span>
      </div>
      {buckets.every((bucket) => bucket.count === 0) ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('ไม่มี Task ในช่วงเวลานี้')}</p>
      ) : (
        <div aria-label={t('จำนวน Task ที่แจ้งในช่วงวันที่เลือก')} className="mt-5 overflow-x-auto pb-2">
          <ol
            className="grid h-48 items-end gap-2 border-b border-slate-200"
            style={{
              gridTemplateColumns: `repeat(${buckets.length}, minmax(2rem, 1fr))`,
              minWidth: `${Math.max(480, buckets.length * 42)}px`,
            }}
          >
            {buckets.map((bucket) => (
              <li
                aria-label={`${bucket.label}: ${bucket.count}`}
                className="flex h-full min-w-0 flex-col items-center justify-end gap-1"
                key={bucket.key}
                title={`${bucket.label}: ${bucket.count}`}
              >
                <span className="text-[10px] font-semibold tabular-nums text-slate-600">{bucket.count || ''}</span>
                <span
                  aria-hidden="true"
                  className={`w-full max-w-8 rounded-t-md ${bucket.count ? 'bg-sky-300' : 'bg-slate-100'}`}
                  style={{ height: `${bucket.count ? Math.max(6, (bucket.count / maxCount) * 132) : 3}px` }}
                />
                <span className="w-full truncate text-center text-[10px] text-slate-500">{bucket.tickLabel}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">{t('Dashboard คำนวณจาก Task ล่าสุดที่โหลดได้สูงสุด 50 รายการ')}</p>
    </section>
  )
}

function RepairAssets({
  assets,
  onViewAll,
  compact = false,
}: {
  assets: AssetRecord[]
  onViewAll: () => void
  compact?: boolean
}) {
  const underRepair = assets.filter((asset) => asset.status === 'Under Repair')
  const overdue = underRepair.filter(
    (asset) => asset.expectedReturnOn && asset.expectedReturnOn < bangkokToday(),
  ).length
  return (
    <section className="dashboard-panel flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="mt-1 font-semibold text-slate-900">{t('อุปกรณ์ที่ส่งซ่อม')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('ติดตามกำหนดรับคืนและผู้รับซ่อม')}</p>
        </div>
        <button
          className="shrink-0 rounded-full border border-lotus-100 bg-lotus-50/60 px-3 py-2 text-xs font-semibold text-lotus-700 hover:bg-lotus-100"
          onClick={onViewAll}
          type="button"
        >
          {t('เปิดรายการ →')}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-4xl font-semibold tabular-nums text-slate-900">{underRepair.length}</p>
        <p className="pb-1 text-sm text-slate-600">{t('รายการอยู่ระหว่างซ่อม')}</p>
      </div>
      <p
        className={`mt-3 inline-flex w-fit max-w-full rounded-full px-3 py-1.5 text-xs font-semibold ${overdue ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}
      >
        {overdue ? `${t('เลยกำหนดรับคืน')} ${overdue} ${t('รายการ')}` : t('ไม่มีรายการเลยกำหนดรับคืน')}
      </p>
      {underRepair.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {underRepair.slice(0, compact ? 1 : 2).map((asset) => (
            <li className="py-3" key={asset.id}>
              <p className="truncate text-sm font-semibold text-slate-800">
                {asset.propertyCode} · {asset.assetTag} · {asset.name}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {asset.serviceVendor || (asset.serviceType === 'Warranty Claim' ? t('ส่งเคลมประกัน') : t('ซ่อมภายใน'))}
                {asset.expectedReturnOn ? ` · ${t('รับคืน')} ${asset.expectedReturnOn}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-400">{t('นับจาก Asset ล่าสุดสูงสุด 100 รายการ')}</p>
    </section>
  )
}

export function ExecutiveDashboard({
  selectedPropertyId,
  onOpenCctv,
  onOpenTicket,
  onViewTickets,
  onViewIncidents,
  onViewDamagedAssets,
  onViewLicenses,
  onViewTodo,
  showCctv = true,
}: {
  selectedPropertyId: string
  onOpenCctv: () => void
  onOpenTicket: (ticket: TicketRecord) => void
  onViewTickets: () => void
  onViewIncidents: () => void
  onViewDamagedAssets: () => void
  onViewLicenses: () => void
  onViewTodo: () => void
  showCctv?: boolean
}) {
  const { firebaseUser, profile, memberships, accessState } = useAuth()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('1m')
  const [customStartDate, setCustomStartDate] = useState(() => shiftCalendarMonths(bangkokToday(), -1))
  const [customEndDate, setCustomEndDate] = useState(() => bangkokToday())
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [incidents, setIncidents] = useState<InfrastructureIncident[]>([])
  const [incidentLoading, setIncidentLoading] = useState(true)

  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canReadTodos = isSuperAdmin || Boolean(membership)
  const canReadPm = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const canReadAssets = isSuperAdmin || membership?.role === 'supportEngineer'
  const canReadLicenses =
    isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const canReadIncidents =
    isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'

  useEffect(() => {
    if (accessState !== 'ready' || !canReadAssets) {
      setAssets([])
      return
    }
    return subscribeToAssets(selectedPropertyId, allProperties, setAssets, () => setAssets([]))
  }, [accessState, canReadAssets, selectedPropertyId, allProperties])

  useEffect(() => {
    if (accessState !== 'ready' || !canReadIncidents) {
      setIncidents([])
      setIncidentLoading(false)
      return
    }
    setIncidentLoading(true)
    return subscribeToIncidents(
      selectedPropertyId,
      allProperties,
      (nextIncidents) => {
        setIncidents(nextIncidents)
        setIncidentLoading(false)
      },
      () => {
        setIncidents([])
        setIncidentLoading(false)
      },
    )
  }, [accessState, canReadIncidents, selectedPropertyId, allProperties])

  useEffect(() => {
    if (accessState !== 'ready' || !firebaseUser || !profile) return
    if (!isSuperAdmin && !membership) {
      setTickets([])
      setLoading(false)
      setError(t('ไม่มีสิทธิ์เข้าถึง Property ที่เลือก'))
      return
    }

    setLoading(true)
    setError(null)
    const access: TicketAccess = {
      uid: firebaseUser.uid,
      globalRole: profile.globalRole,
      propertyRole: membership?.role,
      propertyId: selectedPropertyId,
      allProperties: isSuperAdmin && selectedPropertyId === 'all',
    }
    return subscribeToTickets(
      access,
      (nextTickets) => {
        setTickets(nextTickets)
        setLoading(false)
      },
      (cause) => {
        setError(cause.message)
        setLoading(false)
      },
    )
  }, [accessState, firebaseUser, profile, membership, selectedPropertyId, isSuperAdmin])

  const data = useMemo(() => {
    const today = bangkokToday()
    const startDate =
      period === 'custom'
        ? customStartDate
        : period === '7'
          ? shiftDate(today, -6)
          : period === '15'
            ? shiftDate(today, -14)
            : shiftCalendarMonths(today, period === '1m' ? -1 : -3)
    const endDate = period === 'custom' ? customEndDate : today
    const validDateRange = Boolean(startDate && endDate && startDate <= endDate)
    const endExclusive = validDateRange ? shiftDate(endDate, 1) : ''
    const rangeDays = validDateRange
      ? Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1
      : 0
    const trendGrouping: 'day' | 'week' | 'month' = rangeDays > 120 ? 'month' : rangeDays > 31 ? 'week' : 'day'
    const filtered = validDateRange
      ? tickets.filter((ticket) => {
          const createdAt = ticket.createdAt?.getTime()
          return (
            createdAt !== undefined &&
            createdAt >= bangkokStartOfDay(startDate) &&
            createdAt < bangkokStartOfDay(endExclusive)
          )
        })
      : []
    const active = filtered.filter(isActive)
    const completed = filtered.filter((ticket) => ticket.status === 'Completed')
    const durations = completed
      .filter((ticket) => ticket.createdAt && ticket.completedAt)
      .map((ticket) => ticket.completedAt!.getTime() - ticket.createdAt!.getTime())
      .filter((duration) => duration >= 0)
    const averageCloseTime = durations.length
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : null

    const tally = (values: string[]) => {
      const counts = new Map<string, number>()
      values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
      return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
    }
    const problems = tally(filtered.map((ticket) => formatTicketProblem(ticket.problemCategory, ticket.problemType)))
    const problemCategories = tally(filtered.map((ticket) => ticket.problemCategory || 'ยังไม่ระบุหมวด'))
    const channels = tally(filtered.map((ticket) => ticket.channel || 'Line'))
    const assignmentRows = [
      { label: 'มอบหมายแล้ว', count: filtered.filter((ticket) => Boolean(ticket.assignedEngineerUid)).length },
      { label: 'ยังไม่มอบหมาย', count: filtered.filter((ticket) => !ticket.assignedEngineerUid).length },
    ]
    const priorityRows = (['Critical', 'High', 'Medium', 'Low'] as const).map((priority) => ({
      label: priority,
      count: filtered.filter((ticket) => ticket.priority === priority).length,
    }))
    const areaCounts = ticketIssueAreas.map((area) => ({
      label: area,
      count: filtered.filter((ticket) => ticket.issueArea === area).length,
    }))
    const uncategorized = filtered.filter((ticket) => ticket.issueArea === 'Uncategorized').length
    const issueAreas = [...areaCounts, ...(uncategorized ? [{ label: 'ยังไม่ระบุ', count: uncategorized }] : [])]
    const locations = tally(
      filtered.map((ticket) => (ticket.assetId.trim() ? `${ticket.location} · ${ticket.assetId}` : ticket.location)),
    ).slice(0, 5)
    const statusCounts = ticketStatuses.map((status) => ({
      status,
      count: filtered.filter((ticket) => ticket.status === status).length,
    }))
    const slaRows = filtered.map((ticket) => ({ ticket, snapshot: getSlaSnapshot(ticket) }))
    const eligibleSla = slaRows.filter(({ ticket }) => ticket.status !== 'Cancelled')
    const slaSummary = {
      eligible: eligibleSla.length,
      open: eligibleSla.filter(({ ticket }) => isActive(ticket)).length,
      dueSoon: eligibleSla.filter(({ snapshot }) => snapshot.state === 'dueSoon').length,
      breached: eligibleSla.filter(({ snapshot }) => snapshot.state === 'breached').length,
      responseBreached: eligibleSla.filter(({ snapshot }) => snapshot.responseStatus === 'breached').length,
      responseMet: eligibleSla.filter(({ snapshot }) => snapshot.responseStatus === 'met').length,
      resolutionBreached: eligibleSla.filter(
        ({ snapshot }) => snapshot.resolutionStatus === 'breached' || snapshot.state === 'breached',
      ).length,
      met: eligibleSla.filter(({ ticket, snapshot }) => ticket.status === 'Completed' && snapshot.state === 'met')
        .length,
      byProperty: tally(
        eligibleSla.filter(({ snapshot }) => snapshot.state === 'breached').map(({ ticket }) => ticket.propertyCode),
      ),
    }

    const trendBuckets: TrendBucket[] = []
    if (validDateRange) {
      let cursor = startDate
      while (cursor <= endDate) {
        let bucketEnd = cursor
        let label = ''
        let tickLabel = ''
        if (trendGrouping === 'day') {
          label = chartDateLabel(cursor, { day: 'numeric', month: 'long', year: 'numeric' })
          tickLabel = chartDateLabel(cursor, { day: 'numeric' })
        } else if (trendGrouping === 'week') {
          bucketEnd = [shiftDate(cursor, 6), endDate].sort()[0]
          label = `${chartDateLabel(cursor)} – ${chartDateLabel(bucketEnd)}`
          tickLabel = chartDateLabel(cursor)
        } else {
          const [year, month] = cursor.split('-').map(Number)
          const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
          bucketEnd = [lastDayOfMonth, endDate].sort()[0]
          label = chartDateLabel(cursor, { month: 'long', year: 'numeric' })
          tickLabel = chartDateLabel(cursor, { month: 'short' })
        }
        const bucketEndExclusive = shiftDate(bucketEnd, 1)
        const count = filtered.filter((ticket) => {
          const createdAt = ticket.createdAt?.getTime()
          return (
            createdAt !== undefined &&
            createdAt >= bangkokStartOfDay(cursor) &&
            createdAt < bangkokStartOfDay(bucketEndExclusive)
          )
        }).length
        trendBuckets.push({ key: cursor, label, tickLabel, count })
        cursor = shiftDate(bucketEnd, 1)
      }
    }

    return {
      filtered,
      active,
      completed,
      overdue: active.filter((ticket) => getSlaSnapshot(ticket).state === 'breached').length,
      slaRisk: active.filter((ticket) => getSlaSnapshot(ticket).state === 'dueSoon').length,
      critical: active.filter((ticket) => ticket.priority === 'Critical').length,
      averageCloseTime,
      problems,
      problemCategories,
      channels,
      assignmentRows,
      priorityRows,
      issueAreas,
      locations,
      statusCounts,
      slaSummary,
      trendBuckets,
      trendGrouping,
      validDateRange,
    }
  }, [tickets, period, customStartDate, customEndDate])

  return (
    <div className="portal-dashboard space-y-6">
      <section className="dashboard-hero rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30 sm:p-7">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t('ภาพรวมงานบริการ IT')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t('สแกนงานค้าง สุขภาพระบบ และรายการที่ควรติดตามในหน้าเดียว')}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {t('ข้อมูลล่าสุด')} · {tickets.length} {t('งาน')} · {t('นับจาก Task ที่โหลดได้')}
          </p>
        </div>
        <div
          className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
          aria-label={t('เลือกช่วงเวลาสรุป')}
        >
          <span className="mr-1 text-xs font-medium text-slate-500">{t('ช่วงวันที่แจ้ง')}</span>
          {(
            [
              ['7', '7 วัน'],
              ['15', '15 วัน'],
              ['1m', '1 เดือน'],
              ['3m', '3 เดือน'],
              ['custom', 'กำหนดเอง'],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={`min-h-10 rounded-full px-4 py-2 text-xs font-semibold transition ${period === value ? 'bg-lotus-800 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-lotus-200 hover:bg-lotus-50'}`}
              key={value}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {t(label)}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="dashboard-start-date">
                {t('ตั้งแต่วันที่')}
              </label>
              <input
                aria-label={t('ตั้งแต่วันที่')}
                className="form-input !min-h-10 !rounded-full !py-2 text-xs"
                id="dashboard-start-date"
                max={customEndDate || undefined}
                onChange={(event) => setCustomStartDate(event.target.value)}
                type="date"
                value={customStartDate}
              />
              <span className="self-center text-xs text-slate-400">{t('ถึง')}</span>
              <label className="sr-only" htmlFor="dashboard-end-date">
                {t('ถึงวันที่')}
              </label>
              <input
                aria-label={t('ถึงวันที่')}
                className="form-input !min-h-10 !rounded-full !py-2 text-xs"
                id="dashboard-end-date"
                min={customStartDate || undefined}
                max={bangkokToday()}
                onChange={(event) => setCustomEndDate(event.target.value)}
                type="date"
                value={customEndDate}
              />
            </div>
          )}
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      {!data.validDateRange && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          {t('กรุณาเลือกวันเริ่มต้นที่ไม่เกินวันสิ้นสุด')}
        </p>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลดข้อมูล Dashboard…')}
        </p>
      ) : (
        <>
          <div className="dashboard-metric-grid dashboard-kpi-rail grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              className="dashboard-metric"
              icon="alert"
              label={t('เลยกำหนด')}
              value={data.overdue}
              note={t('ต้องติดตามทันที')}
              tone={data.overdue ? 'danger' : 'success'}
            />
            <Metric
              icon="timer"
              label={t('ใกล้ครบกำหนด')}
              value={data.slaRisk}
              note={t('เสี่ยงเกิน SLA')}
              tone={data.slaRisk ? 'warning' : 'success'}
            />
            <Metric
              icon="alert"
              label={t('งาน Critical ที่ยังเปิด')}
              value={data.critical}
              note={t('ควรติดตามเป็นลำดับแรก')}
              tone={data.critical ? 'danger' : 'success'}
            />
            <Metric
              icon="clipboard"
              label={t('งานที่ยังเปิดอยู่')}
              value={data.active.length}
              note={t('ไม่รวม Completed และ Cancelled')}
              tone={data.active.length ? 'neutral' : 'success'}
            />
            <Metric
              icon="clock"
              label={t('Response SLA')}
              value={
                data.slaSummary.eligible
                  ? `${Math.round((data.slaSummary.responseMet / data.slaSummary.eligible) * 100)}%`
                  : '—'
              }
              note={t('จาก Task ที่ประเมินได้')}
              tone={data.slaSummary.responseMet === data.slaSummary.eligible ? 'success' : 'neutral'}
            />
          </div>

          <div className="dashboard-command-grid grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <div className="dashboard-command-primary min-w-0">
              <PendingTickets onOpenTicket={onOpenTicket} onViewAll={onViewTickets} tickets={tickets} />
            </div>
            {canReadIncidents && (
              <div className="dashboard-command-secondary min-w-0">
                <IncidentOperations incidents={incidents} loading={incidentLoading} onViewAll={onViewIncidents} />
              </div>
            )}
            <div className="dashboard-command-wide min-w-0 xl:col-span-2">
              <SlaOperations summary={data.slaSummary} />
            </div>
          </div>

          {canReadTodos && <TodoDashboardPreview onOpen={onViewTodo} selectedPropertyId={selectedPropertyId} />}

          <details
            className="dashboard-details-band group rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/20"
            open
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-slate-900 marker:hidden sm:px-6">
              <span>{t('รายละเอียดเพิ่มเติม')}</span>
              <span aria-hidden="true" className="text-xl text-slate-400 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-100 p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <StatusSnapshot rows={data.statusCounts} />
                <TaskTrendChart buckets={data.trendBuckets} grouping={data.trendGrouping} />
              </div>
              <section>
                <div className="mb-3">
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{t('รูปแบบการแจ้งและประเภทปัญหา')}</h2>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                  <IssueAreaBreakdown rows={data.issueAreas} />
                  <ChannelBreakdown rows={data.channels} />
                </div>
                <div className="mb-3 mt-6">
                  <h3 className="font-semibold text-slate-800">{t('รายละเอียดที่พบใน Task')}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('หมวดปัญหา ประเภทย่อย และจุด / Asset ที่มีรายการมาก')}
                  </p>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <BarList
                    accent="bg-violet-400"
                    rows={data.problemCategories}
                    title={t('ตามหมวดปัญหา')}
                    totalCount={data.filtered.length}
                    maxRows={5}
                  />
                  <TaskControlSummary
                    assignmentRows={data.assignmentRows}
                    priorityRows={data.priorityRows}
                    totalCount={data.filtered.length}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  <BarList
                    accent="bg-fuchsia-300"
                    rows={data.problems}
                    title={t('ประเภทย่อยที่พบบ่อย')}
                    totalCount={data.filtered.length}
                    maxRows={5}
                  />
                  <BarList
                    accent="bg-amber-400"
                    rows={data.locations}
                    title={t('จุด / Asset ที่พบ Task บ่อย')}
                    totalCount={data.filtered.length}
                  />
                </div>
              </section>
            </div>
          </details>

          {(showCctv || canReadPm || canReadAssets || canReadLicenses) && (
            <section aria-labelledby="dashboard-service-health-heading" className="dashboard-service-health">
              <div className="mb-3 border-b border-slate-200/80 pb-3">
                <h2 className="text-lg font-semibold text-slate-900" id="dashboard-service-health-heading">
                  {t('สุขภาพงานบริการและทรัพย์สิน')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('ติดตามสถานะ CCTV, PM, Asset และ License ในขอบเขตปัจจุบัน')}
                </p>
              </div>
              <div className="dashboard-service-health-grid grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                {showCctv && <CctvOverview compact onOpenCctv={onOpenCctv} selectedPropertyId={selectedPropertyId} />}
                {canReadPm && <PmOverviewSummary compact selectedPropertyId={selectedPropertyId} />}
                {canReadAssets && <RepairAssets assets={assets} compact onViewAll={onViewDamagedAssets} />}
                {canReadLicenses && (
                  <LicenseOverviewSummary
                    compact
                    onOpenDetails={onViewLicenses}
                    selectedPropertyId={selectedPropertyId}
                  />
                )}
              </div>
            </section>
          )}

          <p className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs leading-5 text-slate-500">
            {t(
              'หมายเหตุ: Dashboard แสดง SLA จาก Deadline ที่บันทึกกับ Ticket และคำนวณสถานะปัจจุบันบนหน้าจอ ส่วนการประเมินอัตโนมัติและ escalation แบบต่อเนื่องยังต้องใช้ trusted worker',
            )}
          </p>
        </>
      )}
    </div>
  )
}
