// ─────────────────────────────────────────────────────────────────────────────
// IFFS 2026 Triennial Survey — canonical definition
// Source: iffs-triennial-survey-2026-FINAL.json (20 pages, 525 questions)
//
// SURVEY_DEFINITION  → used by SurveyModal as the SurveyJS model fallback
// SURVEY_PAGES_META  → used by SurveyTimeline + SurveySectionHeader for sidebar
// ─────────────────────────────────────────────────────────────────────────────
import surveyDefJson from './survey-definition.json'
import type { SurveyPageMeta } from '@/types'

type SurveyPage = { title?: string; name: string; description?: string }
type SurveyJson  = { pages: SurveyPage[] }

// Primary export — the full SurveyJS definition object
export const SURVEY_DEFINITION = surveyDefJson

// Sidebar metadata — derived from the JSON so they can never drift out of sync.
// All 20 pages have a `title` field. Pages 13 and 17 have no `description`
// (handled by the '' fallback).
export const SURVEY_PAGES_META: SurveyPageMeta[] = (
  surveyDefJson as unknown as SurveyJson
).pages.map((p) => ({
  name:        p.title ?? p.name,
  description: p.description ?? '',
}))
