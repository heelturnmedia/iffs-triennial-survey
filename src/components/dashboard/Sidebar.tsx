import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Users,
  ScrollText,
  Settings2,
  Unplug,
  LogOut,
  Workflow,
  UserCircle2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { cn } from '@/utils/cn'
import type { ActivePanel } from '@/types'
import { ROLES } from '@/constants'

// ─── Nav item definitions ─────────────────────────────────────────────────────

export interface NavItem {
  id: ActivePanel | 'survey'
  label: string
  /** Short label for the mobile bottom navigation bar */
  shortLabel?: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  panel?: ActivePanel
  opensSurvey?: boolean
  adminOnly?: boolean
  supervisorPlus?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview',    label: 'Overview',    shortLabel: 'Overview', Icon: LayoutDashboard, panel: 'overview' },
  { id: 'survey',      label: 'My Survey',   shortLabel: 'Survey',   Icon: ClipboardList,   opensSurvey: true },
  { id: 'reports',     label: 'Reports',     shortLabel: 'Reports',  Icon: BarChart3,       panel: 'reports',     supervisorPlus: true },
  { id: 'users',       label: 'Users',       Icon: Users,           panel: 'users',       adminOnly: true },
  { id: 'activity',    label: 'Activity Log',Icon: ScrollText,      panel: 'activity',    adminOnly: true },
  { id: 'survey-mgmt', label: 'Survey Mgmt', Icon: Settings2,       panel: 'survey-mgmt', adminOnly: true },
  { id: 'wa-settings', label: 'WA Settings', Icon: Unplug,          panel: 'wa-settings', adminOnly: true },
  { id: 'app-flow',    label: 'App Flow',    Icon: Workflow,         panel: 'app-flow',    adminOnly: true },
  { id: 'profile',     label: 'My Profile',  shortLabel: 'Profile',  Icon: UserCircle2,       panel: 'profile' },
]

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin:         { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe' },
  supervisor:    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  'iffs-member': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  user:          { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
}

// ─── Shared navigation logic ──────────────────────────────────────────────────
// One source of truth for visibility, active state, the password-recovery lock,
// and the unsaved-profile-changes confirm — used by both the Sidebar (desktop /
// drawer) and the MobileBottomNav, so behavior can never drift between the two.

export function useDashboardNav() {
  const { profile, isAdmin, canViewReports, signOut, isPasswordRecovery } = useAuthStore()
  const { activePanel, setActivePanel } = useUIStore()
  const profileFormDirty = useUIStore((s) => s.profileFormDirty)
  const openConfirmModal = useUIStore((s) => s.openConfirmModal)
  const setProfileFormDirty = useUIStore((s) => s.setProfileFormDirty)
  const { openModal } = useSurveyStore()

  const isVisible = (item: NavItem): boolean => {
    if (item.adminOnly) return isAdmin()
    if (item.supervisorPlus) return canViewReports()
    return true
  }

  const isActive = (item: NavItem): boolean => {
    if (item.opensSurvey) return false
    return activePanel === item.panel
  }

  const isDisabled = (item: NavItem): boolean =>
    isPasswordRecovery && item.panel !== 'profile'

  /** Navigate to an item. `after` runs once navigation actually happens
   *  (used to close the mobile drawer). */
  const handleItemClick = (item: NavItem, after?: () => void) => {
    // During password recovery, only the profile panel is reachable.
    if (isDisabled(item)) return

    const performNavigation = () => {
      if (item.opensSurvey) {
        openModal()
      } else if (item.panel) {
        setActivePanel(item.panel)
      }
      after?.()
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

  return { profile, isAdmin, isVisible, isActive, isDisabled, handleItemClick, signOut }
}

// ─── Component ────────────────────────────────────────────────────────────────
// Fills its parent (the parent decides width): a static column on desktop, or
// the panel inside the mobile drawer. Same content and behavior in both.

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, isVisible, isActive, isDisabled, handleItemClick, signOut } = useDashboardNav()

  const role = profile?.role ?? 'user'
  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'
  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : ''
  const roleLabel = ROLES[role]?.label ?? role
  const badge = ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS['user']

  return (
    <aside className="w-full h-full flex flex-col overflow-y-auto bg-white border-r border-bd">
      {/* ── User profile block ──────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 border-b border-bd">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--g1) 0%, var(--g5) 100%)',
            boxShadow: '0 2px 10px rgba(29,119,51,0.28)',
          }}
          aria-hidden="true"
        >
          <span className="font-display text-[13px] font-bold text-white tracking-[0.04em]">
            {initials}
          </span>
        </div>

        {/* Name */}
        <p className="font-display text-[13.5px] font-bold text-f1 leading-tight truncate">
          {displayName}
        </p>
        {profile?.email && (
          <p className="font-body text-[11px] text-f3 mt-0.5 truncate">
            {profile.email}
          </p>
        )}

        {/* Role badge */}
        <span
          className="inline-flex items-center mt-2 font-body text-[10px] font-semibold tracking-[0.05em] px-2 py-[3px] rounded-full border"
          style={{ borderColor: badge.border, background: badge.bg, color: badge.text }}
        >
          {roleLabel}
        </span>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 pt-3 pb-2" aria-label="Dashboard navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.filter(isVisible).map((item) => {
            const active = isActive(item)
            const disabled = isDisabled(item)
            const { Icon } = item
            return (
              <li key={item.id} role="listitem">
                <button
                  type="button"
                  onClick={() => handleItemClick(item, onNavigate)}
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl text-left',
                    'font-body text-[13px] transition-all duration-150 border-none cursor-pointer',
                    active
                      ? 'bg-g1/[0.07] text-g1 font-semibold'
                      : 'bg-transparent text-f2 font-normal hover:bg-g1/[0.04] hover:text-f1',
                    disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-f2',
                  )}
                >
                  {/* Left active bar */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-[3px] bg-g1"
                    />
                  )}

                  {/* Icon container */}
                  <span
                    className={cn(
                      'flex items-center justify-center shrink-0 w-[30px] h-[30px] rounded-lg transition-all duration-150',
                      active ? 'bg-g1/[0.12] text-g1' : 'bg-transparent text-f3',
                    )}
                  >
                    <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
                  </span>

                  <span className="flex-1">{item.label}</span>

                  {/* Active indicator dot */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="w-[5px] h-[5px] rounded-full bg-g1 shrink-0 opacity-70"
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Sign out ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-4 pt-2.5 border-t border-bd">
        <button
          type="button"
          onClick={() => signOut().then(() => { window.location.href = '/' })}
          className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-xl text-left font-body text-[13px] font-normal text-f3 bg-transparent border-none cursor-pointer transition-all duration-150 hover:bg-red-600/5 hover:text-red-600"
        >
          <span className="flex items-center justify-center shrink-0 w-[30px] h-[30px] rounded-lg">
            <LogOut size={15} strokeWidth={1.8} />
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
