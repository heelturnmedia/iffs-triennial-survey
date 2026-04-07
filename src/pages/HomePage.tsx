// ─────────────────────────────────────────────────────────────────────────────
// HomePage — IFFS 2026 Triennial Survey · Marketing Landing Page
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'
import { Shield, FileText, CheckCircle2, CalendarDays, type LucideIcon } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatItem {
  value: string
  label: string
}

interface FeatureCard {
  number: string
  title: string
  description: string
  icon: LucideIcon
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
    icon: Shield,
    description:
      'Your responses are encrypted and only visible to IFFS administrators.',
  },
  {
    number: '02',
    title: 'Auto-Save',
    icon: FileText,
    description:
      'Progress saves automatically after every answer — complete at your own pace.',
  },
  {
    number: '03',
    title: 'One Submission',
    icon: CheckCircle2,
    description:
      'Each user submits once, ensuring data integrity across the global dataset.',
  },
]


// ─── Component ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const isLoggedIn = Boolean(user)

  const handlePrimaryCTA = () => navigate(isLoggedIn ? '/dashboard' : '/login')

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

              {!isLoggedIn && (
                <button
                  type="button"
                  aria-label="Learn more about the survey features"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none"
                  style={{ border: '1px solid rgba(29,119,51,0.45)', color: '#1d7733', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(29,119,51,0.06)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                >
                  Learn More <span aria-hidden="true">↓</span>
                </button>
              )}

            </div>

            {/* Deadline badge */}
            <div
              className="animate-fade-slide-up mt-2"
              style={{ opacity: 0, animationDelay: '0.42s' }}
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: 'rgba(232,245,236,0.8)',
                  border: '1px solid rgba(29,119,51,0.2)',
                }}
              >
                <CalendarDays size={13} color="#0e5921" strokeWidth={2} />
                <span
                  className="font-display text-[11px] font-semibold tracking-[0.06em]"
                  style={{ color: '#0e5921' }}
                >
                  Submissions close 31 March 2027
                </span>
              </div>
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

      {/* ── Hero → Features separator ──────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          height: '4px',
          background: 'linear-gradient(to right, #1d7733, #2a9444, #1d7733)',
        }}
      />

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section
        id="features"
        className="py-24 px-6 scroll-mt-[68px]"
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
                {/* Icon tile */}
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    backgroundColor: '#e8f5ec',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <card.icon size={22} color="#1d7733" strokeWidth={2} />
                </div>
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


      <Footer />

    </div>
  )
}
