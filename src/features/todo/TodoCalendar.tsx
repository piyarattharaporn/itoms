import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { getLocale, t } from '../../lib/i18n'
import { useAuth } from '../auth/AuthProvider'
import { defaultTodoCategories, subscribeToTicketCatalog } from '../tickets/ticketCatalogService'
import {
  bangkokDateOnly,
  archiveOperationalTodo,
  canEditTodoOccurrence,
  createOperationalTodo,
  setOperationalTodoCompletion,
  shiftTodoDate,
  subscribeToOperationalTodoCompletions,
  subscribeToOperationalTodos,
  subscribeToOperationalTodoSettings,
  todoCompletionId,
  todoOccursOn,
  updateOperationalTodo,
  type OperationalTodo,
  type OperationalTodoCompletion,
  type TodoKind,
  type TodoRepeat,
} from './operationalTodoService'

function moveMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function asDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDay(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(getLocale(), { ...options, timeZone: 'Asia/Bangkok' }).format(new Date(`${value}T12:00:00+07:00`))
}

function todoCategoryLabel(category: string) {
  if (category === 'General') return t('งานทั่วไป')
  if (category === 'Meeting Room') return t('ดูแลห้องประชุม')
  return t(category)
}

function useOperationalTodoData(selectedPropertyId: string, fromDate: string, throughDate: string, enabled: boolean) {
  const [todos, setTodos] = useState<OperationalTodo[]>([])
  const [completions, setCompletions] = useState<OperationalTodoCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const allProperties = selectedPropertyId === 'all'

  useEffect(() => {
    if (!enabled || (!allProperties && !selectedPropertyId)) {
      setTodos([])
      setCompletions([])
      setLoading(false)
      return
    }
    setTodos([])
    setCompletions([])
    setLoading(true)
    setLoadError(false)
    let todosLoaded = false
    let completionsLoaded = false
    const finishLoading = () => { if (todosLoaded && completionsLoaded) setLoading(false) }
    const stopTodos = subscribeToOperationalTodos(selectedPropertyId, allProperties, (items) => {
      setTodos(items)
      todosLoaded = true
      finishLoading()
    }, () => { setLoadError(true); todosLoaded = true; finishLoading() })
    const stopCompletions = subscribeToOperationalTodoCompletions(selectedPropertyId, allProperties, fromDate, throughDate, (items) => {
      setCompletions(items)
      completionsLoaded = true
      finishLoading()
    }, () => { setLoadError(true); completionsLoaded = true; finishLoading() })
    return () => { stopTodos(); stopCompletions() }
  }, [enabled, selectedPropertyId, allProperties, fromDate, throughDate])

  return { todos, completions, loading, loadError }
}

function isCompleted(completions: OperationalTodoCompletion[], taskId: string, date: string) {
  return completions.some((item) => item.id === todoCompletionId(taskId, date) && item.completed)
}

type Occurrence = { todo: OperationalTodo; date: string; done: boolean }

function occurrencesInRange(todos: OperationalTodo[], completions: OperationalTodoCompletion[], fromDate: string, throughDate: string) {
  const occurrences: Occurrence[] = []
  for (let date = fromDate; date <= throughDate; date = shiftTodoDate(date, 1)) {
    for (const todo of todos) {
      if (todoOccursOn(todo, date)) occurrences.push({ todo, date, done: isCompleted(completions, todo.id, date) })
    }
  }
  return occurrences.sort((a, b) => `${a.date}${a.todo.dueTime}${a.todo.title}`.localeCompare(`${b.date}${b.todo.dueTime}${b.todo.title}`))
}

