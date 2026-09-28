import { getLocale, t } from '../../lib/i18n';
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getAssignableEngineers, getTicketPage, subscribeToTicketEvents, type TicketAccess, type TicketPageCursor } from './ticketService'
import { formatTicketChannel, formatTicketProblem, priorities, statusTransitions, ticketIssueAreas, ticketStatuses, type TicketEvent, type TicketRecord, type TicketStatus } from './types'
import { getSlaSnapshot, slaStateLabel } from './sla'
import { postTicketAssignment, postTicketCreation, postTicketStatus, trustedBackendEnabled } from '../../lib/backendApi'
import { assignTicketWithFirebase, changeTicketStatusWithFirebase, createTicketWithFirebase } from './ticketMutationService'

const kanbanStatuses: TicketStatus[] = ['Completed', ...ticketStatuses.filter((status) => status !== 'Completed')]
import { defaultAssetCategories, defaultDepartments, defaultProblemTypes, defaultTicketChannels, defaultTodoCategories, splitProblemType, subscribeToTicketCatalog, type TicketCatalog } from './ticketCatalogService'
import { categoriesForProblem, subscribeToTicketAssets, type TicketAssetOption } from './ticketAssetService'
import { subscribeToRequestUsers, type RequestUserRecord } from '../users/requestUserService'

function formatDate(value: Date | null) {
  if (!value) return t('กำลังบันทึก…')
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(value)
}

function ticketEventNote(event: TicketEvent) {
  if (event.type === 'created') return t('สร้างงานในระบบ')
  if (event.fromStatus) return `${t('เปลี่ยนสถานะจาก')} ${t(event.fromStatus)} ${t('เป็น')} ${t(event.toStatus)}`
  return event.note
}

function ticketDisplayId(ticket: TicketRecord) {
  return `${ticket.propertyCode}-${ticket.id.toUpperCase()}`
}

function ticketStatusTone(status: TicketStatus) {
  if (status === 'Completed') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'Cancelled') return 'border-slate-200 bg-slate-100 text-slate-600'
  if (status === 'In Progress') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (status === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-violet-200 bg-violet-50 text-violet-800'
}

function ticketPriorityTone(priority: TicketRecord['priority']) {
  if (priority === 'Critical') return 'border-rose-200 bg-rose-50 text-rose-800'
  if (priority === 'High') return 'border-orange-200 bg-orange-50 text-orange-800'
  if (priority === 'Low') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-blue-200 bg-blue-50 text-blue-800'
}

function TicketHistory({ ticketId }: { ticketId: string }) {
  const [events, setEvents] = useState<TicketEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToTicketEvents(ticketId, setEvents, (cause) => setError(cause.message)), [ticketId])

  if (error) return <p className="mt-3 text-sm text-red-700" role="alert">{t(error)}</p>
  if (events.length === 0) return <p className="mt-3 text-sm text-slate-500">{t("ยังไม่มีประวัติ")}</p>

  return (
    <ol className="mt-4 space-y-3 border-l border-slate-200 pl-4">
      {events.map((event) => (
        <li className="relative text-sm" key={event.id}>
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-lotus-500" />
          <p className="font-medium">{ticketEventNote(event)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{event.actorUid} · {formatDate(event.createdAt)}</p>
        </li>
      ))}
    </ol>
  )
}

