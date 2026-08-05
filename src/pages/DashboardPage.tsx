import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { useUIStore } from '@/stores/uiStore'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav'
import { cn } from '@/utils/cn'
import { OverviewPanel } from '@/components/dashboard/panels/OverviewPanel'
import { ProfilePanel } from '@/components/dashboard/panels/ProfilePanel'

// Admin/supervisor panels are code-split. They were statically imported, which
// made their whole dependency graph a hard dependency of the dashboard — most
// expensively survey-creator (~1.3 MB), an editor only admins ever open. Every
// respondent was downloading it just to answer the survey, which is exactly the
// wrong trade on hospital wifi. Overview and My Profile stay eager: every role
// lands on one of them immediately.
const ReportsPanel     = lazy(() => import('@/components/dashboard/panels/ReportsPanel').then(m => ({ default: m.ReportsPanel })))
const UsersPanel       = lazy(() => import('@/components/dashboard/panels/UsersPanel').then(m => ({ default: m.UsersPanel })))
const ActivityPanel    = lazy(() => import('@/components/dashboard/panels/ActivityPanel').then(m => ({ default: m.ActivityPanel })))
const SurveyMgmtPanel  = lazy(() => import('@/components/dashboard/panels/SurveyMgmtPanel').then(m => ({ default: m.SurveyMgmtPanel })))
const WASettingsPanel  = lazy(() => import('@/components/dashboard/panels/WASettingsPanel').then(m => ({ default: m.WASettingsPanel })))
const AppFlowPanel     = lazy(() => import('@/components/dashboard/panels/AppFlowPanel').then(m => ({ default: m.AppFlowPanel })))

function PanelLoader() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Loading panel">
      <div className="w-8 h-8 rounded-full border-2 border-g1 border-t-transparent animate-spin" />
    </div>
  )
}
import { SurveyModal } from '@/components/survey/SurveyModal'
import { WelcomeOverlay } from '@/components/common/WelcomeOverlay'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Nav } from '@/components/common/Nav'
import type { ActivePanel } from '@/types'

const ADMIN_PANELS: ActivePanel[] = ['users', 'activity', 'survey-mgmt', 'wa-settings', 'app-flow']
const ALL_PANELS: ActivePanel[] = ['overview', 'reports', ...ADMIN_PANELS, 'profile']