export function TodoDashboardPreview({ selectedPropertyId, onOpen }: { selectedPropertyId: string; onOpen: () => void }) {
  const { profile, memberships } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || Boolean(membership)
  const [clockNow, setClockNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])
  const today = bangkokDateOnly(new Date(clockNow))
  const fromDate = shiftTodoDate(today, -14)
  const throughDate = shiftTodoDate(today, 14)
  const { todos, completions, loading, loadError } = useOperationalTodoData(selectedPropertyId, fromDate, throughDate, canRead)
  const { completed, overdue, upcoming } = useMemo(() => {
    const occurrences = occurrencesInRange(todos, completions, fromDate, throughDate)
    const timestamp = (item: Occurrence) => Date.parse(`${item.date}T${item.todo.dueTime}:00+07:00`)
    const completed = occurrences.filter((item) => item.done)
      .sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 3)
    const overdue = occurrences.filter((item) => !item.done && timestamp(item) < clockNow)
      .sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 3)
    const upcoming = occurrences.filter((item) => !item.done && timestamp(item) >= clockNow)
      .sort((a, b) => timestamp(a) - timestamp(b)).slice(0, 3)
    return { completed, overdue, upcoming }
  }, [todos, completions, fromDate, throughDate, clockNow])

  if (!canRead) return null
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-violet-700">{t('ปฏิทินงาน')}</p><h2 className="mt-1 font-semibold text-slate-900">{t('งานที่ต้องทำ')}</h2><p className="mt-1 text-sm text-slate-500">{t('แยกงานตามสถานะ พร้อมแจ้งรายการเกินกำหนด')}</p></div><button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-lotus-700 hover:bg-lotus-50" onClick={onOpen} type="button">{t('เปิดปฏิทิน')}</button></div>
    {loading ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500" role="status">{t('กำลังโหลดรายการ')}</p>
      : loadError ? <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{t('โหลดรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และ Firebase Emulator')}</p>
        : <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TodoPreviewColumn title={t('เสร็จแล้ว')} count={completed.length} icon="check" tone="emerald" emptyLabel={t('ไม่มีงานที่เสร็จแล้ว')}>
            {completed.map((item) => <TodoPreviewItem item={item} clockNow={clockNow} key={`${item.todo.id}-${item.date}`} />)}
          </TodoPreviewColumn>
          <TodoPreviewColumn title={t('ยังไม่เสร็จ')} count={overdue.length + upcoming.length} icon="clock" tone="slate" emptyLabel={t('ไม่มีงานที่ยังไม่เสร็จ')}>
            {overdue.length > 0 && <TodoPreviewGroup title={t('เกินกำหนด')} tone="amber">{overdue.map((item) => <TodoPreviewItem item={item} clockNow={clockNow} key={`${item.todo.id}-${item.date}`} />)}</TodoPreviewGroup>}
            {upcoming.length > 0 && <TodoPreviewGroup title={t('กำลังจะถึง')} tone="sky">{upcoming.map((item) => <TodoPreviewItem item={item} clockNow={clockNow} key={`${item.todo.id}-${item.date}`} />)}</TodoPreviewGroup>}
          </TodoPreviewColumn>
        </div>}
  </section>
}

function TodoPreviewGroup({ title, tone, children }: { title: string; tone: 'amber' | 'sky'; children: ReactNode }) {
  const color = tone === 'amber' ? 'text-amber-800' : 'text-sky-800'
  return <div className="mt-3 first:mt-1">
    <h4 className={`mb-1 flex items-center gap-2 text-xs font-semibold ${color}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'}`} />{title}
    </h4>
    <ul className="divide-y divide-slate-200/70">{children}</ul>
  </div>
}

function TodoPreviewColumn({ title, count, icon, tone, emptyLabel, children }: {
  title: string
  count: number
  icon: 'check' | 'clock'
  tone: 'emerald' | 'slate'
  emptyLabel: string
  children: ReactNode
}) {
  const colors = tone === 'emerald'
    ? { panel: 'border-emerald-200 bg-emerald-50/50', icon: 'bg-emerald-100 text-emerald-700', count: 'bg-emerald-100 text-emerald-800' }
    : { panel: 'border-slate-200 bg-slate-50/80', icon: 'bg-slate-200 text-slate-700', count: 'bg-slate-200 text-slate-700' }
  return <section aria-label={title} className={`rounded-2xl border p-4 ${colors.panel}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
          {icon === 'check'
            ? <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /></svg>
            : <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" /></svg>}
        </span>
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${colors.count}`}>{count}</span>
    </div>
    {count === 0 ? <p className="mt-4 rounded-xl bg-white/80 px-3 py-4 text-sm text-slate-500">{emptyLabel}</p>
      : <ul className="mt-3 divide-y divide-slate-200/70">{children}</ul>}
  </section>
}

