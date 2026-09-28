import { t } from '../../lib/i18n';
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { AssetRegistry } from './AssetRegistry'
import { LicenseRenewalPanel } from '../licenses/LicenseRenewalPanel'

type AssetPageTab = 'assets' | 'licenses'

export function AssetAndLicensePage({ selectedPropertyId }: { selectedPropertyId: string }) {
  const { profile, memberships } = useAuth()
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
  const canManageAssets = isSuperAdmin || membership?.role === 'supportEngineer'
  const [activeTab, setActiveTab] = useState<AssetPageTab>(canManageAssets ? 'assets' : 'licenses')
  const allTabs: Array<{ id: AssetPageTab; label: string; description: string }> = [
    { id: 'assets', label: 'Asset', description: 'ทะเบียนอุปกรณ์และประวัติซ่อม' },
    { id: 'licenses', label: 'Licence', description: 'รายละเอียด Software License และการต่ออายุ' },
  ]
  const tabs = allTabs.filter((tab) => tab.id !== 'assets' || canManageAssets)

  return <div className="space-y-5">
    <div aria-label={t("ส่วนข้อมูล Asset และ Licence")} className="grid gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-2" role="tablist">
      {tabs.map((tab) => <button aria-controls={`asset-license-panel-${tab.id}`} aria-selected={activeTab === tab.id} className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-lotus-300 ${activeTab === tab.id ? 'bg-white text-lotus-800 shadow-sm' : 'text-slate-600 hover:bg-white/70'}`} id={`asset-license-tab-${tab.id}`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">
        <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeTab === tab.id ? 'bg-lotus-50 text-lotus-700' : 'bg-white text-slate-500'}`}>
          {tab.id === 'assets' ? <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5zM3 16l9 5 9-5M3 12l9 5 9-5" /></svg> : <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5V21M8 7h8M8 11h8" /></svg>}
        </span>
        <span><span className="block text-sm font-semibold">{t(tab.label)}</span><span className="mt-0.5 block text-xs text-slate-500">{t(tab.description)}</span></span>
      </button>)}
    </div>
    <section aria-labelledby={`asset-license-tab-${activeTab}`} className="min-w-0" id={`asset-license-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
      {activeTab === 'assets' ? <AssetRegistry selectedPropertyId={selectedPropertyId} /> : <LicenseRenewalPanel selectedPropertyId={selectedPropertyId} />}
    </section>
  </div>
}
