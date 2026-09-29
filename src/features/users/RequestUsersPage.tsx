import { t } from '../../lib/i18n'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DataFreshnessBar } from '../../components/DataFreshnessBar'
import { useAuth } from '../auth/AuthProvider'
import { defaultDepartments, subscribeToTicketCatalog } from '../tickets/ticketCatalogService'
import { subscribeToTicketAssets, type TicketAssetOption } from '../tickets/ticketAssetService'
import {
  createRequestUser,
  getRequestUserPage,
  setRequestUserActive,
  updateRequestUserAsset,
  updateRequestUserName,
  type RequestUserRecord,
  type RequestUserPageCursor,
} from './requestUserService'

export function RequestUsersPage({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [targetPropertyId, setTargetPropertyId] = useState(
    selectedPropertyId === 'all' ? (properties[0]?.id ?? '') : selectedPropertyId,
  )
  const targetProperty = properties.find((item) => item.id === targetPropertyId)
  const [users, setUsers] = useState<RequestUserRecord[]>([])
  const [departments, setDepartments] = useState(defaultDepartments)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [assetId, setAssetId] = useState('')
  const [assetOptions, setAssetOptions] = useState<TicketAssetOption[]>([])
  const [assetOptionsLoading, setAssetOptionsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [assetDraftId, setAssetDraftId] = useState('')
  const [savingAsset, setSavingAsset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<RequestUserPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (selectedPropertyId !== 'all') setTargetPropertyId(selectedPropertyId)
    else if (!properties.some((item) => item.id === targetPropertyId)) setTargetPropertyId(properties[0]?.id ?? '')
  }, [selectedPropertyId, properties, targetPropertyId])

  useEffect(() => {
    if (!targetPropertyId) {
      setDepartments(defaultDepartments)
      return
    }
    setDepartments(defaultDepartments)
    return subscribeToTicketCatalog(
      targetPropertyId,
      (catalog) => setDepartments(catalog.departments),
      () => setDepartments(defaultDepartments),
    )
  }, [targetPropertyId])

  useEffect(() => {
    if (!targetPropertyId) {
      setAssetOptions([])
      return
    }
    setAssetOptionsLoading(true)
    return subscribeToTicketAssets(
      targetPropertyId,
      (items) => {
        setAssetOptions(items)
        setAssetOptionsLoading(false)
      },
      () => {
        setAssetOptions([])
        setAssetOptionsLoading(false)
      },
      allProperties,
    )
  }, [targetPropertyId, allProperties])

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canManage || (!allProperties && !selectedPropertyId)) {
      setUsers([])
      setLoading(false)
      setError(t('หน้านี้เปิดให้ IT Support Engineer และ Super Admin เท่านั้น'))
      return
    }
    setLoading(true)
    setError(null)
    setUsers([])
    setNextCursor(null)
    setHasMore(false)
    setLastUpdated(null)
    let cancelled = false
    void getRequestUserPage(selectedPropertyId, allProperties, 25)
      .then((page) => {
        if (cancelled) return
        setUsers(page.items)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('โหลด Request User ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes'))
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
      const page = await getRequestUserPage(selectedPropertyId, allProperties, 25, nextCursor)
      setUsers((current) => [...current, ...page.items])
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

  // Keep Firestore cursor order stable across pages. A client-side sort by
  // property/email would reorder page 2 ahead of rows from page 1.
  const visibleUsers = useMemo(() => users, [users])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseUser || !targetProperty) {
      setError(t('กรุณาเลือก Property และเข้าสู่ระบบใหม่'))
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await createRequestUser(
        {
          propertyId: targetProperty.id,
          propertyCode: targetProperty.code,
          email,
          name,
          department,
          assetId: assetId || null,
        },
        firebaseUser.uid,
      )
      setEmail('')
      setName('')
      setDepartment('')
      setAssetId('')
      setNotice(`เพิ่ม ${email.trim().toLocaleLowerCase()} ใน ${targetProperty.code} แล้ว`)
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เพิ่ม Request User ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user: RequestUserRecord) {
    setError(null)
    setNotice(null)
    try {
      await setRequestUserActive(user.id, !user.active)
      setNotice(`${user.email} ${user.active ? 'ถูกปิด' : 'เปิด'}รายการ Request User แล้ว`)
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปเดตสถานะไม่สำเร็จ')
    }
  }

  function beginNameEdit(user: RequestUserRecord) {
    setEditingNameId(user.id)
    setNameDraft(user.name ?? '')
    setError(null)
    setNotice(null)
  }

  async function saveName(event: FormEvent<HTMLFormElement>, user: RequestUserRecord) {
    event.preventDefault()
    setSavingName(true)
    setError(null)
    setNotice(null)
    try {
      await updateRequestUserName(user.id, nameDraft)
      setEditingNameId(null)
      setNotice(t('อัปเดตชื่อ Request User แล้ว'))
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('อัปเดตชื่อ Request User ไม่สำเร็จ'))
    } finally {
      setSavingName(false)
    }
  }

  function beginAssetEdit(user: RequestUserRecord) {
    setEditingAssetId(user.id)
    setAssetDraftId(user.assetId ?? '')
    setError(null)
    setNotice(null)
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>, user: RequestUserRecord) {
    event.preventDefault()
    setSavingAsset(true)
    setError(null)
    setNotice(null)
    try {
      await updateRequestUserAsset(user.id, assetDraftId || null)
      setEditingAssetId(null)
      setNotice(t('อัปเดต Asset ของ Request User แล้ว'))
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('อัปเดต Asset ของ Request User ไม่สำเร็จ'))
    } finally {
      setSavingAsset(false)
    }
  }

  const formAssets = useMemo(
    () =>
      assetOptions.filter(
        (asset) =>
          asset.propertyId === targetPropertyId &&
          asset.department === department &&
          !['Damaged', 'Retired'].includes(asset.status),
      ),
    [assetOptions, department, targetPropertyId],
  )

  function assetsForUser(user: RequestUserRecord) {
    return assetOptions.filter(
      (asset) =>
        asset.propertyId === user.propertyId &&
        asset.department === user.department &&
        !['Damaged', 'Retired'].includes(asset.status),
    )
  }

  function assetLabel(assetIdValue: string | null) {
    if (!assetIdValue) return t('ไม่ระบุอุปกรณ์ · จับคู่ภายหลังได้')
    const asset = assetOptions.find((item) => item.id === assetIdValue)
    return asset ? `${asset.name} · ${asset.assetTag}` : assetIdValue
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
        {t(error || 'หน้านี้เปิดให้ IT Support Engineer และ Super Admin เท่านั้น')}
      </p>
    )

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="rounded-xl bg-lotus-50 p-2.5 text-lotus-700">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="M4 5h16v14H4zM4 7l8 6 8-6M16 3v4" />
            </svg>
          </span>
          <div>
            <h2 className="font-semibold">{t('เพิ่ม Request User')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('กำหนด Email, แผนก และ Property ที่ผู้ใช้สังกัด')}</p>
          </div>
        </div>
        <form className="mt-5 rounded-2xl bg-slate-50/80 p-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allProperties && (
              <label className="text-sm font-medium text-slate-600" htmlFor="request-user-property">
                {t('Property')}
                <select
                  className="form-select mt-1 w-full"
                  id="request-user-property"
                  onChange={(event) => {
                    setTargetPropertyId(event.target.value)
                    setDepartment('')
                  }}
                  required
                  value={targetPropertyId}
                >
                  <option value="">{t('เลือก Property')}</option>
                  {properties.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm font-medium text-slate-600" htmlFor="request-user-name">
              {t('ชื่อผู้แจ้ง (ไม่บังคับ)')}
              <input
                autoComplete="name"
                className="form-input mt-1 w-full"
                id="request-user-name"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('เช่น Fom')}
                value={name}
              />
            </label>
            <label className="text-sm font-medium text-slate-600" htmlFor="request-user-email">
              {t('Email')}
              <input
                autoComplete="email"
                className="form-input mt-1 w-full"
                id="request-user-email"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('name@company.com')}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="text-sm font-medium text-slate-600" htmlFor="request-user-department">
              {t('แผนกของ Property')}
              <select
                className="form-select mt-1 w-full"
                id="request-user-department"
                onChange={(event) => {
                  setDepartment(event.target.value)
                  setAssetId('')
                }}
                required
                value={department}
              >
                <option value="">{t('เลือกแผนก')}</option>
                {departments.map((value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-600" htmlFor="request-user-asset">
              {t('อุปกรณ์ประจำผู้แจ้ง (ไม่บังคับ)')}
              <select
                className="form-select mt-1 w-full"
                disabled={!department || assetOptionsLoading}
                id="request-user-asset"
                onChange={(event) => setAssetId(event.target.value)}
                value={assetId}
              >
                <option value="">{t('ไม่ระบุอุปกรณ์ · จับคู่ภายหลังได้')}</option>
                {formAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.assetTag} · {asset.location}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                {assetOptionsLoading
                  ? t('กำลังโหลด Asset…')
                  : !department
                    ? t('เลือกแผนกก่อน จะแสดง Asset ที่เกี่ยวข้อง')
                    : formAssets.length
                      ? t('แสดงเฉพาะ Asset ใน Property และแผนกนี้')
                      : t('ยังไม่มี Asset ที่ใช้งานในแผนกนี้')}
              </span>
            </label>
          </div>
          {!allProperties && targetProperty && (
            <p className="mt-3 text-xs text-slate-500">
              {t('Property')}: {targetProperty.code} · {targetProperty.name}
            </p>
          )}
          <p className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
            {t(
              'รายการนี้จัดเก็บความสัมพันธ์ Email กับแผนก/Property เพื่อเตรียมเพิ่มผู้แจ้งงาน ยังไม่สร้าง Firebase Login หรือมอบสิทธิ์เข้าระบบ ต้อง provision บัญชีและ Membership แยกตามขั้นตอนผู้ดูแล',
            )}
          </p>
          {error && (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {t(error)}
            </p>
          )}
          {notice && (
            <p className="mt-3 text-sm text-emerald-700" role="status">
              {t(notice)}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              className="rounded-full bg-lotus-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lotus-700 disabled:opacity-50"
              disabled={saving || !targetProperty}
              type="submit"
            >
              {saving ? t('กำลังบันทึก…') : t('เพิ่ม Request User')}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold">{t('รายชื่อ Request User')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('รายการเชื่อมโยงแผนกและ Property · แบ่งหน้า ครั้งละ 25 รายการ')}
            </p>
          </div>
          <span className="rounded-full bg-lotus-50 px-3 py-1 text-xs font-semibold text-lotus-800">
            {visibleUsers.filter((user) => user.active).length} {t('ใช้งาน')}
          </span>
        </div>
        {notice && (
          <p className="mt-3 text-sm text-emerald-700" role="status">
            {t(notice)}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {t(error)}
          </p>
        )}
        <DataFreshnessBar lastUpdated={lastUpdated} loading={loading} onRefresh={refresh} />
        {loading && users.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500" role="status">
            {t('กำลังโหลดรายชื่อ…')}
          </p>
        ) : visibleUsers.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
            {t('ยังไม่มี Request User ใน Property นี้')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">{t('ชื่อ')}</th>
                  <th className="px-3 py-2 font-medium">{t('Email')}</th>
                  <th className="px-3 py-2 font-medium">{t('Property')}</th>
                  <th className="px-3 py-2 font-medium">{t('แผนก')}</th>
                  <th className="px-3 py-2 font-medium">{t('อุปกรณ์')}</th>
                  <th className="px-3 py-2 font-medium">{t('สถานะ')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('จัดการ')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr className="border-b border-slate-50 last:border-0" key={user.id}>
                    <td className="px-3 py-3 font-medium">
                      {editingNameId === user.id ? (
                        <form
                          className="flex min-w-64 flex-wrap items-center gap-2"
                          onSubmit={(event) => void saveName(event, user)}
                        >
                          <input
                            aria-label={t('ชื่อผู้แจ้ง')}
                            autoFocus
                            className="form-input min-w-0 flex-1"
                            maxLength={120}
                            onChange={(event) => setNameDraft(event.target.value)}
                            placeholder={t('ไม่ระบุ')}
                            value={nameDraft}
                          />
                          <button
                            className="rounded-full bg-lotus-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            disabled={savingName}
                            type="submit"
                          >
                            {savingName ? t('กำลังบันทึก…') : t('บันทึก')}
                          </button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600"
                            disabled={savingName}
                            onClick={() => setEditingNameId(null)}
                            type="button"
                          >
                            {t('ยกเลิก')}
                          </button>
                        </form>
                      ) : (
                        user.name || <span className="text-slate-400">{t('ไม่ระบุ')}</span>
                      )}
                    </td>
                    <td className="break-all px-3 py-3">{user.email}</td>
                    <td className="px-3 py-3">{user.propertyCode}</td>
                    <td className="px-3 py-3">{user.department}</td>
                    <td className="px-3 py-3">
                      {editingAssetId === user.id ? (
                        <form
                          className="flex min-w-64 flex-wrap items-center gap-2"
                          onSubmit={(event) => void saveAsset(event, user)}
                        >
                          <select
                            aria-label={t('อุปกรณ์ประจำผู้แจ้ง')}
                            className="form-select min-w-52"
                            disabled={savingAsset}
                            onChange={(event) => setAssetDraftId(event.target.value)}
                            value={assetDraftId}
                          >
                            <option value="">{t('ไม่ระบุอุปกรณ์ · จับคู่ภายหลังได้')}</option>
                            {assetsForUser(user).map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.name} · {asset.assetTag}
                              </option>
                            ))}
                          </select>
                          <button
                            className="rounded-full bg-lotus-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            disabled={savingAsset}
                            type="submit"
                          >
                            {savingAsset ? t('กำลังบันทึก…') : t('บันทึก')}
                          </button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600"
                            disabled={savingAsset}
                            onClick={() => setEditingAssetId(null)}
                            type="button"
                          >
                            {t('ยกเลิก')}
                          </button>
                        </form>
                      ) : (
                        <span className={user.assetId ? 'font-medium text-slate-700' : 'text-slate-400'}>
                          {assetLabel(user.assetId)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${user.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {user.active ? t('ใช้งาน') : t('ปิดใช้งาน')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          className="rounded-full border border-lotus-200 px-3 py-1.5 text-xs font-medium text-lotus-700 hover:bg-lotus-50"
                          disabled={editingNameId !== null || editingAssetId !== null || savingName || savingAsset}
                          onClick={() => beginNameEdit(user)}
                          type="button"
                        >
                          {t('แก้ไขชื่อ')}
                        </button>
                        <button
                          className="rounded-full border border-lotus-200 px-3 py-1.5 text-xs font-medium text-lotus-700 hover:bg-lotus-50"
                          disabled={editingNameId !== null || editingAssetId !== null || savingName || savingAsset}
                          onClick={() => beginAssetEdit(user)}
                          type="button"
                        >
                          {t('จับคู่ Asset')}
                        </button>
                        <button
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          disabled={editingNameId !== null || editingAssetId !== null || savingName || savingAsset}
                          onClick={() => void toggleActive(user)}
                          type="button"
                        >
                          {user.active ? t('ปิดรายการ') : t('เปิดใช้งาน')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-lotus-700 hover:bg-lotus-50 disabled:opacity-50"
              disabled={loading}
              onClick={() => void loadMore()}
              type="button"
            >
              {loading ? t('กำลังโหลด…') : t('โหลดรายการเพิ่ม')}
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">{t('ตัวกรองและจำนวนสรุปคำนวณจากข้อมูลที่โหลดแล้ว')}</p>
      </section>
    </div>
  )
}
