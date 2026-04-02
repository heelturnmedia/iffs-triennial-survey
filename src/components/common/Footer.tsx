// Black background footer
// Left:   "IFFS SURVEY" (SURVEY in green)
// Center: Privacy Policy | Terms of Use | Contact
// Right:  "© 2026 IFFS. All rights reserved."

import { Link } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'

const FOOTER_LINKS: { label: string; to?: string }[] = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Use',   to: '/terms' },
  { label: 'Contact' },
]

export function Footer() {
  const { toast } = useUIStore()

  return (
    <footer
      className="w-full border-t"
      style={{
        background: '#000',
        borderColor: 'rgba(255,255,255,0.06)',
        paddingTop: 36,
        paddingBottom: 36,
        paddingLeft: 32,
        paddingRight: 32,
      }}
    >
      <div
        className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-6"
        style={{ maxWidth: 1200 }}
      >
        {/* ── Brand ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <img
            src="/iffs-logo.png"
            alt="IFFS"
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div className="flex flex-col leading-none">
            <span
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.18em',
                color: '#fff',
              }}
            >
              IFFS{' '}
              <em style={{ fontStyle: 'normal', color: 'var(--g5)' }}>SURVEY</em>
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.03em',
                marginTop: 2,
              }}
            >
              2026 Triennial on ART
            </span>
          </div>
        </div>

        {/* ── Links ─────────────────────────────────────────────── */}
        <nav className="flex items-center gap-6" aria-label="Footer navigation">
          {FOOTER_LINKS.map(({ label, to }, i) => (
            <span key={label} className="flex items-center gap-6">
              {to ? (
                <Link
                  to={to}
                  className="transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    textDecoration: 'none',
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = '#fff'
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)'
                  }}
                >
                  {label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => toast(`${label} — Coming soon.`, 'info')}
                  className="transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#fff'
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'
                  }}
                >
                  {label}
                </button>
              )}
              {i < FOOTER_LINKS.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 1,
                    height: 12,
                    background: 'rgba(255,255,255,0.15)',
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </span>
          ))}
        </nav>

        {/* ── Copyright ─────────────────────────────────────────── */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'rgba(255,255,255,0.28)',
            margin: 0,
          }}
        >
          © 2026 IFFS. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
