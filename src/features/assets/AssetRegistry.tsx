import { t } from '../../lib/i18n'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ViewModeToggle, useDataViewMode } from '../../components/ViewModeToggle'
import { useAuth } from '../auth/AuthProvider'
import {
  createAsset,
  getAssetPage,
  syncTicketAssetOptions,
  updateAsset,
  type AssetInput,
  type AssetPageCursor,
  type AssetRecord,
  type AssetStatus,
} from './assetService'
import { defaultAssetCategories, defaultDepartments, subscribeToTicketCatalog } from '../tickets/ticketCatalogService'

const emptyAsset: AssetInput = {
  propertyId: '',
  propertyCode: '',
  assetTag: '',
  name: '',
  category: '',
  department: '',
  location: '',
  vendor: '',
  model: '',
  spec: '',
  detail: '',
  usedBy: '',
  serialNumber: '',
  warrantyExpiresOn: '',
  status: 'In Service',
  ownershipType: 'Owned',
  lessorName: '',
  leaseContractNumber: '',
  leaseStartDate: '',
  leaseEndDate: '',
  monthlyRentalCost: null,
  serviceType: '',
  serviceVendor: '',
  serviceSentOn: '',
  expectedReturnOn: '',
  serviceNotes: '',
}

function AssetForm({
  initial,
  canChooseProperty,
  properties,
  onCancel,
  onSubmit,
}: {
  initial: AssetInput
  canChooseProperty: boolean
  properties: ReturnType<typeof useAuth>['properties']
  onCancel?: () => void
  onSubmit: (asset: AssetInput) => Promise<void>
}) {
  const [asset, setAsset] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assetCategories, setAssetCategories] = useState(defaultAssetCategories)
  const [departments, setDepartments] = useState(defaultDepartments)

  useEffect(() => {
    if (!asset.propertyId) {
      setAssetCategories(defaultAssetCategories)
      setDepartments(defaultDepartments)
      return
    }
    setAssetCategories(defaultAssetCategories)
    setDepartments(defaultDepartments)
    return subscribeToTicketCatalog(
      asset.propertyId,
      (catalog) => {
        setAssetCategories(catalog.assetCategories)
        setDepartments(catalog.departments)
      },
      () => {
        setAssetCategories(defaultAssetCategories)
        setDepartments(defaultDepartments)
      },
    )
  }, [asset.propertyId])

  function change<K extends keyof AssetInput>(key: K, value: AssetInput[K]) {
    setAsset((current) => {
      if (key === 'propertyId') {
        const property = properties.find((item) => item.id === value)
        return {
          ...current,
          propertyId: String(value),
          propertyCode: property?.code ?? '',
          category: current.propertyId === value ? current.category : '',
          department: current.propertyId === value ? current.department : '',
        }
      }
      return { ...current, [key]: value }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(asset)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึก Asset ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="min-w-0 rounded-2xl border border-lotus-100 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-sm font-medium text-lotus-700">{t('Asset Registry')}</p>
          <h3 className="mt-1 text-lg font-semibold">{initial.assetTag ? t('แก้ไข Asset') : t('เพิ่ม Asset')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('จัดข้อมูลอุปกรณ์ สถานที่ และการครอบครองไว้ในฟอร์มเดียว')}</p>
        </div>
        {asset.ownershipType === 'Leased' && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            {t('อุปกรณ์เช่า')}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-4">
            <h4 className="font-semibold">{t('ข้อมูลประจำอุปกรณ์')}</h4>
            <p className="mt-1 text-xs text-slate-500">{t('ระบุ Property รหัส และประเภทการครอบครอง')}</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {canChooseProperty && (
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-property">
                  {t('Property')}
                </label>
                <select
                  className="form-select w-full min-w-0"
                  id="asset-property"
                  onChange={(event) => change('propertyId', event.target.value)}
                  required
                  value={asset.propertyId}
                >
                  <option disabled value="">
                    {t('เลือก Property')}
                  </option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.code} · {property.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-tag">
                {t('Asset Tag')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-tag"
                maxLength={80}
                onChange={(event) => change('assetTag', event.target.value)}
                required
                value={asset.assetTag}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-name">
                {t('ชื่ออุปกรณ์')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-name"
                maxLength={160}
                onChange={(event) => change('name', event.target.value)}
                required
                value={asset.name}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-ownership">
                {t('ประเภทการครอบครอง')}
              </label>
              <select
                className="form-select w-full min-w-0"
                id="asset-ownership"
                onChange={(event) => change('ownershipType', event.target.value as AssetInput['ownershipType'])}
                value={asset.ownershipType}
              >
                <option value="Owned">{t('เป็นเจ้าของ')}</option>
                <option value="Leased">{t('อุปกรณ์เช่า')}</option>
              </select>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4">
            <h4 className="font-semibold">{t('ประเภทและตำแหน่ง')}</h4>
            <p className="mt-1 text-xs text-slate-500">{t('ช่วยให้ทีมค้นหาและเชื่อม Asset กับ Task ได้ง่าย')}</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-category">
                {t('ประเภท')}
              </label>
              <select
                className="form-select w-full min-w-0"
                id="asset-category"
                onChange={(event) => change('category', event.target.value)}
                required
                value={asset.category}
              >
                <option value="">{t('เลือกประเภท Asset')}</option>
                {asset.category && !assetCategories.includes(asset.category) && (
                  <option value={asset.category}>
                    {t(asset.category)} {t('(ประเภทเดิม)')}
                  </option>
                )}
                {assetCategories.map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-department">
                {t('แผนก')}
              </label>
              <select
                className="form-select w-full min-w-0"
                id="asset-department"
                onChange={(event) => change('department', event.target.value)}
                required
                value={asset.department}
              >
                <option value="">{t('เลือกแผนก')}</option>
                {asset.department && !departments.includes(asset.department) && (
                  <option value={asset.department}>
                    {asset.department} {t('(แผนกเดิม)')}
                  </option>
                )}
                {departments.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-location">
                {t('Location')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-location"
                maxLength={160}
                onChange={(event) => change('location', event.target.value)}
                required
                value={asset.location}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-vendor">
                {t('Vendor')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-vendor"
                maxLength={160}
                onChange={(event) => change('vendor', event.target.value)}
                value={asset.vendor}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-model">
                {t('Model')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-model"
                maxLength={160}
                onChange={(event) => change('model', event.target.value)}
                value={asset.model}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-serial">
                {t('Serial Number')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-serial"
                maxLength={160}
                onChange={(event) => change('serialNumber', event.target.value)}
                value={asset.serialNumber}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-used-by">
                {t('Used by / User Link')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-used-by"
                maxLength={160}
                onChange={(event) => change('usedBy', event.target.value)}
                placeholder={t('ชื่อผู้ใช้หรือ Email (ไม่บังคับ)')}
                value={asset.usedBy}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-warranty">
                {t('Warranty Expires')}
              </label>
              <input
                className="form-input w-full min-w-0"
                id="asset-warranty"
                onChange={(event) => change('warrantyExpiresOn', event.target.value)}
                type="date"
                value={asset.warrantyExpiresOn}
              />
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4">
            <h4 className="font-semibold">{t('รายละเอียดเพิ่มเติม')}</h4>
            <p className="mt-1 text-xs text-slate-500">{t('บันทึกสเปกและข้อมูลที่ช่วยในการดูแลอุปกรณ์')}</p>
          </div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-spec">
                {t('Spec')}
              </label>
              <textarea
                className="form-input min-h-24 w-full min-w-0"
                id="asset-spec"
                maxLength={1000}
                onChange={(event) => change('spec', event.target.value)}
                placeholder={t('เช่น CPU, RAM, Storage')}
                value={asset.spec}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-detail">
                {t('Asset Detail')}
              </label>
              <textarea
                className="form-input min-h-24 w-full min-w-0"
                id="asset-detail"
                maxLength={2000}
                onChange={(event) => change('detail', event.target.value)}
                placeholder={t('รายละเอียดเพิ่มเติม (ไม่บังคับ)')}
                value={asset.detail}
              />
            </div>
          </div>
        </section>

        {asset.ownershipType === 'Leased' && (
          <section className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
            <div className="mb-4">
              <h4 className="font-semibold text-amber-950">{t('ข้อมูลสัญญาเช่า')}</h4>
              <p className="mt-1 text-xs text-amber-800">{t('ติดตามผู้ให้เช่า ระยะเวลา และค่าใช้จ่ายของอุปกรณ์')}</p>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-lessor">
                  {t('ผู้ให้เช่า / บริษัท')}
                </label>
                <input
                  className="form-input w-full min-w-0"
                  id="asset-lessor"
                  maxLength={160}
                  onChange={(event) => change('lessorName', event.target.value)}
                  required
                  value={asset.lessorName}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-lease-contract">
                  {t('เลขที่สัญญาเช่า')}
                </label>
                <input
                  className="form-input w-full min-w-0"
                  id="asset-lease-contract"
                  maxLength={120}
                  onChange={(event) => change('leaseContractNumber', event.target.value)}
                  value={asset.leaseContractNumber}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-lease-start">
                  {t('วันที่เริ่มเช่า')}
                </label>
                <input
                  className="form-input w-full min-w-0"
                  id="asset-lease-start"
                  onChange={(event) => change('leaseStartDate', event.target.value)}
                  type="date"
                  value={asset.leaseStartDate}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-lease-end">
                  {t('วันสิ้นสุดสัญญาเช่า')}
                </label>
                <input
                  className="form-input w-full min-w-0"
                  id="asset-lease-end"
                  onChange={(event) => change('leaseEndDate', event.target.value)}
                  type="date"
                  value={asset.leaseEndDate}
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-rental-cost">
                  {t('ค่าเช่าต่อเดือน (บาท)')}
                </label>
                <input
                  className="form-input w-full min-w-0"
                  id="asset-rental-cost"
                  min="0"
                  max="1000000000"
                  onChange={(event) =>
                    change('monthlyRentalCost', event.target.value === '' ? null : Number(event.target.value))
                  }
                  step="0.01"
                  type="number"
                  value={asset.monthlyRentalCost ?? ''}
                />
              </div>
            </div>
          </section>
        )}

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-4">
            <h4 className="font-semibold">{t('สถานะและการซ่อมบำรุง')}</h4>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-status">
                {t('สถานะ')}
              </label>
              <select
                className="form-select w-full min-w-0"
                id="asset-status"
                onChange={(event) => change('status', event.target.value as AssetStatus)}
                value={asset.status}
              >
                <option value="In Service">{t('In Service')}</option>
                <option value="Damaged">{t('Damaged')}</option>
                <option value="Under Repair">{t('Under Repair')}</option>
                <option value="Retired">{t('Retired')}</option>
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-service-type">
                {t('ประเภทการส่งซ่อม')}
              </label>
              <select
                className="form-select w-full min-w-0"
                id="asset-service-type"
                onChange={(event) => change('serviceType', event.target.value as AssetInput['serviceType'])}
                value={asset.serviceType}
              >
                <option value="">{t('ไม่ระบุ')}</option>
                <option value="Internal Repair">{t('ซ่อมภายใน')}</option>
                <option value="Warranty Claim">{t('ส่งเคลมประกัน')}</option>
                <option value="Vendor Repair">{t('ส่งซ่อม Vendor')}</option>
              </select>
            </div>
            {asset.serviceType && (
              <>
                <div className="min-w-0">
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-service-vendor">
                    {t('ร้าน / Vendor ที่รับซ่อม')}
                  </label>
                  <input
                    className="form-input w-full min-w-0"
                    id="asset-service-vendor"
                    maxLength={160}
                    onChange={(event) => change('serviceVendor', event.target.value)}
                    value={asset.serviceVendor}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-service-sent">
                    {t('วันที่ส่งซ่อม / เคลม')}
                  </label>
                  <input
                    className="form-input w-full min-w-0"
                    id="asset-service-sent"
                    onChange={(event) => change('serviceSentOn', event.target.value)}
                    type="date"
                    value={asset.serviceSentOn}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-service-return">
                    {t('กำหนดรับคืน (ถ้ามี)')}
                  </label>
                  <input
                    className="form-input w-full min-w-0"
                    id="asset-service-return"
                    onChange={(event) => change('expectedReturnOn', event.target.value)}
                    type="date"
                    value={asset.expectedReturnOn}
                  />
                </div>
                <div className="min-w-0 md:col-span-2 xl:col-span-3">
                  <label className="mb-1.5 block text-sm font-medium" htmlFor="asset-service-notes">
                    {t('รายละเอียดอาการ / เลขที่เคลม')}
                  </label>
                  <input
                    className="form-input w-full min-w-0"
                    id="asset-service-notes"
                    maxLength={500}
                    onChange={(event) => change('serviceNotes', event.target.value)}
                    value={asset.serviceNotes}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
        {onCancel && (
          <button
            className="min-h-11 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            {t('ยกเลิก')}
          </button>
        )}
        <button
          className="min-h-11 rounded-full bg-lotus-700 px-6 text-sm font-semibold text-white shadow-sm hover:bg-lotus-800 disabled:opacity-50"
          disabled={saving || properties.length === 0}
          type="submit"
        >
          {saving ? t('กำลังบันทึก…') : t('บันทึก Asset')}
        </button>
      </div>
    </form>
  )
}

export function AssetRegistry({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { firebaseUser, profile, memberships, properties, accessState } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const selectedMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const canManage = isSuperAdmin || selectedMembership?.role === 'supportEngineer'
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useDataViewMode('itoms.assetRegistry.view')
  const [showCreate, setShowCreate] = useState(false)
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null)
  const [syncingTicketOptions, setSyncingTicketOptions] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<AssetPageCursor>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const allProperties = isSuperAdmin && selectedPropertyId === 'all'

  useEffect(() => {
    if (accessState !== 'ready') return
    if (!canManage) {
      setAssets([])
      setLoading(false)
      setError(t('หน้านี้เปิดให้ IT Support Engineer และ Super Admin เท่านั้น'))
      return
    }
    setLoading(true)
    setError(null)
    setAssets([])
    setNextCursor(null)
    setHasMore(false)
    void getAssetPage(selectedPropertyId, allProperties, 25)
      .then((page) => {
        setAssets(page.items)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setLoading(false)
      })
      .catch(() => {
        setError(t('โหลด Asset ไม่สำเร็จ ตรวจสอบ Firestore Rules และ Indexes'))
        setLoading(false)
      })
  }, [accessState, canManage, selectedPropertyId, allProperties, reloadKey])

  async function loadMore() {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const page = await getAssetPage(selectedPropertyId, allProperties, 25, nextCursor)
      setAssets((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch {
      setError(t('โหลดรายการเพิ่มไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  const visibleAssets = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return assets
    return assets.filter((asset) =>
      [
        asset.assetTag,
        asset.name,
        asset.category,
        asset.department,
        asset.location,
        asset.serialNumber,
        asset.spec,
        asset.detail,
        asset.usedBy,
        asset.lessorName,
        asset.leaseContractNumber,
      ].some((value) => value.toLocaleLowerCase().includes(term)),
    )
  }, [assets, search])

  async function saveNewAsset(input: AssetInput) {
    if (!firebaseUser) throw new Error(t('กรุณาเข้าสู่ระบบใหม่'))
    const id = await createAsset(input, firebaseUser.uid)
    setShowCreate(false)
    setNotice(`เพิ่ม Asset ${input.assetTag} แล้ว (${id})`)
    setReloadKey((value) => value + 1)
  }

  async function saveEditedAsset(input: AssetInput) {
    if (!editingAsset) return
    await updateAsset(editingAsset.id, input)
    setEditingAsset(null)
    setNotice(`บันทึก Asset ${input.assetTag} แล้ว`)
    setReloadKey((value) => value + 1)
  }

  async function syncOptions() {
    setSyncingTicketOptions(true)
    setError(null)
    setNotice(null)
    try {
      const count = await syncTicketAssetOptions(assets)
      setNotice(`อัปเดต Asset ${count} รายการสำหรับ Dropdown ใน Task แล้ว`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อัปเดตรายการ Asset สำหรับ Task ไม่สำเร็จ')
    } finally {
      setSyncingTicketOptions(false)
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
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">
        {t(error)}
      </p>
    )

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{t('ทะเบียนอุปกรณ์')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {t('ทะเบียนอุปกรณ์แยกตาม Property · แบ่งหน้า ครั้งละ 25 รายการ')}
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] xl:w-auto xl:min-w-[44rem]">
            <input
              aria-label={t('ค้นหา Asset')}
              className="form-input min-w-0 w-full"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('ค้นหา Asset…')}
              value={search}
            />
            <button
              className="min-h-11 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-lotus-700 hover:bg-lotus-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={syncingTicketOptions || loading || assets.length === 0}
              onClick={() => void syncOptions()}
              type="button"
            >
              {syncingTicketOptions ? t('กำลังอัปเดต…') : t('อัปเดต Dropdown Task จากรายการที่โหลด')}
            </button>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            <button
              className="min-h-11 rounded-full bg-lotus-700 px-5 py-2 text-sm font-semibold text-white hover:bg-lotus-800"
              onClick={() => {
                setEditingAsset(null)
                setShowCreate((value) => !value)
              }}
              type="button"
            >
              {showCreate ? t('ปิดฟอร์ม') : t('เพิ่ม Asset')}
            </button>
          </div>
        </div>
        {notice && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            {t(notice)}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {t(error)}
          </p>
        )}
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {t('ปุ่มนี้ sync เฉพาะ Asset ที่โหลดอยู่ในหน้านี้; เพิ่มหรือแก้ไข Asset ใหม่จะอัปเดต Dropdown อัตโนมัติ')}
        </p>
        {showCreate && (
          <div className="mt-5">
            <AssetForm
              canChooseProperty={isSuperAdmin && allProperties}
              initial={{
                ...emptyAsset,
                propertyId: allProperties ? '' : selectedPropertyId,
                propertyCode: properties.find((property) => property.id === selectedPropertyId)?.code ?? '',
              }}
              onCancel={() => setShowCreate(false)}
              onSubmit={saveNewAsset}
              properties={
                allProperties ? properties : properties.filter((property) => property.id === selectedPropertyId)
              }
            />
          </div>
        )}
        {editingAsset && (
          <div className="mt-5">
            <AssetForm
              canChooseProperty={false}
              initial={{
                propertyId: editingAsset.propertyId,
                propertyCode: editingAsset.propertyCode,
                assetTag: editingAsset.assetTag,
                name: editingAsset.name,
                category: editingAsset.category,
                department: editingAsset.department,
                location: editingAsset.location,
                vendor: editingAsset.vendor,
                model: editingAsset.model,
                serialNumber: editingAsset.serialNumber,
                ownershipType: editingAsset.ownershipType,
                lessorName: editingAsset.lessorName,
                leaseContractNumber: editingAsset.leaseContractNumber,
                leaseStartDate: editingAsset.leaseStartDate,
                leaseEndDate: editingAsset.leaseEndDate,
                monthlyRentalCost: editingAsset.monthlyRentalCost,
                spec: editingAsset.spec,
                detail: editingAsset.detail,
                usedBy: editingAsset.usedBy,
                warrantyExpiresOn: editingAsset.warrantyExpiresOn,
                status: editingAsset.status,
                serviceType: editingAsset.serviceType,
                serviceVendor: editingAsset.serviceVendor,
                serviceSentOn: editingAsset.serviceSentOn,
                expectedReturnOn: editingAsset.expectedReturnOn,
                serviceNotes: editingAsset.serviceNotes,
              }}
              onCancel={() => setEditingAsset(null)}
              onSubmit={saveEditedAsset}
              properties={properties}
            />
          </div>
        )}
      </section>

      {loading && assets.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500" role="status">
          {t('กำลังโหลด Asset…')}
        </p>
      ) : visibleAssets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {t('ยังไม่มี Asset ใน Property นี้')}
        </p>
      ) : viewMode === 'table' ? (
        <section className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('Asset Tag')}</th>
                <th className="px-4 py-3">{t('ชื่ออุปกรณ์')}</th>
                <th className="px-4 py-3">{t('ประเภท:')}</th>
                <th className="px-4 py-3">{t('แผนก:')}</th>
                <th className="px-4 py-3">{t('สถานที่:')}</th>
                <th className="px-4 py-3">{t('สถานะ')}</th>
                <th className="px-4 py-3">{t('การดำเนินการ')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleAssets.map((asset) => (
                <tr className="align-top hover:bg-slate-50/70" key={asset.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-lotus-700">
                      {asset.propertyCode} · {asset.assetTag}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{asset.serialNumber || '—'}</p>
                  </td>
                  <td className="max-w-56 px-4 py-3">
                    <p className="font-semibold text-slate-900">{asset.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[asset.vendor, asset.model].filter(Boolean).join(' / ') || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">{t(asset.category)}</td>
                  <td className="px-4 py-3">{asset.department || t('ไม่ระบุ')}</td>
                  <td className="px-4 py-3">{asset.location}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${asset.status === 'Under Repair' ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : asset.status === 'Damaged' ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200' : asset.status === 'Retired' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800'}`}
                      >
                        {t(asset.status)}
                      </span>
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {t(asset.ownershipType === 'Leased' ? 'อุปกรณ์เช่า' : 'เป็นเจ้าของ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-lotus-700 hover:bg-lotus-50"
                      onClick={() => {
                        setShowCreate(false)
                        setEditingAsset(asset)
                      }}
                      type="button"
                    >
                      {t('แก้ไข Asset')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleAssets.map((asset) => (
            <article
              className="flex min-w-0 flex-col rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30 transition-shadow hover:shadow-md sm:p-5"
              key={asset.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all text-xs font-semibold tracking-wide text-lotus-700">
                    {asset.propertyCode} · {asset.assetTag}
                  </p>
                  <h3 className="mt-1 break-words font-semibold text-slate-900">{asset.name}</h3>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${asset.ownershipType === 'Leased' ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {t(asset.ownershipType === 'Leased' ? 'อุปกรณ์เช่า' : 'เป็นเจ้าของ')}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${asset.status === 'Under Repair' ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : asset.status === 'Damaged' ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200' : asset.status === 'Retired' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800'}`}
                  >
                    {t(asset.status)}
                  </span>
                </div>
              </div>
              <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 rounded-2xl bg-slate-50/80 p-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{t('ประเภท:')}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-800">{t(asset.category)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{t('แผนก:')}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-800">{asset.department || t('ไม่ระบุ')}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{t('สถานที่:')}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-800">{asset.location}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{t('Vendor / Model: ')}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-800">
                    {[asset.vendor, asset.model].filter(Boolean).join(' / ') || '—'}
                  </dd>
                </div>
                {asset.usedBy && (
                  <div className="col-span-2 min-w-0">
                    <dt className="text-xs text-slate-500">{t('Used by: ')}</dt>
                    <dd className="mt-1 break-words font-medium text-slate-800">{asset.usedBy}</dd>
                  </div>
                )}
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{t('Serial: ')}</dt>
                  <dd className="mt-1 break-all font-medium text-slate-800">{asset.serialNumber || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500">{t('หมดประกัน:')}</dt>
                  <dd className="mt-1 break-words font-medium text-slate-800">{asset.warrantyExpiresOn || '—'}</dd>
                </div>
              </dl>
              {asset.ownershipType === 'Leased' && (
                <div className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3">
                  <p className="text-sm font-medium text-amber-900">{t('ข้อมูลสัญญาเช่า')}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-amber-800">{t('ผู้ให้เช่า / บริษัท')}</dt>
                      <dd className="mt-0.5 break-words font-medium text-amber-950">{asset.lessorName || '—'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-amber-800">{t('เลขที่สัญญาเช่า')}</dt>
                      <dd className="mt-0.5 break-words font-medium text-amber-950">
                        {asset.leaseContractNumber || '—'}
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="text-xs text-amber-800">{t('ระยะเวลาสัญญาเช่า')}</dt>
                      <dd className="mt-0.5 break-words font-medium text-amber-950">
                        {asset.leaseStartDate || '—'} – {asset.leaseEndDate || '—'}
                      </dd>
                    </div>
                    {asset.monthlyRentalCost !== null && (
                      <div className="col-span-2 min-w-0">
                        <dt className="text-xs text-amber-800">{t('ค่าเช่าต่อเดือน')}</dt>
                        <dd className="mt-0.5 font-medium text-amber-950">
                          {asset.monthlyRentalCost.toLocaleString()} {t('บาท')}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
              {(asset.spec || asset.detail || asset.serviceType) && (
                <div className="mt-3 space-y-2 text-sm">
                  {asset.spec && (
                    <p className="break-words">
                      <span className="text-slate-500">{t('Spec: ')}</span>
                      <span className="whitespace-pre-wrap">{asset.spec}</span>
                    </p>
                  )}
                  {asset.detail && (
                    <p className="break-words">
                      <span className="text-slate-500">{t('Asset Detail: ')}</span>
                      <span className="whitespace-pre-wrap">{asset.detail}</span>
                    </p>
                  )}
                  {asset.serviceType && (
                    <p className="break-words">
                      <span className="text-slate-500">{t('การซ่อม:')}</span>{' '}
                      {t(
                        asset.serviceType === 'Warranty Claim'
                          ? 'ส่งเคลมประกัน'
                          : asset.serviceType === 'Vendor Repair'
                            ? 'ส่งซ่อม Vendor'
                            : 'ซ่อมภายใน',
                      )}
                      {asset.serviceVendor ? ` · ${asset.serviceVendor}` : ''}
                      {asset.serviceSentOn ? ` · ${t('ส่ง')} ${asset.serviceSentOn}` : ''}
                      {asset.expectedReturnOn ? ` · ${t('กำหนดรับคืน:')} ${asset.expectedReturnOn}` : ''}
                    </p>
                  )}
                </div>
              )}
              <button
                className="mt-auto self-start pt-4 text-sm font-semibold text-lotus-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-lotus-300"
                onClick={() => {
                  setShowCreate(false)
                  setEditingAsset(asset)
                }}
                type="button"
              >
                {t('แก้ไข Asset')}
              </button>
            </article>
          ))}
        </section>
      )}
      {hasMore && (
        <div className="text-center">
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
      <p className="text-xs text-slate-500">{t('แสดง Asset ตามสิทธิ์ Property แบบแบ่งหน้า ครั้งละ 25 รายการ')}</p>
    </div>
  )
}
