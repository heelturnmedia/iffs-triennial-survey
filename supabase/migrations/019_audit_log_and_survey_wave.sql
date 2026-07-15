-- (A) Admin audit trail — the activity_log table already exists with RLS
-- (admins SELECT all; each user INSERTs their own rows). Add a descending
-- created_at index so the Activity panel paginates cheaply.
create index if not exists idx_activity_log_created_at
  on public.activity_log (created_at desc);

-- (B) Biennial wave dimension. The survey is now biennial; to compare 2026 vs
-- 2028 vs … every submission and definition is stamped with its survey year.
-- Existing rows are the 2026 wave.
alter table public.survey_submissions
  add column if not exists survey_year integer not null default 2026;

alter table public.survey_definitions
  add column if not exists survey_year integer not null default 2026;

create index if not exists idx_submissions_survey_year
  on public.survey_submissions (survey_year);

-- Reference numbers already encode the year (IFFS-2026-XXXXXX); the column makes
-- the wave a first-class, queryable dimension for trend reporting.
