import { getLanguage, t } from './lib/i18n';
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { PropertySwitcher } from './features/property/PropertySwitcher'
import { LanguageSwitcher } from './features/property/LanguageSwitcher'
import { subscribeToPropertyCctvSetting } from './features/property/propertySettingsService'
import type { TicketRecord } from './features/tickets/types'

const SignInForm = lazy(() => import('./features/auth/SignInForm').then((module) => ({ default: module.SignInForm })))
const TicketBoard = lazy(() => import('./features/tickets/TicketBoard').then((module) => ({ default: module.TicketBoard })))
const AssetAndLicensePage = lazy(() => import('./features/assets/AssetAndLicensePage').then((module) => ({ default: module.AssetAndLicensePage })))
const PmManager = lazy(() => import('./features/pm/PmManager').then((module) => ({ default: module.PmManager })))
const ExecutiveDashboard = lazy(() => import('./features/dashboard/ExecutiveDashboard').then((module) => ({ default: module.ExecutiveDashboard })))
const TicketCatalogSettings = lazy(() => import('./features/settings/TicketCatalogSettings').then((module) => ({ default: module.TicketCatalogSettings })))
const DamagedAssetsPage = lazy(() => import('./features/assets/DamagedAssetsPage').then((module) => ({ default: module.DamagedAssetsPage })))
const RequestUsersPage = lazy(() => import('./features/users/RequestUsersPage').then((module) => ({ default: module.RequestUsersPage })))
const UserDirectoryPage = lazy(() => import('./features/users/UserDirectoryPage').then((module) => ({ default: module.UserDirectoryPage })))
const PropertySettingsPage = lazy(() => import('./features/settings/PropertySettingsPage').then((module) => ({ default: module.PropertySettingsPage })))
const ActivityLogPage = lazy(() => import('./features/activity/ActivityLogPage').then((module) => ({ default: module.ActivityLogPage })))
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage').then((module) => ({ default: module.AuditLogPage })))
const CctvDailyCheckPanel = lazy(() => import('./features/infrastructure/CctvDailyCheckPanel').then((module) => ({ default: module.CctvDailyCheckPanel })))
const InfrastructureIncidents = lazy(() => import('./features/infrastructure/InfrastructureIncidents').then((module) => ({ default: module.InfrastructureIncidents })))
const TodoCalendar = lazy(() => import('./features/todo/TodoCalendar').then((module) => ({ default: module.TodoCalendar })))

const primaryNavItems = ['ภาพรวม', 'ปฏิทินงาน', 'Asset & Licence', 'CCTV', 'Incident Log']
const ticketNavItems = ['Create Task', 'Update Task', 'View Task']
const systemNavItems = ['Preventive Maintenance']

const navIcons: Record<string, string> = {
  'ภาพรวม': 'M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z',
  Tasks: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  'Create Task': 'M12 5v14 M5 12h14',
  'Update Task': 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z',
  'View Task': 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'Asset & Licence': 'M12 3 3 8l9 5 9-5-9-5z M3 16l9 5 9-5 M3 12l9 5 9-5',
  'Preventive Maintenance': 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z M9 16l2 2 4-4',
  'Incident Log': 'M3 3v18h18 M7 14l4-4 4 4 6-7',
  'ปฏิทินงาน': 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z M8 14h3 M8 18h3 M14 14h3',
  CCTV: 'M14 10l7-4v12l-7-4 M3 6h11v12H3z M7 18v3h7',
  'อุปกรณ์เสียหาย': 'M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 12l-3-3z',
  'ตั้งค่ารายการ': 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 3.1-.2-.1a1.7 1.7 0 0 0-1.8 0l-.2.1h-3.6l-.1-.2a1.7 1.7 0 0 0-1.5-1h-.3l-.2.1-1.8-3.1.1-.2a1.7 1.7 0 0 0 0-1.7l-.1-.2 1.8-3.1.2.1a1.7 1.7 0 0 0 1.8 0l.2-.1h3.6l.1.2a1.7 1.7 0 0 0 1.5 1h.3l.2-.1 1.8 3.1z',
  'Request Users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6',
  'User Directory': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6',
  'Property Setup': 'M3 21h18 M5 21V7l7-4 7 4v14 M9 10h.01 M15 10h.01 M9 14h.01 M15 14h.01 M10 21v-3h4v3',
  'Activities Log': 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  'Audit Log': 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',
}

function NavigationIcon({ item }: { item: string }) {
  return <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24"><path d={navIcons[item] ?? 'M12 3v18 M3 12h18'} /></svg>
}

