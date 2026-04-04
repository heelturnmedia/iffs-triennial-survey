import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { OverviewPanel } from '@/components/dashboard/panels/OverviewPanel'
import { ReportsPanel } from '@/components/dashboard/panels/ReportsPanel'
import { UsersPanel } from '@/components/dashboard/panels/UsersPanel'
import { SurveyMgmtPanel } from '@/components/dashboard/panels/SurveyMgmtPanel'
import { WASettingsPanel } from '@/components/dashboard/panels/WASettingsPanel'
import { AppFlowPanel } from '@/components/dashboard/panels/AppFlowPanel'
import { SurveyModal } from '@/components/survey/SurveyModal'
import { WelcomeOverlay } from '@/components/common/WelcomeOverlay'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Nav } from '@/components/common/Nav'

export default function DashboardPage() {
  const { session, profile, loading, isAdmin, canViewReports } = useAuthStore()
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
    const adminPanels = ['reports', 'users', 'survey-mgmt', 'wa-settings', 'app-flow']
    if (adminPanels.includes(activePanel)) {
      setActivePanel('overview')
    }
  }, [profile, activePanel, setActivePanel])

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
          {activePanel === 'survey-mgmt' && isAdmin() && <SurveyMgmtPanel />}
          {activePanel === 'wa-settings' && isAdmin() && <WASettingsPanel />}
          {activePanel === 'app-flow'    && isAdmin() && <AppFlowPanel />}
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
