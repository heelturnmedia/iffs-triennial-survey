// ─────────────────────────────────────────────────────────────────────────────
// Countries data — per-country submission tallies for the Reports → Countries
// Data tab. User-centric: it aggregates across ALL signed-up users (profiles),
// not just submissions, so people who signed up but never started the survey are
// counted too. Dependency-free (no jsPDF) so the component can import it for
// display; the PDF/XLS exporters live in exportCountriesData.ts (lazy-imported).
// ─────────────────────────────────────────────────────────────────────────────
import { COUNTRY_CHOICES } from '@/data/countries'
import type { SubmissionRow, Profile } from '@/types'

export const UNKNOWN_COUNTRY = '(Unknown)'

export interface CountryCountRow {
  country: string
  submitted: number   // submitted or reviewed
  inProgress: number  // a draft that has been started (page_no > 0)
  notStarted: number  // signed up but no submission, or a draft still on page 0
  total: number       // the three summed
}

export interface NotStartedUser {
  name: string
  email: string
  country: string    // profile country, or '—' (not-started users rarely have one)
  signedUp: string   // profile.created_at (ISO)
  opened: boolean    // has a page-0 draft row (opened but didn't progress) vs never opened
}

type Status = 'submitted' | 'inProgress' | 'notStarted'

function statusOf(sub: SubmissionRow | undefined): Status {
  if (sub && (sub.status === 'submitted' || sub.status === 'reviewed')) return 'submitted'
  if (sub && sub.status === 'draft' && sub.page_no > 0) return 'inProgress'
  return 'notStarted' // no submission row, or a draft still on page 0
}

function subsByUser(submissions: SubmissionRow[]): Map<string, SubmissionRow> {
  const m = new Map<string, SubmissionRow>()
  for (const s of submissions) if (s.user_id) m.set(s.user_id, s)
  return m
}

// Aggregate per-country counts across every signed-up user. Submitted and
// in-progress are attributed to the survey's Country answer; not-started users
// (who usually haven't reached the Country question) are attributed to their
// profile country if known, otherwise the "(Unknown)" bucket.
export function buildCountrySubmissionRows(
  submissions: SubmissionRow[],
  profiles: Profile[],
): CountryCountRow[] {
  const byUser = subsByUser(submissions)
  const counts = new Map<string, { submitted: number; inProgress: number; notStarted: number }>()

  const bump = (country: string, key: Status) => {
    const c = country || UNKNOWN_COUNTRY
    const rec = counts.get(c) ?? { submitted: 0, inProgress: 0, notStarted: 0 }
    rec[key] += 1
    counts.set(c, rec)
  }

  for (const p of profiles) {
    const sub = byUser.get(p.id)
    const status = statusOf(sub)
    const country =
      status === 'notStarted'
        ? String(p.country ?? '').trim()
        : String(sub?.data?.['Country'] ?? p.country ?? '').trim()
    bump(country, status)
  }

  const known = COUNTRY_CHOICES.map((country): CountryCountRow => {
    const c = counts.get(country) ?? { submitted: 0, inProgress: 0, notStarted: 0 }
    return { country, ...c, total: c.submitted + c.inProgress + c.notStarted }
  })

  // Residual buckets that aren't in COUNTRY_CHOICES — chiefly "(Unknown)".
  const extra: CountryCountRow[] = []
  counts.forEach((c, name) => {
    if (!(COUNTRY_CHOICES as readonly string[]).includes(name)) {
      extra.push({ country: name, ...c, total: c.submitted + c.inProgress + c.notStarted })
    }
  })

  return [...known, ...extra].sort((a, b) => b.total - a.total || a.country.localeCompare(b.country))
}

export function countryTotals(tableRows: CountryCountRow[]): {
  submitted: number; inProgress: number; notStarted: number; total: number; countriesActive: number
} {
  return tableRows.reduce(
    (acc, r) => ({
      submitted: acc.submitted + r.submitted,
      inProgress: acc.inProgress + r.inProgress,
      notStarted: acc.notStarted + r.notStarted,
      total: acc.total + r.total,
      countriesActive: acc.countriesActive + (r.total > 0 && r.country !== UNKNOWN_COUNTRY ? 1 : 0),
    }),
    { submitted: 0, inProgress: 0, notStarted: 0, total: 0, countriesActive: 0 },
  )
}

// The people who signed up but haven't started — no submission at all, or a
// draft still on page 0. Sorted newest sign-up first.
export function buildNotStartedUsers(submissions: SubmissionRow[], profiles: Profile[]): NotStartedUser[] {
  const byUser = subsByUser(submissions)
  return profiles
    .filter((p) => statusOf(byUser.get(p.id)) === 'notStarted')
    .map((p): NotStartedUser => ({
      name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—',
      email: p.email ?? '',
      country: String(p.country ?? '').trim() || '—',
      signedUp: p.created_at,
      opened: !!byUser.get(p.id), // has a page-0 draft row = opened but didn't progress
    }))
    .sort((a, b) => (b.signedUp || '').localeCompare(a.signedUp || ''))
}
