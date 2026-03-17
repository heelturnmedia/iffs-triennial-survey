// Fixed nav bar, 68px height, glassmorphism background
// Left: Logo mark (green square "IFFS") + brand name
// Right (unauthenticated): Home / About / Contact links + "Take Survey →" pill
// Right (authenticated): role badge + user name + "Sign Out" button

import { ArrowRight } from 'lucide-react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import type { UserRole } from '@/types'

// ── Role display config ────────────────────────────────────────────────────
const ROLE_LABELS: Record<UserRole, string> = {
  admin:        'Admin',
  supervisor:   'Supervisor',
  'iffs-member':'IFFS Member',
  user:         'Member',
}

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  admin:        'bg-red-100    text-red-700',
  supervisor:   'bg-blue-100   text-blue-700',
  'iffs-member':'bg-purple-100 text-purple-700',
  user:         'bg-gray-100   text-gray-600',
}

// ── Nav link targets (unauthenticated) ────────────────────────────────────
const NAV_LINKS = [
  { label: 'Home',    href: '/' },
  { label: 'About',   href: '/#about' },
  { label: 'Contact', href: '/#contact' },
]

export function Nav() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, profile, signOut } = useAuthStore()
  const { toast } = useUIStore()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
      toast('Signed out successfully.', 'ok')
    } catch {
      toast('Sign out failed. Please try again.', 'err')
    }
  }

  const role        = (profile?.role ?? 'user') as UserRole
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : (user?.email ?? '')

  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center px-8 border-b"
      style={{
        height: 68,
        zIndex: 800,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderColor: 'rgba(226,235,228,0.8)',
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <Link to="/" className="flex items-center gap-3 no-underline flex-shrink-0">
        <img
          src="/iffs-logo.png"
          alt="IFFS"
          className="w-9 h-9 object-contain flex-shrink-0"
        />
        <div className="flex flex-col leading-none">
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: 'var(--f1)',
            }}
          >
            IFFS{' '}
            <em style={{ fontStyle: 'normal', color: 'var(--g1)' }}>SURVEY</em>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10,
              color: 'var(--f3)',
              letterSpacing: '0.04em',
              marginTop: 2,
            }}
          >
            2026 Triennial
          </span>
        </div>
      </Link>

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Unauthenticated ───────────────────────────────────────────── */}
      {!user && (
        <div className="flex items-center gap-6">
          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = location.pathname === href.split('#')[0]
              return (
                <Link
                  key={label}
                  to={href}
                  className="no-underline rounded-lg transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: isActive ? 'var(--f1)' : 'var(--f3)',
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 8,
                    paddingBottom: 8,
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--f1)'
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      isActive ? 'var(--f1)' : 'var(--f3)'
                  }}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* CTA pill — nav-pill style */}
          <Link
            to="/auth"
            className="no-underline flex items-center gap-1.5 rounded-full uppercase transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              background: 'var(--g1)',
              color: '#fff',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 8,
              paddingBottom: 8,
              boxShadow: 'var(--shadow-green-sm)',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--g2)'
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--g1)'
            }}
          >
            Take Survey
            <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* ── Authenticated ─────────────────────────────────────────────── */}
      {user && (
        <div className="flex items-center gap-4">
          {/* Role badge */}
          <span
            className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE_CLASSES[role]}`}
            style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.03em' }}
          >
            {ROLE_LABELS[role]}
          </span>

          {/* User name + email */}
          <div className="flex flex-col items-end leading-none">
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--f1)',
              }}
            >
              {displayName}
            </span>
            {profile && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--f3)',
                  marginTop: 2,
                }}
              >
                {user.email}
              </span>
            )}
          </div>

          {/* Sign Out — nav-link style */}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full uppercase border transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              borderWidth: '1.5px',
              borderColor: 'var(--bd2)',
              color: 'var(--f2)',
              background: 'transparent',
              cursor: 'pointer',
            }}
            onMouseOver={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.borderColor = 'var(--g1)'
              btn.style.color       = 'var(--g1)'
              btn.style.background  = 'var(--g3)'
            }}
            onMouseOut={e => {
              const btn = e.currentTarget as HTMLButtonElement
              btn.style.borderColor = 'var(--bd2)'
              btn.style.color       = 'var(--f2)'
              btn.style.background  = 'transparent'
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
