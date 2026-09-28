import { getLocale, t } from '../../lib/i18n';
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  changeIncidentStatus, createIncident, incidentImpacts, incidentStatuses, incidentTypes,
  subscribeToIncidentEvents, subscribeToIncidents, type IncidentEvent, type IncidentInput,
  type IncidentStatus, type InfrastructureIncident,
} from './incidentService'

const emptyIncident: IncidentInput = { propertyId: '', propertyCode: '', type: 'Network', title: '', location: '', impact: 'Medium', description: '' }

function todayInBangkok() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
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
  return new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

function getWeekdayLabels() {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(getLocale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, index + 1))),
  )
}

function dateInBangkok(value: Date | null) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function dateLabel(value: Date | null) {
  if (!value) return t('กำลังบันทึก…')
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(value)
}

function IncidentHistory({ incidentId }: { incidentId: string }) {
  const [events, setEvents] = useState<IncidentEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => subscribeToIncidentEvents(incidentId, setEvents, () => setError(t("โหลดประวัติเหตุการณ์ไม่สำเร็จ"))), [incidentId])
  if (error) return <p className="mt-3 text-sm text-red-700" role="alert">{t(error)}</p>
  if (events.length === 0) return <p className="mt-3 text-sm text-slate-500">{t("กำลังโหลดประวัติ…")}</p>
  return <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">{events.map((event) => <li className="relative text-sm" key={event.id}><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-lotus-500" /><p className="font-medium">{event.note}</p><p className="mt-0.5 text-xs text-slate-500">{event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus} · {dateLabel(event.createdAt)}</p></li>)}</ol>
}

