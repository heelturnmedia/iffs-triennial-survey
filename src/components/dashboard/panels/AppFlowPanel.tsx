// ─────────────────────────────────────────────────────────────────────────────
// AppFlowPanel — Admin-only architecture & design flow reference
// Tabs: User Flow · Architecture · Role Access · Data & State
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'

type Tab = 'flow' | 'arch' | 'roles' | 'data'

// ─── Shared primitives ────────────────────────────────────────────────────────

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  public:     { bg: 'rgba(29,119,51,0.1)',   color: '#0e5921' },
  protected:  { bg: 'rgba(245,158,11,0.1)',  color: '#92400e' },
  admin:      { bg: 'rgba(124,58,237,0.1)',  color: '#5b21b6' },
  supervisor: { bg: 'rgba(37,99,235,0.1)',   color: '#1e3a8a' },
  external:   { bg: 'rgba(220,38,38,0.08)',  color: '#991b1b' },
  guard:      { bg: 'rgba(8,145,178,0.09)',  color: '#0e7490' },
}

function Tag({ type, label }: { type: keyof typeof TAG_STYLES; label: string }) {
  const s = TAG_STYLES[type]
  return (
    <span
      style={{
        display: 'inline-flex',
        marginTop: 6,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 9,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        background: s.bg,
        color: s.color,
      }}
    >
      {label}
    </span>
  )
}

interface FlowNodeProps {
  icon: string
  title: string
  desc: string
  tagType: keyof typeof TAG_STYLES
  tagLabel: string
  accent: string
}

function FlowNode({ icon, title, desc, tagType, tagLabel, accent }: FlowNodeProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid var(--bd)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: '12px 14px',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = 'var(--shadow-md)'
        el.style.borderColor = accent
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = 'none'
        el.style.borderColor = 'var(--bd)'
        el.style.borderLeftColor = accent
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 5 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--f1)', marginBottom: 3 }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)', lineHeight: 1.5 }}>
        {desc}
      </div>
      <Tag type={tagType} label={tagLabel} />
    </div>
  )
}

// ─── Tab 1: User Flow ─────────────────────────────────────────────────────────

