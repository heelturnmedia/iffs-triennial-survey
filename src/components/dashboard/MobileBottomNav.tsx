// ─────────────────────────────────────────────────────────────────────────────
// MobileBottomNav — MD3-style bottom navigation bar, visible below lg only.
// Shows the core destinations (Overview / Survey / Reports / Profile) in the
// thumb zone; admins get a fifth "Menu" item that opens the full nav drawer.
// All click behavior comes from useDashboardNav — shared with the Sidebar.
// ─────────────────────────────────────────────────────────────────────────────
import { Menu } from 'lucide-react'
import { NAV_ITEMS, useDashboardNav } from './Sidebar'
import { cn } from '@/utils/cn'

const CORE_IDS = ['overview', 'survey', 'reports', 'profile'] as const

export function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { isAdmin, isVisible, isActive, isDisabled, handleItemClick } = useDashboardNav()

  const items = NAV_ITEMS
    .filter((i) => (CORE_IDS as readonly string[]).includes(i.id))
    .filter(isVisible)
  const showMenu = isAdmin()

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-[840] bg-white/95 backdrop-blur-xl border-t border-bd pb-[env(safe-area-inset-bottom)]"
      aria-label="Dashboard navigation"
    >
      <ul className="flex items-stretch justify-around" role="list">
        {items.map((item) => {
          const active = isActive(item)
          const disabled = isDisabled(item)
          const { Icon } = item
          return (
            <li key={item.id} role="listitem" className="flex-1">
              <button
                type="button"
                onClick={() => handleItemClick(item)}
                disabled={disabled}
                aria-disabled={disabled || undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'w-full min-h-[64px] flex flex-col items-center justify-center gap-1 px-1',
                  'bg-transparent border-none cursor-pointer transition-colors duration-150',
                  disabled && 'opacity-40 cursor-not-allowed',
                )}
              >
                {/* MD3 active indicator pill behind the icon */}
                <span
                  className={cn(
                    'flex items-center justify-center w-14 h-7 rounded-full transition-colors duration-200',
                    active ? 'bg-g3 text-g1' : 'text-f3',
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span
                  className={cn(
                    'font-body text-[10.5px] leading-none tracking-[0.01em]',
                    active ? 'text-g1 font-semibold' : 'text-f3 font-medium',
                  )}
                >
                  {item.shortLabel ?? item.label}
                </span>
              </button>
            </li>
          )
        })}

        {showMenu && (
          <li role="listitem" className="flex-1">
            <button
              type="button"
              onClick={onOpenMenu}
              className="w-full min-h-[64px] flex flex-col items-center justify-center gap-1 px-1 bg-transparent border-none cursor-pointer transition-colors duration-150"
              aria-haspopup="dialog"
            >
              <span className="flex items-center justify-center w-14 h-7 rounded-full text-f3">
                <Menu size={19} strokeWidth={1.8} />
              </span>
              <span className="font-body text-[10.5px] leading-none tracking-[0.01em] text-f3 font-medium">
                Menu
              </span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
