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
import { SurveyModal } from '@/components/survey/SurveyModal'
import { WelcomeOverlay } from '@/components/common/WelcomeOverlay'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { Nav } from '@/components/common/Nav'

export default function DashboardPage() {
  const { session, loading, isAdmin, canViewReports } = useAuthStore()
  const { activePanel } = useUIStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !session) navigate('/auth', { replace: true })
  }, [session, loading, navigate])

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
