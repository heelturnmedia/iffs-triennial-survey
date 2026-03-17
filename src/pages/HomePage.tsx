// ─────────────────────────────────────────────────────────────────────────────
// HomePage — IFFS 2026 Triennial Survey · Marketing Landing Page
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatItem {
  value: string
  label: string
}

interface FeatureCard {
  number: string
  title: string
  description: string
}

interface DataRow {
  label: string
  value: string
  width: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const HERO_STATS: StatItem[] = [
  { value: '20',   label: 'SURVEY SECTIONS' },
  { value: '2026', label: 'SURVEY YEAR' },
  { value: '3 yr', label: 'REPORTING CYCLE' },
  { value: 'IFFS', label: 'GLOBAL BODY' },
]

const FEATURE_CARDS: FeatureCard[] = [
  {
    number: '01',
    title: 'Secure & Private',
    description:
      'Your responses are encrypted and only visible to IFFS administrators.',
  },
  {
    number: '02',
    title: 'Auto-Save',
    description:
      'Progress saves automatically after every answer — complete at your own pace.',
  },
  {
    number: '03',
    title: 'One Submission',
    description:
      'Each country submits once, ensuring data integrity across the global dataset.',
  },
]

const ABOUT_DATA_ROWS: DataRow[] = [
  { label: 'ART Infrastructure',    value: '147 countries', width: 88 },
  { label: 'Regulatory Frameworks', value: '96 responses',  width: 72 },
  { label: 'Clinical Practice',     value: '134 entries',   width: 82 },
  { label: 'Financing Models',      value: '112 datasets',  width: 68 },
  { label: 'Success Rates',         value: '89 reports',    width: 60 },
]

const ABOUT_BULLETS: string[] = [
  'Tracks policy evolution and ART regulation across 147 countries',
  'Benchmarks clinical protocols against international best practice',
  'Informs WHO, UN, and ICMART global health reporting',
  'Provides longitudinal data across 30+ years of surveys',
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const isLoggedIn = Boolean(user)

  const handlePrimaryCTA = () => navigate(isLoggedIn ? '/dashboard' : '/auth')

  return (
    <div className="min-h-screen bg-s1 font-body" style={{ paddingTop: '68px' }}>
      <Nav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-68px)]"
        aria-label="Hero section"
      >
        {/* ── Left — copy ─────────────────────────────────────────────────── */}
        <div className="relative flex flex-col justify-center px-10 py-20 lg:px-16 xl:px-24 overflow-hidden">

          {/* Watermark "26" */}
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute left-[-20px] top-1/2 -translate-y-1/2 font-display font-light leading-none"
            style={{
              fontSize:      '300px',
              color:         'rgba(29,119,51,0.055)',
              letterSpacing: '-0.04em',
              zIndex:        0,
            }}
          >
            26
          </span>

          {/* Content */}
          <div className="relative z-10 max-w-xl">

