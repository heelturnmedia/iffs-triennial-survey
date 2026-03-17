import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUp } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useWildApricot } from '@/hooks/useWildApricot'

interface WABadge {
  status: 'idle' | 'checking' | 'member' | 'not-found' | 'error'
  level?: string
}

export function SignUpForm() {
  const navigate = useNavigate()
  const { setProfile } = useAuthStore()
  const { toast } = useUIStore()
  const { checkMembership, isChecking } = useWildApricot()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waBadge, setWaBadge] = useState<WABadge>({ status: 'idle' })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Debounced WA check on email change
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!email.trim() || !email.includes('@')) {
      setWaBadge({ status: 'idle' })
      return
    }
    setWaBadge({ status: 'checking' })
    debounceRef.current = setTimeout(async () => {
      try {
        const role = await checkMembership(email.trim())
        setWaBadge({ status: role === 'iffs-member' ? 'member' : 'not-found' })
      } catch {
        setWaBadge({ status: 'error' })
      }
    }, 600)
    return () => clearTimeout(debounceRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsLoading(true)

    try {
      const data = await signUp({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })

      if (data.user && data.session) {
        // Profile will be loaded by authStore.initialize via onAuthStateChange
        setProfile(null) // will be populated by auth listener
      }

      if (waBadge.status === 'member') {
        toast(`Welcome! IFFS membership verified${waBadge.level ? ` — ${waBadge.level}` : ''}.`, 'ok')
      } else {
        toast('Account created. Please check your email to confirm.', 'ok')
      }

      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderWABadge = () => {
    if (waBadge.status === 'idle') return null
    if (waBadge.status === 'checking' || isChecking)
      return (
        <span className="flex items-center gap-1.5 font-body text-[11px] text-[#f59e0b] mt-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-[#f59e0b]/40 border-t-[#f59e0b] animate-spin" />
          Checking WildApricot membership…
        </span>
      )
    if (waBadge.status === 'member')
      return (
        <span className="flex items-center gap-1.5 font-body text-[11px] text-[#1d7733] font-semibold mt-1.5">
          ✓ IFFS member verified
          {waBadge.level && (
            <span className="text-[#7a8a96] font-normal">— {waBadge.level}</span>
          )}
        </span>
      )
    if (waBadge.status === 'not-found')
      return (
        <span className="flex items-center gap-1.5 font-body text-[11px] text-[#7a8a96] mt-1.5">
          ℹ Not found in WildApricot — you can still register
        </span>
      )
    return (
      <span className="flex items-center gap-1.5 font-body text-[11px] text-[#b0bec5] mt-1.5">
        WA check unavailable
      </span>
    )
  }

  const strengthPct = Math.min(password.length / 12, 1)
  const strengthColor =
    password.length === 0
      ? '#e2ebe4'
      : password.length < 6
      ? '#dc2626'
      : password.length < 8
      ? '#f59e0b'
      : password.length < 12
      ? '#2a9444'
      : '#1d7733'

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <span className="text-red-500 text-base flex-shrink-0 mt-0.5">✕</span>
          <p className="font-body text-[13px] text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="signup-first"
              className="block font-body text-[12px] font-semibold text-[#3d4a52] uppercase tracking-[0.08em] mb-1.5"
            >
              First name
            </label>
            <input
              id="signup-first"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              required
              className="w-full font-body text-[14px] text-[#0d1117] bg-white border-[1.5px] border-[#c4d1c7] rounded-lg px-3.5 py-2.5 placeholder-[#b0bec5] outline-none transition-all focus:border-[#1d7733] focus:shadow-[0_0_0_3px_rgba(29,119,51,0.10)]"
            />
          </div>
          <div>
            <label
              htmlFor="signup-last"
              className="block font-body text-[12px] font-semibold text-[#3d4a52] uppercase tracking-[0.08em] mb-1.5"
            >
              Last name
            </label>
            <input
              id="signup-last"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              required
              className="w-full font-body text-[14px] text-[#0d1117] bg-white border-[1.5px] border-[#c4d1c7] rounded-lg px-3.5 py-2.5 placeholder-[#b0bec5] outline-none transition-all focus:border-[#1d7733] focus:shadow-[0_0_0_3px_rgba(29,119,51,0.10)]"
            />
          </div>
        </div>

        {/* Email + WA badge */}
        <div>
          <label
            htmlFor="signup-email"
            className="block font-body text-[12px] font-semibold text-[#3d4a52] uppercase tracking-[0.08em] mb-1.5"
          >
            Institutional email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@institution.org"
            required
            className="w-full font-body text-[14px] text-[#0d1117] bg-white border-[1.5px] border-[#c4d1c7] rounded-lg px-3.5 py-2.5 placeholder-[#b0bec5] outline-none transition-all focus:border-[#1d7733] focus:shadow-[0_0_0_3px_rgba(29,119,51,0.10)]"
          />
          {renderWABadge()}
        </div>

        {/* Password + strength bar */}
        <div>
          <label
            htmlFor="signup-password"
            className="block font-body text-[12px] font-semibold text-[#3d4a52] uppercase tracking-[0.08em] mb-1.5"
          >
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            minLength={8}
            className="w-full font-body text-[14px] text-[#0d1117] bg-white border-[1.5px] border-[#c4d1c7] rounded-lg px-3.5 py-2.5 placeholder-[#b0bec5] outline-none transition-all focus:border-[#1d7733] focus:shadow-[0_0_0_3px_rgba(29,119,51,0.10)]"
          />
          {/* Strength bar */}
          <div className="h-1 w-full bg-[#e2ebe4] rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${strengthPct * 100}%`,
                background: strengthColor,
              }}
            />
          </div>
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
              Creating account…
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="font-body text-[11px] text-[#b0bec5] text-center leading-relaxed">
        By creating an account you agree to the IFFS Terms of Use and Privacy Policy.
        Your data is processed in accordance with GDPR.
      </p>
    </div>
  )
}
