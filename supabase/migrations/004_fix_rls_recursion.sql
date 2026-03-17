-- Fix infinite recursion in RLS policies.
-- All policies that did `select 1 from public.profiles where id = auth.uid() and role = '...'`
-- caused recursion because querying profiles re-triggers the profiles RLS policy.
-- Fix: use the security definer function get_user_role() which bypasses RLS.

-- ─── DROP ALL AFFECTED POLICIES ──────────────────────────────────────────────

drop policy if exists "profiles_select_all_admin_supervisor" on public.profiles;
drop policy if exists "profiles_update_own"                  on public.profiles;
drop policy if exists "profiles_update_admin"                on public.profiles;

drop policy if exists "submissions_select_admin_supervisor"  on public.survey_submissions;
drop policy if exists "submissions_update_admin"             on public.survey_submissions;

drop policy if exists "definitions_select_authenticated"     on public.survey_definitions;
drop policy if exists "definitions_insert_admin"             on public.survey_definitions;
drop policy if exists "definitions_update_admin"             on public.survey_definitions;

drop policy if exists "wa_settings_admin"                    on public.wa_settings;

drop policy if exists "activity_log_select_admin"            on public.activity_log;

-- ─── RECREATE PROFILES POLICIES ──────────────────────────────────────────────

-- Admins and supervisors can read all profiles
create policy "profiles_select_all_admin_supervisor"
  on public.profiles for select
  using (
    public.get_user_role(auth.uid()) in ('admin', 'supervisor')
  );

-- Users can update their own profile (role field must stay unchanged)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (role = public.get_user_role(auth.uid()));

-- Admins can update any profile (including role)
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.get_user_role(auth.uid()) = 'admin');

-- ─── RECREATE SUBMISSIONS POLICIES ───────────────────────────────────────────

create policy "submissions_select_admin_supervisor"
  on public.survey_submissions for select
  using (
    public.get_user_role(auth.uid()) in ('admin', 'supervisor')
  );

create policy "submissions_update_admin"
  on public.survey_submissions for update
  using (public.get_user_role(auth.uid()) = 'admin');

-- ─── RECREATE DEFINITIONS POLICIES ───────────────────────────────────────────

create policy "definitions_select_authenticated"
  on public.survey_definitions for select
  using (auth.role() = 'authenticated');

create policy "definitions_insert_admin"
  on public.survey_definitions for insert
  with check (public.get_user_role(auth.uid()) = 'admin');

create policy "definitions_update_admin"
  on public.survey_definitions for update
  using (public.get_user_role(auth.uid()) = 'admin');

-- ─── RECREATE WA_SETTINGS POLICY ─────────────────────────────────────────────

create policy "wa_settings_admin"
  on public.wa_settings for all
  using (public.get_user_role(auth.uid()) = 'admin');

-- ─── RECREATE ACTIVITY LOG POLICY ────────────────────────────────────────────

create policy "activity_log_select_admin"
  on public.activity_log for select
  using (public.get_user_role(auth.uid()) = 'admin');
