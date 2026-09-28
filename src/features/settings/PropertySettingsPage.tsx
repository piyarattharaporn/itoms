import { t } from '../../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { defaultSlaPolicyConfig, type SlaPolicyConfig } from '../../../shared/sla-contracts'
import type { Priority } from '../../../shared/ticket-contracts'
import { setPropertyCctvEnabled, setPropertySlaPolicy } from '../property/propertySettingsService'

const slaPriorities: Priority[] = ['Critical', 'High', 'Medium', 'Low']

function defaultPropertyPolicy(propertyCode: string): SlaPolicyConfig {
  return {
    ...defaultSlaPolicyConfig,
    id: `${propertyCode.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'property'}-standard`,
    targets: Object.fromEntries(
      slaPriorities.map((priority) => [priority, { ...defaultSlaPolicyConfig.targets[priority] }]),
    ) as SlaPolicyConfig['targets'],
  }
}

function PropertySlaEditor({
  property,
  saving,
  onSave,
}: {
  property: ReturnType<typeof useAuth>['properties'][number]
  saving: boolean
  onSave: (policy: SlaPolicyConfig) => Promise<void>
}) {
  const [draft, setDraft] = useState<SlaPolicyConfig>(() => property.slaPolicy ?? defaultPropertyPolicy(property.code))

  useEffect(() => {
    setDraft(property.slaPolicy ?? defaultPropertyPolicy(property.code))
  }, [property.code, property.slaPolicy])

  function updateTarget(priority: Priority, field: 'responseMinutes' | 'resolutionMinutes', value: string) {
    const minutes = Number(value)
    setDraft((current) => ({
      ...current,
      targets: {
        ...current.targets,
        [priority]: {
          ...current.targets[priority],
          [field]: Number.isFinite(minutes) ? Math.max(1, Math.min(525_600, Math.floor(minutes))) : 1,
        },
      },
    }))
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">{t('SLA Policy')}</p>
          <p className="mt-1 text-xs text-slate-500">
            {property.slaPolicy
              ? `${t('Policy version')} ${property.slaPolicy.version}`
              : t('ใช้ค่า Default จนกว่าจะบันทึก Policy ของ Property นี้')}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-violet-800">24x7</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead>
            <tr className="border-b border-violet-100 text-slate-500">
              <th className="px-2 py-2 font-medium">{t('Priority')}</th>
              <th className="px-2 py-2 font-medium">{t('First Response (นาที)')}</th>
              <th className="px-2 py-2 font-medium">{t('Resolution (นาที)')}</th>
            </tr>
          </thead>
          <tbody>
            {slaPriorities.map((priority) => (
              <tr className="border-b border-violet-100/70 last:border-0" key={priority}>
                <th className="px-2 py-2 font-semibold text-slate-700">{t(priority)}</th>
                <td className="px-2 py-2">
                  <label
                    className="sr-only"
                    htmlFor={`sla-response-${property.id}-${priority}`}
                  >{`${t('First Response')} ${priority}`}</label>
                  <input
                    className="form-input min-w-28 py-2 text-sm"
                    id={`sla-response-${property.id}-${priority}`}
                    min="1"
                    max="525600"
                    onChange={(event) => updateTarget(priority, 'responseMinutes', event.target.value)}
                    type="number"
                    value={draft.targets[priority].responseMinutes}
                  />
                </td>
                <td className="px-2 py-2">
                  <label
                    className="sr-only"
                    htmlFor={`sla-resolution-${property.id}-${priority}`}
                  >{`${t('Resolution')} ${priority}`}</label>
                  <input
                    className="form-input min-w-28 py-2 text-sm"
                    id={`sla-resolution-${property.id}-${priority}`}
                    min="1"
                    max="525600"
                    onChange={(event) => updateTarget(priority, 'resolutionMinutes', event.target.value)}
                    type="number"
                    value={draft.targets[priority].resolutionMinutes}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-500">
          {t('การบันทึกจะสร้าง Policy version ใหม่ และมีผลเฉพาะ Ticket ที่สร้างหลังจากนั้น')}
        </p>
        <button
          className="shrink-0 rounded-full bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60"
          disabled={saving}
          onClick={() => void onSave({ ...draft, version: (property.slaPolicy?.version ?? 0) + 1 })}
          type="button"
        >
          {saving ? t('กำลังบันทึก…') : t('บันทึก SLA')}
        </button>
      </div>
    </div>
  )
}

export function PropertySettingsPage() {
  const { properties, accessState, profile } = useAuth()
  const [search, setSearch] = useState('')
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null)
  const [savingSlaPropertyId, setSavingSlaPropertyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const filteredProperties = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('th')
    if (!term) return properties
    return properties.filter((property) =>
      `${property.code} ${property.name} ${property.id}`.toLocaleLowerCase('th').includes(term),
    )
  }, [properties, search])

  if (accessState === 'loading')
    return (
      <p className="py-10 text-center text-sm text-slate-500" role="status">
        {t('กำลังโหลด Property…')}
      </p>
    )
  if (!isSuperAdmin)
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800" role="alert">
        {t('หน้านี้สำหรับ Super Admin เท่านั้น')}
      </p>
    )

  async function toggleCctv(propertyId: string, enabled: boolean) {
    if (
      !window.confirm(
        t(enabled ? 'ยืนยันเปิด CCTV สำหรับ Property นี้หรือไม่' : 'ยืนยันปิด CCTV สำหรับ Property นี้หรือไม่'),
      )
    )
      return
    setSavingPropertyId(propertyId)
    setError(null)
    try {
      await setPropertyCctvEnabled(propertyId, enabled)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('บันทึกการตั้งค่า CCTV ไม่สำเร็จ'))
    } finally {
      setSavingPropertyId(null)
    }
  }

  async function saveSlaPolicy(propertyId: string, policy: SlaPolicyConfig) {
    setSavingSlaPropertyId(propertyId)
    setError(null)
    try {
      await setPropertySlaPolicy(propertyId, policy)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('บันทึก SLA ไม่สำเร็จ'))
    } finally {
      setSavingSlaPropertyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-lotus-700">{t('System Setup')}</p>
            <h2 className="mt-1 text-lg font-semibold">{t('รายการ Property')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {t(
                'ตรวจสอบ Property ที่ระบบใช้งานอยู่ ซึ่งจะแสดงใน Property Switcher และใช้กำหนดขอบเขตข้อมูลของแต่ละโรงแรม',
              )}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-slate-800">
            <p className="text-xs text-slate-500">{t('Property ที่ใช้งาน')}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{properties.length}</p>
          </div>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            {t(error)}
          </p>
        )}
        <label className="mt-5 block max-w-md text-sm font-medium text-slate-700" htmlFor="property-search">
          {t('ค้นหา Property')}
          <input
            autoComplete="off"
            className="form-input mt-1 w-full"
            id="property-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('ค้นหาด้วยชื่อหรือรหัส')}
            type="search"
            value={search}
          />
        </label>
      </section>

      {filteredProperties.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('ไม่พบ Property ตามคำค้นหา')}
        </p>
      ) : (
        <section aria-label={t('Property ที่ตั้งค่าแล้ว')} className="grid gap-3 md:grid-cols-2">
          {filteredProperties.map((property) => (
            <article className="rounded-2xl border border-slate-200/80 bg-white p-5" key={property.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lotus-700">{property.code}</p>
                  <h3 className="mt-1 break-words font-semibold text-slate-900">{property.name}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  {t('ใช้งาน')}
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="font-medium text-slate-800">{t('เมนู CCTV')}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('เปิดหรือปิดเมนูและการบันทึก CCTV สำหรับ Property นี้')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('เมื่อปิด เมนูและสรุป CCTV จะถูกซ่อน แต่ประวัติเดิมยังคงอยู่')}
                  </p>
                </div>
                <button
                  aria-checked={property.cctvEnabled !== false}
                  aria-label={`${t('เมนู CCTV')} · ${property.code}`}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${property.cctvEnabled !== false ? 'bg-lotus-700' : 'bg-slate-300'} disabled:cursor-wait disabled:opacity-60`}
                  disabled={savingPropertyId === property.id}
                  onClick={() => void toggleCctv(property.id, property.cctvEnabled === false)}
                  role="switch"
                  type="button"
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${property.cctvEnabled !== false ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
              <PropertySlaEditor
                property={property}
                saving={savingSlaPropertyId === property.id}
                onSave={(policy) => saveSlaPolicy(property.id, policy)}
              />
              <p className="mt-2 text-right text-xs font-medium text-slate-500">
                {savingPropertyId === property.id
                  ? t('กำลังบันทึก…')
                  : property.cctvEnabled === false
                    ? t('ปิดใช้งาน CCTV')
                    : t('เปิดใช้งาน CCTV')}
              </p>
              <p className="mt-3 break-all text-xs text-slate-500">Document ID: {property.id}</p>
            </article>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 text-sm leading-6 text-slate-700">
        <h3 className="font-semibold text-slate-900">{t('การเพิ่มหรือแก้ไข Property')}</h3>
        <p className="mt-1">
          {t(
            'การเพิ่มหรือแก้ไขข้อมูลหลักของ Property ยังปิดไว้ แต่ Super Admin เปลี่ยนได้เฉพาะการเปิดหรือปิด CCTV โดยระบบตรวจสิทธิ์ซ้ำใน Firestore Rules',
          )}
        </p>
        <p className="mt-2 text-xs text-slate-600">
          {t(
            'เมื่อสร้าง Property ใหม่ ต้องใช้ Document ID และรหัส Property ให้ตรงกับ Membership และข้อมูลอ้างอิงที่เกี่ยวข้องด้วย',
          )}
        </p>
      </section>
    </div>
  )
}
