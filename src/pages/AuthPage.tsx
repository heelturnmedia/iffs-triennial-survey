// ─────────────────────────────────────────────────────────────────────────────
// AuthPage — IFFS 2026 Triennial Survey · Split-panel authentication
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate }          from 'react-router-dom'
import { signIn, signUp, signInWithProvider } from '@/services/authService'
import { useAuthStore }         from '@/stores/authStore'
import { useUIStore }           from '@/stores/uiStore'
import { useWildApricot }       from '@/hooks/useWildApricot'
import { Nav }                  from '@/components/common/Nav'
import { Footer }               from '@/components/common/Footer'

// ─── Types ────────────────────────────────────────────────────────────────────
type TabMode = 'signin' | 'signup'

interface DemoAccount {
  label:    string
  email:    string
  password: string
  role:     string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHECKLIST_ITEMS: { icon: string; text: string }[] = [
  { icon: '🔒', text: 'Secure encrypted data transmission' },
  { icon: '🌍', text: 'Global registry of 147+ countries' },
  { icon: '💾', text: 'Auto-save — complete at your own pace' },
  { icon: '✓',  text: 'One submission per country, tamper-proof' },
]

const LEFT_STATS: { value: string; label: string }[] = [
  { value: '2026', label: 'SURVEY YEAR' },
  { value: '20',   label: 'SECTIONS' },
  { value: '147',  label: 'COUNTRIES' },
]

const DEMO_ACCOUNTS: DemoAccount[] = import.meta.env.DEV ? [
  { label: 'Admin',      email: 'admin@iffs.org',       password: 'admin123',  role: 'admin' },
  { label: 'Supervisor', email: 'supervisor@iffs.org',  password: 'super123',  role: 'supervisor' },
  { label: 'User',       email: 'user@hospital.org',    password: 'user123',   role: 'user' },
  { label: 'Member',     email: 'member@iffs.org',      password: 'member123', role: 'iffs-member' },
] : []

const SOCIAL_PROVIDERS: { id: 'google' | 'facebook' | 'linkedin_oidc'; label: string; icon: React.ReactNode }[] = [
  {
    id:    'google',
    label: 'Google',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
        <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z"/>
        <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
        <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
      </svg>
    ),
  },
  {
    id:    'facebook',
    label: 'Facebook',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
  },
  {
    id:    'linkedin_oidc',
    label: 'LinkedIn',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

// ─── Animated SVG grid background ─────────────────────────────────────────────
function GridBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
      style={{ opacity: 0.18 }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path
            d="M 48 0 L 0 0 0 48"
            fill="none"
            stroke="#a6ce39"
            strokeWidth="0.6"
            strokeDasharray="1000"
            strokeDashoffset="0"
            style={{
              animation: 'gridDraw 2.4s cubic-bezier(0.22,1,0.36,1) forwards',
            }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-grid)" />
    </svg>
  )
}

// ─── Social button ─────────────────────────────────────────────────────────────
interface SocialButtonProps {
  provider: typeof SOCIAL_PROVIDERS[number]
  onToast:  (msg: string) => void
}

function SocialButton({ provider, onToast }: SocialButtonProps) {
  const handleClick = async () => {
    try {
      await signInWithProvider(provider.id)
    } catch (err) {
      onToast(err instanceof Error ? err.message : `${provider.label} sign-in failed`)
    }
  }

  return (
    <button
      type="button"
      title={`Sign in with ${provider.label}`}
      aria-label={`Sign in with ${provider.label}`}
      onClick={handleClick}
      className="flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-150 hover:scale-[1.06] active:scale-[0.96] focus-visible:outline-none"
      style={{
        borderColor:     '#e2ebe4',
        backgroundColor: '#f7f9f7',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor     = 'rgba(29,119,51,0.3)'
        el.style.backgroundColor = '#e8f5ec'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor     = '#e2ebe4'
        el.style.backgroundColor = '#f7f9f7'
      }}
    >
      {provider.icon}
    </button>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────
interface InputFieldProps {
  id:           string
  label:        string
  type?:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?:    boolean
  hint?:        React.ReactNode
}

function InputField({
  id, label, type = 'text', value, onChange,
  placeholder, autoComplete, required = false, hint,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-display text-[11px] font-bold tracking-[0.12em] uppercase mb-2"
        style={{ color: '#3d4a52' }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full font-body text-sm rounded-xl px-4 py-3 transition-all duration-150 outline-none"
        style={{
          border:          `1.5px solid ${focused ? '#1d7733' : '#e2ebe4'}`,
          backgroundColor: focused ? '#ffffff' : '#f7f9f7',
          color:           '#0d1117',
          boxShadow:       focused ? '0 0 0 3px rgba(29,119,51,0.1)' : 'none',
        }}
      />
      {hint && (
        <div className="mt-1.5 font-body text-xs" style={{ color: '#7a8a96' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AuthPage() {
  const navigate = useNavigate()
  const { toast } = useUIStore()
  const { checkMembership, isChecking } = useWildApricot()

  // Tab state
  const [tab, setTab] = useState<TabMode>('signin')

  // Sign-in form
  const [siEmail,    setSiEmail]    = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [siLoading,  setSiLoading]  = useState(false)
  const [siError,    setSiError]    = useState<string | null>(null)

  // Sign-up form
  const [suFirst,    setSuFirst]    = useState('')
  const [suLast,     setSuLast]     = useState('')
  const [suEmail,    setSuEmail]    = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [suLoading,  setSuLoading]  = useState(false)
  const [suError,    setSuError]    = useState<string | null>(null)
  const [waRole,     setWaRole]     = useState<string | null>(null)
  const [waChecked,  setWaChecked]  = useState(false)

  // WA debounce ref
  const waTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redirect if already authenticated
  const { user } = useAuthStore()
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  // ── WildApricot debounced check ──────────────────────────────────────────
  const handleSuEmailChange = useCallback(
    (val: string) => {
      setSuEmail(val)
      setWaRole(null)
      setWaChecked(false)
      if (waTimer.current) clearTimeout(waTimer.current)
      if (!val || !val.includes('@')) return
      waTimer.current = setTimeout(async () => {
        const role = await checkMembership(val)
        setWaRole(role)
        setWaChecked(true)
      }, 600)
    },
    [checkMembership]
  )

  // ── Sign In ───────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSiError(null)
    setSiLoading(true)
    try {
      await signIn({ email: siEmail, password: siPassword })
      navigate('/dashboard')
    } catch (err) {
      setSiError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setSiLoading(false)
    }
  }

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuError(null)
    setSuLoading(true)
    try {
      await signUp({
        email:     suEmail,
        password:  suPassword,
        firstName: suFirst,
        lastName:  suLast,
      })
      navigate('/dashboard')
    } catch (err) {
      setSuError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setSuLoading(false)
    }
  }

  // ── Demo quick-fill ──────────────────────────────────────────────────────
  const fillDemo = (account: DemoAccount) => {
    if (tab === 'signup') setTab('signin')
    setSiEmail(account.email)
    setSiPassword(account.password)
    setSiError(null)
  }

  // ── Social handler ───────────────────────────────────────────────────────
  const handleSocialToast = (msg: string) => toast(msg, 'info')

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgotPassword = () => {
    toast('Password reset — enter your email and we will send a reset link.', 'info')
  }

  const isDev = import.meta.env.DEV

  // ── WA hint node ─────────────────────────────────────────────────────────
  const waHint = (() => {
    if (!suEmail || !suEmail.includes('@')) return null
    if (isChecking) return <span>Checking IFFS membership…</span>
    if (!waChecked) return null
    if (waRole === 'iffs-member')
      return (
        <span style={{ color: '#1d7733' }}>
          IFFS member detected — your account will be granted member access.
        </span>
      )
    return <span>No IFFS membership found — standard access will be assigned.</span>
  })()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ paddingTop: '68px' }}
    >
      <Nav />
      <style>{`
        @media (min-width: 960px) {
          .auth-grid { grid-template-columns: 1fr 1fr !important; }
          .auth-left  { display: flex !important; }
        }
      `}</style>

      <div
        className="auth-grid min-h-[calc(100vh-68px)]"
        style={{ display: 'grid', gridTemplateColumns: '1fr' }}
      >
        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div
          className="auth-left relative hidden flex-col justify-between overflow-hidden px-12 py-14"
          style={{
            background: 'linear-gradient(145deg, #0e5921 0%, #1d7733 55%, #0e5921 100%)',
          }}
        >
          {/* SVG grid */}
          <GridBackground />

          {/* Glow orbs */}
          <div
            className="absolute pointer-events-none"
            aria-hidden="true"
            style={{
              top:             '-80px',
              right:           '-80px',
              width:           '360px',
              height:          '360px',
              borderRadius:    '50%',
              background:      'radial-gradient(circle, rgba(42,148,68,0.35) 0%, transparent 70%)',
              filter:          'blur(40px)',
            }}
          />
          <div
            className="absolute pointer-events-none"
            aria-hidden="true"
            style={{
              bottom:          '-60px',
              left:            '-60px',
              width:           '280px',
              height:          '280px',
              borderRadius:    '50%',
              background:      'radial-gradient(circle, rgba(14,89,33,0.5) 0%, transparent 70%)',
              filter:          'blur(40px)',
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full justify-between">

            {/* Top copy */}
            <div>
              <p
                className="font-display text-[11px] font-bold tracking-[0.28em] uppercase mb-8"
                style={{ color: 'rgba(166,206,57,0.85)' }}
              >
                — IFFS · 2026 SURVEY
              </p>

              <h1
                className="font-display font-light leading-[1.1] mb-6"
                style={{ fontSize: 'clamp(32px, 3vw, 48px)', color: '#ffffff' }}
              >
                Advancing{' '}
                <em
                  style={{
                    fontStyle:   'italic',
                    color:       '#a6ce39',
                    fontWeight:  300,
                  }}
                >
                  Reproductive
                </em>
                <br />
                <strong style={{ fontWeight: 600, color: '#ffffff' }}>
                  Medicine
                </strong>{' '}
                Globally
              </h1>

              <p
                className="font-body text-sm leading-relaxed mb-8"
                style={{ color: 'rgba(232,245,236,0.7)', maxWidth: '360px' }}
              >
                Access is restricted to verified medical personnel and national
                fertility society representatives.
              </p>

              {/* Checklist */}
              <ul className="space-y-3">
                {CHECKLIST_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    <span
                      className="font-body text-sm"
                      style={{ color: 'rgba(232,245,236,0.8)' }}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom stats */}
            <div
              className="flex items-center gap-0 mt-10 rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {LEFT_STATS.map((stat, idx) => (
                <div
                  key={stat.label}
                  className="flex-1 flex flex-col items-center py-4 px-2"
                  style={{
                    borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.1)' : undefined,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                  }}
                >
                  <span
                    className="font-display font-light leading-none mb-1"
                    style={{ fontSize: '26px', color: '#ffffff' }}
                  >
                    {stat.value}
                  </span>
                  <span
                    className="font-display text-[9px] font-bold tracking-[0.18em] uppercase"
                    style={{ color: 'rgba(209,235,216,0.55)' }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL — form ───────────────────────────────────────────── */}
        <div
          className="flex flex-col justify-center px-6 py-12 sm:px-10"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div
            className="w-full mx-auto animate-auth-fade-up"
            style={{ maxWidth: '440px' }}
          >
            {/* Header */}
            <div className="mb-8">
              <div
                className="font-display text-[11px] font-bold tracking-[0.2em] uppercase mb-3"
                style={{ color: '#7a8a96' }}
              >
                IFFS 2026 Triennial Survey
              </div>
              <h2
                className="font-display font-light"
                style={{ fontSize: '30px', color: '#0d1117' }}
              >
                {tab === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p
                className="font-body text-sm mt-2"
                style={{ color: '#7a8a96' }}
              >
                {tab === 'signin'
                  ? 'Sign in to access your survey dashboard.'
                  : 'Register to participate in the 2026 global survey.'}
              </p>
            </div>

            {/* Tab switcher */}
            <div
              className="flex mb-8 rounded-xl overflow-hidden"
              style={{ border: '1.5px solid #e2ebe4', backgroundColor: '#f7f9f7' }}
              role="tablist"
              aria-label="Authentication mode"
            >
              {(['signin', 'signup'] as TabMode[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => {
                    setTab(t)
                    setSiError(null)
                    setSuError(null)
                  }}
                  className="flex-1 py-3 font-display text-[12px] font-bold tracking-[0.1em] uppercase transition-all duration-200 focus-visible:outline-none"
                  style={{
                    backgroundColor: tab === t ? '#1d7733' : 'transparent',
                    color:           tab === t ? '#ffffff' : '#7a8a96',
                    boxShadow:       tab === t ? '0 2px 8px rgba(29,119,51,0.25)' : 'none',
                    borderRadius:    tab === t ? '9px' : undefined,
                    margin:          tab === t ? '2px' : undefined,
                  }}
                >
                  {t === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {/* ── SIGN IN FORM ─────────────────────────────────────────────── */}
            {tab === 'signin' && (
              <form onSubmit={handleSignIn} noValidate>
                <div className="space-y-5">
                  <InputField
                    id="si-email"
                    label="Email address"
                    type="email"
                    value={siEmail}
                    onChange={setSiEmail}
                    placeholder="you@institution.org"
                    autoComplete="email"
                    required
                  />
                  <div>
                    <InputField
                      id="si-password"
                      label="Password"
                      type="password"
                      value={siPassword}
                      onChange={setSiPassword}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="font-body text-xs transition-colors duration-150 focus-visible:outline-none"
                        style={{ color: '#1d7733' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = '#0e5921'
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = '#1d7733'
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {siError && (
                    <div
                      className="rounded-xl px-4 py-3 font-body text-sm"
                      style={{
                        backgroundColor: '#fef2f2',
                        border:          '1px solid #fecaca',
                        color:           '#b91c1c',
                      }}
                      role="alert"
                    >
                      {siError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={siLoading}
                    className="w-full py-3.5 rounded-xl font-display text-[13px] font-bold tracking-[0.1em] uppercase text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                    style={{
                      backgroundColor: '#1d7733',
                      boxShadow:       '0 4px 16px rgba(29,119,51,0.3)',
                    }}
                    onMouseEnter={(e) => {
                      if (!siLoading)
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0e5921'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d7733'
                    }}
                  >
                    {siLoading ? 'Signing in…' : 'Sign In →'}
                  </button>
                </div>

                {/* OR divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e2ebe4' }} />
                  <span className="font-body text-xs" style={{ color: '#b0bec5' }}>
                    OR CONTINUE WITH
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e2ebe4' }} />
                </div>

                {/* Social row */}
                <div className="flex items-center justify-center gap-3">
                  {SOCIAL_PROVIDERS.map((p) => (
                    <SocialButton key={p.id} provider={p} onToast={handleSocialToast} />
                  ))}
                </div>
              </form>
            )}

            {/* ── SIGN UP FORM ─────────────────────────────────────────────── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignUp} noValidate>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      id="su-first"
                      label="First name"
                      value={suFirst}
                      onChange={setSuFirst}
                      placeholder="First"
                      autoComplete="given-name"
                      required
                    />
                    <InputField
                      id="su-last"
                      label="Last name"
                      value={suLast}
                      onChange={setSuLast}
                      placeholder="Last"
                      autoComplete="family-name"
                      required
                    />
                  </div>

                  <InputField
                    id="su-email"
                    label="Email address"
                    type="email"
                    value={suEmail}
                    onChange={handleSuEmailChange}
                    placeholder="you@institution.org"
                    autoComplete="email"
                    required
                    hint={
                      waHint ? (
                        <span className="flex items-center gap-1.5">
                          {isChecking && (
                            <span
                              className="inline-block w-3 h-3 rounded-full border-2 border-transparent animate-spin"
                              style={{ borderTopColor: '#1d7733' }}
                              aria-hidden="true"
                            />
                          )}
                          {waHint}
                        </span>
                      ) : undefined
                    }
                  />

                  <InputField
                    id="su-password"
                    label="Password"
                    type="password"
                    value={suPassword}
                    onChange={setSuPassword}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    required
                    hint="Use at least 8 characters with a mix of letters and numbers."
                  />

                  {/* Error */}
                  {suError && (
                    <div
                      className="rounded-xl px-4 py-3 font-body text-sm"
                      style={{
                        backgroundColor: '#fef2f2',
                        border:          '1px solid #fecaca',
                        color:           '#b91c1c',
                      }}
                      role="alert"
                    >
                      {suError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={suLoading}
                    className="w-full py-3.5 rounded-xl font-display text-[13px] font-bold tracking-[0.1em] uppercase text-white transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                    style={{
                      backgroundColor: '#1d7733',
                      boxShadow:       '0 4px 16px rgba(29,119,51,0.3)',
                    }}
                    onMouseEnter={(e) => {
                      if (!suLoading)
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0e5921'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d7733'
                    }}
                  >
                    {suLoading ? 'Creating account…' : 'Create Account →'}
                  </button>
                </div>

                {/* OR divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e2ebe4' }} />
                  <span className="font-body text-xs" style={{ color: '#b0bec5' }}>
                    OR CONTINUE WITH
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e2ebe4' }} />
                </div>

                {/* Social row */}
                <div className="flex items-center justify-center gap-3">
                  {SOCIAL_PROVIDERS.map((p) => (
                    <SocialButton key={p.id} provider={p} onToast={handleSocialToast} />
                  ))}
                </div>
              </form>
            )}

            {/* ── DEMO CREDENTIALS (dev only) ───────────────────────────────── */}
            {isDev && (
              <div
                className="mt-8 rounded-2xl p-4"
                style={{
                  backgroundColor: '#f7f9f7',
                  border:          '1px solid #e2ebe4',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="font-display text-[9px] font-bold tracking-[0.16em] uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#e2ebe4', color: '#7a8a96' }}
                  >
                    DEMO
                  </span>
                  <span className="font-body text-xs" style={{ color: '#7a8a96' }}>
                    Click to auto-fill credentials
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillDemo(acc)}
                      className="text-left px-3 py-2.5 rounded-xl transition-all duration-150 focus-visible:outline-none"
                      style={{
                        backgroundColor: '#ffffff',
                        border:          '1px solid #e2ebe4',
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.borderColor     = 'rgba(29,119,51,0.3)'
                        el.style.backgroundColor = '#e8f5ec'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.borderColor     = '#e2ebe4'
                        el.style.backgroundColor = '#ffffff'
                      }}
                    >
                      <div
                        className="font-display text-[11px] font-bold"
                        style={{ color: '#0d1117' }}
                      >
                        {acc.label}
                      </div>
                      <div
                        className="font-body text-[11px] truncate"
                        style={{ color: '#7a8a96' }}
                      >
                        {acc.email}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Switch tab link */}
            <p
              className="text-center font-body text-sm mt-6"
              style={{ color: '#7a8a96' }}
            >
              {tab === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
                className="font-semibold transition-colors duration-150 focus-visible:outline-none"
                style={{ color: '#1d7733' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#0e5921'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#1d7733'
                }}
              >
                {tab === 'signin' ? 'Create account' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
