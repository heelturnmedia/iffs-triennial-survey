-- Prevent survey submission status from being downgraded (submitted → draft, reviewed → draft).
--
-- ROOT CAUSE: The "submissions_update_admin" policy has no status restriction — any admin
-- can UPDATE any row to any values, including overwriting status='submitted' back to
-- status='draft'. The autosave in SurveyModal fires upsertSubmission(status:'draft') while
-- submitSurvey is in-flight, and because the admin policy has no WITH CHECK guard on status,
-- the autosave wins and silently reverts the submission back to draft.
--
-- Fix 1 (this file): Database trigger that rejects any UPDATE that attempts to move
-- status from 'submitted' or 'reviewed' back to 'draft', regardless of the caller's role.
-- Triggers fire BEFORE the row is written and can override any RLS policy decision.
--
-- Fix 2 (SurveyModal.tsx): Application-level guard — autosave paths check the store's
-- current submission status before calling upsertSubmission. If already submitted/reviewed,
-- the DB write is skipped entirely.
--
-- Fix 3 (SurveyModal.tsx): localStorage is cleared after successful submission so that
-- on re-login the merge logic cannot interfere even if the trigger were bypassed somehow.

create or replace function public.prevent_submission_status_downgrade()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Block any update that would move status from a terminal state back to draft.
  -- 'submitted' and 'reviewed' are terminal — autosave must never overwrite them.
  if (old.status in ('submitted', 'reviewed') and new.status = 'draft') then
    raise exception
      'Cannot downgrade survey submission status from "%" to "draft" for user %',
      old.status, old.user_id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Drop if re-running migration
drop trigger if exists prevent_status_downgrade on public.survey_submissions;

create trigger prevent_status_downgrade
  before update on public.survey_submissions
  for each row
  execute function public.prevent_submission_status_downgrade();
