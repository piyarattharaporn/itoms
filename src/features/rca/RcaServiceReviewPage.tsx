import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DataFreshnessBar } from '../../components/DataFreshnessBar'
import { getLocale, t } from '../../lib/i18n'
import { sortByLabel } from '../../lib/sortOptions'
import { useAuth } from '../auth/AuthProvider'
import { getSlaSnapshot } from '../tickets/sla'
import {
  formatAssignableEngineerLabel,
  getAssignableEngineers,
  type AssignableEngineer,
} from '../tickets/ticketService'
import { formatTicketProblem, priorities, type TicketRecord } from '../tickets/types'
import {
  createRca,
  createKnownError,
  getCompletedTasksPage,
  getKnownErrorsPage,
  getRcaPage,
  knownErrorStatuses,
  rcaStatuses,
  updateKnownError,
  updateRca,
  type KnownErrorRecord,
  type KnownErrorStatus,
  type RcaPageCursor,
  type RcaRecord,
  type RcaStatus,
} from './rcaService'
import type { TicketPageCursor } from '../tickets/ticketService'

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(value)
    : t('กำลังบันทึก…')
}

function taskId(ticket: TicketRecord) {
  return `${ticket.propertyCode}-${ticket.id.toUpperCase()}`
}

function emptyForm() {
  return {
    incidentSummary: '',
    rootCause: '',
    contributingFactors: '',
    fiveWhys: '',
    impact: '',
    downtimeMinutes: '',
    correctiveAction: '',
    preventiveAction: '',
    ownerUid: '',
    dueDate: '',
  }
}

function emptyKnownErrorForm() {
  return {
    title: '',
    symptoms: '',
    rootCause: '',
    workaround: '',
    permanentFix: '',
    ownerUid: '',
    reviewDueDate: '',
  }
}

type FormState = ReturnType<typeof emptyForm>
type KnownErrorFormState = ReturnType<typeof emptyKnownErrorForm>

