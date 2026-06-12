-- Prevent users from modifying their own identity/membership columns.
--
-- ROOT CAUSE: "profiles_update_own" WITH CHECK only pins `role`. Any user
-- could UPDATE their own row and set wa_verified = true, change wa_member_id,
-- or change email so it no longer matches their auth.users identity —
-- self-granting IFFS-member appearance and desyncing auth from the profile.
--
-- Fix: BEFORE UPDATE trigger that rejects changes to role / email /
-- wa_verified / wa_member_id unless the caller is an admin. Calls with no
-- JWT (service role — wa-sync, delete-user, handle_new_user) are exempt:
-- auth.uid() is null for them and they must keep working.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role / postgres (no JWT): edge functions and triggers — allow.
  if auth.uid() is null then
    return new;
  end if;

  if public.get_user_role(auth.uid()) = 'admin' then
    return new;
  end if;

  if new.role         is distinct from old.role
     or new.email        is distinct from old.email
     or new.wa_verified  is distinct from old.wa_verified
     or new.wa_member_id is distinct from old.wa_member_id then
    raise exception 'Not allowed to modify protected profile fields'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
