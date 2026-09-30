import { t } from '../../lib/i18n'
import { sortByLabel } from '../../lib/sortOptions'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { setPropertySlaPolicy } from '../property/propertySettingsService'
import {
  addTicketCatalogOption,
  defaultAssetCategories,
  defaultDepartments,
  defaultProblemTypes,
  defaultTicketChannels,
  defaultTodoCategories,
  makeProblemType,
  removeProblemTypeGroup,
  removeTicketCatalogOption,
  renameProblemTypeGroup,
  renameTicketCatalogOption,
  splitProblemType,
  subscribeToTicketCatalog,
  type TicketCatalog,
  type TicketCatalogListField,
} from '../tickets/ticketCatalogService'
import { formatTicketChannel } from '../tickets/types'
import { SlaPolicyEditor } from './SlaPolicyEditor'
import type { SlaPolicyConfig } from '../../../shared/sla-contracts'

type CatalogField = TicketCatalogListField

function CatalogEditor({
  title,
  values,
  field,
  onAdd,
  onRename,
  saving,
}: {
  title: string
  values: string[]
  field: CatalogField
  onAdd: (field: CatalogField, value: string) => Promise<void>
  onRename: (field: CatalogField, oldValue: string, value: string) => Promise<void>
  saving: boolean
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const displayValue = (item: string) =>
    field === 'channels'
      ? formatTicketChannel(item)
      : field === 'todoCategories' && item === 'General'
        ? t('งานทั่วไป')
        : field === 'todoCategories' && item === 'Meeting Room'
          ? t('ดูแลห้องประชุม')
          : item
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await onAdd(field, value)
      setValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มรายการไม่สำเร็จ')
    }
  }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setError(null)
    try {
      await onRename(field, editing, editValue)
      setEditing(null)
      setEditValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'แก้ไขรายการไม่สำเร็จ')
    }
  }
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {values.length}
          {t('/100 รายการ')}
        </span>
      </div>
      <form className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submit}>
        <label className="sr-only" htmlFor={`catalog-${field}`}>
          {t('เพิ่ม')}
          {title}
        </label>
        <input
          className="form-input w-full min-w-0"
          id={`catalog-${field}`}
          maxLength={80}
          onChange={(event) => setValue(event.target.value)}
          placeholder={`เพิ่ม${title}`}
          required
          value={value}
        />
        <button
          className="min-h-11 rounded-full bg-lotus-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving || !value.trim() || values.length >= 100}
          type="submit"
        >
          {saving ? t('กำลังบันทึก…') : t('เพิ่มรายการ')}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      <ul className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {values.map((item) => {
          const defaults =
            field === 'problemTypes'
              ? defaultProblemTypes
              : field === 'departments'
                ? defaultDepartments
                : field === 'assetCategories'
                  ? defaultAssetCategories
                  : field === 'channels'
                    ? defaultTicketChannels
                    : defaultTodoCategories
          const isDefault = defaults.includes(item)
          return (
            <li className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm" key={item}>
              {editing === item ? (
                <form className="grid min-w-0 grid-cols-1 gap-2" onSubmit={submitEdit}>
                  <label className="sr-only" htmlFor={`edit-${field}`}>
                    {t('แก้ไข')} {item}
                  </label>
                  <input
                    autoFocus
                    className="form-input w-full min-w-0"
                    id={`edit-${field}`}
                    maxLength={80}
                    onChange={(event) => setEditValue(event.target.value)}
                    required
                    value={editValue}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-9 rounded-full bg-lotus-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={saving || !editValue.trim()}
                      type="submit"
                    >
                      {t('บันทึก')}
                    </button>
                    <button
                      className="min-h-9 rounded-full px-4 py-1.5 text-xs text-slate-600 hover:bg-white"
                      onClick={() => {
                        setEditing(null)
                        setError(null)
                      }}
                      type="button"
                    >
                      {t('ยกเลิก')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words">{displayValue(item)}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {isDefault ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                        {t('มาตรฐาน')}
                      </span>
                    ) : (
                      <button
                        className="min-h-8 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-lotus-700 hover:bg-lotus-50 disabled:opacity-50"
                        disabled={saving}
                        onClick={() => {
                          setEditing(item)
                          setEditValue(item)
                          setError(null)
                        }}
                        type="button"
                      >
                        {t('แก้ไข')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        {t(
          'แก้ไขได้เฉพาะรายการที่เพิ่มเอง รายการมาตรฐานของระบบคงไว้เพื่อให้ข้อมูลที่อ้างอิงเดิมและตัวกรอง Asset ทำงานต่อได้',
        )}
      </p>
    </section>
  )
}

function ProblemTypeEditor({
  values,
  onAdd,
  onRename,
  onRemove,
  onRenameGroup,
  onRemoveGroup,
  saving,
}: {
  values: string[]
  onAdd: (value: string) => Promise<void>
  onRename: (oldValue: string, value: string) => Promise<void>
  onRemove: (value: string) => Promise<void>
  onRenameGroup: (oldGroup: string, value: string) => Promise<void>
  onRemoveGroup: (group: string) => Promise<void>
  saving: boolean
}) {
  const groups = values.reduce<Record<string, { value: string; item: string }[]>>((result, value) => {
    const parsed = splitProblemType(value)
    ;(result[parsed.group] ??= []).push({ value, item: parsed.item })
    return result
  }, {})
  const [group, setGroup] = useState('Hardware')
  const [item, setItem] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editGroup, setEditGroup] = useState('')
  const [editItem, setEditItem] = useState('')
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await onAdd(makeProblemType(group, item))
      setItem('')
      setNotice(t('เพิ่มประเภทปัญหาแล้ว'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่มรายการไม่สำเร็จ')
    }
  }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setError(null)
    try {
      await onRename(editing, makeProblemType(editGroup, editItem))
      setEditing(null)
      setNotice(t('แก้ไขประเภทปัญหาแล้ว'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'แก้ไขรายการไม่สำเร็จ')
    }
  }
  async function saveGroupName(event: FormEvent<HTMLFormElement>, oldGroup: string) {
    event.preventDefault()
    setError(null)
    try {
      await onRenameGroup(oldGroup, groupDraft)
      setRenamingGroup(null)
      setNotice(`เปลี่ยนชื่อหมวดเป็น “${groupDraft.trim()}” แล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'แก้ไขหมวดไม่สำเร็จ')
    }
  }
  async function deleteGroup(name: string) {
    if (!window.confirm(`ลบหมวด “${name}” และประเภทย่อยทั้งหมดใช่หรือไม่`)) return
    setError(null)
    try {
      await onRemoveGroup(name)
      setNotice(`ลบหมวด “${name}” แล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบหมวดไม่สำเร็จ')
    }
  }
  async function deleteItem(value: string) {
    const { item: label } = splitProblemType(value)
    if (!window.confirm(`ลบประเภท “${label}” ใช่หรือไม่`)) return
    setError(null)
    try {
      await onRemove(value)
      setNotice(`ลบประเภท “${label}” แล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบรายการไม่สำเร็จ')
    }
  }
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/70 sm:p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t('ประเภทปัญหา')}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {t(`${values.length} /100 รายการ`)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {t('จัดกลุ่มเพื่อให้เลือกประเภทปัญหาในหน้า Create Task ได้ง่ายขึ้น')}
      </p>
      <form
        className="mt-4 grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        onSubmit={submitAdd}
      >
        <label className="sr-only" htmlFor="problem-type-group">
          {t('หมวดปัญหา')}
        </label>
        <input
          className="form-input w-full min-w-0"
          id="problem-type-group"
          list="problem-type-groups"
          maxLength={80}
          onChange={(event) => setGroup(event.target.value)}
          placeholder={t('หมวด เช่น Hardware')}
          required
          value={group}
        />
        <datalist id="problem-type-groups">
          {Object.keys(groups).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <label className="sr-only" htmlFor="problem-type-item">
          {t('ประเภทย่อย')}
        </label>
        <input
          className="form-input w-full min-w-0"
          id="problem-type-item"
          maxLength={80}
          onChange={(event) => setItem(event.target.value)}
          placeholder={t('ประเภทย่อย เช่น Computer PC')}
          required
          value={item}
        />
        <button
          className="min-h-11 rounded-full bg-lotus-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2 xl:col-span-1"
          disabled={saving || !group.trim() || !item.trim() || values.length >= 100}
          type="submit"
        >
          {t('เพิ่มรายการ')}
        </button>
      </form>
      {(error || notice) && (
        <p className={`mt-3 text-sm ${error ? 'text-red-700' : 'text-emerald-700'}`} role={error ? 'alert' : 'status'}>
          {t(error || notice)}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {Object.entries(groups)
          .sort(([a], [b]) => a.localeCompare(b, 'en'))
          .map(([name, items]) => (
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4" key={name}>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="break-words font-semibold">{name}</h3>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {renamingGroup === name ? (
                    <form
                      className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      onSubmit={(event) => saveGroupName(event, name)}
                    >
                      <label className="sr-only" htmlFor={`rename-group-${name}`}>
                        {t('ชื่อหมวดใหม่')}
                      </label>
                      <input
                        className="form-input w-full min-w-0"
                        id={`rename-group-${name}`}
                        maxLength={80}
                        onChange={(event) => setGroupDraft(event.target.value)}
                        required
                        value={groupDraft}
                      />
                      <button
                        className="min-h-9 rounded-full bg-lotus-600 px-4 py-1.5 text-xs font-semibold text-white"
                        disabled={saving}
                        type="submit"
                      >
                        {t('บันทึก')}
                      </button>
                      <button
                        className="min-h-9 rounded-full px-4 py-1.5 text-xs"
                        onClick={() => setRenamingGroup(null)}
                        type="button"
                      >
                        {t('ยกเลิก')}
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        className="min-h-9 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-lotus-700"
                        onClick={() => {
                          setRenamingGroup(name)
                          setGroupDraft(name)
                          setError(null)
                        }}
                        type="button"
                      >
                        {t('แก้ไขหมวด')}
                      </button>
                      <button
                        className="min-h-9 rounded-full border border-rose-200 bg-white px-4 py-1.5 text-xs font-medium text-rose-700"
                        disabled={saving}
                        onClick={() => deleteGroup(name)}
                        type="button"
                      >
                        {t('ลบหมวด')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <ul className="mt-3 grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-2">
                {items.map(({ value, item: label }) => (
                  <li className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-sm" key={value}>
                    {editing === value ? (
                      <form className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" onSubmit={submitEdit}>
                        <label className="sr-only" htmlFor="edit-problem-group">
                          {t('หมวด')}
                        </label>
                        <input
                          className="form-input w-full min-w-0"
                          id="edit-problem-group"
                          maxLength={80}
                          onChange={(event) => setEditGroup(event.target.value)}
                          required
                          value={editGroup}
                        />
                        <label className="sr-only" htmlFor="edit-problem-item">
                          {t('ประเภทย่อย')}
                        </label>
                        <input
                          autoFocus
                          className="form-input w-full min-w-0"
                          id="edit-problem-item"
                          maxLength={80}
                          onChange={(event) => setEditItem(event.target.value)}
                          required
                          value={editItem}
                        />
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <button
                            className="min-h-9 rounded-full bg-lotus-600 px-4 py-1.5 text-xs font-semibold text-white"
                            disabled={saving}
                            type="submit"
                          >
                            {t('บันทึก')}
                          </button>
                          <button
                            className="min-h-9 rounded-full px-4 py-1.5 text-xs"
                            onClick={() => setEditing(null)}
                            type="button"
                          >
                            {t('ยกเลิก')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-words">{label}</span>
                        <div className="flex shrink-0 gap-2">
                          <button
                            className="min-h-8 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-lotus-700"
                            onClick={() => {
                              setEditing(value)
                              setEditGroup(name)
                              setEditItem(label)
                              setError(null)
                            }}
                            type="button"
                          >
                            {t('แก้ไข')}
                          </button>
                          <button
                            className="min-h-8 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700"
                            disabled={saving}
                            onClick={() => deleteItem(value)}
                            type="button"
                          >
                            {t('ลบ')}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </section>
  )
}

export function TicketCatalogSettings({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const [propertyId, setPropertyId] = useState(
    selectedPropertyId === 'all' ? (properties[0]?.id ?? '') : selectedPropertyId,
  )
  const property = properties.find((item) => item.id === propertyId)
  const membership = memberships.find((item) => item.propertyId === propertyId)
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  const [catalog, setCatalog] = useState<TicketCatalog>({
    propertyId: '',
    propertyCode: '',
    problemTypes: defaultProblemTypes,
    departments: defaultDepartments,
    assetCategories: defaultAssetCategories,
    channels: [...defaultTicketChannels],
    todoCategories: [...defaultTodoCategories],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSla, setSavingSla] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (selectedPropertyId !== 'all') setPropertyId(selectedPropertyId)
    else if (!properties.some((item) => item.id === propertyId)) setPropertyId(properties[0]?.id ?? '')
  }, [selectedPropertyId, properties, propertyId])
  useEffect(() => {
    if (!propertyId || !canManage) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    return subscribeToTicketCatalog(
      propertyId,
      (value) => {
        setCatalog(value)
        setLoading(false)
      },
      () => {
        setError(t('โหลดรายการตั้งค่าไม่สำเร็จ ตรวจสอบ Firestore Rules'))
        setLoading(false)
      },
    )
  }, [propertyId, canManage])
  async function addOption(field: CatalogField, value: string) {
    if (!firebaseUser || !property) throw new Error(t('ไม่พบผู้ใช้หรือ Property ที่เลือก'))
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await addTicketCatalogOption(property.id, property.code, field, value, firebaseUser.uid)
      setNotice(`เพิ่มรายการ “${value.trim()}” แล้ว`)
    } finally {
      setSaving(false)
    }
  }
  async function renameOption(field: CatalogField, oldValue: string, value: string) {
    if (!firebaseUser || !property) throw new Error(t('ไม่พบผู้ใช้หรือ Property ที่เลือก'))
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await renameTicketCatalogOption(property.id, property.code, field, oldValue, value, firebaseUser.uid)
      setNotice(`แก้ไข “${oldValue}” เป็น “${value.trim()}” แล้ว`)
    } finally {
      setSaving(false)
    }
  }
  async function removeOption(value: string) {
    if (!property) throw new Error(t('ไม่พบ Property ที่เลือก'))
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await removeTicketCatalogOption(property.id, 'problemTypes', value)
    } finally {
      setSaving(false)
    }
  }
  async function renameGroup(oldGroup: string, value: string) {
    if (!property) throw new Error(t('ไม่พบ Property ที่เลือก'))
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await renameProblemTypeGroup(property.id, oldGroup, value)
    } finally {
      setSaving(false)
    }
  }
  async function removeGroup(group: string) {
    if (!property) throw new Error(t('ไม่พบ Property ที่เลือก'))
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await removeProblemTypeGroup(property.id, group)
    } finally {
      setSaving(false)
    }
  }
  async function saveSlaPolicy(policy: SlaPolicyConfig) {
    if (!property) throw new Error(t('ไม่พบ Property ที่เลือก'))
    setSavingSla(true)
    setError(null)
    setNotice(null)
    try {
      await setPropertySlaPolicy(property.id, policy)
      setNotice(t('บันทึก SLA แล้ว'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('บันทึก SLA ไม่สำเร็จ'))
    } finally {
      setSavingSla(false)
    }
  }
  if (accessState === 'loading')
    return (
      <p className="py-10 text-center text-sm text-slate-500" role="status">
        {t('กำลังตรวจสอบสิทธิ์…')}
      </p>
    )
  if (!canManage)
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">
        {t('หน้านี้เปิดให้ Super Admin และ IT Support Engineer เท่านั้น')}
      </p>
    )
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-lotus-700">{t('SYSTEM CONFIGURATION')}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{t('ตั้งค่ารายการ')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {t('รายการแยกตาม Property ใช้ใน Dropdown ของ Task, To-do และ Asset')}
            </p>
          </div>
          <div className="w-full min-w-0 rounded-xl bg-slate-50 p-4 lg:max-w-md">
            {isSuperAdmin && (
              <label className="block text-sm font-medium" htmlFor="catalog-property">
                {t('Property')}
                <select
                  className="catalog-property-select form-select mt-1.5 w-full min-w-0"
                  id="catalog-property"
                  onChange={(event) => setPropertyId(event.target.value)}
                  value={propertyId}
                >
                  {sortByLabel(properties, (item) => `${item.code} · ${item.name}`).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {property && (
              <p className={`${isSuperAdmin ? 'mt-2' : ''} break-words text-xs text-slate-600`}>
                {t('กำลังตั้งค่าสำหรับ')}{' '}
                <span className="font-semibold text-slate-800">
                  {property.code} · {property.name}
                </span>
              </p>
            )}
          </div>
        </div>
        {notice && (
          <p
            className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
          >
            {t(notice)}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {t(error)}
          </p>
        )}
      </section>
      {loading ? (
        <div
          className="rounded-3xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500"
          role="status"
        >
          {t('กำลังโหลดรายการ…')}
        </div>
      ) : !propertyId || !property ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <p className="font-medium text-slate-700">{t('ไม่พบ Property สำหรับตั้งค่า')}</p>
          <p className="mt-1 text-sm text-slate-500">{t('เพิ่ม Property หรือกำหนดสิทธิ์ Property ให้บัญชีนี้ก่อน')}</p>
        </div>
      ) : (
        <>
          <nav
            aria-label={t('ส่วนตั้งค่ารายการ')}
            className="relative z-10 flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-sm shadow-slate-200/30 backdrop-blur lg:sticky lg:top-[4.75rem]"
          >
            <a
              className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-lotus-50 hover:text-lotus-800"
              href="#catalog-problem-types"
            >
              {t('ประเภทปัญหา')}
            </a>
            <a
              className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-lotus-50 hover:text-lotus-800"
              href="#catalog-options"
            >
              {t('รายการใช้งาน')}
            </a>
            {isSuperAdmin && (
              <a
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-800"
                href="#catalog-sla"
              >
                SLA
              </a>
            )}
          </nav>
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="scroll-mt-28 lg:col-span-2" id="catalog-problem-types">
              <ProblemTypeEditor
                values={catalog.problemTypes}
                onAdd={(value) => addOption('problemTypes', value)}
                onRename={(oldValue, value) => renameOption('problemTypes', oldValue, value)}
                onRemove={removeOption}
                onRenameGroup={renameGroup}
                onRemoveGroup={removeGroup}
                saving={saving}
              />
            </div>
            <div
              className="scroll-mt-28 grid min-w-0 grid-cols-1 gap-4 lg:col-span-2 lg:grid-cols-2"
              id="catalog-options"
            >
              <CatalogEditor
                field="todoCategories"
                title={t('หมวดงาน To-do')}
                values={catalog.todoCategories}
                onAdd={addOption}
                onRename={renameOption}
                saving={saving}
              />
              <CatalogEditor
                field="departments"
                title={t('แผนก')}
                values={catalog.departments}
                onAdd={addOption}
                onRename={renameOption}
                saving={saving}
              />
              <CatalogEditor
                field="assetCategories"
                title={t('ประเภท Asset')}
                values={catalog.assetCategories}
                onAdd={addOption}
                onRename={renameOption}
                saving={saving}
              />
              <CatalogEditor
                field="channels"
                title={t('ช่องทางการแจ้งปัญหา')}
                values={catalog.channels}
                onAdd={addOption}
                onRename={renameOption}
                saving={saving}
              />
            </div>
            {isSuperAdmin && (
              <div className="scroll-mt-28 lg:col-span-2" id="catalog-sla">
                <SlaPolicyEditor property={property} saving={savingSla} onSave={saveSlaPolicy} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
