-- Active-time tracking
-- ---------------------------------------------------------------------------
-- Accumulates the number of seconds a respondent actively spent filling in the
-- survey (tab focused + non-idle), summed across sessions by the client and
-- persisted through the normal autosave path. Purely additive and
-- backwards-compatible: existing rows keep 0, and nothing reads the column
-- until the client that writes it is deployed.
--
-- Idempotent so it is safe to (re-)apply via `supabase db push` even though the
-- column was already added to production out-of-band.

alter table public.survey_submissions
  add column if not exists active_seconds integer not null default 0;

comment on column public.survey_submissions.active_seconds is
  'Accumulated active engagement time in seconds (client-tracked: tab focused + non-idle), summed across sessions. 0 for rows created before tracking existed.';
