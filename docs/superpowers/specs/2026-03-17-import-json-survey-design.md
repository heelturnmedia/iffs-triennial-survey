# Design: Import IFFS JSON Survey Definition (Option A — Database-backed)

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Seed the official IFFS 2026 Triennial Survey JSON into Supabase as the active survey definition, with a bundled local fallback.

---

## Context

The app has a complete `survey_definitions` table in Supabase with one seeded row (a placeholder). The frontend fetches the active definition via `surveyService.getActiveDefinition()` and renders it with SurveyJS. The source-of-truth JSON (`iffs-triennial-survey-2026-FINAL.json`, 358 KB, 20 pages, 525 questions) lives outside the project at `D:\IFFS\2026\February\json survey\`. A hand-crafted TypeScript mirror exists in `src/data/survey-definition.ts` (1,573 lines) but is not the canonical version.

---

## Goal

Replace the placeholder survey definition with the official JSON — stored in Supabase (primary) and bundled in the frontend (fallback) — without touching any survey UI components.

---

## Changes

### 1. Copy JSON into the project

**Source:** `D:\IFFS\2026\February\json survey\iffs-triennial-survey-2026-FINAL.json`
**Destination:** `src/data/survey-definition.json`

This makes the canonical JSON part of the repository and enables a local fallback import via Vite's native JSON support.

---

### 2. Rewrite `src/data/survey-definition.ts`

Replace the 1,573-line hand-crafted TypeScript definition with a minimal file that re-exports from the JSON and derives `SURVEY_PAGES_META` dynamically:

```ts
import surveyDefJson from './survey-definition.json'
import type { SurveyPageMeta } from '@/types'

export const SURVEY_DEFINITION = surveyDefJson

export const SURVEY_PAGES_META: SurveyPageMeta[] = (surveyDefJson as any).pages.map(
  (p: { title?: string; name: string; description?: string }) => ({
    name: p.title ?? p.name,
    description: p.description ?? '',
  })
)
```

**Why:** Eliminates a second copy of the survey that can drift from the canonical JSON. `SURVEY_PAGES_META` is consumed by `SurveyTimeline` and `SurveySectionHeader` for sidebar section labels — deriving it from the same source guarantees they always match.

---

### 3. Migration 006 — seed the real definition into Supabase

**File:** `supabase/migrations/006_seed_survey_definition.sql`

Updates the existing seeded row (id `00000000-0000-0000-0000-000000000001`) with the full JSON:

```sql
UPDATE public.survey_definitions
SET
  name        = 'IFFS 2026 Triennial Survey',
  description = '20-section survey on ART policies and practices across 147 countries. 525 questions.',
  definition  = '<full JSON content>'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001';
```

The JSON is embedded inline as a `::jsonb` cast — PostgreSQL handles 358 KB JSONB without issue.

---

### 4. Run migration against live Supabase

Use the same Node.js `pg` runner pattern established for migrations 004 and 005:

- Write a temporary `run-migration-006.mjs` script
- Execute it with the live DB connection string
- Delete the script after success

---

### 5. Verify SurveyModal fallback path

Read `SurveyModal.tsx` to confirm the fallback: if `activeDefinition` is null after the Supabase fetch, the modal should fall back to the local `SURVEY_DEFINITION`. Add this guard if it is missing.

---

## Data Flow (after change)

```
App boot
  └─ surveyService.getActiveDefinition()
       ├─ success → surveyStore.activeDefinition = DB row
       └─ failure → SurveyModal falls back to local SURVEY_DEFINITION import

SurveyModal mounts
  └─ new Model(activeDefinition?.definition ?? SURVEY_DEFINITION)

SurveyTimeline / SurveySectionHeader
  └─ SURVEY_PAGES_META (derived from same JSON, always in sync)
```

---

## Files Changed

| File | Action |
|------|--------|
| `src/data/survey-definition.json` | **Created** — copy of the canonical JSON |
| `src/data/survey-definition.ts` | **Rewritten** — imports JSON, derives metadata |
| `supabase/migrations/006_seed_survey_definition.sql` | **Created** — UPDATE with full JSON |
| `src/components/survey/SurveyModal.tsx` | **Possibly patched** — add local fallback if missing |

---

## What Does NOT Change

- `SurveyModal.tsx` component structure
- `SurveyTimeline.tsx`
- `SurveySectionHeader.tsx`
- `surveyService.ts`
- `surveyStore.ts`
- Database schema (no DDL changes)

---

## Success Criteria

1. Opening the survey modal renders the full 20-page, 525-question form
2. `SurveyTimeline` shows all 20 correct section titles
3. `SurveySectionHeader` shows correct per-page title and description
4. Admin "Survey Management" panel shows the definition as active
5. If Supabase is unreachable, the survey still loads from the bundled fallback
