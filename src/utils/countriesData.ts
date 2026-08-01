// ─────────────────────────────────────────────────────────────────────────────
// Countries data — per-country submission tallies for the Reports → Countries
// Data tab. Kept dependency-free (no jsPDF) so the component can import it for
// on-screen display without pulling the PDF engine into the bundle; the heavy
// PDF/XLS exporters live in exportCountriesData.ts and are lazy-imported.
// ─────────────────────────────────────────────────────────────────────────────
import { COUNTRY_CHOICES } from '@/data/countries'
import type { SubmissionRow } from '@/types'

export interface CountryCountRow {
  country: string
  submitted: number   // status submitted or reviewed
  inProgress: number  // draft that has been started (page_no > 0)
  total: number       // submitted + inProgress
}

// Tally submitted / in-progress responses for EVERY country in the world (0 for
// those with none), keyed by the survey's Country answer. Sorted so countries
// with activity float to the top (by total desc), then alphabetically.
export function buildCountrySubmissionRows(rows: SubmissionRow[]): CountryCountRow[] {
  const counts = new Map<string, { submitted: number; inProgress: number }>()

  for (const r of rows) {
    // data['Country'] is the authoritative survey answer (one of COUNTRY_CHOICES);
    // fall back to the joined profile country only if the survey answer is absent.
    const country = String(r.data?.['Country'] ?? r.country ?? r.profile?.country ?? '').trim()
    if (!country) continue
    const rec = counts.get(country) ?? { submitted: 0, inProgress: 0 }
    if (r.status === 'submitted' || r.status === 'reviewed') rec.submitted += 1
    else if (r.status === 'draft' && r.page_no > 0) rec.inProgress += 1
    counts.set(country, rec)
  }

  return COUNTRY_CHOICES
    .map((country): CountryCountRow => {
      const c = counts.get(country) ?? { submitted: 0, inProgress: 0 }
      return { country, submitted: c.submitted, inProgress: c.inProgress, total: c.submitted + c.inProgress }
    })
    .sort((a, b) => b.total - a.total || a.country.localeCompare(b.country))
}

export function countryTotals(tableRows: CountryCountRow[]): { submitted: number; inProgress: number; total: number; countriesActive: number } {
  return tableRows.reduce(
    (acc, r) => ({
      submitted: acc.submitted + r.submitted,
      inProgress: acc.inProgress + r.inProgress,
      total: acc.total + r.total,
      countriesActive: acc.countriesActive + (r.total > 0 ? 1 : 0),
    }),
    { submitted: 0, inProgress: 0, total: 0, countriesActive: 0 },
  )
}
