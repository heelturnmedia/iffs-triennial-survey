-- Correction: "Biannual" was a mistaken term. The survey runs every two years,
-- so the correct word is "Biennial". Revert the term (Biannual → Biennial) while
-- keeping the 2027 publication year. Applied to the stored survey_definitions row.
--
-- At apply time the row was in a mixed state from the two prior rounds: name =
-- "IFFS 2027 Biannual Survey" (term wrong, year right), while the definition JSON
-- had reverted to "IFFS Biennial Survey 2026" (term right, year wrong — the JSON
-- appears to get re-seeded independently). Both tokens are therefore normalised
-- here so name and definition end at the single correct brand:
--   term  Biannual/biannual/BIANNUAL → Biennial/biennial/BIENNIAL
--   year  2026 → 2027   (the definition contains exactly one "2026", the title)
--
-- `survey_year` is a separate column (wave key) and is deliberately left at 2026.
update public.survey_definitions
set
  name = replace(replace(replace(name, 'Biannual', 'Biennial'), 'BIANNUAL', 'BIENNIAL'), '2026', '2027'),
  definition = replace(
                 replace(
                   replace(replace(definition::text, 'Biannual', 'Biennial'), 'biannual', 'biennial'),
                   'BIANNUAL', 'BIENNIAL'
                 ),
                 '2026', '2027'
               )::jsonb,
  updated_at = now()
where name ilike '%biannual%'
   or name like '%2026%'
   or definition::text ilike '%biannual%'
   or definition::text like '%2026%';