function IncidentCard({ incident, canManage, onStatusChange }: {
  incident: InfrastructureIncident
  canManage: boolean
  onStatusChange: (incident: InfrastructureIncident, status: IncidentStatus, note: string) => Promise<void>
}) {
  const [showHistory, setShowHistory] = useState(false)
  const [nextStatus, setNextStatus] = useState<IncidentStatus | ''>('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const transitions: IncidentStatus[] = incident.status === 'Open' ? ['Monitoring', 'Restored'] : incident.status === 'Monitoring' ? ['Open', 'Restored'] : []

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nextStatus) return
    setSaving(true)
    setError(null)
    try { await onStatusChange(incident, nextStatus, note); setNextStatus(''); setNote('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกสถานะไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  return <article className="rounded-2xl border border-slate-200/80 bg-white p-5 transition-shadow hover:shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-lotus-700">{incident.propertyCode} · {t(incident.type)} · {t(incident.impact)}</p><h3 className="mt-1 font-semibold">{incident.title}</h3><p className="mt-1 text-sm text-slate-600">{incident.location}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${incident.status === 'Restored' ? 'bg-emerald-50 text-emerald-700' : incident.impact === 'Critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{t(incident.status)}</span></div>
    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{incident.description}</p>
    <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:grid-cols-2"><div><dt className="inline">{t("เริ่มเหตุ:")} </dt><dd className="inline text-slate-700">{dateLabel(incident.startedAt)}</dd></div>{incident.restoredAt && <div><dt className="inline">{t("กู้คืน:")} </dt><dd className="inline text-slate-700">{dateLabel(incident.restoredAt)}</dd></div>}{incident.resolutionNotes && <div className="sm:col-span-2"><dt className="inline">{t("วิธีแก้ไข:")} </dt><dd className="inline text-slate-700">{incident.resolutionNotes}</dd></div>}</dl>
    {canManage && transitions.length > 0 && <form className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[10rem_1fr_auto]" onSubmit={submitStatus}><label className="sr-only" htmlFor={`incident-status-${incident.id}`}>{t("สถานะใหม่")}</label><select className="form-select" id={`incident-status-${incident.id}`} onChange={(event) => setNextStatus(event.target.value as IncidentStatus | '')} value={nextStatus}><option value="">{t("อัปเดตสถานะ…")}</option>{transitions.map((status) => <option key={status} value={status}>{t(status)}</option>)}</select><label className="sr-only" htmlFor={`incident-note-${incident.id}`}>{t("บันทึกการดำเนินการ")}</label><input className="form-input" id={`incident-note-${incident.id}`} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={nextStatus === 'Restored' ? t("วิธีแก้ไข (จำเป็นเมื่อกู้คืน)") : t("บันทึกเพิ่มเติม (ถ้ามี)")} value={note} /><button className="rounded-lg bg-lotus-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lotus-700 disabled:opacity-50" disabled={saving || !nextStatus} type="submit">{saving ? t("กำลังบันทึก…") : t("บันทึก")}</button></form>}
    {error && <p className="mt-3 text-sm text-red-700" role="alert">{t(error)}</p>}<button className="mt-3 text-sm font-medium text-lotus-700 underline-offset-4 hover:underline" onClick={() => setShowHistory((value) => !value)} type="button">{showHistory ? t("ซ่อนประวัติ") : t("ดูประวัติเหตุการณ์")}</button>{showHistory && <IncidentHistory incidentId={incident.id} />}
  </article>
}

export function InfrastructureIncidents({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [incidents, setIncidents] = useState<InfrastructureIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'All' | IncidentStatus>('All')
  const [search, setSearch] = useState('')
  const today = todayInBangkok()
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [draft, setDraft] = useState<IncidentInput>(emptyIncident)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canRead) { setIncidents([]); setLoading(false); setError(t("หน้านี้เปิดให้ Client Executive, IT Support Engineer และ Super Admin")); return }
    setLoading(true); setError(null)
    const range = monthRange(visibleMonth)
    return subscribeToIncidents(selectedPropertyId, allProperties, (nextIncidents) => {
      setIncidents(nextIncidents)
      setLoading(false)
    }, () => { setError(t("โหลด Incident ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes")); setLoading(false) }, range)
  }, [accessState, canRead, selectedPropertyId, allProperties, visibleMonth])

  useEffect(() => {
    if (!allProperties && selectedPropertyId) {
      const property = properties.find((item) => item.id === selectedPropertyId)
      setDraft((current) => ({ ...current, propertyId: selectedPropertyId, propertyCode: property?.code ?? '' }))
    } else if (allProperties && !properties.some((property) => property.id === draft.propertyId)) setDraft(emptyIncident)
  }, [allProperties, selectedPropertyId, properties, draft.propertyId])

  const incidentsByDate = useMemo(() => {
    const grouped = new Map<string, InfrastructureIncident[]>()
    incidents.forEach((incident) => {
      const day = dateInBangkok(incident.startedAt)
      if (day) grouped.set(day, [...(grouped.get(day) ?? []), incident])
    })
    return grouped
  }, [incidents])

  const calendarDays = useMemo(() => {
    const [year, monthNumber] = visibleMonth.split('-').map(Number)
    const mondayOffset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
    const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    return [...Array.from({ length: mondayOffset }, () => null), ...Array.from({ length: dayCount }, (_, index) => `${visibleMonth}-${String(index + 1).padStart(2, '0')}`)]
  }, [visibleMonth])

  const selectedDateIncidents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return (incidentsByDate.get(selectedDate) ?? []).filter((incident) => (statusFilter === 'All' || incident.status === statusFilter)
      && (!term || [incident.title, incident.location, incident.type, incident.propertyCode, incident.description].some((value) => value.toLocaleLowerCase().includes(term))))
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
  }, [incidentsByDate, selectedDate, statusFilter, search])

  const incidentSummary = useMemo(() => ({
    active: incidents.filter((incident) => incident.status !== 'Restored').length,
    critical: incidents.filter((incident) => incident.impact === 'Critical' && incident.status !== 'Restored').length,
    restored: incidents.filter((incident) => incident.status === 'Restored').length,
    properties: new Set(incidents.map((incident) => incident.propertyId)).size,
  }), [incidents])

  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser) { setError(t("กรุณาเข้าสู่ระบบใหม่ก่อนบันทึกเหตุการณ์")); return }
    setSaving(true); setError(null)
    try {
      const id = await createIncident(draft, firebaseUser.uid)
      setNotice(`บันทึกเหตุขัดข้องแล้ว (${draft.propertyCode}-${id.slice(0, 8).toUpperCase()})`)
      setVisibleMonth(today.slice(0, 7)); setSelectedDate(today)
      setDraft((current) => ({ ...emptyIncident, propertyId: current.propertyId, propertyCode: current.propertyCode })); setShowCreate(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึก Incident ไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  async function updateStatus(incident: InfrastructureIncident, status: IncidentStatus, note: string) {
    if (!firebaseUser || !canManage) throw new Error(t("ัญชีนี้ไม่มีสิทธิ์อัปเดต Incident"))
    await changeIncidentStatus(incident, status, firebaseUser.uid, note)
  }

  if (accessState === 'loading') return <p className="py-10 text-center text-sm text-slate-500" role="status">{t("กำลังตรวจสอบสิทธิ์…")}</p>
  if (!canRead) return <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">{t(error)}</p>

  const monthIsCurrent = visibleMonth === today.slice(0, 7)

  return <div className="space-y-5">
    <section aria-labelledby="incident-page-heading" className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
      <div className="px-5 py-6 sm:px-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="text-sm font-medium text-lotus-700">IT Operations</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900" id="incident-page-heading">Incident Log</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{t("ติดตามเหตุ CCTV, Network, ISP, Power และระบบสำคัญ พร้อมดูประวัติแยกตามวัน")}</p></div>
          {canManage && <button className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-lotus-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-lotus-800 focus:outline-none focus:ring-2 focus:ring-lotus-400 focus:ring-offset-2 lg:self-auto" onClick={() => setShowCreate((value) => !value)} type="button"><span aria-hidden="true" className="text-lg leading-none">{showCreate ? '−' : '+'}</span>{showCreate ? t("ปิดฟอร์ม") : t("บันทึกเหตุขัดข้อง")}</button>}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-600">{t("ยังไม่กู้คืน · เดือนที่เลือก")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? '—' : incidentSummary.active}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-600">{t("Critical ที่ยังเปิด · เดือนที่เลือก")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? '—' : incidentSummary.critical}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-600">{t("กู้คืนแล้ว · เดือนที่เลือก")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? '—' : incidentSummary.restored}</p></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-600">{t("Property ที่มีเหตุ · เดือนที่เลือก")}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{loading ? '—' : incidentSummary.properties}</p></div>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:px-6">
        <div className="relative min-w-0 flex-1"><label className="sr-only" htmlFor="incident-search">{t("ค้นหา Incident")}</label><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input className="form-input w-full !pl-9" id="incident-search" onChange={(event) => setSearch(event.target.value)} placeholder={t("ค้นหาหัวข้อ สถานที่ หรือรายละเอียด…")} value={search} /></div>
        <label className="sr-only" htmlFor="incident-filter">{t("กรองสถานะ")}</label><select className="form-select w-full sm:w-48" id="incident-filter" onChange={(event) => setStatusFilter(event.target.value as 'All' | IncidentStatus)} value={statusFilter}><option value="All">{t("ทุกสถานะ")}</option>{incidentStatuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}</select>
      </div>
      {notice && <p className="mx-4 mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-6" role="status">{t(notice)}</p>}{error && <p className="mx-4 mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6" role="alert">{t(error)}</p>}
      {showCreate && canManage && <form className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-6" onSubmit={submitIncident}>
        <div className="mb-5 flex items-start gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lotus-100 text-lg font-semibold text-lotus-800">+</span><div><h3 className="font-semibold text-slate-900">{t("บันทึกเหตุขัดข้องใหม่")}</h3><p className="mt-1 text-sm text-slate-500">{t("กรอกข้อมูลหลักเพื่อให้ทีมติดตามและบันทึกการกู้คืนได้")}</p></div></div>
        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          {allProperties && <div><label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="incident-property">Property</label><select className="form-select w-full" id="incident-property" onChange={(event) => { const property = properties.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current, propertyId: property?.id ?? '', propertyCode: property?.code ?? '' })) }} required value={draft.propertyId}><option value="">{t("เลือก Property")}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.code} · {property.name}</option>)}</select></div>}
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="incident-type">{t("ประเภทเหตุ")}</label><select className="form-select w-full" id="incident-type" onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as IncidentInput['type'] }))} value={draft.type}>{incidentTypes.map((type) => <option key={type} value={type}>{t(type)}</option>)}</select></div>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="incident-impact">{t("ระดับผลกระทบ")}</label><select className="form-select w-full" id="incident-impact" onChange={(event) => setDraft((current) => ({ ...current, impact: event.target.value as IncidentInput['impact'] }))} value={draft.impact}>{incidentImpacts.map((impact) => <option key={impact} value={impact}>{t(impact)}</option>)}</select></div>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="incident-title">{t("หัวข้อเหตุการณ์")}</label><input className="form-input w-full" id="incident-title" maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={t("เช่น ระบบ WiFi อาคารหลักใช้งานไม่ได้")} required value={draft.title} /></div>
          <div className="md:col-span-1 xl:col-span-2"><label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="incident-location">{t("สถานที่ / ระบบที่ได้รับผลกระทบ")}</label><input className="form-input w-full" id="incident-location" maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder={t("เช่น ห้อง Server, กล้องทางเข้า, ISP วงจรหลัก")} required value={draft.location} /></div>
          <div className="md:col-span-2 xl:col-span-3"><label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="incident-description">{t("รายละเอียดผลกระทบและสิ่งที่ตรวจพบ")}</label><textarea className="form-input min-h-28 w-full resize-y" id="incident-description" maxLength={3000} minLength={10} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder={t("ระบุอาการ ขอบเขตผลกระทบ และการตรวจสอบเบื้องต้น (อย่างน้อย 10 ตัวอักษร)")} required value={draft.description} /></div>
        </div>
        <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row"><button className="min-h-11 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setShowCreate(false)} type="button">{t("ยกเลิก")}</button><button className="min-h-11 rounded-full bg-lotus-700 px-5 py-2 text-sm font-semibold text-white hover:bg-lotus-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || properties.length === 0} type="submit">{saving ? t("กำลังบันทึก…") : t("บันทึกเหตุการณ์")}</button></div>
      </form>}
    </section>
    <section aria-labelledby="incident-calendar-heading" className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h3 className="font-semibold text-slate-900" id="incident-calendar-heading">{t("ปฏิทิน Incident")}</h3><p className="mt-1 text-sm text-slate-500">{t("เลือกวันที่เพื่อดูเหตุและอัปเดตสถานะด้านล่าง")}</p></div>
        <div className="flex items-center justify-between gap-2 self-start rounded-full border border-slate-200 bg-slate-50 p-1 sm:self-auto">
          <button aria-label={t("เดือนก่อนหน้า")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-slate-700 shadow-sm hover:bg-lotus-50 focus:outline-none focus:ring-2 focus:ring-lotus-300" onClick={() => { const next = shiftMonth(visibleMonth, -1); setVisibleMonth(next); setSelectedDate(`${next}-01`) }} type="button">‹</button>
          <p aria-live="polite" className="min-w-32 px-2 text-center text-sm font-semibold text-slate-800 sm:min-w-36">{monthTitle(visibleMonth)}</p>
          <button aria-label={t("เดือนถัดไป")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-slate-700 shadow-sm hover:bg-lotus-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-lotus-300" disabled={monthIsCurrent} onClick={() => { const next = shiftMonth(visibleMonth, 1); setVisibleMonth(next); setSelectedDate(`${next}-01`) }} type="button">›</button>
          {!monthIsCurrent && <button className="rounded-full px-3 py-2 text-xs font-semibold text-lotus-800 hover:bg-lotus-100" onClick={() => { setVisibleMonth(today.slice(0, 7)); setSelectedDate(today) }} type="button">{t("วันนี้")}</button>}
        </div>
      </div>
      <div aria-label={t("วันในสัปดาห์")} className="mt-5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 sm:gap-2 sm:text-xs">{getWeekdayLabels().map((day) => <span className="py-2" key={day}>{day}</span>)}</div>
      {loading ? <p className="py-10 text-center text-sm text-slate-500" role="status">{t("กำลังโหลดปฏิทิน…")}</p> : <div className="grid grid-cols-7 gap-1 sm:gap-2">{calendarDays.map((date, index) => {
        if (!date) return <span aria-hidden="true" className="min-h-12 sm:min-h-20" key={`blank-${index}`} />
        const dayIncidents = incidentsByDate.get(date) ?? []
        const openCount = dayIncidents.filter((incident) => incident.status !== 'Restored').length
        const restoredCount = dayIncidents.length - openCount
        const dayTone = openCount ? 'border-amber-200 bg-amber-50/80 text-amber-950' : dayIncidents.length ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950' : 'border-slate-100 bg-slate-50/70 text-slate-600 hover:border-slate-200 hover:bg-white'
        const selected = selectedDate === date
        const isToday = today === date
        return <button aria-label={`${Number(date.slice(-2))} ${monthTitle(visibleMonth)} · ${dayIncidents.length} ${t("เหตุการณ์")}${openCount ? ` · ${openCount} ${t("ยังเปิดอยู่")}` : ''}`} aria-pressed={selected} className={`group flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl border p-1 text-center transition focus:outline-none focus:ring-2 focus:ring-lotus-400 sm:min-h-20 sm:items-start sm:justify-between sm:rounded-2xl sm:p-2 ${dayTone} ${selected ? 'border-lotus-500 ring-2 ring-lotus-500 ring-offset-1' : ''}`} key={date} onClick={() => setSelectedDate(date)} type="button">
          <span className={`flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums sm:h-8 sm:min-w-8 sm:text-sm ${isToday ? 'bg-lotus-700 text-white' : ''}`}>{Number(date.slice(-2))}</span>
          <span className="mt-1 hidden w-full truncate text-left text-[10px] font-medium sm:block">{dayIncidents.length ? `${dayIncidents.length} ${t("เหตุ")}` : '—'}</span>
          <span aria-hidden="true" className="mt-1 flex gap-1 sm:hidden">{openCount > 0 && <i className="h-1.5 w-1.5 rounded-full bg-amber-500" />}{restoredCount > 0 && <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}{dayIncidents.length === 0 && <i className="h-1.5 w-1.5 rounded-full bg-slate-300" />}</span>
        </button>
      })}</div>}
      <div aria-label={t("คำอธิบายสี")} className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600"><span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-400" />{t("มีเหตุที่ยังเปิดอยู่")}</span><span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{t("เหตุได้รับการแก้ไขแล้ว")}</span><span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-slate-300" />{t("ไม่มีเหตุในวันนั้น")}</span></div>
    </section>
    <section aria-live="polite" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{t("Incident วันที่")} {new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(new Date(`${selectedDate}T12:00:00+07:00`))}</h3><span className="text-xs text-slate-500">{selectedDateIncidents.length} {t("รายการตามตัวกรอง")}</span></div>
      {loading ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500" role="status">{t("กำลังโหลด Incident…")}</p> : selectedDateIncidents.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{t("ไม่มีเหตุขัดข้องในวันที่เลือก หรือตรงกับตัวกรอง")}</p> : <div className="grid gap-3 lg:grid-cols-2">{selectedDateIncidents.map((incident) => <IncidentCard incident={incident} canManage={canManage} key={incident.id} onStatusChange={updateStatus} />)}</div>}
    </section>
    {!canManage && <p className="text-xs text-slate-500">{t("บัญชีนี้ดูบันทึกเหตุขัดข้องได้ แต่แก้ไขได้เฉพาะ IT Support Engineer และ Super Admin")}</p>}
  </div>
}