function UserFlowTab() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr 40px 1fr', gap: 0, alignItems: 'start' }}>

        {/* Col 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--f4)', marginBottom: 4 }}>Entry Points</div>
          <FlowNode icon="🌐" title="Homepage" desc="Hero with dual CTA + deadline badge, icon feature cards (Secure, Auto-Save, One Submission), green gradient separator" tagType="public" tagLabel="Public · /" accent="var(--g1)" />
          <FlowNode icon="🔐" title="Auth Page" desc="Sign In or Sign Up via Supabase email/password auth" tagType="public" tagLabel="Public · /login" accent="var(--g1)" />
          <FlowNode icon="📜" title="Legal Pages" desc="Privacy Policy, Terms of Use, Contact — static informational pages" tagType="public" tagLabel="Public · /privacy /terms /contact" accent="var(--g1)" />
          <FlowNode icon="🔗" title="WildApricot" desc="Optional member verification synced by admin" tagType="external" tagLabel="External API" accent="#dc2626" />
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 48 }}>
          <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
            <path d="M4 10 H26 M20 4 L28 10 L20 16" stroke="var(--g1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Col 2 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--f4)', marginBottom: 4 }}>Protected Zone</div>
          <FlowNode icon="🔒" title="Auth Guard" desc="Checks Supabase session. Redirects to /auth if unsigned. Preserves destination." tagType="guard" tagLabel="Route Guard" accent="#0891b2" />
          <FlowNode icon="📊" title="Dashboard Page" desc="Sidebar + main panel. Active panel via uiStore. Nav + WelcomeOverlay." tagType="protected" tagLabel="Protected · /dashboard" accent="#d97706" />
          <FlowNode icon="📋" title="Survey Modal" desc="SurveyJS multi-page form. Auto-saves per page. Submits on complete." tagType="protected" tagLabel="All Roles" accent="#d97706" />
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 48 }}>
          <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
            <path d="M4 10 H26 M20 4 L28 10 L20 16" stroke="var(--g1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Col 3 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--f4)', marginBottom: 4 }}>Dashboard Panels</div>
          <FlowNode icon="🏠" title="Overview" desc="Personal survey status, quick actions, progress" tagType="public" tagLabel="All Roles" accent="var(--g1)" />
          <FlowNode icon="📈" title="Reports" desc="Choropleth map, submission stats, export via Edge Fn" tagType="supervisor" tagLabel="Supervisor+" accent="#2563eb" />
          <FlowNode icon="👥" title="Users" desc="Profiles, role management, reset submissions" tagType="admin" tagLabel="Admin Only" accent="#7c3aed" />
          <FlowNode icon="⚙️" title="Survey Mgmt" desc="Upload/activate JSON definitions, Creator editor" tagType="admin" tagLabel="Admin Only" accent="#7c3aed" />
          <FlowNode icon="🔌" title="WA Settings" desc="WildApricot API key & account ID, member sync" tagType="admin" tagLabel="Admin Only" accent="#7c3aed" />
          <FlowNode icon="🗺️" title="App Flow" desc="This panel — architecture & design reference" tagType="admin" tagLabel="Admin Only" accent="#7c3aed" />
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
        {[
          { color: 'var(--g1)',  label: 'Public route' },
          { color: '#0891b2',    label: 'Decision / guard' },
          { color: '#d97706',    label: 'Protected feature' },
          { color: '#2563eb',    label: 'Supervisor+' },
          { color: '#7c3aed',    label: 'Admin only' },
          { color: '#dc2626',    label: 'External service' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 2: Architecture ──────────────────────────────────────────────────────

interface ArchItemProps { icon: string; name: string; desc: string }

function ArchItem({ icon, name, desc }: ArchItemProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 8 }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--f1)', marginBottom: 2 }}>{name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

function ArchTab() {
  const layers: { title: string; accent: string; bg: string; items: ArchItemProps[] }[] = [
    {
      title: 'Frontend · React SPA',
      accent: '#7c3aed',
      bg: 'rgba(124,58,237,0.04)',
      items: [
        { icon: '📄', name: 'Pages (7)', desc: 'HomePage, AuthPage, DashboardPage, PrivacyPolicyPage, TermsOfUsePage, ContactPage, NotFoundPage — lazy-loaded with Suspense' },
        { icon: '🧩', name: 'Components', desc: 'Nav, Sidebar, SurveyModal, Dashboard Panels, WelcomeOverlay, ConfirmModal, Toast' },
        { icon: '🗄️', name: 'Zustand Stores (3)', desc: 'authStore · surveyStore · uiStore — global state, no prop drilling' },
        { icon: '🪝', name: 'Custom Hooks', desc: 'useAuth (bootstrap + realtime) · useToast · useWildApricot' },
        { icon: '💾', name: 'localStorage', desc: 'Draft survey data persisted locally — merged with DB on next sign-in' },
        { icon: '🗺️', name: 'ChoroplethMap', desc: 'Mapbox GL interactive world map — per-country submission data' },
        { icon: '🔤', name: 'Self-hosted Fonts', desc: 'Raleway + Source Sans 3 via @fontsource-variable — bundled by Vite, no Google Fonts CDN dependency' },
      ],
    },
    {
      title: 'Backend · Supabase',
      accent: 'var(--g1)',
      bg: 'rgba(29,119,51,0.04)',
      items: [
        { icon: '🔑', name: 'Auth', desc: 'Email/password, session management, JWT tokens, onAuthStateChange listener' },
        { icon: '🗃️', name: 'Database (PostgreSQL)', desc: 'profiles · survey_submissions · survey_definitions — RLS policies per role' },
        { icon: '⚡', name: 'Realtime', desc: 'Postgres changes subscribed per user_id — live updates when admin resets submission' },
        { icon: '🌐', name: 'Edge Functions (3)', desc: 'export-report · wa-sync · rate-limit — Deno runtime with CORS + auth middleware' },
        { icon: '🔒', name: 'Row Level Security', desc: '5 migrations — schema, RLS policies, seed data, recursion fix, timestamps' },
      ],
    },
    {
      title: 'External Services',
      accent: '#d97706',
      bg: 'rgba(217,119,6,0.04)',
      items: [
        { icon: '🍑', name: 'WildApricot', desc: 'Member verification API — checks IFFS membership, returns memberId & level' },
        { icon: '🐳', name: 'Docker + Nginx', desc: 'Containerized via Dokploy. Nginx serves Vite build. Env vars injected at runtime via env-config.js. Security headers (CSP, HSTS, X-Frame-Options) + rate limiting (60 req/min) on all routes.' },
        { icon: '📦', name: 'SurveyJS', desc: 'Open-source survey engine. Definition loaded from DB (JSON). 20-section form.' },
      ],
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      {layers.map(layer => (
        <div key={layer.title} style={{ borderRadius: 14, padding: 18, background: layer.bg, border: `1.5px solid ${layer.accent}30` }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.14em', textTransform: 'uppercase' as const,
            color: layer.accent, marginBottom: 14, paddingBottom: 10,
            borderBottom: `1px solid ${layer.accent}25`,
          }}>
            {layer.title}
          </div>
          {layer.items.map(item => <ArchItem key={item.name} {...item} />)}
        </div>
      ))}
    </div>
  )
}

// ─── Tab 3: Role Access ───────────────────────────────────────────────────────

const ROLE_FEATURES = [
  'Overview Panel',
  'My Survey (modal)',
  'Reports + Map',
  'Export Reports',
  'Users Panel',
  'Reset Submissions',
  'Survey Mgmt',
  'WA Settings',
  'App Flow Panel',
]

const ROLE_ACCESS: Record<string, boolean[]> = {
  Admin:        [true,  true,  true,  true,  true,  true,  true,  true,  true],
  Supervisor:   [true,  true,  true,  true,  false, false, false, false, false],
  'IFFS Member':[true,  true,  false, false, false, false, false, false, false],
  User:         [true,  true,  false, false, false, false, false, false, false],
}

const ROLE_META: Record<string, { level: number; color: string; bg: string; border: string; top: string }> = {
  Admin:        { level: 4, color: '#5b21b6', bg: '#faf5ff', border: '#ddd6fe', top: '#7c3aed' },
  Supervisor:   { level: 3, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', top: '#2563eb' },
  'IFFS Member':{ level: 2, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', top: '#16a34a' },
  User:         { level: 1, color: '#374151', bg: '#f9fafb', border: '#e5e7eb', top: '#9ca3af' },
}

function RolesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {Object.entries(ROLE_ACCESS).map(([role, access]) => {
          const meta = ROLE_META[role]
          return (
            <div key={role} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid var(--bd)', borderTop: `3px solid ${meta.top}`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
                <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, marginBottom: 6 }}>
                  {role}
                </span>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)' }}>
                  Level <strong style={{ color: 'var(--f1)' }}>{meta.level}</strong>
                </div>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ROLE_FEATURES.map((feat, i) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, background: access[i] ? 'rgba(29,119,51,0.04)' : 'transparent', opacity: access[i] ? 1 : 0.4 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: access[i] ? 'rgba(29,119,51,0.15)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 8, color: access[i] ? 'var(--g1)' : 'var(--f4)' }}>{access[i] ? '✓' : '✗'}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: access[i] ? 'var(--f1)' : 'var(--f4)' }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hierarchy bar */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid var(--bd)', padding: '14px 18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--f4)', marginBottom: 10 }}>Role Hierarchy</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {Object.entries(ROLE_META).map(([role, meta], i, arr) => (
            <>
              <div key={role} style={{ flex: 1, padding: '10px 14px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : 0, textAlign: 'center' as const }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: meta.color, marginBottom: 2 }}>{role}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--f1)' }}>{meta.level}</div>
              </div>
              {i < arr.length - 1 && (
                <div key={`arrow-${i}`} style={{ color: 'var(--g1)', fontSize: 14, padding: '0 4px', zIndex: 1 }}>→</div>
              )}
            </>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)', textAlign: 'center' as const, marginTop: 8 }}>
          Each level inherits access from all levels below it
        </div>
      </div>
    </div>
  )
}

