import { t } from '../../lib/i18n';
import type { PropertyOption } from '../auth/types'

interface PropertySwitcherProps {
  properties: PropertyOption[]
  selectedPropertyId: string
  onChange: (propertyId: string) => void
  allowAll: boolean
}

export function PropertySwitcher({ properties, selectedPropertyId, onChange, allowAll }: PropertySwitcherProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-slate-500">{t("Property")}</span>
      <select
        aria-label={t("เลือก Property")}
        className="property-switcher-select rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-lotus-600 focus:ring-2 focus:ring-lotus-100"
        onChange={(event) => onChange(event.target.value)}
        value={selectedPropertyId}
      >
        {allowAll && <option value="all">{t("ทุก Property")}</option>}
        {properties.map((property) => (
          <option key={property.id} value={property.id}>{property.code} · {property.name}</option>
        ))}
      </select>
    </label>
  )
}
