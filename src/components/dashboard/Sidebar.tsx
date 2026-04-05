import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Users,
  Settings2,
  Unplug,
  LogOut,
  Workflow,
  UserCircle2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useSurveyStore } from '@/stores/surveyStore'
import type { ActivePanel } from '@/types'
import { ROLES } from '@/constants'

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItem {
  id: ActivePanel | 'survey'
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  panel?: ActivePanel
  opensSurvey?: boolean
  adminOnly?: boolean
  supervisorPlus?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',    label: 'Overview',    Icon: LayoutDashboard, panel: 'overview' },
  { id: 'survey',      label: 'My Survey',   Icon: ClipboardList,   opensSurvey: true },
  { id: 'reports',     label: 'Reports',     Icon: BarChart3,       panel: 'reports',     supervisorPlus: true },
  { id: 'users',       label: 'Users',       Icon: Users,           panel: 'users',       adminOnly: true },
  { id: 'survey-mgmt', label: 'Survey Mgmt', Icon: Settings2,       panel: 'survey-mgmt', adminOnly: true },
  { id: 'wa-settings', label: 'WA Settings', Icon: Unplug,          panel: 'wa-settings', adminOnly: true },
  { id: 'app-flow',    label: 'App Flow',    Icon: Workflow,         panel: 'app-flow',    adminOnly: true },
  { id: 'profile',     label: 'My Profile',  Icon: UserCircle2,       panel: 'profile' },
]

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:         { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
  supervisor:    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'iffs-member': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  user:          { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { profile, isAdmin, canViewReports, signOut, isPasswordRecovery } = useAuthStore()
  const { activePanel, setActivePanel } = useUIStore()
  const profileFormDirty = useUIStore((s) => s.profileFormDirty)
  const openConfirmModal = useUIStore((s) => s.openConfirmModal)
  const setProfileFormDirty = useUIStore((s) => s.setProfileFormDirty)
  const { openModal } = useSurveyStore()

  const role = profile?.role ?? 'user'
  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : ''
  const roleLabel = ROLES[role]?.label ?? role
  const badge = ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS['user']

  const isVisible = (item: NavItem): boolean => {
    if (item.adminOnly) return isAdmin()
    if (item.supervisorPlus) return canViewReports()
    return true
  }

  const isActive = (item: NavItem): boolean => {
    if (item.opensSurvey) return false
    return activePanel === item.panel
  }

  const handleItemClick = (item: NavItem) => {
    // During password recovery, only the profile panel is reachable.
    if (isPasswordRecovery && item.panel !== 'profile') return

    const performNavigation = () => {
      if (item.opensSurvey) {
        openModal()
      } else if (item.panel) {
        setActivePanel(item.panel)
      }
    }

    // If the user is leaving the profile panel with unsaved changes, confirm.
    const leavingProfile = activePanel === 'profile' && item.panel !== 'profile'
    if (leavingProfile && profileFormDirty) {
      openConfirmModal({
        title: 'Discard unsaved changes?',
        message: 'You have unsaved profile changes. Leave without saving?',
        variant: 'warning',
        onConfirm: () => {
          setProfileFormDirty(false)
          performNavigation()
        },
      })
      return
    }

    performNavigation()
  }

  return (
    <aside
      className="flex-shrink-0 flex flex-col"
      style={{
        width: '232px',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid var(--bd)',
        overflowY: 'auto',
      }}
    >
      {/* ── User profile block ──────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--bd)' }}>
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--g1) 0%, var(--g5) 100%)',
            boxShadow: '0 2px 10px rgba(29,119,51,0.28)',
          }}
          aria-hidden="true"
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.04em',
            }}
          >
            {initials}
          </span>
        </div>

        {/* Name */}
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--f1)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </p>
        {profile?.email && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              color: 'var(--f3)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profile.email}
          </p>
        )}

        {/* Role badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: 8,
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 99,
            border: `1px solid ${badge.border}`,
            background: badge.bg,
            color: badge.text,
          }}
        >
          {roleLabel}
        </span>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 pt-3 pb-2" aria-label="Dashboard navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.filter(isVisible).map((item) => {
            const active = isActive(item)
            const disabled = isPasswordRecovery && item.panel !== 'profile'
            const { Icon } = item
            return (
              <li key={item.id} role="listitem">
                <button
                  type="button"
                  onClick={() => handleItemClick(item)}
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: active ? 'rgba(29,119,51,0.07)' : 'transparent',
                    color: active ? 'var(--g1)' : 'var(--f2)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    border: 'none',
                    outline: 'none',
                    position: 'relative',
                    opacity: disabled ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!active && !disabled) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(29,119,51,0.04)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--f1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !disabled) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--f2)'
                    }
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* Left active bar */}
                  {active && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 3,
                        height: 20,
                        borderRadius: '0 3px 3px 0',
                        background: 'var(--g1)',
                      }}
                    />
                  )}

                  {/* Icon container */}
                  <span
                    className="flex items-center justify-center flex-shrink-0 transition-all duration-150"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: active ? 'rgba(29,119,51,0.12)' : 'transparent',
                      color: active ? 'var(--g1)' : 'var(--f3)',
                    }}
                  >
                    <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  </span>

                  <span style={{ flex: 1 }}>{item.label}</span>

                  {/* Active indicator dot */}
                  {active && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'var(--g1)',
                        flexShrink: 0,
                        opacity: 0.7,
                      }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Sign out ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
        <button
          type="button"
          onClick={() => signOut().then(() => { window.location.href = '/' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--f3)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.05)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#dc2626'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--f3)'
          }}
        >
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, borderRadius: 8 }}
          >
            <LogOut size={15} strokeWidth={1.8} />
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
