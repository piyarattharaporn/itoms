import { useEffect, useState } from 'react'
import { t } from '../../lib/i18n'
import { defaultSlaPolicyConfig, type SlaPolicyConfig } from '../../../shared/sla-contracts'
import type { Priority } from '../../../shared/ticket-contracts'
import type { PropertyOption } from '../auth/types'

const slaPriorities: Priority[] = ['Critical', 'High', 'Medium', 'Low']

export function defaultPropertyPolicy(propertyCode: string): SlaPolicyConfig {
  return {
    ...defaultSlaPolicyConfig,
    id: `${propertyCode.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'property'}-standard`,
    targets: Object.fromEntries(
      slaPriorities.map((priority) => [priority, { ...defaultSlaPolicyConfig.targets[priority] }]),
    ) as SlaPolicyConfig['targets'],
  }
}

export function SlaPolicyEditor({
  property,
  saving,
  onSave,
}: {
  property: Pick<PropertyOption, 'id' | 'code' | 'slaPolicy'>
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
    <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
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
      <div aria-label={t('SLA Policy targets')} className="mt-3 space-y-2" role="group">
        <div className="hidden grid-cols-[minmax(5rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-2 text-xs text-slate-500 sm:grid">
          <span className="py-2 font-medium">{t('Priority')}</span>
          <span className="py-2 font-medium">{t('First Response (นาที)')}</span>
          <span className="py-2 font-medium">{t('Resolution (นาที)')}</span>
        </div>
        {slaPriorities.map((priority) => (
          <div
            className="grid gap-2 rounded-2xl border border-violet-100/80 bg-white/75 p-3 sm:grid-cols-[minmax(5rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3"
            key={priority}
          >
            <div className="flex items-center justify-between gap-2 sm:block">
              <span className="text-sm font-semibold text-slate-700">{t(priority)}</span>
              <span className="text-[11px] text-slate-500 sm:hidden">{t('SLA target')}</span>
            </div>
            <label
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-slate-600 sm:block"
              htmlFor={`sla-response-${property.id}-${priority}`}
            >
              <span className="sm:sr-only">{`${t('First Response')} ${priority}`}</span>
              <input
                aria-label={`${t('First Response')} ${priority}`}
                className="form-input w-full min-w-0 py-2 text-sm"
                id={`sla-response-${property.id}-${priority}`}
                min="1"
                max="525600"
                onChange={(event) => updateTarget(priority, 'responseMinutes', event.target.value)}
                type="number"
                value={draft.targets[priority].responseMinutes}
              />
              <span className="sm:hidden">{t('นาที')}</span>
            </label>
            <label
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-slate-600 sm:block"
              htmlFor={`sla-resolution-${property.id}-${priority}`}
            >
              <span className="sm:sr-only">{`${t('Resolution')} ${priority}`}</span>
              <input
                aria-label={`${t('Resolution')} ${priority}`}
                className="form-input w-full min-w-0 py-2 text-sm"
                id={`sla-resolution-${property.id}-${priority}`}
                min="1"
                max="525600"
                onChange={(event) => updateTarget(priority, 'resolutionMinutes', event.target.value)}
                type="number"
                value={draft.targets[priority].resolutionMinutes}
              />
              <span className="sm:hidden">{t('นาที')}</span>
            </label>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-slate-600">
          {t('การบันทึกจะสร้าง Policy version ใหม่ และมีผลเฉพาะ Ticket ที่สร้างหลังจากนั้น')}
        </p>
        <button
          className="shrink-0 rounded-full bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
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
