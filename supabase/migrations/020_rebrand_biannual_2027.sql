-- Rebrand: "IFFS Biennial Survey 2026" → "IFFS Biannual Survey 2027" in the
-- stored survey definition (the survey definition is the source of truth the
-- app renders; static JSON is only a fallback). Two token swaps:
--   Biennial/biennial → Biannual/biannual   (term)
--   2026 → 2027                              (brand/publication year)
--
-- The definition contains exactly one "2026" (the title) and four "biennial"
-- occurrences (title, description, and the two completion-page lines), so the
-- blanket text replace is safe. The `survey_year` column is deliberately left
-- at 2026 — it is the wave key for longitudinal analysis (the survey is fielded
-- in 2026; only the public brand/report year moves to 2027).
update public.survey_definitions
set
  name = replace(replace(name, 'Biennial', 'Biannual'), '2026', '2027'),
  definition = replace(
                 replace(
                   replace(definition::text, 'Biennial', 'Biannual'),
                   'biennial', 'biannual'
                 ),
                 '2026', '2027'
               )::jsonb,
  updated_at = now()
where name ilike '%biennial%'
   or name like '%2026%'
   or definition::text ilike '%biennial%';
