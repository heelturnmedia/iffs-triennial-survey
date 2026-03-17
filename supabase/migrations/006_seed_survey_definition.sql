-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Seed official IFFS 2026 Triennial Survey definition
-- ─────────────────────────────────────────────────────────────────────────────
-- Seeds the canonical survey JSON into the pre-existing active definition row.
-- The JSON is passed as parameter $1 by the Node.js runner (run-migration-006.mjs)
-- to avoid embedding 358 KB inline and to sidestep SQL quoting issues.
--
-- NOT independently runnable via psql — requires the Node.js runner in Task 5.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.survey_definitions
SET
  name        = 'IFFS 2026 Triennial Survey',
  description = '20-section survey on ART policies and practices across 147 countries. 525 questions.',
  definition  = $1::jsonb,
  is_active   = true
  -- updated_at is handled automatically by the survey_definitions_updated_at trigger
WHERE id = '00000000-0000-0000-0000-000000000001';
