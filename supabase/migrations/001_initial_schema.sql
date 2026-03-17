-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── ENUMS ────────────────────────────────────────────────────────────────────
create type user_role as enum ('admin', 'supervisor', 'iffs-member', 'user');
create type survey_status as enum ('draft', 'submitted', 'reviewed');

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  email        text unique not null,
  first_name   text not null default '',
  last_name    text not null default '',
  role         user_role not null default 'user',
  country      text,
  institution  text,
  wa_member_id text,
  wa_verified  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── SURVEY DEFINITIONS ───────────────────────────────────────────────────────
create table public.survey_definitions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  definition  jsonb not null default '{}',
  is_active   boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── SURVEY SUBMISSIONS ───────────────────────────────────────────────────────
create table public.survey_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade not null unique,
  survey_def_id uuid references public.survey_definitions(id) on delete set null,
  status       survey_status not null default 'draft',
  page_no      integer not null default 0,
  data         jsonb not null default '{}',
  saved_at     timestamptz not null default now(),
  submitted_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ─── WA SETTINGS ─────────────────────────────────────────────────────────────
create table public.wa_settings (
  id              uuid primary key default gen_random_uuid(),
  api_key         text not null default '',
  account_id      text not null default '',
  last_sync_at    timestamptz,
  sync_enabled    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Only one row allowed
create unique index wa_settings_singleton on public.wa_settings ((true));

-- ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  action      text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at();

create trigger survey_definitions_updated_at
  before update on public.survey_definitions
  for each row execute function update_updated_at();

create trigger wa_settings_updated_at
  before update on public.wa_settings
  for each row execute function update_updated_at();

-- ─── AUTO-CREATE PROFILE ON SIGNUP ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index idx_submissions_user_id on public.survey_submissions(user_id);
create index idx_submissions_status on public.survey_submissions(status);
create index idx_profiles_role on public.profiles(role);
create index idx_activity_log_user_id on public.activity_log(user_id, created_at desc);

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
create or replace function public.get_user_role(user_id uuid)
returns user_role language sql security definer as $$
  select role from public.profiles where id = user_id;
$$;

create or replace function public.reset_user_submission(target_user_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Only admins can call this
  if (select role from public.profiles where id = auth.uid()) != 'admin' then
    raise exception 'Only admins can reset submissions';
  end if;

  update public.survey_submissions
  set status = 'draft', page_no = 0, data = '{}', saved_at = now(), submitted_at = null
  where user_id = target_user_id;

  -- Log the action
  insert into public.activity_log (user_id, action, metadata)
  values (auth.uid(), 'reset_submission', json_build_object('target_user_id', target_user_id));
end;
$$;
