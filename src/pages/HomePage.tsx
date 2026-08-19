// ─────────────────────────────────────────────────────────────────────────────
// HomePage — IFFS 2027 Biennial Survey · Marketing Landing Page
// Entrance + scroll choreography via GSAP (reduced-motion aware).
// ─────────────────────────────────────────────────────────────────────────────
import { useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useAuthStore } from '@/stores/authStore'
import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'
import { Shield, FileText, CheckCircle2, type LucideIcon } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

// ─── Types ────────────────────────────────────────────────────────────────────
interface StatItem {
  value: string
  label: string
}

interface FeatureCard {
  title: string
  description: string
  icon: LucideIcon
}


// ─── Constants ────────────────────────────────────────────────────────────────
// The closing date moved here from a badge under the hero CTAs. A small line of
// text trailing the buttons is the classic "tiny tagline below the CTA" that
// pads a hero to five stacked elements; as a stat row it sits with the other
// facts and the hero keeps to four (eyebrow, headline, subtext, CTAs).
const HERO_STATS: StatItem[] = [
  { value: '20',     label: 'SURVEY SECTIONS' },
  { value: '2027',   label: 'SURVEY YEAR' },
  { value: '2 yr',   label: 'REPORTING CYCLE' },
  { value: '31 Aug', label: 'SUBMISSIONS CLOSE 2026' },
]