function TicketCard({
  ticket,
  canUpdate,
  onStatusChange,
  onAssign,
  engineers,
}: {
  ticket: TicketRecord
  canUpdate: boolean
  onStatusChange: (ticket: TicketRecord, status: TicketStatus) => Promise<void>
  onAssign: (ticket: TicketRecord, engineerUid: string) => Promise<void>
  engineers: Array<{ uid: string; propertyName: string }>
}) {
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const sla = getSlaSnapshot(ticket)

  async function updateStatus(status: TicketStatus) {
    setSaving(true)
    setError(null)
    try {
      await onStatusChange(ticket, status)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เปลี่ยนสถานะไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="group rounded-2xl border border-line bg-white p-4 shadow-sm shadow-slate-200/40 transition hover:border-lotus-200 hover:shadow-md sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-all text-xs font-semibold tracking-wide text-lotus-700">{ticketDisplayId(ticket)}</p>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${ticketStatusTone(ticket.status)}`}>{t(ticket.status)}</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${sla.state === 'breached' ? 'bg-rose-50 text-rose-800' : sla.state === 'dueSoon' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{slaStateLabel(sla.state)}</span>
          </div>
          <h3 className="mt-2 break-words text-base font-semibold leading-snug text-ink">{formatTicketProblem(ticket.problemCategory, ticket.problemType)} <span className="font-normal text-muted">· {ticket.location}</span></h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
              {t(ticket.issueArea === 'Guest Property Problem' ? 'Guest / พื้นที่แขก' : ticket.issueArea === 'BOH (Back of House)' ? 'BOH / พื้นที่ปฏิบัติงาน' : ticket.issueArea === 'Office / Corporate' ? 'Office / สำนักงาน' : ticket.issueArea === 'Other' ? 'อื่นๆ' : 'ยังไม่ระบุหมวด')}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${ticketPriorityTone(ticket.priority)}`}>{t(ticket.priority)}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap rounded-xl bg-canvas px-3.5 py-3 text-sm leading-6 text-ink">{ticket.description}</p>
      {ticket.resolutionNotes && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3"><p className="text-xs font-semibold text-emerald-900">{t('วิธีแก้ไขปัญหา')}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-emerald-950">{ticket.resolutionNotes}</p></div>}
      <dl className="mt-4 grid gap-x-5 gap-y-3 rounded-xl border border-line bg-white px-3.5 py-3 text-xs text-muted sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="inline">{t("ผู้แจ้ง:")} </dt><dd className="inline text-slate-700">{ticket.requesterName}</dd></div>
        <div><dt className="inline">{t("ช่องทางแจ้ง:")} </dt><dd className={`inline font-medium ${ticket.channel === 'Message Box' ? 'text-violet-700' : 'text-slate-700'}`}>{formatTicketChannel(ticket.channel)}</dd></div>
        <div><dt className="inline">{t("แผนก:")} </dt><dd className="inline text-slate-700">{ticket.department || t('ไม่ระบุ')}</dd></div>
        <div><dt className="inline">{t('Asset:')} </dt><dd className="inline text-slate-700">{ticket.assetId || t('ไม่ระบุ')}</dd></div>
        <div><dt className="inline">{t("แจ้งเมื่อ:")} </dt><dd className="inline text-slate-700">{formatDate(ticket.createdAt)}</dd></div>
        <div><dt className="inline">{t('ผู้รับผิดชอบ:')} </dt><dd className="inline break-all text-slate-700">{ticket.assignedEngineerUid || t('ยังไม่มอบหมาย')}</dd></div>
        <div><dt className="inline">{t('SLA Due:')} </dt><dd className="inline text-slate-700">{formatDate(sla.dueAt)}</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        {canUpdate && <label className="flex min-w-64 items-center gap-2 text-xs text-slate-500">{t('มอบหมายให้')}
          <select aria-label={`${t('มอบหมายให้')} ${ticketDisplayId(ticket)}`} className="form-select min-h-10 min-w-48 py-2 text-sm disabled:opacity-50" disabled={assignmentSaving || saving} onChange={(event) => { setAssignmentSaving(true); setError(null); void onAssign(ticket, event.target.value).catch((cause) => setError(cause instanceof Error ? cause.message : 'มอบหมายงานไม่สำเร็จ')).finally(() => setAssignmentSaving(false)) }} value={ticket.assignedEngineerUid}>
            <option value="">{t('ยังไม่มอบหมาย')}</option>
            {engineers.map((engineer) => <option key={engineer.uid} value={engineer.uid}>{engineer.uid}</option>)}
          </select>
        </label>}
        {canUpdate && statusTransitions(ticket.status).length > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {t("เปลี่ยนสถานะ")}
            <select
              aria-label={`${t('เปลี่ยนสถานะ')} ${ticketDisplayId(ticket)}`}
              className="form-select min-h-10 w-auto min-w-40 py-2 text-sm disabled:opacity-50"
              disabled={saving}
              onChange={(event) => void updateStatus(event.target.value as TicketStatus)}
              value=""
            >
              <option disabled value="">{t("เลือกสถานะ")}</option>
              {statusTransitions(ticket.status).map((status) => <option key={status} value={status}>{t(status)}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{t(error)}</p>}
      <button
        className="mt-3 rounded-lg px-2 py-1 text-sm font-medium text-lotus-700 underline-offset-4 transition hover:bg-lotus-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lotus-300"
        onClick={() => setShowHistory((value) => !value)}
        type="button"
      >
        {showHistory ? t("ซ่อนประวัติ") : t("ดูประวัติการดำเนินงาน")}
      </button>
      {showHistory && <TicketHistory ticketId={ticket.id} />}
    </article>
  )
}

function TicketCreateForm({ defaultPropertyId }: { defaultPropertyId: string }) {
  const { firebaseUser, profile, properties, memberships } = useAuth()
  const [propertyId, setPropertyId] = useState(defaultPropertyId === 'all' ? properties[0]?.id ?? '' : defaultPropertyId)
  const [problemCategory, setProblemCategory] = useState(splitProblemType(defaultProblemTypes[0]).group)
  const [problemType, setProblemType] = useState(splitProblemType(defaultProblemTypes[0]).item)
  const [issueArea, setIssueArea] = useState<(typeof ticketIssueAreas)[number]>('Guest Property Problem')
  const [priority, setPriority] = useState<(typeof priorities)[number]>('Medium')
  const [channel, setChannel] = useState('Line')
  const [location, setLocation] = useState('')
  const [department, setDepartment] = useState('')
  const [selectedRequestUserId, setSelectedRequestUserId] = useState('')
  const [requestUsers, setRequestUsers] = useState<RequestUserRecord[]>([])
  const [requestUsersLoading, setRequestUsersLoading] = useState(false)
  const [catalog, setCatalog] = useState<TicketCatalog>({ propertyId: '', propertyCode: '', problemTypes: defaultProblemTypes, departments: defaultDepartments, assetCategories: defaultAssetCategories, channels: [...defaultTicketChannels], todoCategories: [...defaultTodoCategories] })
  const [assetId, setAssetId] = useState('')
  const [manualAssetId, setManualAssetId] = useState(false)
  const [assetOptions, setAssetOptions] = useState<TicketAssetOption[]>([])
  const [assetOptionsLoading, setAssetOptionsLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const canSelectRequestUser = isSuperAdmin || memberships.some((membership) => membership.propertyId === propertyId && membership.role === 'supportEngineer')
  const selectedRequestUser = requestUsers.find((user) => user.id === selectedRequestUserId && user.active)
  const problemGroups = useMemo(() => catalog.problemTypes.reduce<Record<string, string[]>>((groups, value) => {
    const parsed = splitProblemType(value)
    ;(groups[parsed.group] ??= []).push(parsed.item)
    return groups
  }, {}), [catalog.problemTypes])
  const problemCategories = Object.keys(problemGroups).sort((a, b) => a.localeCompare(b, 'en'))
  const problemTypesForCategory = problemGroups[problemCategory] ?? []

  useEffect(() => {
    const nextPropertyId = defaultPropertyId !== 'all'
      ? defaultPropertyId
      : properties.some((property) => property.id === propertyId) ? propertyId : properties[0]?.id ?? ''
    if (nextPropertyId !== propertyId) {
      setPropertyId(nextPropertyId)
      setAssetId('')
      setManualAssetId(false)
      setSelectedRequestUserId('')
    }
  }, [defaultPropertyId, properties, propertyId])

  useEffect(() => {
    if (!propertyId) return
    setChannel('Line')
    setCatalog({ propertyId, propertyCode: '', problemTypes: defaultProblemTypes, departments: defaultDepartments, assetCategories: defaultAssetCategories, channels: [...defaultTicketChannels], todoCategories: [...defaultTodoCategories] })
    return subscribeToTicketCatalog(propertyId, setCatalog, () => setCatalog({ propertyId, propertyCode: '', problemTypes: defaultProblemTypes, departments: defaultDepartments, assetCategories: defaultAssetCategories, channels: [...defaultTicketChannels], todoCategories: [...defaultTodoCategories] }))
  }, [propertyId])

  useEffect(() => {
    if (!propertyId) { setAssetOptions([]); return }
    setAssetOptionsLoading(true)
    return subscribeToTicketAssets(propertyId, (items) => { setAssetOptions(items); setAssetOptionsLoading(false) }, () => { setAssetOptions([]); setAssetOptionsLoading(false) })
  }, [propertyId])

  useEffect(() => {
    setSelectedRequestUserId('')
    if (!propertyId || !canSelectRequestUser) { setRequestUsers([]); setRequestUsersLoading(false); return }
    setRequestUsersLoading(true)
    return subscribeToRequestUsers(propertyId, false, (items) => {
      setRequestUsers(items.filter((item) => item.active))
      setRequestUsersLoading(false)
    }, () => {
      setRequestUsers([])
      setRequestUsersLoading(false)
    })
  }, [propertyId, canSelectRequestUser])

  useEffect(() => {
    if (!problemCategories.includes(problemCategory)) setProblemCategory(problemCategories[0] ?? '')
  }, [problemCategories, problemCategory])

  useEffect(() => {
    if (!problemTypesForCategory.includes(problemType)) setProblemType(problemTypesForCategory[0] ?? '')
  }, [problemTypesForCategory, problemType])

  const relevantAssets = useMemo(() => {
    const categories = categoriesForProblem(problemCategory, problemType, catalog.assetCategories.length ? catalog.assetCategories : defaultAssetCategories)
    if (!department) return []
    return assetOptions.filter((asset) => asset.status !== 'Retired' && asset.department === department && categories.includes(asset.category))
  }, [assetOptions, problemCategory, problemType, catalog.assetCategories, department])

  useEffect(() => {
    if (!manualAssetId && assetId && !relevantAssets.some((asset) => asset.id === assetId)) setAssetId('')
  }, [assetId, manualAssetId, relevantAssets])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    const property = properties.find((item) => item.id === propertyId)
    if (!firebaseUser || !profile || !property) {
      setError(t("เลือก Property และเข้าสู่ระบบใหม่ก่อนส่ง Task"))
      return
    }
    setSaving(true)
    try {
      const chosenAsset = relevantAssets.find((asset) => asset.id === assetId)
      const command = {
        propertyId: property.id,
        propertyCode: property.code,
        requesterName: selectedRequestUser?.name || selectedRequestUser?.email || profile.displayName || firebaseUser.displayName || firebaseUser.email || 'ผู้ใช้งาน',
        requesterEmail: selectedRequestUser?.email || profile.email || firebaseUser.email || '',
        department: selectedRequestUser?.department || department,
        issueArea,
        location,
        assetId: manualAssetId ? assetId.trim() : chosenAsset?.assetTag ?? '',
        problemCategory,
        problemType,
        channel,
        priority,
        description,
      }
      const ticketId = (trustedBackendEnabled
        ? await postTicketCreation(firebaseUser, command)
        : await createTicketWithFirebase(firebaseUser, command)).ticketId
      setSuccess(`สร้าง Task ${property.code}-${ticketId.toUpperCase()} แล้ว`)
      setAttemptedSubmit(false)
      setLocation('')
      setDepartment('')
      setSelectedRequestUserId('')
      setAssetId('')
      setManualAssetId(false)
      setChannel('Line')
      setDescription('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'สร้าง Task ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="ticket-create-form overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-sm shadow-slate-200/50" onInvalidCapture={() => setAttemptedSubmit(true)} onSubmit={handleSubmit}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-lotus-100 bg-gradient-to-r from-lotus-50 via-white to-emerald-50/60 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lotus-700 shadow-sm ring-1 ring-lotus-100">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lotus-700">{t('IT SERVICE REQUEST')}</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{t("แจ้งงาน IT")}</h2><p className="mt-1 text-sm text-slate-600">{t("กรอกข้อมูลที่จำเป็นเพื่อให้ทีม IT ตรวจสอบและติดตามงานได้")}</p></div>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-2.5 text-sm shadow-sm">
          <p className="text-xs text-slate-500">Task ID</p><p className="font-medium text-slate-800">{t("ระบบสร้างให้อัตโนมัติ")}</p>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-6 lg:p-7">
        <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-lotus-700 shadow-sm">1</span><div><h3 className="font-semibold text-slate-900">{t("ข้อมูลการแจ้ง")}</h3><p className="mt-0.5 text-xs text-slate-500">{t("เลือก Property และช่องทางที่ได้รับแจ้ง")}</p></div></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-property">Property *</label><select aria-invalid={attemptedSubmit && !propertyId} className="form-select" id="ticket-property" onChange={(event) => { setPropertyId(event.target.value); setAssetId(''); setManualAssetId(false); setSelectedRequestUserId('') }} required value={propertyId}><option disabled value="">{t("เลือก Property")}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.code} · {property.name}</option>)}</select>{attemptedSubmit && !propertyId && <p className="mt-1 text-xs font-medium text-rose-700">{t('กรุณาเลือก Property')}</p>}</div>
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-channel">{t("ช่องทางการแจ้งปัญหา")}</label><select className="form-select" id="ticket-channel" onChange={(event) => setChannel(event.target.value)} value={channel}>{catalog.channels.map((value) => <option key={value} value={value}>{formatTicketChannel(value)}</option>)}</select></div>
            {canSelectRequestUser && <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-request-user">{t("Request User / ผู้แจ้งแทน")}</label><select className="form-select" id="ticket-request-user" onChange={(event) => { const user = requestUsers.find((item) => item.id === event.target.value); setSelectedRequestUserId(event.target.value); setDepartment(user?.department ?? '') }} value={selectedRequestUserId}><option value="">Request User</option>{requestUsers.map((user) => <option key={user.id} value={user.id}>{user.name ? `${user.name} · ` : ''}{user.email} · {user.department}</option>)}</select><p className="mt-1 text-xs text-slate-500">{requestUsersLoading ? t("กำลังโหลด Request User ของ Property นี้…") : requestUsers.length ? t('เลือกเพื่อบันทึกอีเมลและแผนกของผู้แจ้ง บัญชีที่เข้าสู่ระบบยังเป็นผู้สร้าง Task') : t('ยังไม่มี Request User ที่เปิดใช้งานใน Property นี้')}</p></div>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lotus-50 text-sm font-semibold text-lotus-700">2</span><div><h3 className="font-semibold text-slate-900">{t("ระบุประเภทและสถานที่")}</h3><p className="mt-0.5 text-xs text-slate-500">{t("เลือกหมวดและประเภทย่อย เพื่อช่วยกรอง Asset ที่เกี่ยวข้อง")}</p></div></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-issue-area">{t("พื้นที่ / กลุ่มปัญหา")}</label><select className="form-select" id="ticket-issue-area" onChange={(event) => setIssueArea(event.target.value as (typeof ticketIssueAreas)[number])} value={issueArea}>{ticketIssueAreas.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select><p className="mt-1 text-xs text-slate-500">{t("ใช้แบ่ง Guest, BOH และ Office ใน Dashboard")}</p></div>
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-priority">{t('Priority')}</label><select className="form-select" id="ticket-priority" onChange={(event) => setPriority(event.target.value as (typeof priorities)[number])} value={priority}>{priorities.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></div>
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-problem-category">{t("หมวดปัญหา")} *</label><select aria-invalid={attemptedSubmit && !problemCategory} className="form-select" id="ticket-problem-category" onChange={(event) => { const category = event.target.value; setProblemCategory(category); setProblemType(problemGroups[category]?.[0] ?? '') }} required value={problemCategory}><option value="">{t("เลือกหมวดปัญหา")}</option>{problemCategories.map((category) => <option key={category} value={category}>{t(category)}</option>)}</select>{attemptedSubmit && !problemCategory && <p className="mt-1 text-xs font-medium text-rose-700">{t('กรุณาเลือกหมวดปัญหา')}</p>}</div>
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-problem-type">{t("ประเภทย่อย")} *</label><select aria-invalid={attemptedSubmit && !problemType} className="form-select" disabled={!problemCategory || problemTypesForCategory.length === 0} id="ticket-problem-type" onChange={(event) => setProblemType(event.target.value)} required value={problemType}><option value="">{t("เลือกประเภทย่อย")}</option>{problemTypesForCategory.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>{attemptedSubmit && !problemType && <p className="mt-1 text-xs font-medium text-rose-700">{t('กรุณาเลือกประเภทย่อย')}</p>}</div>
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-location">{t(issueArea === 'Guest Property Problem' ? 'ห้องพัก / พื้นที่แขก' : issueArea === 'BOH (Back of House)' ? 'พื้นที่ BOH / แผนก' : issueArea === 'Office / Corporate' ? 'สำนักงาน / ห้อง' : 'สถานที่ / ห้อง')}</label><input aria-invalid={attemptedSubmit && !location.trim()} className="form-input" id="ticket-location" maxLength={120} onChange={(event) => setLocation(event.target.value)} placeholder={t(issueArea === 'Guest Property Problem' ? 'เช่น ห้อง 1124 หรือ Lobby' : issueArea === 'BOH (Back of House)' ? 'เช่น Kitchen, Store หรือ Engineering' : issueArea === 'Office / Corporate' ? 'เช่น IT Office หรือห้องประชุม' : 'ระบุสถานที่เกิดปัญหา')} required value={location} />{attemptedSubmit && !location.trim() && <p className="mt-1 text-xs font-medium text-rose-700">{t('กรุณาระบุสถานที่')}</p>}</div>
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-department">{t("แผนก")}</label><select className="form-select" disabled={Boolean(selectedRequestUser)} id="ticket-department" onChange={(event) => setDepartment(event.target.value)} value={department}><option value="">{t("เลือกแผนกเพื่อกรอง Asset")}</option>{catalog.departments.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></div>
            <div className="sm:col-span-2 rounded-2xl border border-dashed border-lotus-200 bg-lotus-50/50 p-4"><label className="mb-1.5 block text-sm font-medium" htmlFor="ticket-asset">{t("ชื่อ Asset ที่เกี่ยวข้อง (ถ้ามี)")}</label><select className="form-select" disabled={!department || assetOptionsLoading} id="ticket-asset" onChange={(event) => { const value = event.target.value; setManualAssetId(value === '__manual__'); setAssetId(value === '__manual__' ? '' : value) }} value={manualAssetId ? '__manual__' : assetId}><option value="">{t("ไม่ระบุ Asset")}</option>{relevantAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.assetTag} ({asset.category}) · {asset.location}</option>)}<option value="__manual__">{t("ไม่พบในรายการ · กรอกชื่อ Asset หรือ Asset Tag เอง")}</option></select>{manualAssetId && <input aria-label={t("ชื่อ Asset หรือ Asset Tag ที่กรอกเอง")} className="form-input mt-2" maxLength={120} onChange={(event) => setAssetId(event.target.value)} placeholder={t("กรอกชื่อ Asset หรือ Asset Tag")} value={assetId} />}<p className="mt-2 text-xs text-slate-600">{assetOptionsLoading ? t("กำลังโหลด Asset…") : !department ? t("เลือกแผนกก่อน จะแสดง Asset ที่เกี่ยวข้อง") : relevantAssets.length ? `${t('พบ Asset ที่ตรงกับตัวกรอง')} ${relevantAssets.length} · ${t(department)} · ${t(problemCategory)} / ${t(problemType)}` : `${t('ไม่พบ Asset ที่ตรงกับตัวกรอง')} · ${t(department)} · ${t(problemCategory)} / ${t(problemType)}`}</p></div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-lotus-700 shadow-sm">3</span><div><h3 className="font-semibold text-slate-900">{t("รายละเอียดอาการ")}</h3><p className="mt-0.5 text-xs text-slate-500">{t("ระบุอาการและผลกระทบ เพื่อให้ทีม IT เริ่มตรวจสอบได้เร็วขึ้น")}</p></div></div>
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ticket-description">{t("รายละเอียดปัญหา")} *</label><textarea aria-invalid={attemptedSubmit && description.trim().length < 10} className="form-input min-h-36 w-full resize-y" id="ticket-description" maxLength={4000} minLength={10} onChange={(event) => setDescription(event.target.value)} placeholder={issueArea === 'Guest Property Problem' ? t("เช่น Fom แจ้งว่าแขกห้อง 1124 ใช้ WiFi ไม่ได้ ระบุเวลา อาการ และผลกระทบที่พบ") : t("ระบุอาการ เวลาเริ่มเกิดปัญหา และผลกระทบต่อผู้ใช้งาน")} required value={description} />{attemptedSubmit && description.trim().length < 10 && <p className="mt-1 text-xs font-medium text-rose-700">{t(description.trim() ? 'กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร' : 'กรุณาระบุรายละเอียดปัญหา')}</p>}<p className="mt-1 text-right text-xs text-slate-500">{description.length}/4000</p>
        </section>

        {error && <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{t(error)}</p>}
        {success && <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{t(success)}</p>}
        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{t("กรุณากรอกช่องที่จำเป็นให้ครบก่อนส่งงาน")}</p>
          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-lotus-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-lotus-800 focus:outline-none focus:ring-2 focus:ring-lotus-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || properties.length === 0 || !problemCategory || !problemType} type="submit"><svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>{saving ? t("กำลังบันทึก…") : t("สร้าง Task")}</button>
        </footer>
      </div>
    </form>
  )
}

