-- Enable Postgres realtime for the tables the app already subscribes to.
--
-- ROOT CAUSE of the "reset doesn't stick" bug: the supabase_realtime
-- publication was empty, so the client's reset handler (useAuth) never fired.
-- After an admin reset, the participant's in-memory store kept the old answers,
-- and the sign-out flush then re-uploaded them — resurrecting the data.
--
-- Enabling realtime makes the reset event reach the client so the store +
-- localStorage are cleared immediately. RLS still applies to realtime, so each
-- user only receives changes to rows they can SELECT.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'survey_submissions'
  ) then
    alter publication supabase_realtime add table public.survey_submissions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
