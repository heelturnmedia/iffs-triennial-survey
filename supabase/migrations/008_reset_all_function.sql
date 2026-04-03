-- Add a security-definer function for resetting all non-reviewed submissions.
-- This bypasses RLS so the admin can reset any user's submission regardless of
-- the current RLS policies on survey_submissions.

create or replace function public.reset_all_submissions()
returns void language plpgsql security definer as $$
begin
  if (select public.get_user_role(auth.uid())) != 'admin' then
    raise exception 'Only admins can reset all submissions';
  end if;

  update public.survey_submissions
  set
    status       = 'draft',
    page_no      = 0,
    data         = '{}',
    saved_at     = now(),
    submitted_at = null,
    reviewed_at  = null,
    updated_at   = now()
  where status != 'reviewed';

  insert into public.activity_log (user_id, action, metadata)
  values (auth.uid(), 'reset_all_submissions', '{}'::jsonb);
end;
$$;
