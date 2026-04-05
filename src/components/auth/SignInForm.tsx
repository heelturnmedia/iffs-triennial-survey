import { useState, useRef, useEffect } from 'react'
import { signIn } from '@/services/authService'
import { useUIStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'

// ─── Demo accounts (dev only) ─────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { label: 'Admin',       email: 'admin@iffs-demo.org',      password: 'Demo1234!' },
  { label: 'Supervisor',  email: 'supervisor@iffs-demo.org', password: 'Demo1234!' },
  { label: 'IFFS Member', email: 'member@iffs-demo.org',     password: 'Demo1234!' },
  { label: 'User',        email: 'user@iffs-demo.org',       password: 'Demo1234!' },
]

// ─── Supabase error → human-readable message ──────────────────────────────────

function mapAuthError(message: string): string {
  if (message.includes('Invalid login credentials'))
    return 'Incorrect email or password. Please try again.'
  if (message.includes('Email not confirmed'))
    return 'Please confirm your email address before signing in. Check your inbox.'
  if (message.includes('Too many requests'))
    return 'Too many sign-in attempts. Please wait a few minutes and try again.'
  if (message.includes('User not found'))
    return 'No account found with that email address.'
  if (message.includes('Network') || message.includes('fetch'))
    return 'Network error — check your connection and try again.'
  return message || 'Sign in failed. Please try again.'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SignInForm() {
  const { toast } = useUIStore()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [isLoading,  setIsLoading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [timedOut,   setTimedOut]   = useState(false)
  const [capsLock,   setCapsLock]   = useState(false)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear timeout on unmount
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }
    setError(null)
    setTimedOut(false)
    setIsLoading(true)

    // Show escape hatch if the redirect stalls for any reason
    timeoutRef.current = setTimeout(() => setTimedOut(true), 10_000)

    try {
      await signIn({ email: email.trim(), password })
      // Hard redirect — reads Supabase session from localStorage on reload via
      // authStore.initialize() → getSession(). Bypasses the unreliable
      // onAuthStateChange → Zustand → AuthRedirect chain that stalls in production.
      window.location.href = '/dashboard'
      // Intentionally no setIsLoading(false) here — button stays in loading state
      // until the page navigates away. Resetting it would cause a flash.
    } catch (err: unknown) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setError(mapAuthError(err instanceof Error ? err.message : ''))
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address above first.')
      return
    }
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/dashboard`,
      })
      setForgotSent(true)
      toast('Password reset email sent.', 'ok')
    } catch {
      toast('Could not send reset email. Please try again.', 'err')
    }
  }

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError(null)
    setForgotSent(false)
    setTimedOut(false)
  }

  return (
    <div className="space-y-5">
      {/* Demo quick-fill — development only */}
      {import.meta.env.DEV && (
        <div className="bg-[#f7f9f7] border border-[#e2ebe4] rounded-xl p-4">
          <p className="font-body text-[11px] font-semibold text-[#7a8a96] uppercase tracking-[0.10em] mb-3">
            Quick-fill demo accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.label}
                type="button"
                onClick={() => fillDemo(acc)}
                className="font-body text-[12px] text-left px-3 py-2 rounded-lg border border-[#e2ebe4] bg-white hover:border-[#afc7b4] hover:bg-[#e8f5ec] transition-all text-[#3d4a52]"
              >
                <span className="font-semibold text-[#0d1117] block">{acc.label}</span>
                <span className="text-[11px] text-[#b0bec5]">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeout escape hatch */}
      {timedOut && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">⏱</span>
          <div>
            <p className="font-body text-[13px] text-amber-800 font-semibold">
              Taking longer than expected
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-body text-[12px] text-amber-700 underline hover:text-amber-900 mt-0.5"
            >
              Click here to refresh and try again
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <span className="text-red-500 text-base flex-shrink-0 mt-0.5">✕</span>
          <p className="font-body text-[13px] text-red-700">{error}</p>
        </div>
      )}

      {/* Forgot password confirmation */}
      {forgotSent && !error && (
        <div className="flex items-start gap-2.5 bg-[#e8f5ec] border border-[#afc7b4] rounded-lg px-4 py-3">
          <span className="text-[#1d7733] text-base flex-shrink-0 mt-0.5">✓</span>
          <p className="font-body text-[13px] text-[#0e5921]">
            Password reset email sent. Check your inbox.
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="signin-email"
            className="block font-body text-[12px] font-semibold text-[#3d4a52] uppercase tracking-[0.08em] mb-1.5"
          >
            Email address
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@institution.org"
            required
            className="w-full font-body text-[14px] text-[#0d1117] bg-white border-[1.5px] border-[#c4d1c7] rounded-lg px-3.5 py-2.5 placeholder-[#b0bec5] outline-none transition-all focus:border-[#1d7733] focus:shadow-[0_0_0_3px_rgba(29,119,51,0.10)]"
          />
        </div>

        <div>
          <label
            htmlFor="signin-password"
            className="block font-body text-[12px] font-semibold text-[#3d4a52] uppercase tracking-[0.08em] mb-1.5"
          >
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
            onBlur={() => setCapsLock(false)}
            placeholder="••••••••"
            required
            className="w-full font-body text-[14px] text-[#0d1117] bg-white border-[1.5px] border-[#c4d1c7] rounded-lg px-3.5 py-2.5 placeholder-[#b0bec5] outline-none transition-all focus:border-[#1d7733] focus:shadow-[0_0_0_3px_rgba(29,119,51,0.10)]"
          />
          {capsLock && (
            <p className="font-body text-[12px] text-amber-600 flex items-center gap-1.5 mt-1.5">
              <span aria-hidden="true">⚠</span> Caps Lock is on
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="font-body text-[12px] text-[#1d7733] hover:text-[#0e5921] hover:underline transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 font-display text-[11px] font-bold tracking-[0.14em] uppercase px-6 py-3.5 rounded-full bg-[#1d7733] text-white hover:bg-[#0e5921] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: '0 4px 16px rgba(29,119,51,0.25)' }}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  )
}