// ─── Tab 4: Data & State ──────────────────────────────────────────────────────

interface StateFlowProps { title: string; subtitle: string; accent: string; steps: string[] }

function StateFlow({ title, subtitle, accent, steps }: StateFlowProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid var(--bd)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--f1)' }}>{title}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--f3)', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>{subtitle}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {steps.map((step, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', background: 'var(--s1)', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--f2)', lineHeight: 1.45 }}>
              <div style={{ minWidth: 18, height: 18, borderRadius: '50%', background: 'var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--f3)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <span dangerouslySetInnerHTML={{ __html: step }} />
            </div>
            {i < steps.length - 1 && (
              <div style={{ textAlign: 'center' as const, color: 'var(--bd2)', fontSize: 10, lineHeight: 1.2 }}>↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DataStateTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <StateFlow
          title="Auth State Bootstrap"
          subtitle="useAuth() hook — runs once at app root"
          accent="var(--g1)"
          steps={[
            'App mounts → <code style="background:var(--bd);padding:1px 5px;border-radius:3px;font-size:10px">authStore.initialize()</code> called',
            'supabase.auth.getSession() → checks existing session',
            'If session → fetchProfile(userId) from profiles table',
            'Set { session, user, profile, loading: false } in store',
            'onAuthStateChange listener active for all future events',
          ]}
        />
        <StateFlow
          title="Survey Data Load"
          subtitle="Triggered when authStore.user?.id changes"
          accent="#7c3aed"
          steps={[
            'User signs in → userId becomes available',
            'getSubmission(userId) → fetch from survey_submissions',
            'loadPersistedSurvey(email) → check localStorage draft',
            'Merge: use localStorage if newer or further ahead in pages',
            'getActiveDefinition() → load survey JSON from DB',
            'surveyStore.setSubmission() + setActiveDefinition()',
          ]}
        />
        <StateFlow
          title="Survey Auto-Save"
          subtitle="Every page change in SurveyModal"
          accent="#d97706"
          steps={[
            'User answers page → SurveyJS onCurrentPageChanged fires',
            'surveyStore.setAutoSaveStatus("saving")',
            'upsert to survey_submissions (user_id, page_no, data, status: "draft")',
            'persistSurvey(email, data) → localStorage backup',
            'status → "saved" · lastSavedAt updated in UI',
          ]}
        />
        <StateFlow
          title="Zustand Stores"
          subtitle="Global state — no prop drilling"
          accent="#0891b2"
          steps={[
            '<strong>authStore</strong> — session · user · profile · loading · isAdmin() · canViewReports()',
            '<strong>surveyStore</strong> — submission · isModalOpen · activeDefinition · autoSaveStatus · lastSavedAt',
            '<strong>uiStore</strong> — activePanel · toast() · openConfirmModal()',
            '<strong>Realtime</strong> — Supabase channel on survey_submissions WHERE user_id = userId → surveyStore.setSubmission(payload.new)',
          ]}
        />
      </div>

      {/* Status machine */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid var(--bd)', padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--f4)', marginBottom: 12 }}>
          Survey Submission Status Machine
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { icon: '📝', label: 'Draft',     sub: 'In progress · auto-saved',      bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.25)',  color: '#92400e' },
            { icon: '✅', label: 'Submitted', sub: 'Final · locked from edits',       bg: 'rgba(37,99,235,0.07)',   border: 'rgba(37,99,235,0.25)',   color: '#1e3a8a' },
            { icon: '🏆', label: 'Reviewed',  sub: 'Accepted · included in report',   bg: 'rgba(29,119,51,0.07)',   border: 'rgba(29,119,51,0.25)',   color: '#166534' },
          ].map((s, i, arr) => (
            <>
              <div key={s.label} style={{ flex: 1, padding: '12px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : 0, textAlign: 'center' as const }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: s.color, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--f3)' }}>{s.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <div key={`arr-${i}`} style={{ padding: '0 6px', textAlign: 'center' as const }}>
                  <div style={{ color: 'var(--g1)', fontSize: 18 }}>→</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--f4)' }}>{i === 0 ? 'complete' : 'admin review'}</div>
                </div>
              )}
            </>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--f4)', textAlign: 'right' as const, marginTop: 8 }}>
          Admin can reset "submitted" back to "draft" via the Users panel
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'flow',  label: 'User Flow'    },
  { id: 'arch',  label: 'Architecture' },
  { id: 'roles', label: 'Role Access'  },
  { id: 'data',  label: 'Data & State' },
]

export function AppFlowPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('flow')

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {/* Admin badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#5b21b6' }}>Admin Only</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--f1)', marginBottom: 4 }}>
          App Design Flow
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--f3)' }}>
          Architecture, user flows, role access, and data model — all in one view
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 24, padding: 4, borderRadius: 12, width: 'fit-content', background: 'var(--s2)', border: '1px solid var(--bd)' }}
        role="tablist"
        aria-label="App flow diagram tabs"
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === t.id ? '#fff' : 'transparent',
              color: activeTab === t.id ? 'var(--g1)' : 'var(--f3)',
              boxShadow: activeTab === t.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      {activeTab === 'flow'  && <UserFlowTab />}
      {activeTab === 'arch'  && <ArchTab />}
      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'data'  && <DataStateTab />}
    </div>
  )
}
