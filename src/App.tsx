import { getLanguage, t, tKey } from './lib/i18n'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { PropertySwitcher } from './features/property/PropertySwitcher'
import { LanguageSwitcher } from './features/property/LanguageSwitcher'
import { subscribeToPropertyCctvSetting } from './features/property/propertySettingsService'
import type { TicketRecord } from './features/tickets/types'

const SignInForm = lazy(() => import('./features/auth/SignInForm').then((module) => ({ default: module.SignInForm })))
const TicketBoard = lazy(() =>
  import('./features/tickets/TicketBoard').then((module) => ({ default: module.TicketBoard })),
)
const AssetAndLicensePage = lazy(() =>
  import('./features/assets/AssetAndLicensePage').then((module) => ({ default: module.AssetAndLicensePage })),
)
const PmManager = lazy(() => import('./features/pm/PmManager').then((module) => ({ default: module.PmManager })))
const ExecutiveDashboard = lazy(() =>
  import('./features/dashboard/ExecutiveDashboard').then((module) => ({ default: module.ExecutiveDashboard })),
)
const TicketCatalogSettings = lazy(() =>
  import('./features/settings/TicketCatalogSettings').then((module) => ({ default: module.TicketCatalogSettings })),
)
const DamagedAssetsPage = lazy(() =>
  import('./features/assets/DamagedAssetsPage').then((module) => ({ default: module.DamagedAssetsPage })),
)
const RequestUsersPage = lazy(() =>
  import('./features/users/RequestUsersPage').then((module) => ({ default: module.RequestUsersPage })),
)
const UserDirectoryPage = lazy(() =>
  import('./features/users/UserDirectoryPage').then((module) => ({ default: module.UserDirectoryPage })),
)
const PropertySettingsPage = lazy(() =>
  import('./features/settings/PropertySettingsPage').then((module) => ({ default: module.PropertySettingsPage })),
)
const ActivityLogPage = lazy(() =>
  import('./features/activity/ActivityLogPage').then((module) => ({ default: module.ActivityLogPage })),
)
const AuditLogPage = lazy(() =>
  import('./features/audit/AuditLogPage').then((module) => ({ default: module.AuditLogPage })),
)
const ServicePerformancePage = lazy(() =>
  import('./features/reporting/ServicePerformancePage').then((module) => ({ default: module.ServicePerformancePage })),
)
const RcaServiceReviewPage = lazy(() =>
  import('./features/rca/RcaServiceReviewPage').then((module) => ({ default: module.RcaServiceReviewPage })),
)
const CctvDailyCheckPanel = lazy(() =>
  import('./features/infrastructure/CctvDailyCheckPanel').then((module) => ({ default: module.CctvDailyCheckPanel })),
)
const InfrastructureIncidents = lazy(() =>
  import('./features/infrastructure/InfrastructureIncidents').then((module) => ({
    default: module.InfrastructureIncidents,
  })),
)
const TodoCalendar = lazy(() =>
  import('./features/todo/TodoCalendar').then((module) => ({ default: module.TodoCalendar })),
)

const overviewNavItems = ['ภาพรวม']
const serviceNavItems = ['View Task', 'Create Task', 'ปฏิทินงาน', 'RCA & Service Review']
const operationsNavItems = ['Incident Log', 'CCTV', 'Preventive Maintenance', 'Asset & Licence', 'อุปกรณ์เสียหาย']
const governanceNavItems = ['Service Performance', 'Activities Log', 'Audit Log']
const administrationNavItems = ['Property Setup', 'ตั้งค่ารายการ', 'Request Users', 'User Directory']

function navigationLabel(item: string) {
  return item === 'View Task' ? t('Task Board') : t(item)
}