function AccessMessage({ title, detail }: { title: string; detail: string }) {
  const { signOut, error } = useAuth()
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-lotus-700">{t("IT Outsource Managed System (ITOMS)")}</p>
        <h1 className="mt-2 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        {error && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">{t(error)}</p>}
        <button
          className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lotus-300"
          onClick={() => void signOut()}
          type="button"
        >
          {t("ออกจากระบบ")}
        </button>
      </section>
    </main>
  )
}

function Portal() {
  const { firebaseUser, profile, memberships, properties, accessState, signOut, error } = useAuth()
  const [, setLanguageVersion] = useState(0)
  const isSuperAdmin = profile?.globalRole === 'superAdmin'
  const [activeItem, setActiveItem] = useState(primaryNavItems[0])
  const [selectedPropertyId, setSelectedPropertyId] = useState(isSuperAdmin ? 'all' : '')
  const [cctvEnabledForSelectedProperty, setCctvEnabledForSelectedProperty] = useState(true)
  const [ticketSearch, setTicketSearch] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuButton = useRef<HTMLButtonElement>(null)

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
      setSelectedPropertyId((current) => current === 'all' || properties.some((property) => property.id === current) ? current : 'all')
      return
    }
    setSelectedPropertyId((current) => properties.some((property) => property.id === current) ? current : properties[0]?.id ?? '')
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
    return subscribeToPropertyCctvSetting(selectedPropertyId, setCctvEnabledForSelectedProperty, () => setCctvEnabledForSelectedProperty(false))
  }, [isSuperAdmin, selectedPropertyId, properties])

  useEffect(() => {
    const membership = memberships.find((item) => item.propertyId === selectedPropertyId)
    const hasCctvRole = isSuperAdmin || membership?.role === 'supportEngineer' || membership?.role === 'clientExecutive'
    if (activeItem === 'CCTV' && (!hasCctvRole || !cctvEnabledForSelectedProperty)) setActiveItem('ภาพรวม')
  }, [activeItem, cctvEnabledForSelectedProperty, isSuperAdmin, memberships, selectedPropertyId])

  if (accessState === 'loading') {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600" role="status">{t("กำลังตรวจสอบบัญชีและสิทธิ์…")}</main>
  }
  if (accessState === 'signedOut') return <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-slate-600" role="status">{t("กำลังโหลดหน้าเข้าสู่ระบบ…")}</main>}><SignInForm /></Suspense>
  if (accessState === 'unprovisioned') {
    return <AccessMessage title={t("บัญชียังไม่ได้รับสิทธิ์ใช้งาน")} detail={t("บัญชีนี้ยังไม่มีโปรไฟล์ในระบบ หรือข้อมูลโปรไฟล์ไม่ครบ กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนด Role และ Property")} />
  }
  if (accessState === 'inactive') {
    return <AccessMessage title={t("บัญชีถูกระงับการใช้งาน")} detail={t("โปรไฟล์นี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ")} />
  }
  if (accessState === 'noProperties') {
    return <AccessMessage title={t("ยังไม่มี Property ที่ได้รับมอบหมาย")} detail={t("บัญชีนี้ยังไม่มีสิทธิ์ใน Property ใด กรุณาติดต่อผู้ดูแลระบบ")} />
  }

  const activeProperty = properties.find((property) => property.id === selectedPropertyId)
  const activeMembership = memberships.find((membership) => membership.propertyId === selectedPropertyId)
  const canManageCatalog = isSuperAdmin || activeMembership?.role === 'supportEngineer'
  const canCreateTicket = canManageCatalog || activeMembership?.role === 'requester'
  const canViewActivities = canManageCatalog
  const canReadCctv = cctvEnabledForSelectedProperty && (isSuperAdmin || activeMembership?.role === 'supportEngineer' || activeMembership?.role === 'clientExecutive')
  const canReadTodos = isSuperAdmin || Boolean(activeMembership)
  const canReadInfrastructure = canManageCatalog || activeMembership?.role === 'clientExecutive'
  const canReadAssetAndLicense = canManageCatalog || activeMembership?.role === 'clientExecutive'
  const canReadDamagedAssets = isSuperAdmin || Boolean(activeMembership)
  const visiblePrimaryNavItems = [
    ...primaryNavItems.filter((item) => item === 'CCTV' ? canReadCctv : item === 'Incident Log' ? canReadInfrastructure : item === 'ปฏิทินงาน' ? canReadTodos : item !== 'Asset & Licence' || canReadAssetAndLicense),
    ...(canReadDamagedAssets ? ['อุปกรณ์เสียหาย'] : []),
  ]
  const visibleTicketNavItems = ticketNavItems.filter((item) => item === 'View Task' || (item === 'Create Task' && canCreateTicket) || (item === 'Update Task' && canManageCatalog))
  const visibleSystemNavItems = [...systemNavItems.filter(() => canManageCatalog), ...(canManageCatalog ? ['Request Users', 'ตั้งค่ารายการ'] : []), ...(canViewActivities ? ['Activities Log', 'Audit Log'] : []), ...(isSuperAdmin ? ['User Directory', 'Property Setup'] : [])].sort((a, b) => a.localeCompare(b, 'en'))
  const navItemClass = (active: boolean) => `group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${active ? 'bg-lotus-50 text-lotus-800 ring-1 ring-lotus-100 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-sm shadow-slate-200/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lotus-600 text-white"><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="13" rx="2" width="19" x="2.5" y="3" /><path d="M8 21h8M12 16v5M6 7h12" /></svg></div>
            <div className="min-w-0 break-words">
              <p className="font-semibold tracking-tight">{t("IT Outsource Managed System (ITOMS)")}</p>
              <p className="text-xs text-slate-500">{profile?.displayName || firebaseUser?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <LanguageSwitcher />
            <PropertySwitcher
              allowAll={isSuperAdmin}
              onChange={setSelectedPropertyId}
              properties={properties}
              selectedPropertyId={selectedPropertyId}
            />
            <button
              className="min-h-10 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-lotus-300"
              onClick={() => void signOut()}
              type="button"
            >
              {t("ออกจากระบบ")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 gap-4 px-4 py-5 sm:px-6 md:gap-6 md:py-7 lg:px-8 md:grid-cols-[232px_minmax(0,1fr)]">
        <aside aria-label={t("เมนูหลัก")} className="min-w-0 md:sticky md:top-[5.75rem] md:max-h-[calc(100vh-6.5rem)] md:self-start" onKeyDown={(event) => {
          if (event.key === 'Escape' && mobileMenuOpen) {
            setMobileMenuOpen(false)
            mobileMenuButton.current?.focus()
          }
        }}>
          <button
            ref={mobileMenuButton}
            aria-controls="portal-navigation"
            aria-expanded={mobileMenuOpen}
            className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-lotus-300 md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            {t("เมนูหลัก")}
            <span aria-hidden="true">{mobileMenuOpen ? '−' : '+'}</span>
          </button>
          <nav id="portal-navigation" aria-label={t("เมนูหลัก")} className={`${mobileMenuOpen ? 'block' : 'hidden'} mt-3 max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-sm md:mt-0 md:block md:max-h-[inherit]`}>
            {visiblePrimaryNavItems.map((item) => (
              <button
                aria-current={activeItem === item ? 'page' : undefined}
                className={navItemClass(activeItem === item)}
                key={item}
                onClick={() => selectNavigationItem(item)}
                type="button"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${activeItem === item ? 'bg-white text-lotus-700' : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-lotus-700'}`}><NavigationIcon item={item} /></span>
                {t(item)}
              </button>
            ))}
            {visibleTicketNavItems.length > 0 && <>
              <div className="mb-2 mt-5 border-t border-line pt-4"><p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("Tasks")}</p></div>
              {visibleTicketNavItems.map((item) => <button aria-current={activeItem === item ? 'page' : undefined} className={navItemClass(activeItem === item)} key={item} onClick={() => { setTicketSearch(''); selectNavigationItem(item) }} type="button"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${activeItem === item ? 'bg-white text-lotus-700' : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-lotus-700'}`}><NavigationIcon item={item} /></span>{t(item)}</button>)}
            </>}
            {canManageCatalog && <>
              <div className="mb-2 mt-5 border-t border-line pt-4">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t("System Menu")}</p>
              </div>
              {visibleSystemNavItems.map((item) => (
                <button
                  aria-current={activeItem === item ? 'page' : undefined}
                  className={navItemClass(activeItem === item)}
                  key={item}
                  onClick={() => selectNavigationItem(item)}
                  type="button"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${activeItem === item ? 'bg-white text-lotus-700' : 'bg-slate-50 text-slate-500 group-hover:bg-white group-hover:text-lotus-700'}`}><NavigationIcon item={item} /></span>
                  {t(item)}
                </button>
              ))}
            </>}
          </nav>
        </aside>

        <section className="min-w-0 break-words pt-1">
          <p className="text-sm font-medium text-lotus-700">{activeProperty ? `${activeProperty.code} · ${activeProperty.name}` : t("ทุก Property")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t(activeItem)}</h1>
          <Suspense fallback={<p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">{t("กำลังโหลดข้อมูล…")}</p>}>
          {activeItem === 'ภาพรวม' ? (
            <div className="mt-6"><ExecutiveDashboard onOpenCctv={() => setActiveItem('CCTV')} onOpenTicket={(ticket: TicketRecord) => { setTicketSearch(`${ticket.propertyCode}-${ticket.id.toUpperCase()}`); setActiveItem(canManageCatalog ? 'Update Task' : 'View Task') }} onViewTickets={() => setActiveItem(canManageCatalog ? 'Update Task' : 'View Task')} onViewDamagedAssets={() => setActiveItem('อุปกรณ์เสียหาย')} onViewLicenses={() => setActiveItem('Asset & Licence')} onViewTodo={() => setActiveItem('ปฏิทินงาน')} selectedPropertyId={selectedPropertyId} showCctv={canReadCctv} /></div>
          ) : activeItem === 'ปฏิทินงาน' ? (
            <Suspense fallback={<p className="mt-6 text-sm text-slate-500" role="status">{t('กำลังโหลดรายการ')}</p>}><TodoCalendar propertyCode={activeProperty?.code ?? ''} propertyName={activeProperty ? `${activeProperty.code} · ${activeProperty.name}` : t('ทุก Property')} selectedPropertyId={selectedPropertyId} /></Suspense>
          ) : activeItem === 'Create Task' ? (
            <div className="mt-6"><TicketBoard mode="create" selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'Update Task' ? (
            <div className="mt-6"><TicketBoard initialSearch={ticketSearch} mode="update" selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'View Task' ? (
            <div className="mt-6"><TicketBoard initialSearch={ticketSearch} mode="view" selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'Asset & Licence' ? (
            <div className="mt-6"><AssetAndLicensePage selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'Preventive Maintenance' ? (
            <div className="mt-6"><PmManager selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'CCTV' ? (
            canReadCctv ? <div className="mt-6"><CctvDailyCheckPanel selectedPropertyId={selectedPropertyId} /></div> : null
          ) : activeItem === 'Incident Log' ? (
            <div className="mt-6"><InfrastructureIncidents selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'อุปกรณ์เสียหาย' ? (
            <div className="mt-6"><DamagedAssetsPage onOpenAssets={() => setActiveItem('Asset & Licence')} selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'ตั้งค่ารายการ' ? (
            <div className="mt-6"><TicketCatalogSettings selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'Request Users' ? (
            <div className="mt-6"><RequestUsersPage selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'User Directory' ? (
            <div className="mt-6"><UserDirectoryPage /></div>
          ) : activeItem === 'Property Setup' ? (
            <div className="mt-6"><PropertySettingsPage /></div>
          ) : activeItem === 'Activities Log' ? (
            <div className="mt-6"><ActivityLogPage selectedPropertyId={selectedPropertyId} /></div>
          ) : activeItem === 'Audit Log' ? (
            <div className="mt-6"><AuditLogPage selectedPropertyId={selectedPropertyId} /></div>
          ) : (
            <>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {t("เข้าสู่ระบบสำเร็จแล้ว หน้านี้เป็นโครงสำหรับพัฒนางาน")} {activeItem}  {t("ใน Phase ถัดไป")}
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
                  <p className="text-xs font-semibold uppercase tracking-widest text-lotus-600">{t("Account")}</p>
                  <h2 className="mt-3 font-semibold">{profile?.displayName || firebaseUser?.email}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t(profile?.globalRole === 'superAdmin' ? 'Super Admin' : activeMembership?.role ?? 'สมาชิก')}</p>
                </article>
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
                  <p className="text-xs font-semibold uppercase tracking-widest text-lotus-600">{t("Access scope")}</p>
                  <h2 className="mt-3 font-semibold">{isSuperAdmin ? t("ทุก Property") : `${properties.length} Property`}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t("Property Switcher แสดงเฉพาะขอบเขตที่บัญชีนี้ได้รับอนุญาต")}</p>
                </article>
              </div>
              {error && <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">{t(error)}</p>}
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
  return <AuthProvider><AuthGate /></AuthProvider>
}

export default App