            {/* Badge */}
            <div
              className="animate-fade-slide-up inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border"
              style={{
                borderColor:     'rgba(29,119,51,0.25)',
                backgroundColor: 'rgba(232,245,236,0.7)',
                opacity:         0,
                animationDelay:  '0.05s',
              }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="animate-expand-ring absolute inline-flex h-full w-full rounded-full"
                  style={{ backgroundColor: '#2a9444', opacity: 0.5 }}
                />
                <span
                  className="relative inline-flex rounded-full h-2.5 w-2.5"
                  style={{ backgroundColor: '#1d7733' }}
                />
              </span>
              <span
                className="font-display text-[11px] font-bold tracking-[0.18em] uppercase"
                style={{ color: '#0e5921' }}
              >
                IFFS · Triennial Survey · 2026
              </span>
            </div>

            {/* H1 */}
            <h1
              className="animate-fade-slide-up font-display font-light leading-[1.06] mb-6"
              style={{
                fontSize:       'clamp(44px, 5.5vw, 76px)',
                color:          '#0d1117',
                opacity:        0,
                animationDelay: '0.12s',
              }}
            >
              Shaping the{' '}
              <em
                style={{
                  fontStyle:  'italic',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 300,
                  color:      '#1d7733',
                }}
              >
                Future
              </em>
              {' '}of
              <br />
              Reproductive Medicine
            </h1>

            {/* Description */}
            <p
              className="animate-fade-slide-up font-body text-lg leading-relaxed mb-10"
              style={{
                color:          '#3d4a52',
                maxWidth:       '480px',
                opacity:        0,
                animationDelay: '0.22s',
              }}
            >
              The International Federation of Fertility Societies 2026 Triennial
              Survey collects global data on ART infrastructure, regulation,
              financing, and clinical practice.
            </p>

            {/* CTA row */}
            <div
              className="animate-fade-slide-up flex flex-wrap gap-4"
              style={{ opacity: 0, animationDelay: '0.32s' }}
            >
              {/* Primary CTA */}
              <button
                type="button"
                onClick={handlePrimaryCTA}
                className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 rounded-full text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none"
                style={{
                  backgroundColor: '#1d7733',
                  boxShadow:       '0 8px 32px rgba(29,119,51,0.35)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0e5921'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d7733'
                }}
              >
                {isLoggedIn ? 'Go to Dashboard' : 'Take the Survey'}
                <span aria-hidden="true">→</span>
              </button>

              {/* Ghost CTA */}
              <button
                type="button"
                onClick={() =>
                  document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="inline-flex items-center font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 rounded-full border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none"
                style={{
                  borderColor:     'rgba(29,119,51,0.35)',
                  color:           '#1d7733',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.backgroundColor = 'rgba(232,245,236,0.6)'
                  el.style.borderColor     = '#1d7733'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.backgroundColor = 'transparent'
                  el.style.borderColor     = 'rgba(29,119,51,0.35)'
                }}
              >
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* ── Right — dark green panel ─────────────────────────────────────── */}
        <div
          className="relative flex flex-col overflow-hidden min-h-[480px] lg:min-h-0"
          style={{ backgroundColor: '#0e5921' }}
        >
          {/* Animated rings */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="absolute rounded-full border"
                style={{
                  width:            `${220 + i * 110}px`,
                  height:           `${220 + i * 110}px`,
                  borderColor:      'rgba(42,148,68,0.22)',
                  animation:        `expandRing ${2.2 + i * 0.5}s ease-out infinite`,
                  animationDelay:   `${i * 0.55}s`,
                }}
              />
            ))}
          </div>

          {/* Mesh gradient overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background: [
                'radial-gradient(ellipse 70% 60% at 80% 20%, rgba(42,148,68,0.18) 0%, transparent 60%)',
                'radial-gradient(ellipse 50% 50% at 20% 80%, rgba(14,89,33,0.14) 0%, transparent 60%)',
              ].join(', '),
            }}
          />

          {/* Floating countries card */}
          <div
            className="animate-float-card absolute top-8 left-8 z-10 rounded-2xl p-5"
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              backdropFilter:  'blur(12px)',
              border:          '1px solid rgba(255,255,255,0.14)',
              boxShadow:       '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div
              className="font-display font-light leading-none mb-1"
              style={{ fontSize: '52px', color: '#ffffff' }}
            >
              147
            </div>
            <div
              className="font-display text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{ color: 'rgba(209,235,216,0.8)' }}
            >
              Countries
            </div>
            <div
              className="font-body text-[12px] mt-0.5"
              style={{ color: 'rgba(232,245,236,0.6)' }}
            >
              Invited to Participate
            </div>
          </div>

          {/* Stats stack */}
          <div className="mt-auto z-10 relative px-8 pb-8 pt-4">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'rgba(0,0,0,0.18)',
                backdropFilter:  'blur(12px)',
                border:          '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {HERO_STATS.map((stat, idx) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 px-6 py-4"
                  style={{
                    borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.07)' : undefined,
                  }}
                >
                  <span
                    className="font-display font-light text-white leading-none"
                    style={{ fontSize: '28px', minWidth: '72px' }}
                  >
                    {stat.value}
                  </span>
                  <span
                    className="font-display text-[10px] font-bold tracking-[0.22em] uppercase"
                    style={{ color: 'rgba(209,235,216,0.65)' }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section
        className="py-24 px-6"
        style={{ backgroundColor: '#ffffff' }}
        aria-label="Features"
      >
        <div className="max-w-6xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-16">
            <span
              className="inline-block font-display text-[11px] font-bold tracking-[0.22em] uppercase mb-4 px-4 py-2 rounded-full"
              style={{ color: '#1d7733', backgroundColor: '#e8f5ec' }}
            >
              Why Use Our Survey Platform
            </span>
            <h2
              className="font-display font-light leading-tight"
              style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#0d1117' }}
            >
              Built for Global
              <br />
              <span style={{ color: '#1d7733' }}>Medical Research</span>
            </h2>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.number}
                className="relative rounded-2xl p-8 transition-all duration-300 cursor-default"
                style={{ border: '1px solid #e2ebe4', backgroundColor: '#f7f9f7' }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor     = 'rgba(29,119,51,0.3)'
                  el.style.backgroundColor = '#ffffff'
                  el.style.boxShadow       = '0 8px 32px rgba(29,119,51,0.12)'
                  el.style.transform       = 'translateY(-4px)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor     = '#e2ebe4'
                  el.style.backgroundColor = '#f7f9f7'
                  el.style.boxShadow       = 'none'
                  el.style.transform       = 'translateY(0)'
                }}
              >
                <div
                  className="font-display font-light mb-5 leading-none"
                  style={{ fontSize: '40px', color: 'rgba(29,119,51,0.18)' }}
                >
                  {card.number}
                </div>
                <div
                  className="w-10 h-0.5 mb-5 rounded-full"
                  style={{ backgroundColor: '#1d7733' }}
                />
                <h3
                  className="font-display text-xl font-semibold mb-3"
                  style={{ color: '#0d1117' }}
                >
                  {card.title}
                </h3>
                <p
                  className="font-body text-base leading-relaxed"
                  style={{ color: '#3d4a52' }}
                >
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ─────────────────────────────────────────────────────────── */}
      <section
        id="about-section"
        className="py-24 px-6"
        style={{ backgroundColor: '#f0f4f1' }}
        aria-label="About the survey"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — visual panel */}
          <div
            className="relative rounded-3xl p-8 overflow-hidden flex flex-col justify-between"
            style={{ backgroundColor: '#1d7733', minHeight: '480px' }}
          >
            {/* Background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{
                background: [
                  'radial-gradient(ellipse 80% 60% at 90% 10%, rgba(42,148,68,0.3) 0%, transparent 55%)',
                  'radial-gradient(ellipse 60% 50% at 5% 90%, rgba(14,89,33,0.4) 0%, transparent 55%)',
                ].join(', '),
              }}
            />

            <div className="relative z-10">
              <div
                className="font-display text-[11px] font-bold tracking-[0.22em] uppercase mb-6"
                style={{ color: 'rgba(209,235,216,0.7)' }}
              >
                Survey Data Points · 2026
              </div>

              <div className="space-y-5">
                {ABOUT_DATA_ROWS.map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between items-baseline mb-2">
                      <span
                        className="font-body text-sm font-medium"
                        style={{ color: 'rgba(232,245,236,0.85)' }}
                      >
                        {row.label}
                      </span>
                      <span
                        className="font-display text-xs font-bold"
                        style={{ color: 'rgba(209,235,216,0.7)' }}
                      >
                        {row.value}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:           `${row.width}%`,
                          backgroundColor: 'rgba(209,235,216,0.55)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom stat */}
            <div
              className="relative z-10 mt-8 pt-6 flex items-end gap-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
            >
              <div>
                <div
                  className="font-display font-light leading-none mb-1"
                  style={{ fontSize: '56px', color: '#ffffff' }}
                >
                  30
                  <span style={{ fontSize: '28px', color: 'rgba(209,235,216,0.7)' }}>+</span>
                </div>
                <div
                  className="font-display text-[10px] font-bold tracking-[0.2em] uppercase"
                  style={{ color: 'rgba(209,235,216,0.65)' }}
                >
                  Years of Data
                </div>
              </div>
              <div
                className="ml-auto font-body text-xs leading-relaxed text-right"
                style={{ color: 'rgba(232,245,236,0.55)', maxWidth: '160px' }}
              >
                Continuous global fertility data collection since 1992
              </div>
            </div>
          </div>

          {/* Right — copy */}
          <div>
            <span
              className="inline-block font-display text-[11px] font-bold tracking-[0.22em] uppercase mb-5 px-4 py-2 rounded-full"
              style={{ color: '#1d7733', backgroundColor: '#e8f5ec' }}
            >
              About the Survey
            </span>

            <h2
              className="font-display font-light leading-tight mb-6"
              style={{ fontSize: 'clamp(28px, 3.5vw, 42px)', color: '#0d1117' }}
            >
              Three Decades of{' '}
              <span style={{ color: '#1d7733' }}>Global Fertility Data</span>
            </h2>

            <p
              className="font-body text-base leading-relaxed mb-6"
              style={{ color: '#3d4a52' }}
            >
              Since 1992, the International Federation of Fertility Societies has
              conducted its landmark Triennial Survey — the most comprehensive global
              census of assisted reproductive technology. The 2026 edition continues
              this tradition, gathering standardised data from national fertility
              societies in every region of the world.
            </p>

            <p
              className="font-body text-base leading-relaxed mb-8"
              style={{ color: '#3d4a52' }}
            >
              Results are published as an open-access Surveillance report, cited by
              governments, international health bodies, and clinical guideline
              committees worldwide.
            </p>

            <ul className="space-y-4 mb-10">
              {ABOUT_BULLETS.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#e8f5ec' }}
                    aria-hidden="true"
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="#1d7733"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className="font-body text-sm leading-relaxed"
                    style={{ color: '#3d4a52' }}
                  >
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={handlePrimaryCTA}
              className="inline-flex items-center gap-2 font-display text-[12px] font-bold tracking-[0.14em] uppercase px-8 py-4 rounded-full text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none"
              style={{
                backgroundColor: '#1d7733',
                boxShadow:       '0 8px 32px rgba(29,119,51,0.28)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0e5921'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d7733'
              }}
            >
              {isLoggedIn ? 'Go to Dashboard' : 'Participate Now'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  )
}
