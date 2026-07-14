-- Rebrand: Triennial → Biennial in the stored survey definitions (the survey
-- modal renders the ACTIVE definition from this table, not the repo file).
-- Verified against the definition JSON that the word only occurs in display
-- fields (title, description, completedHtml) — no question `name` keys are
-- affected, so existing answers keyed by question name are untouched.

update public.survey_definitions
set
  name       = replace(name, 'Triennial', 'Biennial'),
  definition = replace(
                 replace(definition::text, 'Triennial', 'Biennial'),
                 'triennial', 'biennial'
               )::jsonb,
  updated_at = now();
