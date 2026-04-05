import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import {
  updatePassword,
  verifyAndUpdatePassword,
  WrongCurrentPasswordError,
} from '@/services/authService'

interface FieldErrors {
  current?: string
  next?: string
  confirm?: string
}

// Detect Supabase errors that indicate an expired / invalid recovery session.
// Supabase surfaces these as AuthApiError with status 401 or messages mentioning
// expired/invalid refresh tokens or JWT. We match permissively to catch variants.
function isRecoveryExpiredError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: number; code?: string; message?: string }
  if (e.status === 401) return true
  const msg = (e.message ?? '').toLowerCase()
  return (
    msg.includes('expired') ||
    msg.includes('invalid refresh') ||
    msg.includes('jwt') ||
    e.code === 'session_not_found'
  )
}

export function ChangePasswordCard() {
  const user = useAuthStore((s) => s.user)
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery)
  const setPasswordRecovery = useAuthStore((s) => s.setPasswordRecovery)
  const signOut = useAuthStore((s) => s.signOut)
  const toast = useUIStore((s) => s.toast)
  const [recoveryExpired, setRecoveryExpired] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {}
    if (!isPasswordRecovery && !currentPassword) {
      errs.current = 'Enter your current password'
    }
    if (newPassword.length < 8) {
      errs.next = 'Password must be at least 8 characters'
    } else if (!isPasswordRecovery && newPassword === currentPassword) {
      errs.next = 'New password must differ from current password'
    }
    if (newPassword !== confirmPassword) {
      errs.confirm = 'Passwords do not match'
    }
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      if (isPasswordRecovery) {
        // Recovery mode: session is already proven via the magic link, no
        // current-password re-verification possible.
        await updatePassword(newPassword)
      } else {
        if (!user?.email) {
          setError('Session email missing — please sign out and sign in again.')
          return
        }
        // Single-client flow: verify current password and update on the main
        // client in one call, avoiding navigator.locks contention.
        await verifyAndUpdatePassword(user.email, currentPassword, newPassword)
      }
      // Success — clear form, clear recovery flag, toast.
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFieldErrors({})
      if (isPasswordRecovery) setPasswordRecovery(false)
      toast('Password updated', 'ok')
    } catch (err) {
      if (err instanceof WrongCurrentPasswordError) {
        setFieldErrors({ current: 'Current password is incorrect' })
        setCurrentPassword('')
      } else if (isPasswordRecovery && isRecoveryExpiredError(err)) {
        setRecoveryExpired(true)
      } else {
        const msg = err instanceof Error ? err.message : 'Could not update password'
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSignOutAndRestart = async () => {
    setPasswordRecovery(false)
    await signOut()
    window.location.href = '/login'
  }

  return (
    <section
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--bd)',
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
      }}
      aria-labelledby="change-password-heading"
    >
      <header className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(29,119,51,0.08)' }}
          aria-hidden="true"
        >
          <KeyRound size={18} color="var(--g1)" strokeWidth={2} />
        </div>
        <div>
          <h3
            id="change-password-heading"
            style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--f1)' }}
          >
            Change password
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--f3)', marginTop: 2 }}>
            {isPasswordRecovery
              ? 'Set a new password to regain full access to your account.'
              : 'Enter your current password, then choose a new one.'}
          </p>
        </div>
      </header>

      {recoveryExpired ? (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
            Reset link expired
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#b91c1c', marginTop: 4, marginBottom: 12 }}>
            Your password reset link has expired. Please sign in again and request a new one.
          </p>
          <button
            type="button"
            onClick={handleSignOutAndRestart}
            className="rounded-xl px-4 py-2"
            style={{
              background: '#b91c1c',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Sign out and request new link
          </button>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {!isPasswordRecovery && (
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            error={fieldErrors.current}
            autoComplete="current-password"
            disabled={saving}
          />
        )}
        <PasswordField
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          error={fieldErrors.next}
          hint="Minimum 8 characters"
          autoComplete="new-password"
          disabled={saving}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          error={fieldErrors.confirm}
          autoComplete="new-password"
          disabled={saving}
        />

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            {error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-opacity"
            style={{
              background: 'var(--g1)',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
      )}
    </section>
  )
}

// ── Password field subcomponent ────────────────────────────────────────────────

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  error?: string
  hint?: string
  autoComplete: string
  disabled: boolean
}

function PasswordField({
  id, label, value, onChange, show, onToggleShow, error, hint, autoComplete, disabled,
}: PasswordFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--f2)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            padding: '9px 38px 9px 12px',
            borderRadius: 10,
            border: `1px solid ${error ? '#fecaca' : 'var(--bd)'}`,
            background: disabled ? '#f8fafc' : '#ffffff',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            background: 'transparent',
            border: 'none',
            color: 'var(--f3)',
            cursor: 'pointer',
          }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)', marginTop: 4 }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#b91c1c', marginTop: 4 }}>
          {error}
        </p>
      )}
    </div>
  )
}
