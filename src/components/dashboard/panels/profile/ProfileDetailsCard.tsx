import { useState, useMemo } from 'react'
import { UserCircle2, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { updateProfile } from '@/services/authService'
import { ROLES } from '@/constants'

export function ProfileDetailsCard() {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const setProfile = useAuthStore((s) => s.setProfile)
  const toast = useUIStore((s) => s.toast)

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [country, setCountry] = useState(profile?.country ?? '')
  const [institution, setInstitution] = useState(profile?.institution ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(() => {
    return (
      firstName !== (profile?.first_name ?? '') ||
      lastName !== (profile?.last_name ?? '') ||
      country !== (profile?.country ?? '') ||
      institution !== (profile?.institution ?? '')
    )
  }, [firstName, lastName, country, institution, profile])

  const firstNameTrimmed = firstName.trim()
  const lastNameTrimmed = lastName.trim()
  const valid = firstNameTrimmed.length >= 1 && lastNameTrimmed.length >= 1

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || !user) return
    if (!dirty || !valid) return
    setError(null)
    setSaving(true)
    try {
      // Send trimmed values as-is (including empty strings) so clearing a
      // field actually persists. Falling back to `undefined` would drop the
      // key from the payload and leave the old value intact.
      const updated = await updateProfile(profile.id, {
        first_name: firstNameTrimmed,
        last_name: lastNameTrimmed,
        country: country.trim(),
        institution: institution.trim(),
      })
      setProfile(updated)
      toast('Profile saved', 'ok')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save profile'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const email = user?.email ?? profile?.email ?? ''
  const roleLabel = profile?.role ? ROLES[profile.role]?.label ?? profile.role : ''

  return (
    <section
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--bd)',
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
      }}
      aria-labelledby="profile-details-heading"
    >
      <header className="flex items-center gap-3 mb-5">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(29,119,51,0.08)' }}
          aria-hidden="true"
        >
          <UserCircle2 size={18} color="var(--g1)" strokeWidth={2} />
        </div>
        <div>
          <h3
            id="profile-details-heading"
            style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--f1)' }}
          >
            Profile details
          </h3>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--f3)', marginTop: 2 }}>
            Your name, country, and institution. Email and role are managed by administrators.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Read-only: email + role */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReadOnlyRow label="Email" value={email} />
          <ReadOnlyRow label="Role" value={roleLabel} />
        </dl>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            id="first-name"
            label="First name"
            value={firstName}
            onChange={setFirstName}
            maxLength={100}
            required
            disabled={saving}
          />
          <TextField
            id="last-name"
            label="Last name"
            value={lastName}
            onChange={setLastName}
            maxLength={100}
            required
            disabled={saving}
          />
          <TextField
            id="country"
            label="Country"
            value={country}
            onChange={setCountry}
            maxLength={100}
            disabled={saving}
          />
          <TextField
            id="institution"
            label="Institution"
            value={institution}
            onChange={setInstitution}
            maxLength={200}
            disabled={saving}
          />
        </div>

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
            disabled={!dirty || !valid || saving}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 transition-opacity"
            style={{
              background: 'var(--g1)',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: !dirty || !valid || saving ? 'not-allowed' : 'pointer',
              opacity: !dirty || !valid || saving ? 0.5 : 1,
            }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ── Read-only row ────────────────────────────────────────────────────────────

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--f3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--f2)',
          padding: '9px 12px',
          borderRadius: 10,
          background: '#f8fafc',
          border: '1px solid var(--bd)',
        }}
      >
        {value || '—'}
      </dd>
    </div>
  )
}

// ── Editable text field ──────────────────────────────────────────────────────

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  required?: boolean
  disabled?: boolean
}

function TextField({ id, label, value, onChange, maxLength, required, disabled }: TextFieldProps) {
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
        {required && <span style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        disabled={disabled}
        style={{
          width: '100%',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          padding: '9px 12px',
          borderRadius: 10,
          border: '1px solid var(--bd)',
          background: disabled ? '#f8fafc' : '#ffffff',
          outline: 'none',
        }}
      />
    </div>
  )
}
