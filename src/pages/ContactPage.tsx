import { Mail, MapPin, Globe } from 'lucide-react'
import { Nav }    from '@/components/common/Nav'
import { Footer } from '@/components/common/Footer'

const CONTACT_EMAIL = 'secretariat@iffsreproduction.org'

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ paddingTop: '68px' }}>
      <Nav />

      <main className="flex-1 py-20 px-6">
        <div className="max-w-3xl mx-auto">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="mb-12">
            <span
              className="inline-block font-display text-[11px] font-bold tracking-[0.22em] uppercase mb-4 px-4 py-2 rounded-full"
              style={{ color: '#1d7733', backgroundColor: '#e8f5ec' }}
            >
              Get in Touch
            </span>
            <h1
              className="font-display font-light leading-tight mb-4"
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: '#0d1117' }}
            >
              Contact Us
            </h1>
            <p className="font-body text-[15px] leading-relaxed" style={{ color: '#3d4a52' }}>
              Have a question about the 2026 IFFS Triennial Survey? Need assistance with your
              submission? Our secretariat team is here to help.
            </p>
          </div>

          {/* ── Contact card ────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-8"
            style={{ border: '1px solid #e2ebe4', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
          >
            {/* Green top bar */}
            <div
              className="h-2"
              style={{ background: 'linear-gradient(90deg, #1d7733 0%, #0e5921 100%)' }}
            />

            <div className="p-8 md:p-10 bg-white">
              <h2
                className="font-display text-[18px] font-bold mb-6"
                style={{ color: '#0d1117' }}
              >
                IFFS Secretariat
              </h2>

              <div className="space-y-5">
                {/* Email */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#e8f5ec' }}
                  >
                    <Mail size={18} color="#1d7733" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p
                      className="font-body text-[11px] font-semibold tracking-[0.08em] uppercase mb-1"
                      style={{ color: '#7a8a96' }}
                    >
                      Email
                    </p>
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="font-body text-[15px] font-medium transition-colors"
                      style={{ color: '#1d7733', textDecoration: 'none' }}
                      onMouseOver={e =>
                        ((e.currentTarget as HTMLAnchorElement).style.color = '#0e5921')
                      }
                      onMouseOut={e =>
                        ((e.currentTarget as HTMLAnchorElement).style.color = '#1d7733')
                      }
                    >
                      {CONTACT_EMAIL}
                    </a>
                    <p className="font-body text-[12px] mt-1" style={{ color: '#7a8a96' }}>
                      We aim to respond within 2 business days.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: '#f0f4f1' }} />

                {/* Website */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#e8f5ec' }}
                  >
                    <Globe size={18} color="#1d7733" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p
                      className="font-body text-[11px] font-semibold tracking-[0.08em] uppercase mb-1"
                      style={{ color: '#7a8a96' }}
                    >
                      Website
                    </p>
                    <a
                      href="https://www.iffsreproduction.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-[15px] font-medium transition-colors"
                      style={{ color: '#1d7733', textDecoration: 'none' }}
                      onMouseOver={e =>
                        ((e.currentTarget as HTMLAnchorElement).style.color = '#0e5921')
                      }
                      onMouseOut={e =>
                        ((e.currentTarget as HTMLAnchorElement).style.color = '#1d7733')
                      }
                    >
                      www.iffsreproduction.org
                    </a>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: '#f0f4f1' }} />

                {/* Organisation */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#e8f5ec' }}
                  >
                    <MapPin size={18} color="#1d7733" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p
                      className="font-body text-[11px] font-semibold tracking-[0.08em] uppercase mb-1"
                      style={{ color: '#7a8a96' }}
                    >
                      Organisation
                    </p>
                    <p className="font-body text-[15px] font-medium" style={{ color: '#0d1117' }}>
                      International Federation of Fertility Societies
                    </p>
                    <p className="font-body text-[12px] mt-0.5" style={{ color: '#7a8a96' }}>
                      IFFS — The global voice in reproductive medicine
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid #f0f4f1' }}>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-display text-[11px] font-bold tracking-[0.12em] uppercase text-white transition-all"
                  style={{
                    background: '#1d7733',
                    boxShadow: '0 4px 12px rgba(29,119,51,0.25)',
                    textDecoration: 'none',
                  }}
                  onMouseOver={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = '#0e5921'
                    el.style.transform = 'translateY(-1px)'
                  }}
                  onMouseOut={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = '#1d7733'
                    el.style.transform = 'translateY(0)'
                  }}
                >
                  <Mail size={13} strokeWidth={2.2} aria-hidden="true" />
                  Send us an Email
                </a>
              </div>
            </div>
          </div>

          {/* ── FAQ hint ────────────────────────────────────────────────────── */}
          <div
            className="rounded-xl px-6 py-5 flex items-start gap-4"
            style={{ background: '#f7f9f7', border: '1px solid #e2ebe4' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: '#e8f5ec' }}
            >
              <span
                className="font-display font-bold"
                style={{ fontSize: 13, color: '#1d7733' }}
                aria-hidden="true"
              >
                ?
              </span>
            </div>
            <div>
              <p
                className="font-body text-[13px] font-semibold mb-1"
                style={{ color: '#0d1117' }}
              >
                Survey questions or technical issues?
              </p>
              <p className="font-body text-[13px] leading-relaxed" style={{ color: '#3d4a52' }}>
                If you are experiencing a technical problem with the survey platform, please
                include your registered email address and a brief description of the issue
                when contacting us so we can assist you quickly.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
