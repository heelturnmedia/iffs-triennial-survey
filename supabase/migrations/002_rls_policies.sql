-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.survey_submissions enable row level security;
alter table public.survey_definitions enable row level security;
alter table public.wa_settings enable row level security;
alter table public.activity_log enable row level security;

-- ─── PROFILES ────────────────────────────────────────────
-- Anyone authenticated can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins and supervisors can read all profiles
create policy "profiles_select_all_admin_supervisor"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Users can update their own profile (not role)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (role = (select role from public.profiles where id = auth.uid()));

-- Admins can update any profile (including role)
create policy "profiles_update_admin"
  on public.profiles for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── SURVEY SUBMISSIONS ──────────────────────────────────
-- Users can read their own submission
create policy "submissions_select_own"
  on public.survey_submissions for select
  using (auth.uid() = user_id);

-- Admins and supervisors can read all submissions
create policy "submissions_select_admin_supervisor"
  on public.survey_submissions for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Users can insert their own submission
create policy "submissions_insert_own"
  on public.survey_submissions for insert
  with check (auth.uid() = user_id);

-- Users can update their own submission (only if draft)
create policy "submissions_update_own_draft"
  on public.survey_submissions for update
  using (auth.uid() = user_id AND status = 'draft');

-- Admins can update any submission
create policy "submissions_update_admin"
  on public.survey_submissions for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── SURVEY DEFINITIONS ──────────────────────────────────
-- All authenticated users can read active definitions
create policy "definitions_select_authenticated"
  on public.survey_definitions for select
  using (auth.role() = 'authenticated');

-- Only admins can insert/update/delete
create policy "definitions_insert_admin"
  on public.survey_definitions for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "definitions_update_admin"
  on public.survey_definitions for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── WA SETTINGS ────────────────────────────────────────
-- Only admins can read/write WA settings
create policy "wa_settings_admin"
  on public.wa_settings for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── ACTIVITY LOG ────────────────────────────────────────
create policy "activity_log_select_own"
  on public.activity_log for select
  using (auth.uid() = user_id);

create policy "activity_log_select_admin"
  on public.activity_log for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "activity_log_insert"
  on public.activity_log for insert
  with check (auth.uid() = user_id);
