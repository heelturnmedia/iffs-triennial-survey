import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { useUIStore } from '@/stores/uiStore'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { OverviewPanel } from '@/components/dashboard/panels/OverviewPanel'
import { ReportsPanel } from '@/components/dashboard/panels/ReportsPanel'
import { UsersPanel } from '@/components/dashboard/panels/UsersPanel'
import { ActivityPanel } from '@/components/dashboard/panels/ActivityPanel'
import { SurveyMgmtPanel } from '@/components/dashboard/panels/SurveyMgmtPanel'
import { WASettingsPanel } from '@/components/dashboard/panels/WASettingsPanel'
import { AppFlowPanel } from '@/components/dashboard/panels/AppFlowPanel'
import { ProfilePanel } from '@/components/dashboard/panels/ProfilePanel'
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

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen" style={{ background: 'var(--s1)' }}>
      <Nav />
      <div style={{ paddingTop: '68px' }} className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {activePanel === 'overview' && <OverviewPanel />}
          {activePanel === 'reports' && canViewReports() && <ReportsPanel />}
          {activePanel === 'users' && isAdmin() && <UsersPanel />}
          {activePanel === 'activity' && isAdmin() && <ActivityPanel />}
          {activePanel === 'survey-mgmt' && isAdmin() && <SurveyMgmtPanel />}
          {activePanel === 'wa-settings' && isAdmin() && <WASettingsPanel />}
          {activePanel === 'app-flow'    && isAdmin() && <AppFlowPanel />}
          {activePanel === 'profile' && <ProfilePanel />}
        </main>
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
      <div className="w-10 h-10 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
    </div>
  )
}