export default function DashboardPage() {
  const { session, profile, loading, isAdmin, canViewReports, isPasswordRecovery } = useAuthStore()
  const { activePanel, setActivePanel } = useUIStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true })
  }, [session, loading, navigate])

  // If the user is on an admin panel but their profile is temporarily null (auth
  // event in-flight), don't let the main area go blank — reset to overview.
  // When the profile resolves, the sidebar will reveal the admin nav again and
  // the user can navigate back. This is purely a safety net for the ~300ms
  // window between an auth event clearing the profile and fetchProfile completing.
  useEffect(() => {
    if (profile) return // profile is loaded, nothing to do
    const adminPanels = ['reports', 'users', 'activity', 'survey-mgmt', 'wa-settings', 'app-flow']
    if (adminPanels.includes(activePanel)) {
      setActivePanel('overview')
    }
  }, [profile, activePanel, setActivePanel])

  // A panel is openable via URL only if the user's role allows it.
  const canOpenPanel = (id: ActivePanel): boolean => {
    if (ADMIN_PANELS.includes(id)) return isAdmin()
    if (id === 'reports') return canViewReports()
    return true
  }

  // Keep the URL in sync with the survey modal: /dashboard?survey=open while
  // filling the survey. Landing on that URL directly re-opens the survey, and
  // the browser Back button closes it (the param removal drops the modal).
  // Both effects preserve any other params (e.g. ?panel=…).
  const { isModalOpen, openModal, closeModal } = useSurveyStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const surveyParam = searchParams.get('survey') === 'open'
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (isModalOpen && !surveyParam) {
      params.set('survey', 'open')
      setSearchParams(params)
    } else if (!isModalOpen && surveyParam) {
      // Modal closed via its own X — reflect that in the URL.
      params.delete('survey')
      setSearchParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen])
  useEffect(() => {
    if (surveyParam && !isModalOpen && !isPasswordRecovery) openModal()
    if (!surveyParam && isModalOpen) closeModal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyParam])

  // Panel deep-links for every user: /dashboard?panel=<id> always reflects the
  // active panel, and landing on such a URL opens that panel directly (subject
  // to the role guard). Back/forward walks through previously visited panels.
  const panelParam = searchParams.get('panel')
  useEffect(() => {
    // URL → state. Ignore unknown ids; drop panels the role can't open.
    if (!panelParam) {
      if (activePanel !== 'overview') setActivePanel('overview')
      return
    }
    if (!ALL_PANELS.includes(panelParam as ActivePanel)) return
    const target = panelParam as ActivePanel
    if (!profile) return // role unknown while profile loads — decide once it resolves
    if (!canOpenPanel(target)) {
      const params = new URLSearchParams(searchParams)
      params.delete('panel')
      setSearchParams(params, { replace: true })
      return
    }
    if (target !== activePanel) setActivePanel(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelParam, profile])
  useEffect(() => {
    // State → URL. 'overview' is the default and keeps a clean /dashboard.
    const params = new URLSearchParams(searchParams)
    if (activePanel === 'overview') params.delete('panel')
    else params.set('panel', activePanel)
    if ((params.get('panel') ?? '') !== (searchParams.get('panel') ?? '')) {
      setSearchParams(params)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel])

  // Password recovery: auto-navigate to the profile panel exactly once per
  // activation. The ref gate prevents a loop if something else later tries
  // to flip activePanel while recovery is active.
  const didAutoNavRef = useRef(false)
  useEffect(() => {
    if (isPasswordRecovery && !didAutoNavRef.current) {
      didAutoNavRef.current = true
      setActivePanel('profile')
    }
    if (!isPasswordRecovery) {
      didAutoNavRef.current = false
    }
  }, [isPasswordRecovery, setActivePanel])

  // Mobile nav drawer (admin full menu). Closes on scrim click and Escape.
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  if (loading) return <PageLoader />

  return (
    <div className="min-h-dvh" style={{ background: 'var(--s1)' }}>
      <Nav />
      <div style={{ paddingTop: '68px' }} className="flex h-dvh overflow-hidden">
        {/* Desktop sidebar — hidden on mobile, replaced by bottom nav + drawer */}
        <div className="hidden lg:block w-[232px] shrink-0 h-full">
          <Sidebar />
        </div>
        {/* min-w-0: a flex child defaults to min-width:auto, so a single wide
            descendant (table, long token) would stretch it past the viewport
            and clip the page horizontally on small screens. */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-24 lg:pb-0">
          {activePanel === 'overview' && <OverviewPanel />}
          {activePanel === 'profile' && <ProfilePanel />}
          <Suspense fallback={<PanelLoader />}>
            {activePanel === 'reports' && canViewReports() && <ReportsPanel />}
            {activePanel === 'users' && isAdmin() && <UsersPanel />}
            {activePanel === 'activity' && isAdmin() && <ActivityPanel />}
            {activePanel === 'survey-mgmt' && isAdmin() && <SurveyMgmtPanel />}
            {activePanel === 'wa-settings' && isAdmin() && <WASettingsPanel />}
            {activePanel === 'app-flow'    && isAdmin() && <AppFlowPanel />}
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom navigation (core destinations, thumb zone) */}
      <MobileBottomNav onOpenMenu={() => setDrawerOpen(true)} />

      {/* Mobile drawer — full nav (admin panels live here) */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-[900]',
          drawerOpen ? 'visible' : 'invisible pointer-events-none',
        )}
        aria-hidden={!drawerOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/35 transition-opacity duration-200',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard menu"
          className={cn(
            'absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-xl',
            'transition-transform duration-250 ease-out',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      <SurveyModal />
      <WelcomeOverlay />
      <ConfirmModal />
    </div>
  )
}

function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--s1)' }}
    >
      <div className="w-10 h-10 rounded-full border-2 border-g1 border-t-transparent animate-spin" />
    </div>
  )
}
