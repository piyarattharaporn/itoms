import { getLanguage, t } from '../../lib/i18n'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DataFreshnessBar } from '../../components/DataFreshnessBar'
import { useAuth } from '../auth/AuthProvider'
import {
  createLicense,
  daysUntilExpiry,
  getLicensePage,
  licenseStatuses,
  licenseTypes,
  type LicensePageCursor,
  updateLicense,
  type SoftwareLicenseInput,
  type SoftwareLicense,
} from './licenseService'

const emptyLicense: SoftwareLicenseInput = {
  propertyId: '',
  propertyCode: '',
  productName: '',
  vendor: '',
  licenseType: 'Subscription',
  expiresOn: '',
  quantity: 1,
  renewalOwner: '',
  status: 'Active',
  notes: '',
}

function expiringLabel(days: number) {
  if (getLanguage() === 'en') {
    if (days < 0) return `Expired ${Math.abs(days)} days ago`
    if (days === 0) return 'Expires today'
    return `${days} days left`
  }
  if (days < 0) return `หมดอายุแล้ว ${Math.abs(days)} วัน`
  if (days === 0) return 'หมดอายุวันนี้'
  return `เหลือ ${days} วัน`
}

function LicenseForm({
  initial,
  properties,
  canChooseProperty,
  editing,
  onCancel,
  onSaved,
}: {
  initial: SoftwareLicenseInput
  properties: ReturnType<typeof useAuth>['properties']
  canChooseProperty: boolean
  editing: boolean
  onCancel: () => void
  onSaved: (input: SoftwareLicenseInput) => Promise<void>
}) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function update<K extends keyof SoftwareLicenseInput>(key: K, field: SoftwareLicenseInput[K]) {
    setValue((current) => {
      if (key === 'propertyId') {
        const property = properties.find((item) => item.id === field)
        return { ...current, propertyId: String(field), propertyCode: property?.code ?? '' }
      }
      return { ...current, [key]: field }
    })
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSaved(value)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึก License ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="mt-5 space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5" onSubmit={submit}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">
            {editing ? t('แก้ไข Software License') : t('เพิ่ม Software License')}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t('กรอกข้อมูลผลิตภัณฑ์ วันหมดอายุ และผู้ดูแลการต่ออายุ')}
          </p>
        </div>
        {editing && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {value.propertyCode}
          </span>
        )}
      </div>

      <section aria-label={t('ข้อมูลผลิตภัณฑ์')} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-slate-800">{t('ข้อมูลผลิตภัณฑ์')}</h4>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {canChooseProperty && !editing && (
            <label className="block min-w-0 text-sm font-medium text-slate-700">
              {t('Property')}
              <select
                className="form-select mt-1.5 w-full"
                onChange={(event) => update('propertyId', event.target.value)}
                required
                value={value.propertyId}
              >
                <option value="">{t('เลือก Property')}</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.code} · {property.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('ชื่อ License / Product')}
            <input
              className="form-input mt-1.5 w-full"
              maxLength={160}
              onChange={(event) => update('productName', event.target.value)}
              required
              value={value.productName}
              placeholder={t('เช่น Microsoft 365, Antivirus')}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('Vendor')}
            <input
              className="form-input mt-1.5 w-full"
              maxLength={160}
              onChange={(event) => update('vendor', event.target.value)}
              required
              value={value.vendor}
              placeholder={t('ชื่อผู้จำหน่าย')}
            />
          </label>
        </div>
      </section>

      <section
        aria-label={t('ข้อมูลสิทธิ์และการต่ออายุ')}
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <h4 className="text-sm font-semibold text-slate-800">{t('ข้อมูลสิทธิ์และการต่ออายุ')}</h4>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('ประเภท')}
            <select
              className="form-select mt-1.5 w-full"
              onChange={(event) => update('licenseType', event.target.value as SoftwareLicenseInput['licenseType'])}
              value={value.licenseType}
            >
              {licenseTypes.map((type) => (
                <option key={type} value={type}>
                  {t(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('วันหมดอายุ')}
            <input
              className="form-input mt-1.5 w-full"
              onChange={(event) => update('expiresOn', event.target.value)}
              required
              type="date"
              value={value.expiresOn}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('จำนวน Seats / สิทธิ์')}
            <input
              className="form-input mt-1.5 w-full"
              max="100000"
              min="1"
              onChange={(event) => update('quantity', Number(event.target.value))}
              required
              type="number"
              value={value.quantity}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('ผู้รับผิดชอบต่ออายุ')}
            <input
              className="form-input mt-1.5 w-full"
              maxLength={160}
              onChange={(event) => update('renewalOwner', event.target.value)}
              value={value.renewalOwner}
              placeholder={t('ชื่อผู้รับผิดชอบ (ไม่บังคับ)')}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            {t('สถานะต่ออายุ')}
            <select
              className="form-select mt-1.5 w-full"
              onChange={(event) => update('status', event.target.value as SoftwareLicenseInput['status'])}
              value={value.status}
            >
              {licenseStatuses.map((status) => (
                <option key={status} value={status}>
                  {t(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <label className="block text-sm font-medium text-slate-700">
          {t('หมายเหตุ')}
          <textarea
            className="form-input mt-1.5 min-h-24 w-full"
            maxLength={1000}
            onChange={(event) => update('notes', event.target.value)}
            placeholder={t('บันทึกข้อมูลเพิ่มเติมที่ไม่ใช่ License Key')}
            value={value.notes}
          />
        </label>
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {t('ไม่บันทึก License Key หรือรหัสเปิดใช้งานลงในระบบ')}
        </p>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {t(error)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <button
          className="min-h-11 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
          type="button"
        >
          {t('ยกเลิก')}
        </button>
        <button
          className="min-h-11 rounded-full bg-lotus-700 px-5 py-2 text-sm font-semibold text-white hover:bg-lotus-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={saving || properties.length === 0}
          type="submit"
        >
          {saving ? t('กำลังบันทึก…') : editing ? t('บันทึกการแก้ไข') : t('บันทึก License')}
        </button>
      </div>
    </form>
  )
}

function LicenseRow({
  license,
  canManage,
  onEdit,
}: {
  license: SoftwareLicense
  canManage: boolean
  onEdit: (license: SoftwareLicense) => void
}) {
  const days = daysUntilExpiry(license.expiresOn)
  const expiryTone =
    days < 0
      ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
      : days <= 15
        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
        : days <= 30
          ? 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200'
          : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
  return (
    <li
      className={`rounded-3xl border bg-white p-4 sm:p-5 ${days < 0 ? 'border-rose-200/80' : days <= 30 ? 'border-amber-200/80' : 'border-slate-200/80'}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-semibold text-slate-900">{license.productName}</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {t(license.licenseType)}
            </span>
          </div>
          <p className="mt-1 break-words text-sm text-slate-500">
            {license.vendor} · {license.propertyCode}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${expiryTone}`}>{expiringLabel(days)}</span>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${license.status === 'Active' ? 'bg-emerald-50 text-emerald-800' : license.status === 'Renewal In Progress' ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-700'}`}
          >
            {t(license.status)}
          </span>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50/80 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">{t('จำนวน Seats / สิทธิ์')}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-slate-900">{license.quantity.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t('วันหมดอายุ')}</dt>
          <dd className="mt-1 font-medium text-slate-800">{license.expiresOn}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-slate-500">{t('ผู้รับผิดชอบต่ออายุ')}</dt>
          <dd className="mt-1 break-words font-medium text-slate-800">{license.renewalOwner || t('ไม่ระบุ')}</dd>
        </div>
      </dl>
      {license.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{license.notes}</p>}
      {canManage && (
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <button
            className="min-h-10 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-lotus-700 hover:bg-lotus-50"
            onClick={() => onEdit(license)}
            type="button"
          >
            {t('แก้ไข')}
          </button>
        </div>
      )}
    </li>
  )
}

export function LicenseRenewalPanel({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canRead = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
  const canManage = isSuperAdmin || membership?.role === 'supportEngineer'
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showAll, setShowAll] = useState(true)
  const [editingLicense, setEditingLicense] = useState<SoftwareLicense | null>(null)
  const [draft, setDraft] = useState<SoftwareLicenseInput>(emptyLicense)
  const [nextCursor, setNextCursor] = useState<LicensePageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canRead) {
      setLicenses([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    setLicenses([])
    setNextCursor(null)
    setHasMore(false)
    setLastUpdated(null)
    let cancelled = false
    void getLicensePage(selectedPropertyId, allProperties, 25)
      .then((page) => {
        if (cancelled) return
        setLicenses(page.items)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setLastUpdated(new Date())
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('โหลด License ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes'))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessState, canRead, selectedPropertyId, allProperties, reloadKey])

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const page = await getLicensePage(selectedPropertyId, allProperties, 25, nextCursor)
      setLicenses((current) => [...current, ...page.items])
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

  useEffect(() => {
    if (!allProperties && selectedPropertyId) {
      const property = properties.find((item) => item.id === selectedPropertyId)
      setDraft((current) => ({ ...current, propertyId: selectedPropertyId, propertyCode: property?.code ?? '' }))
    } else if (allProperties && !properties.some((property) => property.id === draft.propertyId)) setDraft(emptyLicense)
  }, [allProperties, selectedPropertyId, properties, draft.propertyId])

  const expiring = useMemo(
    () =>
      licenses
        .filter((license) => daysUntilExpiry(license.expiresOn) <= 30)
        .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn)),
    [licenses],
  )
  const visibleLicenses = showAll ? licenses : expiring

  async function saveLicense(input: SoftwareLicenseInput) {
    if (!firebaseUser) throw new Error(t('กรุณาเข้าสู่ระบบใหม่'))
    if (editingLicense) {
      await updateLicense(editingLicense.id, input)
      setNotice(`แก้ไข ${input.productName} แล้ว`)
      setEditingLicense(null)
    } else {
      await createLicense(input, firebaseUser.uid)
      setDraft((current) => ({ ...emptyLicense, propertyId: current.propertyId, propertyCode: current.propertyCode }))
      setNotice(`เพิ่ม ${input.productName} แล้ว`)
    }
    setShowForm(false)
    setReloadKey((value) => value + 1)
  }

  function editLicense(license: SoftwareLicense) {
    setEditingLicense(license)
    setShowForm(true)
  }

  if (!canRead && accessState !== 'ready') return null
  if (!canRead) return null
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-medium text-violet-700">{t('License & Renewal')}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{t('Software License & Subscription')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {t('รายละเอียด License ทั้งหมด แก้ไขวันหมดอายุ จำนวนสิทธิ์ และสถานะต่ออายุได้')}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto">
          {canManage && (
            <>
              <button
                className="min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingLicense(null)
                  setShowForm((value) => !value)
                }}
                type="button"
              >
                {showForm ? t('ปิดฟอร์ม') : t('เพิ่ม License')}
              </button>
              <button
                className="min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
                onClick={() => setShowAll((value) => !value)}
                type="button"
              >
                {showAll ? t('แสดงเฉพาะใกล้หมดอายุ') : `แสดง License ทั้งหมด (${licenses.length})`}
              </button>
            </>
          )}
        </div>
      </div>
      {notice && (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {t(notice)}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      <DataFreshnessBar lastUpdated={lastUpdated} loading={loading} onRefresh={refresh} />
      {showForm && canManage && (
        <LicenseForm
          canChooseProperty={allProperties}
          editing={Boolean(editingLicense)}
          initial={editingLicense ?? draft}
          key={editingLicense?.id ?? 'new-license'}
          onCancel={() => {
            setShowForm(false)
            setEditingLicense(null)
          }}
          onSaved={saveLicense}
          properties={allProperties ? properties : properties.filter((property) => property.id === selectedPropertyId)}
        />
      )}
      {loading && licenses.length === 0 ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลด License…')}
        </p>
      ) : visibleLicenses.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          {showAll
            ? t('ยังไม่มี License ในระบบ')
            : t('ไม่มี License ที่หมดอายุหรือจะหมดใน 30 วันจากข้อมูลที่บันทึกไว้')}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visibleLicenses.map((license) => (
            <LicenseRow canManage={canManage} key={license.id} license={license} onEdit={editLicense} />
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="mt-4 text-center">
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
      <p className="mt-3 text-xs text-slate-500">
        {t('แสดง License แบบแบ่งหน้า ครั้งละ 25 รายการ; สรุปจากข้อมูลที่โหลดแล้ว')}
      </p>
    </section>
  )
}