export function RcaServiceReviewPage({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const activeMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const canRead =
    isSuperAdmin || activeMembership?.role === 'supportEngineer' || activeMembership?.role === 'clientExecutive'
  const canWrite = isSuperAdmin || activeMembership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const ticketAccess = useMemo(
    () => ({
      uid: firebaseUser?.uid ?? '',
      globalRole: profile?.globalRole ?? 'member',
      propertyRole: activeMembership?.role,
      propertyId: selectedPropertyId,
      allProperties,
    }),
    [activeMembership?.role, allProperties, firebaseUser?.uid, profile?.globalRole, selectedPropertyId],
  )

  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [ticketCursor, setTicketCursor] = useState<TicketPageCursor>(null)
  const [ticketsMore, setTicketsMore] = useState(false)
  const [rcas, setRcas] = useState<RcaRecord[]>([])
  const [rcaCursor, setRcaCursor] = useState<RcaPageCursor>(null)
  const [rcasMore, setRcasMore] = useState(false)
  const [knownErrors, setKnownErrors] = useState<KnownErrorRecord[]>([])
  const [knownErrorCursor, setKnownErrorCursor] = useState<RcaPageCursor>(null)
  const [knownErrorsMore, setKnownErrorsMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [assignee, setAssignee] = useState('')
  const [slaFilter, setSlaFilter] = useState<'all' | 'breached' | 'notBreached'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedTask, setSelectedTask] = useState<TicketRecord | null>(null)
  const [editingRca, setEditingRca] = useState<RcaRecord | null>(null)
  const [selectedRcaForKnownError, setSelectedRcaForKnownError] = useState<RcaRecord | null>(null)
  const [editingKnownError, setEditingKnownError] = useState<KnownErrorRecord | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [knownErrorForm, setKnownErrorForm] = useState<KnownErrorFormState>(emptyKnownErrorForm())
  const [status, setStatus] = useState<RcaStatus>('Draft')
  const [knownErrorStatus, setKnownErrorStatus] = useState<KnownErrorStatus>('Draft')
  const [saving, setSaving] = useState(false)
  const [savingKnownError, setSavingKnownError] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [ownerOptions, setOwnerOptions] = useState<AssignableEngineer[]>([])
  const [assigneeDirectory, setAssigneeDirectory] = useState<AssignableEngineer[]>([])
  const [ownerOptionsLoading, setOwnerOptionsLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const ownerPropertyId =
    selectedTask?.propertyId ??
    editingRca?.propertyId ??
    selectedRcaForKnownError?.propertyId ??
    editingKnownError?.propertyId ??
    ''

  useEffect(() => {
    if (
      !canWrite ||
      (!selectedTask && !editingRca && !selectedRcaForKnownError && !editingKnownError) ||
      !ownerPropertyId
    ) {
      setOwnerOptions([])
      setOwnerOptionsLoading(false)
      return
    }
    setOwnerOptionsLoading(true)
    void getAssignableEngineers(ownerPropertyId)
      .then(setOwnerOptions)
      .catch(() => setOwnerOptions([]))
      .finally(() => setOwnerOptionsLoading(false))
  }, [canWrite, editingKnownError, editingRca, ownerPropertyId, selectedRcaForKnownError, selectedTask])

  useEffect(() => {
    if (accessState === 'loading' || !canRead || (!allProperties && !selectedPropertyId)) {
      setAssigneeDirectory([])
      return
    }
    let cancelled = false
    void getAssignableEngineers(allProperties ? 'all' : selectedPropertyId, isSuperAdmin)
      .then((engineers) => {
        if (!cancelled) setAssigneeDirectory(engineers)
      })
      .catch(() => {
        if (!cancelled) setAssigneeDirectory([])
      })
    return () => {
      cancelled = true
    }
  }, [accessState, allProperties, canRead, isSuperAdmin, selectedPropertyId])

  const selectableOwners = useMemo(() => {
    const options = ownerOptions.slice()
    if (form.ownerUid && !options.some((item) => item.uid === form.ownerUid)) {
      const fallbackName =
        form.ownerUid === firebaseUser?.uid
          ? profile?.displayName || firebaseUser.displayName || form.ownerUid
          : form.ownerUid
      options.push({ uid: form.ownerUid, displayName: fallbackName, propertyId: ownerPropertyId })
    }
    return options.sort((a, b) => formatAssignableEngineerLabel(a).localeCompare(formatAssignableEngineerLabel(b)))
  }, [firebaseUser?.displayName, firebaseUser?.uid, form.ownerUid, ownerOptions, ownerPropertyId, profile?.displayName])

  const knownErrorSelectableOwners = useMemo(() => {
    const options = ownerOptions.slice()
    if (knownErrorForm.ownerUid && !options.some((item) => item.uid === knownErrorForm.ownerUid)) {
      options.push({ uid: knownErrorForm.ownerUid, displayName: knownErrorForm.ownerUid, propertyId: ownerPropertyId })
    }
    return options.sort((a, b) => formatAssignableEngineerLabel(a).localeCompare(formatAssignableEngineerLabel(b)))
  }, [knownErrorForm.ownerUid, ownerOptions, ownerPropertyId])

  useEffect(() => {
    if (accessState === 'loading') return
    if (!canRead || (!allProperties && !selectedPropertyId)) {
      setTickets([])
      setRcas([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setTickets([])
    setRcas([])
    setKnownErrors([])
    setTicketCursor(null)
    setRcaCursor(null)
    setKnownErrorCursor(null)
    setTicketsMore(false)
    setRcasMore(false)
    setKnownErrorsMore(false)
    setLastUpdated(null)
    let cancelled = false
    void Promise.all([
      getCompletedTasksPage(ticketAccess, 25),
      getRcaPage(selectedPropertyId, allProperties, 25),
      getKnownErrorsPage(selectedPropertyId, allProperties, 25),
    ])
      .then(([ticketPage, rcaPage, knownErrorPage]) => {
        if (cancelled) return
        setTickets(ticketPage.items)
        setTicketCursor(ticketPage.nextCursor)
        setTicketsMore(ticketPage.hasMore)
        setRcas(rcaPage.items)
        setRcaCursor(rcaPage.nextCursor)
        setRcasMore(rcaPage.hasMore)
        setKnownErrors(knownErrorPage.items)
        setKnownErrorCursor(knownErrorPage.nextCursor)
        setKnownErrorsMore(knownErrorPage.hasMore)
        setLastUpdated(new Date())
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('โหลด RCA ไม่สำเร็จ'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessState, allProperties, canRead, reloadKey, selectedPropertyId, ticketAccess])

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null
    return tickets.filter((ticket) => {
      const ticketTime = ticket.updatedAt?.getTime() ?? ticket.createdAt?.getTime() ?? 0
      const breached = getSlaSnapshot(ticket).state === 'breached'
      return (
        (!term ||
          [
            taskId(ticket),
            ticket.description,
            ticket.location,
            ticket.problemCategory,
            ticket.problemType,
            ticket.requesterName,
          ].some((value) => value.toLocaleLowerCase().includes(term))) &&
        (!category || ticket.problemCategory === category) &&
        (!priority || ticket.priority === priority) &&
        (!assignee || ticket.assignedEngineerUid === assignee) &&
        (slaFilter === 'all' || (slaFilter === 'breached' ? breached : !breached)) &&
        (from === null || ticketTime >= from) &&
        (to === null || ticketTime <= to)
      )
    })
  }, [assignee, category, fromDate, priority, search, slaFilter, tickets, toDate])

  const categories = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.problemCategory).filter(Boolean))].sort(),
    [tickets],
  )
  const assignees = useMemo(
    () => [...new Set(tickets.map((ticket) => ticket.assignedEngineerUid).filter(Boolean))].sort(),
    [tickets],
  )
  const assigneeNames = useMemo(
    () =>
      new Map(
        assigneeDirectory
          .filter((engineer) => engineer.displayName && engineer.displayName !== engineer.uid)
          .map((engineer) => [engineer.uid, formatAssignableEngineerLabel(engineer)]),
      ),
    [assigneeDirectory],
  )

  function displayAssignee(uid: string) {
    return assigneeNames.get(uid) || t('ไม่พบชื่อผู้รับผิดชอบ')
  }
  const rcaByTask = useMemo(() => new Map(rcas.map((item) => [item.taskId, item])), [rcas])
  const knownErrorByRca = useMemo(() => new Map(knownErrors.map((item) => [item.sourceRcaId, item])), [knownErrors])

  function openCreate(ticket: TicketRecord) {
    setSelectedTask(ticket)
    setEditingRca(null)
    setSelectedRcaForKnownError(null)
    setEditingKnownError(null)
    setStatus('Draft')
    setForm({ ...emptyForm(), ownerUid: firebaseUser?.uid ?? '' })
    setSavedMessage('')
  }

  function openEdit(rca: RcaRecord) {
    setEditingRca(rca)
    setSelectedTask(null)
    setSelectedRcaForKnownError(null)
    setEditingKnownError(null)
    setStatus(rca.status)
    setForm({
      incidentSummary: rca.incidentSummary,
      rootCause: rca.rootCause,
      contributingFactors: rca.contributingFactors,
      fiveWhys: rca.fiveWhys,
      impact: rca.impact,
      downtimeMinutes: rca.downtimeMinutes === null ? '' : String(rca.downtimeMinutes),
      correctiveAction: rca.correctiveAction,
      preventiveAction: rca.preventiveAction,
      ownerUid: rca.ownerUid,
      dueDate: rca.dueDate,
    })
    setSavedMessage('')
  }

  function closeForm() {
    setSelectedTask(null)
    setEditingRca(null)
  }

  function openCreateKnownError(rca: RcaRecord) {
    setSelectedTask(null)
    setEditingRca(null)
    setSelectedRcaForKnownError(rca)
    setEditingKnownError(null)
    setKnownErrorStatus('Draft')
    setKnownErrorForm({
      title: rca.taskTitle,
      symptoms: rca.incidentSummary,
      rootCause: rca.rootCause,
      workaround: rca.correctiveAction,
      permanentFix: rca.preventiveAction,
      ownerUid: rca.ownerUid,
      reviewDueDate: '',
    })
    setSavedMessage('')
  }

  function openEditKnownError(knownError: KnownErrorRecord) {
    setSelectedTask(null)
    setEditingRca(null)
    setSelectedRcaForKnownError(null)
    setEditingKnownError(knownError)
    setKnownErrorStatus(knownError.status)
    setKnownErrorForm({
      title: knownError.title,
      symptoms: knownError.symptoms,
      rootCause: knownError.rootCause,
      workaround: knownError.workaround,
      permanentFix: knownError.permanentFix,
      ownerUid: knownError.ownerUid,
      reviewDueDate: knownError.reviewDueDate,
    })
    setSavedMessage('')
  }

  function closeKnownErrorForm() {
    setSelectedRcaForKnownError(null)
    setEditingKnownError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser || (!selectedTask && !editingRca)) return
    if (!form.incidentSummary.trim() || !form.rootCause.trim()) {
      setError(t('กรุณากรอกสรุปเหตุการณ์และ Root Cause'))
      return
    }
    const downtimeMinutes = form.downtimeMinutes.trim() ? Number(form.downtimeMinutes) : null
    if (
      downtimeMinutes !== null &&
      (!Number.isInteger(downtimeMinutes) || downtimeMinutes < 0 || downtimeMinutes > 525600)
    ) {
      setError(t('Downtime ต้องเป็นจำนวนนาทีตั้งแต่ 0 ถึง 525,600'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (selectedTask) {
        await createRca(firebaseUser.uid, {
          propertyId: selectedTask.propertyId,
          propertyCode: selectedTask.propertyCode,
          task: selectedTask,
          ...form,
          downtimeMinutes,
        })
        setSavedMessage(t('สร้าง RCA Draft แล้ว'))
        closeForm()
      } else if (editingRca) {
        await updateRca(editingRca.id, { ...form, downtimeMinutes }, status)
        setRcas((current) =>
          current.map((item) => (item.id === editingRca.id ? { ...item, ...form, downtimeMinutes, status } : item)),
        )
        setSavedMessage(t('บันทึก RCA แล้ว'))
        closeForm()
      }
      const refreshed = await getRcaPage(selectedPropertyId, allProperties, 25)
      setRcas(refreshed.items)
      setRcaCursor(refreshed.nextCursor)
      setRcasMore(refreshed.hasMore)
      setLastUpdated(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('บันทึก RCA ไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  async function submitKnownError(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser || (!selectedRcaForKnownError && !editingKnownError)) return
    if (!knownErrorForm.title.trim() || !knownErrorForm.symptoms.trim() || !knownErrorForm.rootCause.trim()) {
      setError(t('กรุณากรอกชื่อ Known Error, อาการ และ Root Cause'))
      return
    }
    setSavingKnownError(true)
    setError(null)
    try {
      if (selectedRcaForKnownError) {
        if (selectedRcaForKnownError.status !== 'Approved') {
          throw new Error(t('ต้องอนุมัติ RCA ก่อนสร้าง Known Error'))
        }
        await createKnownError(firebaseUser.uid, {
          propertyId: selectedRcaForKnownError.propertyId,
          propertyCode: selectedRcaForKnownError.propertyCode,
          sourceRcaId: selectedRcaForKnownError.id,
          sourceTaskId: selectedRcaForKnownError.taskId,
          taskTitle: selectedRcaForKnownError.taskTitle,
          taskCategory: selectedRcaForKnownError.taskCategory,
          ...knownErrorForm,
        })
        setSavedMessage(t('สร้าง Known Error Draft แล้ว'))
      } else if (editingKnownError) {
        await updateKnownError(editingKnownError.id, knownErrorForm, knownErrorStatus)
        setSavedMessage(t('บันทึก Known Error แล้ว'))
      }
      closeKnownErrorForm()
      const refreshed = await getKnownErrorsPage(selectedPropertyId, allProperties, 25)
      setKnownErrors(refreshed.items)
      setKnownErrorCursor(refreshed.nextCursor)
      setKnownErrorsMore(refreshed.hasMore)
      setLastUpdated(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('บันทึก Known Error ไม่สำเร็จ'))
    } finally {
      setSavingKnownError(false)
    }
  }

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      if (ticketsMore && ticketCursor) {
        const page = await getCompletedTasksPage(ticketAccess, 25, ticketCursor)
        setTickets((current) => [...current, ...page.items])
        setTicketCursor(page.nextCursor)
        setTicketsMore(page.hasMore)
      }
      if (rcasMore && rcaCursor) {
        const page = await getRcaPage(selectedPropertyId, allProperties, 25, rcaCursor)
        setRcas((current) => [...current, ...page.items])
        setRcaCursor(page.nextCursor)
        setRcasMore(page.hasMore)
      }
      if (knownErrorsMore && knownErrorCursor) {
        const page = await getKnownErrorsPage(selectedPropertyId, allProperties, 25, knownErrorCursor)
        setKnownErrors((current) => [...current, ...page.items])
        setKnownErrorCursor(page.nextCursor)
        setKnownErrorsMore(page.hasMore)
      }
      setLastUpdated(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('โหลดรายการเพิ่มไม่สำเร็จ'))
    } finally {
      setLoadingMore(false)
    }
  }

  function refresh() {
    setReloadKey((value) => value + 1)
  }

  if (accessState === 'loading')
    return <p className="py-10 text-center text-sm text-slate-500">{t('กำลังตรวจสอบสิทธิ์…')}</p>
  if (!canRead)
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {t('หน้านี้เปิดให้ Support Engineer, Client Executive และ Super Admin')}
      </p>
    )

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t('RCA & Service Review')}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              {t('ทบทวน Task ที่เสร็จแล้วเพื่อบันทึก Root Cause และแผนป้องกัน แยกจากประวัติ Task เดิม')}
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
            {tickets.length} {t('Task ที่โหลดแล้ว')} · {rcas.length} RCA · {knownErrors.length} Known Error
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            {t('ค้นหา Task')}
            <input
              className="form-input mt-1 w-full"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('รหัสงาน, รายละเอียด, หมวดหมู่, ผู้แจ้ง')}
              value={search}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t('หมวดหมู่')}
            <select
              className="form-select mt-1 w-full"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              <option value="">{t('ทั้งหมด')}</option>
              {sortByLabel(categories, (item) => t(item)).map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t('ความสำคัญ')}
            <select
              className="form-select mt-1 w-full"
              onChange={(event) => setPriority(event.target.value)}
              value={priority}
            >
              <option value="">{t('ทั้งหมด')}</option>
              {sortByLabel(priorities, (item) => t(item)).map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t('ผู้รับผิดชอบ')}
            <select
              className="form-select mt-1 w-full"
              onChange={(event) => setAssignee(event.target.value)}
              value={assignee}
            >
              <option value="">{t('ทั้งหมด')}</option>
              {sortByLabel(assignees, displayAssignee).map((item) => (
                <option key={item} value={item}>
                  {displayAssignee(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t('SLA')}
            <select
              className="form-select mt-1 w-full"
              onChange={(event) => setSlaFilter(event.target.value as typeof slaFilter)}
              value={slaFilter}
            >
              <option value="all">{t('ทั้งหมด')}</option>
              {sortByLabel(
                [
                  { value: 'breached', label: t('เกิน SLA') },
                  { value: 'notBreached', label: t('ไม่เกิน SLA') },
                ],
                (item) => item.label,
              ).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t('ตั้งแต่')}
            <input
              className="form-input mt-1 w-full"
              onChange={(event) => setFromDate(event.target.value)}
              type="date"
              value={fromDate}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t('ถึง')}
            <input
              className="form-input mt-1 w-full"
              onChange={(event) => setToDate(event.target.value)}
              type="date"
              value={toDate}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t(
            'ตัวกรองทำงานบนข้อมูลที่โหลดตามหน้าเท่านั้น หากต้องการค้นหาประวัติทั้งหมดต้องใช้ Backend Search ใน Phase ถัดไป',
          )}
        </p>
      </section>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {t(error)}
        </p>
      )}
      <DataFreshnessBar lastUpdated={lastUpdated} loading={loading || loadingMore} onRefresh={refresh} />
      {savedMessage && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {savedMessage}
        </p>
      )}

      {(selectedTask || editingRca) && canWrite && (
        <form
          className="rounded-2xl border border-lotus-200 bg-lotus-50/40 p-5"
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-lotus-700">
                {editingRca ? t('แก้ไข RCA') : t('สร้าง RCA Draft')}
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                {selectedTask
                  ? `${taskId(selectedTask)} · ${formatTicketProblem(selectedTask.problemCategory, selectedTask.problemType)}`
                  : editingRca?.taskTitle}
              </h3>
            </div>
            <button
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"
              onClick={closeForm}
              type="button"
            >
              {t('ปิด')}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(
              [
                ['incidentSummary', 'สรุปเหตุการณ์', 'สรุปอาการ เหตุการณ์ และขอบเขตผลกระทบ'],
                ['rootCause', 'Root Cause', 'สาเหตุรากที่พิสูจน์หรือยืนยันได้'],
                ['contributingFactors', 'ปัจจัยร่วม', 'ปัจจัยแวดล้อม กระบวนการ หรือการเปลี่ยนแปลงที่เกี่ยวข้อง'],
                ['fiveWhys', '5 Whys', 'ไล่เหตุผลจากอาการไปถึงสาเหตุราก'],
                ['impact', 'ผลกระทบ', 'ผู้ใช้งาน บริการ รายได้ หรือความเสี่ยงที่ได้รับผลกระทบ'],
                ['correctiveAction', 'Corrective Action', 'สิ่งที่ทำเพื่อแก้เหตุการณ์นี้'],
                ['preventiveAction', 'Preventive Action', 'สิ่งที่จะทำเพื่อไม่ให้เกิดซ้ำ'],
              ] as const
            ).map(([name, label, placeholder]) => (
              <label className="text-sm font-medium text-slate-700 md:col-span-2" key={name}>
                {t(label)}
                <textarea
                  className="form-textarea mt-1 min-h-24 w-full"
                  onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                  placeholder={t(placeholder)}
                  value={form[name]}
                />
              </label>
            ))}
            <label className="text-sm font-medium text-slate-700">
              {t('Downtime (นาที)')}
              <input
                className="form-input mt-1 w-full"
                min="0"
                max="525600"
                onChange={(event) => setForm((current) => ({ ...current, downtimeMinutes: event.target.value }))}
                type="number"
                value={form.downtimeMinutes}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t('กำหนดเสร็จ')}
              <input
                className="form-input mt-1 w-full"
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                type="date"
                value={form.dueDate}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t('ผู้รับผิดชอบ RCA')}
              <select
                className="form-select mt-1 w-full"
                onChange={(event) => setForm((current) => ({ ...current, ownerUid: event.target.value }))}
                value={form.ownerUid}
              >
                <option value="">{t('ยังไม่กำหนด')}</option>
                {sortByLabel(selectableOwners, formatAssignableEngineerLabel).map((owner) => (
                  <option key={owner.uid} value={owner.uid}>
                    {formatAssignableEngineerLabel(owner)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {ownerOptionsLoading
                  ? t('กำลังโหลดรายชื่อผู้รับผิดชอบ…')
                  : t('เลือกจาก Support Engineer ของ Property นี้ได้ โดยระบบจะเก็บ UID ไว้เบื้องหลัง')}
              </span>
            </label>
            {editingRca && (
              <label className="text-sm font-medium text-slate-700">
                {t('สถานะ RCA')}
                <select
                  className="form-select mt-1 w-full"
                  onChange={(event) => setStatus(event.target.value as RcaStatus)}
                  value={status}
                >
                  {sortByLabel(rcaStatuses, (item) => t(item)).map((item) => (
                    <option key={item} value={item}>
                      {t(item)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <p className="mr-auto text-xs text-slate-500">
              {t('MVP นี้ยังไม่มีไฟล์แนบ, approval workflow หรือการแจ้งเตือนอัตโนมัติ')}
            </p>
            <button
              className="rounded-full bg-lotus-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? t('กำลังบันทึก…') : t('บันทึก RCA')}
            </button>
          </div>
        </form>
      )}

      {(selectedRcaForKnownError || editingKnownError) && canWrite && (
        <form
          className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5"
          onSubmit={(event) => void submitKnownError(event)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
                {editingKnownError ? t('แก้ไข Known Error') : t('สร้าง Known Error จาก RCA')}
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                {editingKnownError?.title || selectedRcaForKnownError?.taskTitle}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {t('RCA ต้นทาง')}: {editingKnownError?.sourceRcaId || selectedRcaForKnownError?.id}
              </p>
            </div>
            <button
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"
              onClick={closeKnownErrorForm}
              type="button"
            >
              {t('ปิด')}
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              {t('ชื่อ Known Error')}
              <input
                className="form-input mt-1 w-full"
                onChange={(event) => setKnownErrorForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={t('หัวข้ออาการหรือปัญหาที่ค้นหาเจอได้ง่าย')}
                required
                value={knownErrorForm.title}
              />
            </label>
            {(
              [
                ['symptoms', 'อาการ / Symptoms', 'อาการ เงื่อนไข และข้อความผิดพลาดที่พบ'],
                ['rootCause', 'Root Cause', 'สาเหตุรากที่ยืนยันจาก RCA'],
                ['workaround', 'Workaround', 'แนวทางชั่วคราวเพื่อให้บริการกลับมาใช้งานได้'],
                ['permanentFix', 'Permanent Fix', 'แนวทางแก้ไขถาวรหรือแผนงานถัดไป'],
              ] as const
            ).map(([name, label, placeholder]) => (
              <label className="text-sm font-medium text-slate-700 md:col-span-2" key={name}>
                {t(label)}
                <textarea
                  className="form-textarea mt-1 min-h-24 w-full"
                  onChange={(event) => setKnownErrorForm((current) => ({ ...current, [name]: event.target.value }))}
                  placeholder={t(placeholder)}
                  required={name === 'symptoms' || name === 'rootCause'}
                  value={knownErrorForm[name]}
                />
              </label>
            ))}
            <label className="text-sm font-medium text-slate-700">
              {t('ผู้รับผิดชอบ Known Error')}
              <select
                className="form-select mt-1 w-full"
                onChange={(event) => setKnownErrorForm((current) => ({ ...current, ownerUid: event.target.value }))}
                value={knownErrorForm.ownerUid}
              >
                <option value="">{t('ยังไม่กำหนด')}</option>
                {sortByLabel(knownErrorSelectableOwners, formatAssignableEngineerLabel).map((owner) => (
                  <option key={owner.uid} value={owner.uid}>
                    {formatAssignableEngineerLabel(owner)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {ownerOptionsLoading
                  ? t('กำลังโหลดรายชื่อผู้รับผิดชอบ…')
                  : t('เลือกจาก Support Engineer ของ Property นี้')}
              </span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              {t('วันที่ทบทวน')}
              <input
                className="form-input mt-1 w-full"
                onChange={(event) =>
                  setKnownErrorForm((current) => ({ ...current, reviewDueDate: event.target.value }))
                }
                type="date"
                value={knownErrorForm.reviewDueDate}
              />
            </label>
            {editingKnownError && (
              <label className="text-sm font-medium text-slate-700">
                {t('สถานะ Known Error')}
                <select
                  className="form-select mt-1 w-full"
                  onChange={(event) => setKnownErrorStatus(event.target.value as KnownErrorStatus)}
                  value={knownErrorStatus}
                >
                  {sortByLabel(knownErrorStatuses, (item) => t(item)).map((item) => (
                    <option key={item} value={item}>
                      {t(item)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <p className="mr-auto text-xs text-slate-500">
              {t('Known Error จะใช้ข้อมูล Snapshot จาก RCA ต้นทาง และเริ่มต้นเป็น Draft')}
            </p>
            <button
              className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
              onClick={closeKnownErrorForm}
              type="button"
            >
              {t('ยกเลิก')}
            </button>
            <button
              className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={savingKnownError}
              type="submit"
            >
              {savingKnownError ? t('กำลังบันทึก…') : t('บันทึก Known Error')}
            </button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{t('Completed Task Review')}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {t('เลือกงานที่เสร็จแล้วเพื่อเริ่ม RCA หรือเปิด RCA ที่มีอยู่')}
            </p>
          </div>
          <span className="text-sm text-slate-500">
            {filteredTickets.length} {t('รายการที่พบ')}
          </span>
        </div>
        {loading ? (
          <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            {t('กำลังโหลดรายการ…')}
          </p>
        ) : filteredTickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            {t('ไม่พบ Completed Task ตามตัวกรอง')}
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredTickets.map((ticket) => {
              const rca = rcaByTask.get(ticket.id)
              const knownError = rca ? knownErrorByRca.get(rca.id) : null
              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={ticket.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-lotus-700">{taskId(ticket)}</p>
                      <h4 className="mt-1 font-semibold">
                        {formatTicketProblem(ticket.problemCategory, ticket.problemType)}{' '}
                        <span className="font-normal text-slate-500">· {ticket.location}</span>
                      </h4>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      {t('เสร็จสิ้น')}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{ticket.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{t(ticket.priority)}</span>
                    <span>· {formatDate(ticket.updatedAt)}</span>
                    {ticket.assignedEngineerUid && <span>· {displayAssignee(ticket.assignedEngineerUid)}</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {rca ? (
                      <>
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">
                          RCA: {t(rca.status)}
                        </span>
                        {knownError && (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                            Known Error: {t(knownError.status)}
                          </span>
                        )}
                        {canWrite && (
                          <>
                            <button
                              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                              onClick={() => openEdit(rca)}
                              type="button"
                            >
                              {t('แก้ไข RCA')}
                            </button>
                            {knownError ? (
                              <button
                                className="rounded-full border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-800"
                                onClick={() => openEditKnownError(knownError)}
                                type="button"
                              >
                                {t('แก้ไข Known Error')}
                              </button>
                            ) : rca.status === 'Approved' ? (
                              <button
                                className="rounded-full bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white"
                                onClick={() => openCreateKnownError(rca)}
                                type="button"
                              >
                                {t('สร้าง Known Error Draft')}
                              </button>
                            ) : null}
                          </>
                        )}
                      </>
                    ) : canWrite ? (
                      <button
                        className="rounded-full bg-lotus-700 px-3 py-1.5 text-xs font-semibold text-white"
                        onClick={() => openCreate(ticket)}
                        type="button"
                      >
                        {t('สร้าง RCA Draft')}
                      </button>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs">{t('ยังไม่มี RCA')}</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {rcas.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{t('RCA ที่บันทึกแล้ว')}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {t('รายการ RCA แยกจาก Task และใช้สำหรับ Service Review ต่อไป')}
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t('รหัสงาน')}</th>
                  <th className="px-3 py-2">{t('Property')}</th>
                  <th className="px-3 py-2">{t('สถานะ')}</th>
                  <th className="px-3 py-2">{t('Known Error')}</th>
                  <th className="px-3 py-2">{t('อัปเดตล่าสุด')}</th>
                  <th className="px-3 py-2">{t('การดำเนินการ')}</th>
                </tr>
              </thead>
              <tbody>
                {rcas.map((rca) => (
                  <tr className="border-b border-slate-100" key={rca.id}>
                    <td className="px-3 py-3 font-medium">
                      {rca.propertyCode}-{rca.taskId.toUpperCase()}
                    </td>
                    <td className="px-3 py-3">{rca.propertyCode}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">
                        {t(rca.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {knownErrorByRca.get(rca.id) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                            {t(knownErrorByRca.get(rca.id)!.status)}
                          </span>
                          {canWrite && (
                            <button
                              className="rounded-full border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-800"
                              onClick={() => openEditKnownError(knownErrorByRca.get(rca.id)!)}
                              type="button"
                            >
                              {t('แก้ไข')}
                            </button>
                          )}
                        </div>
                      ) : rca.status === 'Approved' && canWrite ? (
                        <button
                          className="rounded-full border border-sky-300 px-2.5 py-1 text-xs font-semibold text-sky-800"
                          onClick={() => openCreateKnownError(rca)}
                          type="button"
                        >
                          {t('สร้าง Known Error Draft')}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">{t('ยังไม่มี Known Error')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(rca.updatedAt)}</td>
                    <td className="px-3 py-3">
                      {canWrite && (
                        <button
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                          onClick={() => openEdit(rca)}
                          type="button"
                        >
                          {t('แก้ไข')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {knownErrors.length > 0 && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/30 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{t('Known Errors จาก RCA')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('รายการ Known Error ที่บันทึกจาก RCA ต้นทาง')}</p>
            </div>
            <span className="text-sm text-slate-500">
              {knownErrors.length} {t('รายการที่พบ')}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-sky-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t('ชื่อ Known Error')}</th>
                  <th className="px-3 py-2">{t('ประเภทปัญหา')}</th>
                  <th className="px-3 py-2">{t('RCA ต้นทาง')}</th>
                  <th className="px-3 py-2">{t('สถานะ')}</th>
                  <th className="px-3 py-2">{t('วันที่ทบทวน')}</th>
                  <th className="px-3 py-2">{t('การดำเนินการ')}</th>
                </tr>
              </thead>
              <tbody>
                {knownErrors.map((knownError) => (
                  <tr className="border-b border-sky-100" key={knownError.id}>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{knownError.title}</p>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">{knownError.symptoms}</p>
                    </td>
                    <td className="px-3 py-3">{t(knownError.taskCategory)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{knownError.sourceRcaId}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                        {t(knownError.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{knownError.reviewDueDate || t('ยังไม่กำหนด')}</td>
                    <td className="px-3 py-3">
                      {canWrite && (
                        <button
                          className="rounded-full border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-800"
                          onClick={() => openEditKnownError(knownError)}
                          type="button"
                        >
                          {t('แก้ไข Known Error')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {(ticketsMore || rcasMore || knownErrorsMore) && (
        <div className="text-center">
          <button
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            type="button"
          >
            {loadingMore ? t('กำลังโหลด…') : t('โหลดรายการเพิ่ม')}
          </button>
        </div>
      )}
      <p className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-xs leading-5 text-violet-900">
        {t(
          'ข้อจำกัด MVP: งาน, RCA และ Known Error โหลดแบบ cursor pagination; Filter ยังทำงานเฉพาะข้อมูลหน้าที่โหลดแล้ว และข้อมูลที่สร้างจาก Client ยังไม่ใช่หลักฐาน tamper-proof จนกว่าจะมี Trusted Backend',
        )}
      </p>
    </div>
  )
}