const navIcons: Record<string, string> = {
  ภาพรวม: 'M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z',
  Tasks: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  'Create Task': 'M12 5v14 M5 12h14',
  'Update Task': 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z',
  'View Task': 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'Asset & Licence': 'M12 3 3 8l9 5 9-5-9-5z M3 16l9 5 9-5 M3 12l9 5 9-5',
  'Preventive Maintenance': 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z M9 16l2 2 4-4',
  'Incident Log': 'M3 3v18h18 M7 14l4-4 4 4 6-7',
  ปฏิทินงาน: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z M8 14h3 M8 18h3 M14 14h3',
  CCTV: 'M14 10l7-4v12l-7-4 M3 6h11v12H3z M7 18v3h7',
  อุปกรณ์เสียหาย: 'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-3-3z',
  ตั้งค่ารายการ:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8 0l-.2.1h-3.6l-.1-.2a1.7 1.7 0 0 0-1.5-1h-.3l-.2.1-1.8-3.1.1-.2a1.7 1.7 0 0 0 0-1.7l-.1-.2 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8 0l.2-.1h3.6l.1.2a1.7 1.7 0 0 0 1.5 1h.3l.2-.1 1.8 3.1z',
  'Request Users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6',
  'User Directory': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6',
  'Property Setup': 'M3 21h18 M5 21V7l7-4 7 4v14 M9 10h.01 M15 10h.01 M9 14h.01 M15 14h.01 M10 21v-3h4v3',
  'Activities Log': 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  'Audit Log': 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
  'Service Performance': 'M4 19V5 M4 19h16 M8 16v-4 M12 16V8 M16 16V5',
  'RCA & Service Review': 'M4 4h16v16H4z M8 8h8 M8 12h5 M8 16h7',
}

function NavigationIcon({ item }: { item: string }) {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      <path d={navIcons[item] ?? 'M12 3v18 M3 12h18'} />
    </svg>
  )
}

function AccessMessage({ title, detail }: { title: string; detail: string }) {
  const { signOut, error } = useAuth()
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-lotus-700">{tKey('app.name')}</p>
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        {error && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
            {t(error)}
          </p>
        )}
        <button
          className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lotus-300"
          onClick={() => void signOut()}
          type="button"
        >
          {tKey('common.signOut')}
        </button>
      </section>
    </main>
  )
}