function TodoPreviewItem({ item, clockNow }: { item: Occurrence; clockNow: number }) {
  const passed = Date.parse(`${item.date}T${item.todo.dueTime}:00+07:00`) < clockNow
  const status = item.done ? 'เสร็จสิ้น' : passed ? 'เกินกำหนด' : 'กำลังจะถึง'
  const statusStyle = item.done
    ? 'bg-emerald-100 text-emerald-800'
    : passed ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-800'
  const dateStyle = item.done
    ? 'bg-emerald-100/80 text-emerald-800'
    : passed ? 'bg-amber-100 text-amber-900' : 'bg-violet-100 text-violet-800'
  return <li className={`flex items-start gap-3 py-3 first:pt-1 last:pb-1 ${passed && !item.done ? 'rounded-xl bg-amber-50/70 px-2' : ''}`}>
    <span className={`min-w-[3.5rem] rounded-xl px-2 py-1.5 text-center text-xs font-semibold ${dateStyle}`}>{formatDay(item.date)}<span className="mt-0.5 block font-normal">{item.todo.dueTime}</span></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        {!item.done && passed && <svg aria-label={t('เกินกำหนด')} className="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>}
        <p className={`text-sm font-semibold ${item.done ? 'text-slate-500' : 'text-slate-800'}`}>{item.todo.title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle}`}>{t(status)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{todoCategoryLabel(item.todo.kind)}{item.todo.room ? ` · ${t('ห้อง')} ${item.todo.room}` : ''} · {item.todo.assignee}</p>
      {item.todo.propertyCode && <p className="mt-1 text-[11px] text-slate-400">{item.todo.propertyCode}</p>}
    </div>
  </li>
}

export function TodoCalendar({ selectedPropertyId, propertyCode, propertyName }: { selectedPropertyId: string; propertyCode: string; propertyName: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || Boolean(membership)
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  const selectedPropertyNeeded = selectedPropertyId === 'all'
  const canReadSelectedPropertySettings = selectedPropertyId !== 'all' && canManage
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const [clockNow, setClockNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  const today = bangkokDateOnly(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [showForm, setShowForm] = useState(false)
  const [formPropertyId, setFormPropertyId] = useState('')
  const [formMeetingRoomEnabled, setFormMeetingRoomEnabled] = useState(false)
  const [formPropertySettingsLoaded, setFormPropertySettingsLoaded] = useState(false)
  const [propertyTodoCategories, setPropertyTodoCategories] = useState<string[]>(defaultTodoCategories)
  const [formTodoCategories, setFormTodoCategories] = useState<string[]>(defaultTodoCategories)
  const [editingTodo, setEditingTodo] = useState<OperationalTodo | null>(null)
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TodoKind>('General')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('09:00')
  const [room, setRoom] = useState('')
  const [assignee, setAssignee] = useState('')
  const [recurrence, setRecurrence] = useState<TodoRepeat>('None')
  const [checklist, setChecklist] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyOccurrence, setBusyOccurrence] = useState<string | null>(null)
  const [busyTodo, setBusyTodo] = useState<string | null>(null)
  const [operationError, setOperationError] = useState('')
  const [settings, setSettings] = useState<{ meetingRoomCareEnabled: boolean } | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => { const cell = new Date(start); cell.setDate(start.getDate() + index); return cell })
  }, [month])
  const fromDate = asDateOnly(cells[0])
  const throughDate = asDateOnly(cells[cells.length - 1])
  const { todos, completions, loading, loadError } = useOperationalTodoData(selectedPropertyId, fromDate, throughDate, canRead)
  const occurrences = useMemo(() => occurrencesInRange(todos, completions, fromDate, throughDate), [todos, completions, fromDate, throughDate])
  const dayItems = occurrences.filter((item) => item.date === selectedDate)
  const completedDayItems = dayItems.filter((item) => item.done)
  const openDayItems = dayItems.filter((item) => !item.done).sort((a, b) => {
    const aOverdue = Date.parse(`${a.date}T${a.todo.dueTime}:00+07:00`) < clockNow
    const bOverdue = Date.parse(`${b.date}T${b.todo.dueTime}:00+07:00`) < clockNow
    return Number(bOverdue) - Number(aOverdue) || a.todo.dueTime.localeCompare(b.todo.dueTime)
  })
  const openCount = occurrences.filter((item) => !item.done && item.date >= today).length
  const formProperty = properties.find((property) => property.id === formPropertyId)

  useEffect(() => {
    setSettings(null)
    if (!canReadSelectedPropertySettings) { setSettings(null); setSettingsLoaded(true); return }
    setSettingsLoaded(false)
    return subscribeToOperationalTodoSettings(selectedPropertyId, (value) => { setSettings(value); setSettingsLoaded(true) }, () => { setOperationError(t('โหลดการตั้งค่าไม่สำเร็จ')); setSettingsLoaded(true) })
  }, [canReadSelectedPropertySettings, selectedPropertyId])

  useEffect(() => {
    setPropertyTodoCategories(defaultTodoCategories)
    if (selectedPropertyNeeded || !selectedPropertyId || !canRead) return
    return subscribeToTicketCatalog(selectedPropertyId, (catalog) => setPropertyTodoCategories(catalog.todoCategories), () => setPropertyTodoCategories(defaultTodoCategories))
  }, [canRead, selectedPropertyId, selectedPropertyNeeded])

  useEffect(() => {
    if (!showForm || !selectedPropertyNeeded || !formPropertyId) {
      setFormMeetingRoomEnabled(false)
      setFormTodoCategories(defaultTodoCategories)
      setFormPropertySettingsLoaded(!selectedPropertyNeeded)
      return
    }
    setFormPropertySettingsLoaded(false)
    const stopSettings = subscribeToOperationalTodoSettings(formPropertyId, (value) => {
      setFormMeetingRoomEnabled(value?.meetingRoomCareEnabled === true)
      setFormPropertySettingsLoaded(true)
    }, () => {
      setFormMeetingRoomEnabled(false)
      setFormPropertySettingsLoaded(true)
    })
    const stopCatalog = subscribeToTicketCatalog(formPropertyId, (catalog) => setFormTodoCategories(catalog.todoCategories), () => setFormTodoCategories(defaultTodoCategories))
    return () => { stopSettings(); stopCatalog() }
  }, [showForm, selectedPropertyNeeded, formPropertyId])

  async function saveTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser) return
    const targetPropertyId = selectedPropertyNeeded ? formPropertyId : selectedPropertyId
    const targetPropertyCode = selectedPropertyNeeded ? formProperty?.code ?? '' : propertyCode
    if (!targetPropertyId) {
      setFormError(t('เลือก Property ก่อนบันทึกรายการ'))
      return
    }
    const roomCareEnabled = selectedPropertyNeeded ? formMeetingRoomEnabled : settings?.meetingRoomCareEnabled === true
    if (kind === 'Meeting Room' && selectedPropertyNeeded && !formPropertySettingsLoaded) {
      setFormError(t('กำลังโหลดการตั้งค่า'))
      return
    }
    if (kind === 'Meeting Room' && !roomCareEnabled && editingTodo?.kind !== 'Meeting Room') {
      setFormError(t('Property นี้ยังไม่ได้เปิดงานห้องประชุม'))
      return
    }
    if (!title.trim() || !date || !time || !assignee.trim() || (kind === 'Meeting Room' && !room.trim())) {
      setFormError(t('กรอกชื่อ วันที่ เวลา ผู้รับผิดชอบ และห้องประชุมให้ครบ'))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const input = { title, kind, startDate: date, dueTime: time, room, assignee, repeat: recurrence, checklistText: checklist }
      if (editingTodo) {
        if (!editingOccurrenceDate) throw new Error('Missing occurrence date')
        await updateOperationalTodo(editingTodo, editingOccurrenceDate, input)
      } else await createOperationalTodo(targetPropertyId, targetPropertyCode, input, firebaseUser.uid)
      const returnDate = editingOccurrenceDate ?? date
      setSelectedDate(returnDate)
      setMonth(new Date(`${returnDate}T00:00:00`))
      closeTodoForm()
    } catch {
      setFormError(editingTodo && editingOccurrenceDate && !canEditTodoOccurrence(editingTodo, editingOccurrenceDate)
        ? t('เลยเวลาแก้ไขแล้ว')
        : t('บันทึกงานไม่สำเร็จ กรุณาตรวจสอบ Firebase Emulator และข้อมูล'))
    } finally { setSaving(false) }
  }

  function closeTodoForm() {
    setShowForm(false)
    setEditingTodo(null)
    setEditingOccurrenceDate(null)
    setFormPropertyId('')
    setTitle('')
    setKind('General')
    setDate(today)
    setTime('09:00')
    setRoom('')
    setAssignee('')
    setRecurrence('None')
    setChecklist('')
    setFormError('')
  }

  function beginEdit(todo: OperationalTodo, occurrenceDate: string) {
    if (!canEditTodoOccurrence(todo, occurrenceDate)) {
      setOperationError(t('เลยเวลาแก้ไขแล้ว'))
      return
    }
    setEditingTodo(todo)
    setEditingOccurrenceDate(occurrenceDate)
    setTitle(todo.title)
    setKind(todo.kind)
    setDate(todo.startDate)
    setTime(todo.dueTime)
    setRoom(todo.room)
    setAssignee(todo.assignee)
    setRecurrence(todo.repeat)
    setChecklist(todo.checklistText)
    setFormError('')
    setShowForm(true)
    requestAnimationFrame(() => document.getElementById('todo-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function removeTodo(todo: OperationalTodo) {
    if (!window.confirm(t('เก็บรายการนี้ออกจากปฏิทินหรือไม่? ประวัติเดิมจะยังอยู่'))) return
    setBusyTodo(todo.id)
    setOperationError('')
    try { await archiveOperationalTodo(todo.id) }
    catch { setOperationError(t('เก็บรายการไม่สำเร็จ ตรวจสอบ Firebase Emulator และสิทธิ์')) }
    finally { setBusyTodo(null) }
  }

  async function markOccurrence(occurrence: Occurrence, completed: boolean) {
    if (!firebaseUser) return
    const key = todoCompletionId(occurrence.todo.id, occurrence.date)
    setBusyOccurrence(key)
    setOperationError('')
    try { await setOperationalTodoCompletion(occurrence.todo, occurrence.date, completed, firebaseUser.uid) }
    catch { setOperationError(t('เปลี่ยนสถานะไม่สำเร็จ ตรวจสอบ Firebase Emulator และสิทธิ์')) }
    finally { setBusyOccurrence(null) }
  }

  function renderDayOccurrence(item: Occurrence) {
    const completionKey = todoCompletionId(item.todo.id, item.date)
    const canEditOccurrence = canEditTodoOccurrence(item.todo, item.date, clockNow)
    const overdue = !item.done && Date.parse(`${item.date}T${item.todo.dueTime}:00+07:00`) < clockNow
    return <li className="py-3 first:pt-1 last:pb-1" key={completionKey}>
      <div className="flex items-start gap-3">
        <input aria-label={`${t('ทำเครื่องหมายเสร็จ')}: ${item.todo.title}`} checked={item.done} className="mt-1 rounded border-slate-300 text-lotus-700 focus:ring-lotus-500" disabled={!canManage || busyOccurrence === completionKey || busyTodo === item.todo.id} onChange={(event) => void markOccurrence(item, event.target.checked)} type="checkbox" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-slate-500">{item.todo.dueTime}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.todo.kind === 'Meeting Room' ? 'bg-violet-50 text-violet-800' : 'bg-sky-50 text-sky-800'}`}>{todoCategoryLabel(item.todo.kind)}</span>
            {overdue && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">{t('เกินกำหนด')}</span>}
            {item.todo.propertyCode && selectedPropertyNeeded && <span className="text-[10px] text-slate-400">{item.todo.propertyCode}</span>}
          </div>
          <p className={`mt-1.5 text-sm font-semibold ${item.done ? 'text-slate-500' : 'text-slate-800'}`}>{item.todo.title}</p>
          <p className="mt-1 text-xs text-slate-500">{item.todo.room ? `${t('ห้อง')} ${item.todo.room} · ` : ''}{t('ผู้รับผิดชอบ')}: {item.todo.assignee}</p>
          {item.todo.repeat !== 'None' && <p className="mt-1 text-xs text-violet-700">{t(item.todo.repeat === 'Weekly' ? 'ทุกสัปดาห์' : 'ทุกเดือน')}</p>}
          {item.todo.checklistText && <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{t('Checklist')}: {item.todo.checklistText}</p>}
          {canManage && !selectedPropertyNeeded && <div className="mt-2 flex flex-wrap items-center gap-3">{canEditOccurrence ? <button className="text-xs font-semibold text-lotus-700 hover:underline disabled:opacity-50" disabled={busyTodo === item.todo.id} onClick={() => beginEdit(item.todo, item.date)} type="button">{t('แก้ไข')}</button> : <span className="text-xs text-slate-400">{t('เลยเวลาแก้ไขแล้ว')}</span>}<button className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50" disabled={busyTodo === item.todo.id} onClick={() => void removeTodo(item.todo)} type="button">{busyTodo === item.todo.id ? t('กำลังบันทึก') : t('เก็บออกจากปฏิทิน')}</button></div>}
        </div>
      </div>
    </li>
  }

  if (accessState !== 'ready' || !canRead) return <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{t('บัญชีนี้ไม่มีสิทธิ์อ่านปฏิทินงาน')}</div>
  const meetingRoomEnabled = settings?.meetingRoomCareEnabled === true
  const canAddMeetingRoomTodo = selectedPropertyNeeded ? formMeetingRoomEnabled : meetingRoomEnabled
  const availableTodoCategories = (selectedPropertyNeeded ? formTodoCategories : propertyTodoCategories)
    .filter((category) => category !== 'Meeting Room' || canAddMeetingRoomTodo || editingTodo?.kind === 'Meeting Room' || kind === 'Meeting Room')
  if (kind && !availableTodoCategories.includes(kind)) availableTodoCategories.push(kind)

  return <div className="mt-6 space-y-5">
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-violet-700">{t('ปฏิทินงาน')}</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{t('ปฏิทินงานดูแล')}</h2><p className="mt-1 text-sm text-slate-500">{propertyName} · {t('จัดตารางงานและติดตามผู้รับผิดชอบ')}</p></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"><span className="rounded-full bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{openCount} {t('งานที่ยังไม่เสร็จ')}</span><button className="rounded-full bg-lotus-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-lotus-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canManage || (!selectedPropertyNeeded && !settingsLoaded)} onClick={() => { if (showForm) closeTodoForm(); else { setFormPropertyId(selectedPropertyNeeded ? '' : selectedPropertyId); setShowForm(true); setEditingTodo(null); setFormError('') } }} type="button">{showForm ? t('ปิดฟอร์ม') : `+ ${t('เพิ่มงาน To-do')}`}</button></div></div>
      {loadError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{t('โหลดรายการไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และ Firebase Emulator')}</p>}
      {operationError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{operationError}</p>}
    </section>

    {showForm && <form className="scroll-mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" id="todo-editor" onSubmit={(event) => void saveTodo(event)}>
      <div className="mb-4"><h2 className="font-semibold text-slate-900">{t(editingTodo ? 'แก้ไขงาน To-do' : 'เพิ่มงาน To-do')}</h2><p className="mt-1 text-sm text-slate-500">{t('จัดตารางงานและติดตามผู้รับผิดชอบ')}</p></div>
      {formError && <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{formError}</p>}
      {selectedPropertyNeeded && <div className="mb-4 max-w-xl"><label className="block text-sm font-medium text-slate-700">{t('Property')}<select className="form-select mt-1.5 w-full" onChange={(event) => setFormPropertyId(event.target.value)} required value={formPropertyId}><option value="">{t('เลือก Property')}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.code} · {property.name}</option>)}</select></label>{formPropertyId && !formPropertySettingsLoaded && <p className="mt-1 text-xs text-slate-500">{t('กำลังโหลดการตั้งค่า')}</p>}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">{t('ชื่อรายการ')}<input className="form-input mt-1.5 w-full" maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder={t('เช่น ตรวจความพร้อมก่อนประชุม')} required value={title} /></label>
        <div><label className="text-sm font-medium text-slate-700">{t('หมวดงาน')}<select className="form-select mt-1.5 w-full" onChange={(event) => setKind(event.target.value as TodoKind)} value={kind}>{availableTodoCategories.map((category) => <option key={category} value={category}>{todoCategoryLabel(category)}</option>)}</select></label>{canManage && <p className="mt-1 text-xs text-slate-500">{t('ปรับรายการหมวดงานได้ในเมนูตั้งค่ารายการ')}</p>}</div>
        <label className="text-sm font-medium text-slate-700">{t('วันที่')}<input className="form-input mt-1.5 w-full" onChange={(event) => setDate(event.target.value)} required type="date" value={date} /></label>
        <label className="text-sm font-medium text-slate-700">{t('เวลา')}<input className="form-input mt-1.5 w-full" onChange={(event) => setTime(event.target.value)} required type="time" value={time} /></label>
        {kind === 'Meeting Room' && <label className="text-sm font-medium text-slate-700">{t('ห้องประชุม')}<input className="form-input mt-1.5 w-full" maxLength={120} onChange={(event) => setRoom(event.target.value)} placeholder={t('เช่น Orchid')} required value={room} /></label>}
        <label className="text-sm font-medium text-slate-700">{t('ผู้รับผิดชอบ')}<input className="form-input mt-1.5 w-full" maxLength={120} onChange={(event) => setAssignee(event.target.value)} placeholder={t('ชื่อผู้รับผิดชอบ')} required value={assignee} /></label>
        <label className="text-sm font-medium text-slate-700">{t('ทำซ้ำ')}<select className="form-select mt-1.5 w-full" onChange={(event) => setRecurrence(event.target.value as TodoRepeat)} value={recurrence}><option value="None">{t('ไม่ทำซ้ำ')}</option><option value="Weekly">{t('ทุกสัปดาห์')}</option><option value="Monthly">{t('ทุกเดือน')}</option></select></label>
        {kind === 'Meeting Room' && <label className="text-sm font-medium text-slate-700 sm:col-span-2">{t('Checklist')}<textarea className="form-textarea mt-1.5 min-h-24 w-full" maxLength={1200} onChange={(event) => setChecklist(event.target.value)} placeholder={t('เช่น จอภาพ, HDMI, ไมโครโฟน, รีโมต')} value={checklist} /></label>}
      </div>
      <div className="mt-5 flex justify-end gap-2"><button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600" onClick={closeTodoForm} type="button">{t('ยกเลิก')}</button><button className="rounded-full bg-lotus-700 px-5 py-2 text-sm font-semibold text-white hover:bg-lotus-800 disabled:opacity-50" disabled={saving} type="submit">{saving ? t('กำลังบันทึก') : t(editingTodo ? 'บันทึกการแก้ไข' : 'บันทึกงาน')}</button></div>
    </form>}

    <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><button aria-label={t('เดือนก่อน')} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setMonth((value) => moveMonth(value, -1))} type="button">‹</button><div className="text-center"><h2 className="font-semibold text-slate-900">{new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(month)}</h2><button className="mt-1 text-xs font-medium text-lotus-700 hover:underline" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(today) }} type="button">{t('วันนี้')}</button></div><button aria-label={t('เดือนถัดไป')} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setMonth((value) => moveMonth(value, 1))} type="button">›</button></div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(getLocale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + index))).replace('.', '')).map((day, index) => <div className="py-2 text-center text-[11px] font-semibold text-slate-400" key={`${day}-${index}`}>{day}</div>)}{cells.map((cell) => {
          const value = asDateOnly(cell)
          const dayOccurrences = occurrences.filter((item) => item.date === value)
          const count = dayOccurrences.length
          const hasOverdue = dayOccurrences.some((item) => !item.done && Date.parse(`${item.date}T${item.todo.dueTime}:00+07:00`) < clockNow)
          const hasUpcoming = dayOccurrences.some((item) => !item.done && Date.parse(`${item.date}T${item.todo.dueTime}:00+07:00`) >= clockNow)
          const hasCompleted = dayOccurrences.some((item) => item.done)
          const inMonth = cell.getMonth() === month.getMonth()
          return <button aria-label={`${formatDay(value, { weekday: 'long', day: 'numeric', month: 'long' })}${count ? ` · ${count} ${t('รายการ')}` : ''}`} aria-pressed={selectedDate === value} className={`min-h-[4.7rem] rounded-xl border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-lotus-400 ${selectedDate === value ? 'border-lotus-500 bg-lotus-50 ring-1 ring-lotus-500' : inMonth ? 'border-slate-100 bg-white hover:border-lotus-200 hover:bg-lotus-50/50' : 'border-transparent bg-slate-50/60 text-slate-600'}`} key={value} onClick={() => setSelectedDate(value)} type="button">
            <span className="text-xs font-semibold tabular-nums">{cell.getDate()}</span>
            {count > 0 && <span className="mt-2 flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="flex shrink-0 items-center gap-0.5">{hasOverdue && <i className="h-1.5 w-1.5 rounded-full bg-amber-500" />}{hasUpcoming && <i className="h-1.5 w-1.5 rounded-full bg-sky-500" />}{hasCompleted && <i className="h-1.5 w-1.5 rounded-full bg-lotus-500" />}</span>
              <span className="truncate text-[10px] text-slate-500">{count} {t('รายการ')}</span>
            </span>}
          </button>
        })}</div>
        <p className="mt-4 text-xs text-slate-400">{t('เลือกวันที่เพื่อดูรายการ และกดวันที่อื่นเพื่อเปลี่ยนมุมมอง')}</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-violet-700">{t('กำหนดการ')}</p><h2 className="mt-1 font-semibold text-slate-900">{formatDay(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2></div><span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">{dayItems.length} {t('รายการ')}</span></div>
        {loading ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500" role="status">{t('กำลังโหลดรายการ')}</p> : dayItems.length === 0 ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{t('ไม่มีงานในวันที่เลือก')}</div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TodoPreviewColumn title={t('เสร็จแล้ว')} count={completedDayItems.length} icon="check" tone="emerald" emptyLabel={t('ไม่มีงานที่เสร็จแล้ว')}>
            {completedDayItems.length > 0 && <ul className="divide-y divide-slate-200/70">{completedDayItems.map(renderDayOccurrence)}</ul>}
          </TodoPreviewColumn>
          <TodoPreviewColumn title={t('ยังไม่เสร็จ')} count={openDayItems.length} icon="clock" tone="slate" emptyLabel={t('ไม่มีงานที่ยังไม่เสร็จ')}>
            {openDayItems.length > 0 && <ul className="divide-y divide-slate-200/70">{openDayItems.map(renderDayOccurrence)}</ul>}
          </TodoPreviewColumn>
        </div>}
      </div>
    </section>
    <p className="text-xs leading-5 text-slate-500">{t('รายการและสถานะบันทึกใน Firestore ของ Property ที่เลือก ส่วนงานประจำแสดงเป็นวันที่เกิดซ้ำโดยเก็บรายการหลักเพียงรายการเดียว')}</p>
  </div>
}
