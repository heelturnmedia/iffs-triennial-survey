import { AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { ProfileDetailsCard } from './profile/ProfileDetailsCard'
import { ChangePasswordCard } from './profile/ChangePasswordCard'

export function ProfilePanel() {
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery)

  return (
    <div
      style={{
        padding: '28px 32px 40px',
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--f1)',
            letterSpacing: '-0.01em',
          }}
        >
          My profile
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--f3)',
            marginTop: 4,
          }}
        >
          Update your personal details and password.
        </p>
      </header>

      {isPasswordRecovery && (
        <div
          role="alert"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: '14px 16px',
            borderRadius: 12,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: '#92400e',
              }}
            >
              Please set a new password to continue.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: '#b45309',
                marginTop: 4,
              }}
            >
              Do not close or refresh this page until your new password is saved — the reset link cannot be reused.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <ProfileDetailsCard />
        <ChangePasswordCard />
      </div>
    </div>
  )
}