export function TicketBoard({ selectedPropertyId, initialSearch = '', mode = 'view' }: { selectedPropertyId: string; initialSearch?: string; mode?: 'create' | 'update' | 'view' }) {
  const { firebaseUser, profile, memberships, accessState } = useAuth()
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState(mode === 'update' ? 'active' : 'all')
  const [search, setSearch] = useState(initialSearch)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [mobileKanbanStatus, setMobileKanbanStatus] = useState<TicketStatus>('Pending')
  const [completionTicket, setCompletionTicket] = useState<TicketRecord | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [completionSaving, setCompletionSaving] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<TicketPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [engineers, setEngineers] = useState<Array<{ uid: string; propertyName: string }>>([])

  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const selectedMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const propertyRole = selectedMembership?.role
  const canCreate = isSuperAdmin || propertyRole === 'supportEngineer' || propertyRole === 'requester'
  const canUpdate = isSuperAdmin || propertyRole === 'supportEngineer'
  // Spark-only mode uses Firestore Rules for the allowed client mutations.
  // The optional Trusted Backend remains available for a future self-hosted deployment.
  const canMutate = canUpdate

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setStatusFilter(mode === 'update' ? 'active' : 'all')
  }, [mode])

  useEffect(() => {
    if (mode === 'create') { setTickets([]); setLoading(false); setError(null); return }
    if (accessState !== 'ready' || !firebaseUser || !profile) return
    if (!isSuperAdmin && !selectedMembership) {
      setTickets([])
      setLoading(false)
      setError(t("ไม่มีสิทธิ์เข้าถึง Property ที่เลือก"))
      return
    }

    setLoading(true)
    setError(null)
    const access: TicketAccess = {
      uid: firebaseUser.uid,
      globalRole: profile.globalRole,
      propertyRole,
      propertyId: selectedPropertyId,
      allProperties: isSuperAdmin && selectedPropertyId === 'all',
    }
    setTickets([])
    setNextCursor(null)
    setHasMore(false)
    void getTicketPage(access).then((page) => {
      setTickets(page.items)
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setLoading(false)
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : t('โหลด Task ไม่สำเร็จ'))
      setLoading(false)
    })
    if (!isSuperAdmin && selectedMembership?.role === 'supportEngineer') {
      void getAssignableEngineers(selectedPropertyId).then(setEngineers).catch(() => setEngineers([]))
    } else if (isSuperAdmin && selectedPropertyId !== 'all') {
      void getAssignableEngineers(selectedPropertyId).then(setEngineers).catch(() => setEngineers([]))
    } else {
      setEngineers([])
    }
  }, [accessState, firebaseUser, profile, propertyRole, selectedMembership, selectedPropertyId, isSuperAdmin, mode])

  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? ticket.status !== 'Completed' && ticket.status !== 'Cancelled' : ticket.status === statusFilter)
    const searchValue = search.trim().toLocaleLowerCase()
    const matchesSearch = !searchValue || [ticketDisplayId(ticket), ticket.requesterName, ticket.problemCategory, ticket.problemType, ticket.location, ticket.assetId, ticket.description]
      .some((value) => value.toLocaleLowerCase().includes(searchValue))
    return matchesStatus && matchesSearch
  }), [tickets, statusFilter, search])

  async function updateStatus(ticket: TicketRecord, status: TicketStatus) {
    if (!firebaseUser || !canMutate) throw new Error(t('ไม่มีสิทธิ์เปลี่ยนสถานะ Task'))
    if (status === 'Completed') {
      setCompletionTicket(ticket)
      setResolutionNotes(ticket.resolutionNotes ?? '')
      setCompletionError(null)
      return
    }
    if (trustedBackendEnabled) await postTicketStatus(firebaseUser, ticket.id, status)
    else await changeTicketStatusWithFirebase(firebaseUser, ticket, status)
    setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, status, updatedAt: new Date() } : item))
  }

  async function updateAssignment(ticket: TicketRecord, engineerUid: string) {
    if (!firebaseUser || !canMutate) throw new Error(t('ไม่มีสิทธิ์มอบหมาย Task'))
    if (trustedBackendEnabled) await postTicketAssignment(firebaseUser, ticket.id, engineerUid)
    else await assignTicketWithFirebase(firebaseUser, ticket, engineerUid)
    setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, assignedEngineerUid: engineerUid, assignedAt: engineerUid ? new Date() : null, assignedByUid: engineerUid ? firebaseUser.uid : '' } : item))
  }

  async function loadMoreTickets() {
    if (!nextCursor || !firebaseUser || !profile || loading) return
    setLoading(true)
    try {
      const access: TicketAccess = { uid: firebaseUser.uid, globalRole: profile.globalRole, propertyRole, propertyId: selectedPropertyId, allProperties: isSuperAdmin && selectedPropertyId === 'all' }
      const page = await getTicketPage(access, 25, nextCursor)
      setTickets((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('โหลด Task ไม่สำเร็จ')) }
    finally { setLoading(false) }
  }

  async function completeTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!completionTicket || !firebaseUser || !canMutate) return
    const cleaned = resolutionNotes.trim()
    if (cleaned.length < 10) { setCompletionError(t('กรุณากรอกวิธีแก้ไขอย่างน้อย 10 ตัวอักษร และไม่เกิน 4,000 ตัวอักษร')); return }
    setCompletionSaving(true); setCompletionError(null)
    try {
      if (trustedBackendEnabled) await postTicketStatus(firebaseUser, completionTicket.id, 'Completed', cleaned)
      else await changeTicketStatusWithFirebase(firebaseUser, completionTicket, 'Completed', cleaned)
      setTickets((current) => current.map((item) => item.id === completionTicket.id ? { ...item, status: 'Completed', resolutionNotes: cleaned, updatedAt: new Date() } : item))
      setCompletionTicket(null); setResolutionNotes('')
    } catch (cause) { setCompletionError(cause instanceof Error ? cause.message : t('เปลี่ยนสถานะไม่สำเร็จ')) }
    finally { setCompletionSaving(false) }
  }

  return (
    <div className="space-y-6">
      {mode === 'create' ? canCreate ? <TicketCreateForm defaultPropertyId={selectedPropertyId} /> : <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">{t("บัญชีนี้ไม่มีสิทธิ์สร้าง Task")}</p> : <>

      <section className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-line bg-gradient-to-r from-lotus-50/80 via-white to-slate-50 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lotus-700">{mode === 'update' ? t('Action queue') : t('Task management')}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">{mode === 'update' ? t("งาน Task ที่ต้องดำเนินการ") : t("รายการ Task")}</h2>
            <p className="mt-1 text-sm text-muted">{mode === 'update' ? t("แสดงงานที่ยังไม่ Completed หรือ Cancelled · อัปเดตสถานะได้") : t("แสดงงานเป็นหน้า ๆ · เปิดดูรายละเอียดและประวัติได้")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(9rem,auto)_auto] xl:min-w-[36rem]">
            <label className="sr-only" htmlFor="ticket-search">{t("ค้นหา Task")}</label>
            <input className="form-input min-w-0" id="ticket-search" onChange={(event) => setSearch(event.target.value)} placeholder={t("ค้นหา Task…")} value={search} />
            <label className="sr-only" htmlFor="ticket-status-filter">{t("กรองตามสถานะ")}</label>
            <select className="form-select" id="ticket-status-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              {mode === 'update' && <option value="active">{t("งานที่ยังเปิด")}</option>}
              <option value="all">{t("ทุกสถานะ")}</option>
              {ticketStatuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}
            </select>
            <div className="flex min-h-12 items-center rounded-xl border border-line bg-white p-1" aria-label={t("รูปแบบการแสดงผล")}>
              <button aria-pressed={view === 'list'} className={`h-10 flex-1 rounded-lg px-3 text-xs font-medium transition ${view === 'list' ? 'bg-lotus-50 text-lotus-800 shadow-sm' : 'text-muted hover:bg-canvas'}`} onClick={() => setView('list')} type="button">{t("รายการ")}</button>
              <button aria-pressed={view === 'kanban'} className={`h-10 flex-1 rounded-lg px-3 text-xs font-medium transition ${view === 'kanban' ? 'bg-lotus-50 text-lotus-800 shadow-sm' : 'text-muted hover:bg-canvas'}`} onClick={() => setView('kanban')} type="button">Kanban</button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-muted">{t('Results')} <strong className="ml-1 tabular-nums text-ink">{visibleTickets.length}</strong></span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">{t('งานที่ยังเปิด')} <strong className="ml-1 tabular-nums">{tickets.filter((ticket) => ticket.status !== 'Completed' && ticket.status !== 'Cancelled').length}</strong></span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">{t('Completed')} <strong className="ml-1 tabular-nums">{tickets.filter((ticket) => ticket.status === 'Completed').length}</strong></span>
        </div>
        </div>

        <div className="p-4 sm:p-6">
        {error && <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{t(error)}</p>}
        {loading ? <p className="py-10 text-center text-sm text-slate-500" role="status">{t("กำลังโหลด Task…")}</p> : visibleTickets.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{t("ไม่พบ Task ในเงื่อนไขนี้")}</p>
        ) : view === 'list' ? (
          <div className="grid gap-3">
            {visibleTickets.map((ticket) => <TicketCard canUpdate={mode === 'update' && canMutate} engineers={engineers} key={ticket.id} onAssign={updateAssignment} onStatusChange={updateStatus} ticket={ticket} />)}
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <p className="hidden sm:block">{t("เลื่อนแนวนอนเพื่อดูสถานะทั้งหมด · ลาก Task เพื่อเปลี่ยนสถานะ")}</p>
              <p className="sm:hidden">{t("เลือกสถานะเพื่อดู Task และอัปเดตได้จากเมนู")}</p>
            </div>

            <nav aria-label={t("เลือกสถานะ Kanban")} className="mb-4 flex gap-2 overflow-x-auto pb-2 sm:hidden">
              {kanbanStatuses.map((status) => {
                const count = visibleTickets.filter((ticket) => ticket.status === status).length
                return <button aria-pressed={mobileKanbanStatus === status} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium ${mobileKanbanStatus === status ? 'border-lotus-200 bg-lotus-50 text-lotus-800' : 'border-slate-200 bg-white text-slate-600'}`} key={status} onClick={() => setMobileKanbanStatus(status)} type="button">{t(status)}<span className="ml-1.5 tabular-nums opacity-70">{count}</span></button>
              })}
            </nav>

            <section aria-label={`Task สถานะ ${mobileKanbanStatus}`} className="space-y-3 sm:hidden">
              {visibleTickets.filter((ticket) => ticket.status === mobileKanbanStatus).length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{t("ไม่มี Task ในสถานะนี้")}</p> : visibleTickets.filter((ticket) => ticket.status === mobileKanbanStatus).map((ticket) => <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={ticket.id}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-xs font-semibold text-lotus-700">{ticketDisplayId(ticket)}</p><h3 className="mt-1 break-words text-sm font-semibold">{formatTicketProblem(ticket.problemCategory, ticket.problemType)}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ticket.priority === 'Critical' ? 'bg-red-100 text-red-800' : ticket.priority === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'}`}>{t(ticket.priority)}</span></div>
                <p className="mt-2"><span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">{t(ticket.issueArea === 'Guest Property Problem' ? 'Guest / พื้นที่แขก' : ticket.issueArea === 'BOH (Back of House)' ? 'BOH / พื้นที่ปฏิบัติงาน' : ticket.issueArea === 'Office / Corporate' ? 'Office / สำนักงาน' : ticket.issueArea === 'Other' ? 'อื่นๆ' : 'ยังไม่ระบุหมวด')}</span></p>
                <p className="mt-2 break-words text-sm text-slate-600">{ticket.location}{ticket.assetId ? ` · ${ticket.assetId}` : ''}</p>
                <p className="mt-1 text-xs text-slate-500">{ticket.requesterName}{ticket.department ? ` · ${ticket.department}` : ''}</p>
                <p className="mt-1 text-xs text-slate-500">{t("ช่องทางแจ้ง:")} {formatTicketChannel(ticket.channel)}</p>
                {ticket.resolutionNotes && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs"><p className="font-semibold text-emerald-900">{t('วิธีแก้ไขปัญหา')}</p><p className="mt-1 whitespace-pre-wrap text-emerald-950">{ticket.resolutionNotes}</p></div>}
            {mode === 'update' && canMutate && statusTransitions(ticket.status).length > 0 && <label className="mt-3 block text-xs font-medium text-slate-600">{t("เปลี่ยนสถานะ")}<select aria-label={`${t('เปลี่ยนสถานะ')} ${ticketDisplayId(ticket)}`} className="form-select mt-1 w-full" onChange={(event) => { if (event.target.value) void updateStatus(ticket, event.target.value as TicketStatus).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'เปลี่ยนสถานะไม่สำเร็จ')) }} value=""><option value="">{t("เลือกสถานะใหม่")}</option>{statusTransitions(ticket.status).map((status) => <option key={status} value={status}>{t(status)}</option>)}</select></label>}
              </article>)}
            </section>

            <div className="hidden gap-3 overflow-x-auto overscroll-x-contain pb-3 sm:flex" role="region" aria-label={t("Kanban board เลื่อนแนวนอนได้")}>
              {kanbanStatuses.map((status) => {
                const columnTickets = visibleTickets.filter((ticket) => ticket.status === status)
                return (
                  <section
                    aria-label={`Task สถานะ ${status}`}
                    className={`min-h-56 w-[min(42vw,19rem)] shrink-0 rounded-2xl border p-3 lg:w-72 ${status === 'Completed' ? 'border-emerald-100 bg-emerald-50/60' : status === 'Cancelled' ? 'border-slate-200 bg-slate-100' : status === 'In Progress' ? 'border-sky-100 bg-sky-50/60' : status === 'Pending' ? 'border-amber-100 bg-amber-50/60' : 'border-violet-100 bg-violet-50/60'}`}
                    key={status}
                    onDragOver={(event) => { if (mode === 'update' && canMutate) event.preventDefault() }}
                    onDrop={(event) => {
                      if (mode !== 'update' || !canMutate) return
                      event.preventDefault()
                      const ticket = visibleTickets.find((item) => item.id === event.dataTransfer.getData('text/ticket-id'))
                      if (ticket) void updateStatus(ticket, status).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'เปลี่ยนสถานะไม่สำเร็จ'))
                    }}
                  >
                    <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
                      {status}<span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{columnTickets.length}</span>
                    </h3>
                    <div className="space-y-2">
                      {columnTickets.map((ticket) => (
                        <div
                          className={`break-words rounded-xl border border-slate-200 bg-white p-3 ${mode === 'update' && canMutate ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          draggable={mode === 'update' && canMutate}
                          key={ticket.id}
                          onDragStart={(event) => event.dataTransfer.setData('text/ticket-id', ticket.id)}
                        >
                          <p className="break-all text-xs font-semibold text-lotus-700">{ticketDisplayId(ticket)}</p>
                          <p className="mt-1 break-words text-sm font-medium">{formatTicketProblem(ticket.problemCategory, ticket.problemType)}</p>
                          <p className="mt-1 break-words text-[11px] font-medium text-sky-700">{t(ticket.issueArea === 'Guest Property Problem' ? 'Guest / พื้นที่แขก' : ticket.issueArea === 'BOH (Back of House)' ? 'BOH / พื้นที่ปฏิบัติงาน' : ticket.issueArea === 'Office / Corporate' ? 'Office / สำนักงาน' : ticket.issueArea === 'Other' ? 'อื่นๆ' : 'ยังไม่ระบุหมวด')}</p>
                          <p className="mt-1 break-words text-[11px] text-slate-500">{t("ช่องทางแจ้ง:")} {formatTicketChannel(ticket.channel)}</p>
                          <p className="mt-1 break-words text-xs text-slate-500">{ticket.location} · {ticket.priority}</p>
                          {ticket.resolutionNotes && <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs"><p className="font-semibold text-emerald-900">{t('วิธีแก้ไขปัญหา')}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-emerald-950">{ticket.resolutionNotes}</p></div>}
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
        {hasMore && <div className="mt-5 text-center"><button className="rounded-full border border-line bg-white px-5 py-2 text-sm font-semibold text-lotus-700 hover:bg-lotus-50 disabled:opacity-50" disabled={loading} onClick={() => void loadMoreTickets()} type="button">{loading ? t('กำลังโหลด…') : t('โหลดรายการถัดไป')}</button></div>}
        </div>
      </section>
      </>}
      {completionTicket && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !completionSaving) setCompletionTicket(null) }}>
        <form aria-labelledby="task-completion-title" aria-modal="true" className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onSubmit={completeTask} role="dialog">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lotus-700">{t('ปิดงาน')}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900" id="task-completion-title">{t('กรอกวิธีแก้ไขก่อนตั้งเป็น Completed')}</h2>
          <p className="mt-1 text-sm text-slate-500">{ticketDisplayId(completionTicket)} · {formatTicketProblem(completionTicket.problemCategory, completionTicket.problemType)}</p>
          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="task-resolution-notes">{t('วิธีแก้ไขปัญหา')} *</label>
          <textarea autoFocus className="form-input mt-1 min-h-36 w-full" id="task-resolution-notes" maxLength={4000} minLength={10} onChange={(event) => setResolutionNotes(event.target.value)} placeholder={t('ระบุสาเหตุที่พบ ขั้นตอนที่แก้ และผลหลังตรวจสอบ')} required value={resolutionNotes} />
          <p className="mt-1 text-xs text-slate-500">{resolutionNotes.trim().length}/4000 · {t('อย่างน้อย 10 ตัวอักษร')}</p>
          {completionError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{t(completionError)}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2"><button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={completionSaving} onClick={() => setCompletionTicket(null)} type="button">{t('ยกเลิก')}</button><button className="rounded-full bg-lotus-700 px-5 py-2 text-sm font-semibold text-white hover:bg-lotus-800 disabled:opacity-50" disabled={completionSaving || resolutionNotes.trim().length < 10} type="submit">{completionSaving ? t('กำลังปิดงาน…') : t('ยืนยันปิดงาน')}</button></div>
        </form>
      </div>}
    </div>
  )
}