const FEATURE_CARDS: FeatureCard[] = [
  {
    title: 'Secure & Private',
    icon: Shield,
    description:
      'Your responses are encrypted and only visible to IFFS administrators.',
  },
  {
    title: 'Auto-Save',
    icon: FileText,
    description:
      'Progress saves automatically after every answer, so you can complete the survey at your own pace.',
  },
  {
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
  const rootRef    = useRef<HTMLDivElement>(null)

  const handlePrimaryCTA = () => navigate(isLoggedIn ? '/dashboard' : '/login')

  // ── GSAP choreography ──────────────────────────────────────────────────────
  // One orchestrated hero timeline + scroll-triggered reveals. Users with
  // prefers-reduced-motion get the page fully visible with no motion at all.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia(rootRef)

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Hero entrance — left column cascades, right panel answers.
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } })
      tl.from('[data-hero="badge"]',    { y: 24, autoAlpha: 0, duration: 0.55 })
        .from('[data-hero="title"]',    { y: 42, autoAlpha: 0 }, '-=0.3')
        .from('[data-hero="copy"]',     { y: 24, autoAlpha: 0, duration: 0.6 }, '-=0.5')
        .from('[data-hero="cta"]',      { y: 18, autoAlpha: 0, duration: 0.55 }, '-=0.42')
        
        .from('[data-hero="card"]',     { y: 34, autoAlpha: 0, scale: 0.95, duration: 0.9, ease: 'power2.out' }, 0.35)
        .from('[data-hero="stat-row"]', { x: 26, autoAlpha: 0, stagger: 0.09, duration: 0.55 }, 0.55)

      // Ambient float on the countries card (takes over after entrance).
      gsap.to('[data-hero="card"]', {
        y: -8,
        duration: 3.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 1.5,
      })

      // Watermark "26" drifts as you scroll — quiet depth cue.
      gsap.to('[data-hero="watermark"]', {
        y: 90,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-section="hero"]',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      })

      // Features — header first, then the cards in sequence.
      //
      // Scroll reveals are driven by IntersectionObserver, not ScrollTrigger,
      // and deliberately so: ScrollTrigger caches start/end scroll positions,
      // and when the page reflows after those are computed (late webfont swap
      // is the usual culprit) the trigger can silently never fire — leaving
      // `autoAlpha: 0` content permanently invisible. IO recomputes against
      // live layout every time, so it cannot go stale. GSAP still runs the
      // animation; ScrollTrigger is kept above for the scrubbed parallax,
      // which is what it is genuinely the right tool for.
      //
      // Second safety layer: elements already on screen are never hidden at
      // all — they are shown as-is rather than animated in. So the worst case
      // anywhere on this page is a missing animation, never missing content.
      const observers: IntersectionObserver[] = []

      const revealOnScroll = (selector: string, stagger: number) => {
        const offscreen = gsap.utils
          .toArray<HTMLElement>(selector)
          .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9)
        if (offscreen.length === 0) return

        gsap.set(offscreen, { y: 36, autoAlpha: 0 })

        const pending = new Set(offscreen)
        const io = new IntersectionObserver(
          (entries) => {
            const entering = entries
              .filter((e) => e.isIntersecting && pending.has(e.target as HTMLElement))
              .map((e) => e.target as HTMLElement)
            if (entering.length === 0) return
            entering.forEach((el) => { pending.delete(el); io.unobserve(el) })
            gsap.to(entering, {
              y: 0,
              autoAlpha: 1,
              stagger,
              duration: 0.7,
              ease: 'power3.out',
              overwrite: true,
            })
          },
          { rootMargin: '0px 0px -10% 0px' },
        )
        offscreen.forEach((el) => io.observe(el))
        observers.push(io)
      }

      // Wait for webfonts before measuring. useLayoutEffect runs before the
      // font swap, when the page is still laid out in fallback metrics and is
      // materially shorter — measuring then makes below-the-fold elements look
      // on-screen, and the reveal silently never arms. The same reflow is what
      // invalidates ScrollTrigger's cached parallax positions, so refresh here.
      let cancelled = false
      void (document.fonts?.ready ?? Promise.resolve()).then(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          revealOnScroll('[data-reveal="feature-head"]', 0)
          revealOnScroll('[data-reveal="feature-card"]', 0.12)
          ScrollTrigger.refresh()
        })
      })

      return () => {
        cancelled = true
        observers.forEach((io) => io.disconnect())
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <div ref={rootRef} className="min-h-screen bg-s1 font-body" style={{ paddingTop: '68px' }}>
      <Nav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        data-section="hero"
        className="relative grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100dvh-68px)]"
        aria-label="Hero section"
      >
        {/* ── Left — copy ─────────────────────────────────────────────────── */}
        <div className="relative flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-16 lg:px-16 xl:px-24 overflow-hidden">

          {/* Watermark "26" */}
          <span
            data-hero="watermark"
            aria-hidden="true"
            className="pointer-events-none select-none absolute left-[-20px] top-1/2 -translate-y-1/2 font-display font-light leading-none"
            style={{
              fontSize:      'clamp(180px, 28vw, 300px)',
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
              data-hero="badge"
              className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border"
              style={{
                borderColor:     'rgba(29,119,51,0.25)',
                backgroundColor: 'rgba(232,245,236,0.7)',
              }}
            >
              {/* The pulsing ring that used to sit here was a decorative status
                  dot: it signalled nothing. Removed. One separator, not two. */}
              <span
                className="font-display text-[11px] font-bold tracking-[0.18em] uppercase"
                style={{ color: '#0e5921' }}
              >
                IFFS Biennial Survey · 2027
              </span>
            </div>

            {/* H1 */}
            <h1
              data-hero="title"
              className="font-display font-light leading-[1.06] mb-5"
              style={{
                fontSize: 'clamp(32px, 3.2vw, 42px)',
                color:    '#0d1117',
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
              data-hero="copy"
              className="font-body text-lg leading-relaxed mb-8"
              style={{ color: '#3d4a52', maxWidth: '480px' }}
            >
              The International Federation of Fertility Societies 2027 Biennial
              Survey collects global data on ART infrastructure, regulation,
              financing, and clinical practice.
            </p>

            {/* CTA row */}
            <div data-hero="cta" className="flex flex-wrap gap-4">
              {/* Primary CTA */}
              <button
                type="button"
                onClick={handlePrimaryCTA}
                className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 min-h-[52px] rounded-full text-white bg-g1 hover:bg-g2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                style={{ boxShadow: '0 8px 32px rgba(29,119,51,0.35)' }}
              >
                {isLoggedIn ? 'Go to Dashboard' : 'Take the Survey'}
                <span aria-hidden="true">→</span>
              </button>

              {!isLoggedIn && (
                <button
                  type="button"
                  aria-label="Learn more about the survey features"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 font-display text-[13px] font-bold tracking-[0.12em] uppercase px-8 py-4 min-h-[52px] rounded-full text-g1 bg-transparent border border-g1/45 hover:bg-g1/[0.06] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  Learn More <span aria-hidden="true">↓</span>
                </button>
              )}
            </div>

            {/* The closing date lives in the stats panel now — see HERO_STATS. */}

          </div>
        </div>

        {/* ── Right — dark green panel ─────────────────────────────────────── */}
        <div
          className="relative flex flex-col overflow-hidden min-h-[440px] lg:min-h-0"
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
            data-hero="card"
            className="absolute top-6 left-6 sm:top-8 sm:left-8 z-10 rounded-2xl p-5"
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
          <div className="mt-auto z-10 relative px-5 pb-6 pt-4 sm:px-8 sm:pb-8">
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
                  data-hero="stat-row"
                  className="flex items-center gap-4 px-5 sm:px-6 py-4"
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
        data-section="features"
        className="py-20 sm:py-24 px-6 scroll-mt-[68px]"
        style={{ backgroundColor: '#ffffff' }}
        aria-label="Features"
      >
        <div className="max-w-6xl mx-auto">

          {/* Section header. The eyebrow that sat above this headline is gone:
              the hero badge already spends the page's one permitted eyebrow,
              and "Why Use Our Survey Platform" told the reader nothing the
              headline underneath doesn't. Left-aligned rather than centred so
              it doesn't mirror the hero's composition. */}
          <div data-reveal="feature-head" className="max-w-2xl mb-12 sm:mb-14">
            <h2
              className="font-display font-light leading-tight"
              style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: '#0d1117' }}
            >
              Built for Global{' '}
              <span style={{ color: '#1d7733' }}>Medical Research</span>
            </h2>
          </div>

          {/* Three equal cards in a row is the single most templated feature
              layout there is, so this is an asymmetric trio instead: the trust
              message carries a filled brand panel (echoing the hero's right
              half, so the page keeps one visual language), the two supporting
              points sit lighter beside it. */}
          <div data-reveal="feature-grid" className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Primary — filled */}
            <article
              data-reveal="feature-card"
              className="lg:col-span-3 rounded-2xl p-8 sm:p-10 flex flex-col justify-between min-h-[260px] relative overflow-hidden"
              style={{ backgroundColor: '#0e5921' }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 70% at 88% 12%, rgba(42,148,68,0.35) 0%, transparent 62%)',
                }}
              />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl mb-6 flex items-center justify-center bg-white/12">
                  <Shield size={22} strokeWidth={2} className="text-white" />
                </div>
                <h3 className="font-display text-2xl sm:text-[28px] font-semibold mb-3 text-white leading-snug">
                  {FEATURE_CARDS[0].title}
                </h3>
                <p
                  className="font-body text-base leading-relaxed max-w-md"
                  style={{ color: 'rgba(232,245,236,0.82)' }}
                >
                  {FEATURE_CARDS[0].description}
                </p>
              </div>
            </article>

            {/* Supporting pair — stacked */}
            <div className="lg:col-span-2 grid gap-5">
              {FEATURE_CARDS.slice(1).map((card) => (
                <article
                  key={card.title}
                  data-reveal="feature-card"
                  className="group rounded-2xl p-7 border border-bd bg-s1 transition-all duration-300 hover:bg-white hover:border-g1/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(29,119,51,0.12)]"
                >
                  <div className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center bg-g3 transition-colors duration-300 group-hover:bg-g1">
                    <card.icon
                      size={20}
                      strokeWidth={2}
                      className="text-g1 transition-colors duration-300 group-hover:text-white"
                    />
                  </div>
                  <h3
                    className="font-display text-lg font-semibold mb-2"
                    style={{ color: '#0d1117' }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="font-body text-[15px] leading-relaxed"
                    style={{ color: '#3d4a52' }}
                  >
                    {card.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>


      <Footer />

    </div>
  )
}