function Portal() {
  const { firebaseUser, profile, memberships, properties, accessState, signOut, error } = useAuth()
  const [, setLanguageVersion] = useState(0)
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const [activeItem, setActiveItem] = useState(overviewNavItems[0])
  const [selectedPropertyId, setSelectedPropertyId] = useState(isSuperAdmin ? 'all' : '')
  const [cctvEnabledForSelectedProperty, setCctvEnabledForSelectedProperty] = useState(true)
  const [ticketSearch, setTicketSearch] = useState('')
  const [commandSearch, setCommandSearch] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [profileImageFailed, setProfileImageFailed] = useState(false)
  const mobileMenuButton = useRef<HTMLButtonElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuTrigger = useRef<HTMLButtonElement>(null)

  function selectNavigationItem(item: string) {
    setActiveItem(item)
    setMobileMenuOpen(false)
    if (window.matchMedia('(max-width: 767px)').matches) mobileMenuButton.current?.focus()
  }

  useEffect(() => {
    document.documentElement.lang = getLanguage()
    const refreshLanguage = () => setLanguageVersion((version) => version + 1)
    window.addEventListener('lotus-language-change', refreshLanguage)
    return () => window.removeEventListener('lotus-language-change', refreshLanguage)
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      setSelectedPropertyId((current) =>
        current === 'all' || properties.some((property) => property.id === current) ? current : 'all',
      )
      return
    }
    setSelectedPropertyId((current) =>
      properties.some((property) => property.id === current) ? current : (properties[0]?.id ?? ''),
    )
  }, [isSuperAdmin, properties])

  useEffect(() => {
    if (isSuperAdmin && selectedPropertyId === 'all') {
      setCctvEnabledForSelectedProperty(properties.some((property) => property.cctvEnabled !== false))
      return
    }
    if (!selectedPropertyId) {
      setCctvEnabledForSelectedProperty(false)
      return
    }
    setCctvEnabledForSelectedProperty(false)
    return subscribeToPropertyCctvSetting(selectedPropertyId, setCctvEnabledForSelectedProperty, () =>
      setCctvEnabledForSelectedProperty(false),
    )
  }, [isSuperAdmin, selectedPropertyId, properties])

  useEffect(() => {
    const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
    const hasCctvRole = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
    if (activeItem === 'CCTV' && (!hasCctvRole || !cctvEnabledForSelectedProperty)) setActiveItem('ภาพรวม')
  }, [activeItem, cctvEnabledForSelectedProperty, isSuperAdmin, memberships, selectedPropertyId])

  useEffect(() => {
    if (!profileMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
        profileMenuTrigger.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    setProfileImageFailed(false)
  }, [firebaseUser?.photoURL])

  if (accessState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-600" role="status">
        {t('กำลังตรวจสอบบัญชีและสิทธิ์…')}
      </main>
    )
  }
  if (accessState === 'signedOut')
    return (
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center text-sm text-slate-600" role="status">
            {t('กำลังโหลดหน้าเข้าสู่ระบบ…')}
          </main>
        }
      >
        <SignInForm />
      </Suspense>
    )
  if (accessState === 'unprovisioned') {
    return (
      <AccessMessage
        title={t('บัญชียังไม่ได้รับสิทธิ์ใช้งาน')}
        detail={t(
          'บัญชีนี้ยังไม่มีโปรไฟล์ในระบบ หรือข้อมูลโปรไฟล์ไม่ครบ กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนด Role และ Property',
        )}
      />
    )
  }
  if (accessState === 'inactive') {
    return (
      <AccessMessage title={t('บัญชีถูกระงับการใช้งาน')} detail={t('โปรไฟล์นี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ')} />
    )
  }
  if (accessState === 'noProperties') {
    return (
      <AccessMessage
        title={t('ยังไม่มี Property ที่ได้รับมอบหมาย')}
        detail={t('บัญชีนี้ยังไม่มีสิทธิ์ใน Property ใด กรุณาติดต่อผู้ดูแลระบบ')}
      />
    )
  }

  const activeProperty = properties.find((property) => property.id === selectedPropertyId)
  const activeMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const profileDisplayName =
    profile?.displayName?.trim() || firebaseUser?.displayName?.trim() || firebaseUser?.email || t('ผู้ใช้')
  const profilePhotoUrl = firebaseUser?.photoURL && !profileImageFailed ? firebaseUser.photoURL : null
  const profileEmail = profile?.email || firebaseUser?.email || '—'
  const profileRole = isSuperAdmin ? t('Super Admin') : t(activeMembership?.role ?? 'Member')
  const profilePropertyAccess = isSuperAdmin
    ? t('ทุก Property')
    : properties.map((property) => `${property.code} · ${property.name}`).join(', ') || t('ยังไม่มี Property')

  const canManageCatalog = isSuperAdmin || activeMembership?.role === 'supportEngineer'
  const canCreateTicket = canManageCatalog || activeMembership?.role === 'requester'
  const canViewActivities = canManageCatalog
  const canReadRca = canManageCatalog || activeMembership?.role === 'clientExecutive'
  const canReadCctv =
    cctvEnabledForSelectedProperty &&
    (isSuperAdmin || activeMembership?.role === 'supportEngineer' || activeMembership?.role === 'clientExecutive')
  const canReadTodos = isSuperAdmin || Boolean(activeMembership)
  const canReadInfrastructure = canManageCatalog || activeMembership?.role === 'clientExecutive'
  const canReadAssetAndLicense = canManageCatalog || activeMembership?.role === 'clientExecutive'
  const canReadDamagedAssets = isSuperAdmin || Boolean(activeMembership)
  const visibleServiceNavItems = serviceNavItems.filter(
    (item) =>
      item === 'View Task' ||
      (item === 'Create Task' && canCreateTicket) ||
      (item === 'ปฏิทินงาน' && canReadTodos) ||
      (item === 'RCA & Service Review' && canReadRca),
  )
  const visibleOperationsNavItems = operationsNavItems.filter(
    (item) =>
      (item === 'Incident Log' && canReadInfrastructure) ||
      (item === 'CCTV' && canReadCctv) ||
      (item === 'Preventive Maintenance' && canManageCatalog) ||
      (item === 'Asset & Licence' && canReadAssetAndLicense) ||
      (item === 'อุปกรณ์เสียหาย' && canReadDamagedAssets),
  )
  const canReadPerformance =
    isSuperAdmin || activeMembership?.role === 'supportEngineer' || activeMembership?.role === 'clientExecutive'
  const visibleGovernanceNavItems = governanceNavItems.filter((item) =>
    item === 'Service Performance' ? canReadPerformance : canViewActivities,
  )
  const visibleAdministrationNavItems = administrationNavItems.filter(
    (item) =>
      (item === 'Property Setup' && isSuperAdmin) ||
      ((item === 'ตั้งค่ารายการ' || item === 'Request Users') && canManageCatalog) ||
      (item === 'User Directory' && isSuperAdmin),
  )
  const navItemClass = (active: boolean) =>
    `portal-nav-item group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${active ? 'bg-lotus-50 text-lotus-800 ring-1 ring-lotus-100 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`
  const selectNavigationItemWithContext = (item: string) => {
    if (['Create Task', 'Update Task', 'View Task'].includes(item)) setTicketSearch('')
    selectNavigationItem(item)
  }
  const renderNavigationItems = (items: string[]) =>
    items.map((item) => (
      <button
        aria-current={activeItem === item ? 'page' : undefined}
        aria-label={navigationLabel(item)}
        className={navItemClass(activeItem === item)}
        data-active={activeItem === item ? 'true' : 'false'}
        key={item}
        onClick={() => selectNavigationItemWithContext(item)}
        title={navigationLabel(item)}
        type="button"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${activeItem === item ? 'bg-white text-lotus-700' : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-lotus-700'}`}
        >
          <NavigationIcon item={item} />
        </span>
        <span className="portal-nav-text">{navigationLabel(item)}</span>
      </button>
    ))
  const renderNavigationGroup = (label: string, items: string[]) =>
    items.length > 0 ? (
      <div key={label}>
        <div className="mb-2 mt-5 border-t border-line pt-4">
          <p className="portal-nav-group-label px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t(label)}
          </p>
        </div>
        {renderNavigationItems(items)}
      </div>
    ) : null

  return (
    <main className="portal-app min-h-screen bg-canvas text-ink">
      <header className="portal-topbar sticky top-0 z-40 border-b border-line bg-white/95 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="portal-topbar-inner mx-auto flex max-w-[1536px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="portal-brand flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="portal-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lotus-600 text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <rect height="13" rx="2" width="19" x="2.5" y="3" />
                <path d="M8 21h8M12 16v5M6 7h12" />
              </svg>
            </div>
            <div className="portal-brand-copy min-w-0 break-words">
              <p className="font-semibold tracking-tight">{tKey('app.name')}</p>
              <p className="text-xs text-slate-500">{profile?.displayName || firebaseUser?.email}</p>
            </div>
          </div>
          <div className="portal-command-area order-3 flex w-full items-center gap-3 lg:order-2 lg:w-auto">
            <label className="portal-command-search flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <span className="sr-only">{t('ค้นหา Task')}</span>
              <input
                aria-label={t('ค้นหา Task')}
                className="min-h-9 min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-sm outline-none placeholder:text-white/60 focus:ring-0"
                onChange={(event) => setCommandSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && commandSearch.trim()) {
                    setTicketSearch(commandSearch.trim())
                    setActiveItem(canManageCatalog ? 'Update Task' : 'View Task')
                    setCommandSearch('')
                  }
                }}
                placeholder={t('ค้นหา Task…')}
                value={commandSearch}
              />
            </label>
          </div>
          <div className="portal-topbar-controls order-2 flex flex-wrap items-center justify-end gap-2 sm:gap-4 lg:order-3">
            <LanguageSwitcher />
            <PropertySwitcher
              allowAll={isSuperAdmin}
              onChange={setSelectedPropertyId}
              properties={properties}
              selectedPropertyId={selectedPropertyId}
            />
            <div className="portal-profile-menu relative" ref={profileMenuRef}>
              <button
                aria-expanded={profileMenuOpen}
                aria-haspopup="dialog"
                aria-label={t('User menu')}
                className="portal-profile-trigger flex min-h-10 max-w-[15rem] items-center gap-2 rounded-full border border-line px-2 py-1.5 text-left text-sm font-semibold text-ink hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-lotus-300"
                onClick={() => setProfileMenuOpen((open) => !open)}
                ref={profileMenuTrigger}
                type="button"
              >
                <span className="portal-user-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {profilePhotoUrl ? (
                    <img
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                      onError={() => setProfileImageFailed(true)}
                      referrerPolicy="no-referrer"
                      src={profilePhotoUrl}
                    />
                  ) : (
                    profileDisplayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="portal-profile-trigger-name hidden min-w-0 truncate sm:inline">
                  {profileDisplayName}
                </span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path d={profileMenuOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
                </svg>
              </button>
              {profileMenuOpen && (
                <div
                  aria-label={t('User detail')}
                  className="portal-profile-dropdown absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 text-ink shadow-xl shadow-slate-900/10"
                  role="dialog"
                >
                  <div className="border-b border-line pb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t('User detail')}
                    </p>
                    <p className="mt-2 truncate text-base font-semibold">{profileDisplayName}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{profileEmail}</p>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">{t('Role')}</dt>
                      <dd className="text-right font-medium">{profileRole}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-slate-500">{t('Property access')}</dt>
                      <dd className="max-w-[13rem] text-right font-medium">{profilePropertyAccess}</dd>
                    </div>
                  </dl>
                  <button
                    className="portal-profile-sign-out mt-4 min-h-10 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      void signOut()
                    }}
                    type="button"
                  >
                    {tKey('common.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="portal-layout mx-auto grid min-w-0 max-w-7xl grid-cols-1 gap-4 px-4 py-5 sm:px-6 md:gap-6 md:py-7 lg:px-8 md:grid-cols-[232px_minmax(0,1fr)]">
        <aside
          aria-label={t('เมนูหลัก')}
          className="portal-sidebar min-w-0 md:sticky md:top-[5.75rem] md:max-h-[calc(100vh-6.5rem)] md:self-start"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && mobileMenuOpen) {
              setMobileMenuOpen(false)
              mobileMenuButton.current?.focus()
            }
          }}
        >
          <button
            ref={mobileMenuButton}
            aria-controls="portal-navigation"
            aria-expanded={mobileMenuOpen}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-lotus-300 md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            {t('เมนูหลัก')}
            <span aria-hidden="true">{mobileMenuOpen ? '−' : '+'}</span>
          </button>
          <nav
            id="portal-navigation"
            aria-label={t('เมนูหลัก')}
            className={`${mobileMenuOpen ? 'block' : 'hidden'} mt-3 max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-sm md:mt-0 md:block md:max-h-[inherit]`}
          >
            {renderNavigationItems(overviewNavItems)}
            {renderNavigationGroup('งานบริการ', visibleServiceNavItems)}
            {renderNavigationGroup('การปฏิบัติการ IT', visibleOperationsNavItems)}
            {renderNavigationGroup('รายงานและการตรวจสอบ', visibleGovernanceNavItems)}
            {renderNavigationGroup('การจัดการระบบ', visibleAdministrationNavItems)}
          </nav>
        </aside>

        <section className="portal-main min-w-0 break-words pt-1">
          {activeItem === 'ภาพรวม' ? (
            <div className="portal-overview-heading flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="portal-scope-title truncate text-2xl font-semibold tracking-tight">
                  {activeProperty ? `${activeProperty.code} · ${activeProperty.name}` : t('ทุก Property')}
                </h1>
                <p className="portal-breadcrumb mt-1 text-sm font-medium text-lotus-700">{tKey('nav.overview')}</p>
              </div>
              <div className="portal-summary-date shrink-0 rounded-xl border border-line bg-white px-4 py-2.5">
                <p className="text-xs text-slate-500">{t('วันที่สรุป')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {new Intl.DateTimeFormat(getLanguage() === 'th' ? 'th-TH' : 'en-US', {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Bangkok',
                  }).format(new Date())}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="portal-breadcrumb text-sm font-medium text-lotus-700">
                {activeProperty ? `${activeProperty.code} · ${activeProperty.name}` : t('ทุก Property')}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{navigationLabel(activeItem)}</h1>
            </>
          )}
          <Suspense
            fallback={
              <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">
                {tKey('common.loading')}
              </p>
            }
          >
            {activeItem === 'ภาพรวม' ? (
              <div className="mt-6">
                <ExecutiveDashboard
                  onOpenCctv={() => setActiveItem('CCTV')}
                  onOpenTicket={(ticket: TicketRecord) => {
                    setTicketSearch(`${ticket.propertyCode}-${ticket.id.toUpperCase()}`)
                    setActiveItem(canManageCatalog ? 'Update Task' : 'View Task')
                  }}
                  onViewTickets={() => setActiveItem(canManageCatalog ? 'Update Task' : 'View Task')}
                  onViewIncidents={() => setActiveItem('Incident Log')}
                  onViewDamagedAssets={() => setActiveItem('อุปกรณ์เสียหาย')}
                  onViewLicenses={() => setActiveItem('Asset & Licence')}
                  onViewTodo={() => setActiveItem('ปฏิทินงาน')}
                  selectedPropertyId={selectedPropertyId}
                  showCctv={canReadCctv}
                />
              </div>
            ) : activeItem === 'ปฏิทินงาน' ? (
              <Suspense
                fallback={
                  <p className="mt-6 text-sm text-slate-500" role="status">
                    {t('กำลังโหลดรายการ')}
                  </p>
                }
              >
                <TodoCalendar
                  propertyCode={activeProperty?.code ?? ''}
                  propertyName={activeProperty ? `${activeProperty.code} · ${activeProperty.name}` : t('ทุก Property')}
                  selectedPropertyId={selectedPropertyId}
                />
              </Suspense>
            ) : activeItem === 'Create Task' ? (
              <div className="mt-6">
                <TicketBoard mode="create" selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'Update Task' ? (
              <div className="mt-6">
                <TicketBoard initialSearch={ticketSearch} mode="update" selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'View Task' ? (
              <div className="mt-6">
                <TicketBoard
                  initialSearch={ticketSearch}
                  mode={canManageCatalog ? 'update' : 'view'}
                  selectedPropertyId={selectedPropertyId}
                />
              </div>
            ) : activeItem === 'Asset & Licence' ? (
              <div className="mt-6">
                <AssetAndLicensePage selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'Preventive Maintenance' ? (
              <div className="mt-6">
                <PmManager selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'CCTV' ? (
              canReadCctv ? (
                <div className="mt-6">
                  <CctvDailyCheckPanel selectedPropertyId={selectedPropertyId} />
                </div>
              ) : null
            ) : activeItem === 'Incident Log' ? (
              <div className="mt-6">
                <InfrastructureIncidents selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'อุปกรณ์เสียหาย' ? (
              <div className="mt-6">
                <DamagedAssetsPage
                  onOpenAssets={() => setActiveItem('Asset & Licence')}
                  selectedPropertyId={selectedPropertyId}
                />
              </div>
            ) : activeItem === 'ตั้งค่ารายการ' ? (
              <div className="mt-6">
                <TicketCatalogSettings selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'Request Users' ? (
              <div className="mt-6">
                <RequestUsersPage selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'User Directory' ? (
              <div className="mt-6">
                <UserDirectoryPage />
              </div>
            ) : activeItem === 'Property Setup' ? (
              <div className="mt-6">
                <PropertySettingsPage />
              </div>
            ) : activeItem === 'Activities Log' ? (
              <div className="mt-6">
                <ActivityLogPage selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'Audit Log' ? (
              <div className="mt-6">
                <AuditLogPage selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'Service Performance' ? (
              <div className="mt-6">
                <ServicePerformancePage selectedPropertyId={selectedPropertyId} />
              </div>
            ) : activeItem === 'RCA & Service Review' ? (
              <div className="mt-6">
                <RcaServiceReviewPage selectedPropertyId={selectedPropertyId} />
              </div>
            ) : (
              <>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {t('เข้าสู่ระบบสำเร็จแล้ว หน้านี้เป็นโครงสำหรับพัฒนางาน')} {activeItem} {t('ใน Phase ถัดไป')}
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
                    <p className="text-xs font-semibold uppercase tracking-widest text-lotus-600">{t('Account')}</p>
                    <h2 className="mt-3 font-semibold">{profile?.displayName || firebaseUser?.email}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t(profile?.globalRole === 'superAdmin' ? 'Super Admin' : (activeMembership?.role ?? 'สมาชิก'))}
                    </p>
                  </article>
                  <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
                    <p className="text-xs font-semibold uppercase tracking-widest text-lotus-600">
                      {t('Access scope')}
                    </p>
                    <h2 className="mt-3 font-semibold">
                      {isSuperAdmin ? t('ทุก Property') : `${properties.length} Property`}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('Property Switcher แสดงเฉพาะขอบเขตที่บัญชีนี้ได้รับอนุญาต')}
                    </p>
                  </article>
                </div>
                {error && (
                  <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
                    {t(error)}
                  </p>
                )}
              </>
            )}
          </Suspense>
        </section>
      </div>
    </main>
  )
}

function AuthGate() {
  return <Portal />
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

export default App
