import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useSurveyStore } from '@/stores/surveyStore'
import type { ActivePanel } from '@/types'
import { ROLES } from '@/constants'

// ─── Nav item definitions ─────────────────────────────────────────────────────

interface NavItem {
  id: ActivePanel | 'survey'
  label: string
  icon: string
  panel?: ActivePanel
  opensSurvey?: boolean
  adminOnly?: boolean
  supervisorPlus?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview',     label: 'Overview',     icon: '⊞',  panel: 'overview' },
  { id: 'survey',       label: 'My Survey',    icon: '✎',  opensSurvey: true },
  { id: 'reports',      label: 'Reports',      icon: '⊡',  panel: 'reports',      supervisorPlus: true },
  { id: 'users',        label: 'Users',        icon: '◎',  panel: 'users',        adminOnly: true },
  { id: 'survey-mgmt',  label: 'Survey Mgmt',  icon: '⊘',  panel: 'survey-mgmt',  adminOnly: true },
  { id: 'wa-settings',  label: 'WA Settings',  icon: '⚙',  panel: 'wa-settings',  adminOnly: true },
]

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin:         'bg-purple-100 text-purple-800 border-purple-200',
  supervisor:    'bg-blue-100 text-blue-800 border-blue-200',
  'iffs-member': 'bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4]',
  user:          'bg-gray-100 text-gray-700 border-gray-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { profile, isAdmin, canViewReports, signOut } = useAuthStore()
  const { activePanel, setActivePanel } = useUIStore()
  const { openModal } = useSurveyStore()

  const role = profile?.role ?? 'user'
  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : ''
  const roleLabel = ROLES[role]?.label ?? role

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
    if (item.opensSurvey) {
      openModal()
    } else if (item.panel) {
      setActivePanel(item.panel)
    }
  }

  return (
    <aside
      className="flex-shrink-0 flex flex-col"
      style={{
        width: '240px',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid var(--bd)',
        overflowY: 'auto',
      }}
    >
      {/* ── User profile block ──────────────────────────────────────────── */}
      <div
        className="px-5 py-5"
        style={{ borderBottom: '1px solid var(--bd)' }}
      >
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center mb-3 flex-shrink-0"
          style={{
            background: 'var(--g1)',
            boxShadow: '0 2px 8px rgba(29,119,51,0.20)',
          }}
          aria-hidden="true"
        >
          <span className="font-display text-[13px] font-bold text-white tracking-wide">
            {initials}
          </span>
        </div>

        {/* Name */}
        <p className="font-display text-[14px] font-bold text-[#0d1117] leading-snug truncate">
          {displayName}
        </p>
        {profile?.email && (
          <p className="font-body text-[11px] text-[#7a8a96] mt-0.5 truncate">
            {profile.email}
          </p>
        )}

        {/* Role badge */}
        <span
          className={[
            'inline-flex mt-2.5 font-body text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-[0.04em]',
            ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS['user'],
          ].join(' ')}
        >
          {roleLabel}
        </span>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4" aria-label="Dashboard navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.filter(isVisible).map((item) => {
            const active = isActive(item)
            return (
              <li key={item.id} role="listitem">
                <button
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 relative"
                  style={{
                    background: active ? 'rgba(29,119,51,0.07)' : 'transparent',
                    color: active ? 'var(--g1)' : 'var(--f2)',
                    borderLeft: active ? '3px solid var(--g1)' : '3px solid transparent',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      ;(e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(29,119,51,0.04)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="text-[16px] leading-none flex-shrink-0 w-5 text-center"
                    aria-hidden="true"
                    style={{ color: active ? 'var(--g1)' : 'var(--f3)' }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Sign out ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-5" style={{ borderTop: '1px solid var(--bd)', paddingTop: '12px' }}>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--f3)',
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
          <span className="text-[16px] leading-none flex-shrink-0 w-5 text-center" aria-hidden="true">
            ⇦
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
