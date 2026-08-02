// Fixed nav bar, 68px height, glassmorphism background
// Left: Logo mark (green square "IFFS") + brand name
// Right (unauthenticated): Home / Contact links + "Take Survey →" pill
// Right (authenticated): role badge + user name + "Sign Out" button

import { ArrowRight } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'
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
  { label: 'Contact', href: '/contact' },
]

export function Nav() {
  const location  = useLocation()
  const { user, profile, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    // Hard redirect ensures the entire React tree and all Supabase client state
    // is reset from scratch — no stale Zustand slices or cached auth state can
    // survive a full page reload. navigate('/') would re-use the existing JS
    // runtime and could still read an in-memory session that was just cleared.
    window.location.href = '/'
  }

  const role        = (profile?.role ?? 'user') as UserRole
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : (user?.email ?? '')

  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center gap-3 px-4 sm:px-6 md:px-8 border-b"
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
      <Link to="/" className="flex items-center gap-2 sm:gap-3 no-underline shrink min-w-0">
        <img
          src="/iffs-logo.png"
          alt="IFFS"
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
        />
        <div className="flex flex-col leading-none min-w-0">
          <span className="font-display uppercase text-[10.5px] sm:text-[12px] font-bold tracking-[0.1em] sm:tracking-[0.14em] text-f1 whitespace-nowrap">
            IFFS BIENNIAL{' '}
            <em className="not-italic text-g1">SURVEY</em>
          </span>
          {/* Kept on every breakpoint — on narrow screens it wraps to two lines
              rather than being dropped, so the former name is always visible. */}
          <span className="font-body text-[9px] sm:text-[10px] leading-[1.25] text-f3 tracking-[0.02em] mt-0.5">
            (Previously known as IFFS Triennial Survey)
          </span>
        </div>
      </Link>

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Unauthenticated ───────────────────────────────────────────── */}
      {!user && (
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = location.pathname === href.split('#')[0]
              return (
                <Link
                  key={label}
                  to={href}
                  className={cn(
                    'no-underline rounded-lg font-body text-[15px] px-3.5 py-2 transition-colors hover:text-f1',
                    isActive ? 'text-f1' : 'text-f3',
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* CTA pill — nav-pill style */}
          <Link
            to="/login"
            className="no-underline inline-flex items-center gap-1.5 rounded-full uppercase font-display text-[11px] sm:text-[12px] font-bold tracking-[0.1em] text-white bg-g1 hover:bg-g2 px-4 sm:px-5 min-h-[40px] transition-colors"
            style={{ boxShadow: 'var(--shadow-green-sm)' }}
          >
            Take Survey
            <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* ── Authenticated ─────────────────────────────────────────────── */}
      {user && (
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          {/* Role badge */}
          <span
            className={cn(
              'hidden sm:inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold font-body tracking-[0.03em]',
              ROLE_BADGE_CLASSES[role],
            )}
          >
            {ROLE_LABELS[role]}
          </span>

          {/* User name + email — name from md up, email from lg up */}
          <div className="hidden md:flex flex-col items-end leading-none">
            <span className="font-body text-[13px] font-semibold text-f1">
              {displayName}
            </span>
            {profile && (
              <span className="hidden lg:block font-body text-[11px] text-f3 mt-0.5">
                {user.email}
              </span>
            )}
          </div>

          {/* Sign Out — nav-link style */}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full uppercase font-display text-[10px] font-bold tracking-[0.14em] px-4 min-h-[40px] border-[1.5px] border-bd2 text-f2 bg-transparent cursor-pointer transition-colors hover:border-g1 hover:text-g1 hover:bg-g3"
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
