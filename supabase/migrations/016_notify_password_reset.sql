-- Notify admins when a user requests a password reset.
--
-- GoTrue stamps auth.users.recovery_sent_at when it sends a recovery email.
-- This trigger fires on that change and queues a notify-admins call via the
-- existing notify_admins_event() (pg_net, fire-and-forget). The exception
-- guard ensures a notification failure can NEVER break the password-reset
-- flow itself.

create or replace function public.on_recovery_requested_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recovery_sent_at is not null
     and (old.recovery_sent_at is distinct from new.recovery_sent_at) then
    begin
      perform public.notify_admins_event('password_reset', jsonb_build_object(
        'user_id',      new.id,
        'email',        new.email,
        'requested_at', new.recovery_sent_at
      ));
    exception when others then
      -- Never block the auth flow because a notification failed.
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recovery_requested_notify on auth.users;
create trigger trg_recovery_requested_notify
  after update on auth.users
  for each row execute function public.on_recovery_requested_notify();
