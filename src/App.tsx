import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'
import Toaster from '@/components/ui/Toaster'
import { ToastContainer } from '@/components/common/Toast'
import { ConfirmModal } from '@/components/common/ConfirmModal'

// Lazy-load pages for code splitting
const HomePage = lazy(() => import('@/pages/HomePage'))
const AuthPage = lazy(() => import('@/pages/AuthPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'))
const TermsOfUsePage = lazy(() => import('@/pages/TermsOfUsePage'))
const ContactPage = lazy(() => import('@/pages/ContactPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// ─── Page-level loading fallback ────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-s1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-g1 border-t-transparent animate-spin" />
        <p className="text-f3 font-body text-sm">Loading…</p>
      </div>
    </div>
  )
}

// ─── Auth guard — wraps protected routes ────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (!session) {
    // Preserve the intended destination so we can redirect after sign-in
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// ─── Post-auth redirect — once signed in, send to dashboard ─────────────────
function AuthRedirect() {
  const { session, loading } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && session) {
      // If we came from a protected route, go back there; otherwise dashboard
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'
      navigate(from, { replace: true })
    }
  }, [session, loading, navigate, location.state])

  return null
}

// ─── Root app ────────────────────────────────────────────────────────────────
function AppRoutes() {
  // useAuth handles: auth bootstrapping, profile fetch, survey load, realtime
  useAuth()

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <>
                <AuthRedirect />
                <AuthPage />
              </>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <DashboardPage />
              </AuthGuard>
            }
          />

          {/* Legal pages */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfUsePage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Catch-all → 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      {/* Global toast notifications */}
      <Toaster />
      <ToastContainer />
      <ConfirmModal />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
