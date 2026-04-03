-- Fix survey submission RLS policy blocking users from submitting their survey.
--
-- Root cause: "submissions_update_own_draft" had no WITH CHECK clause, so
-- PostgreSQL reused the USING expression (`status = 'draft'`) as the
-- post-update check. When submitSurvey() changes status to 'submitted', the
-- post-update check fails because the new row no longer satisfies
-- `status = 'draft'`, causing a policy violation error.
--
-- Fix: add WITH CHECK (auth.uid() = user_id) so the post-update state only
-- requires the user owns the row — while the USING clause still prevents
-- updates to rows that are already submitted/reviewed.

drop policy if exists "submissions_update_own_draft" on public.survey_submissions;

create policy "submissions_update_own_draft"
  on public.survey_submissions for update
  using  (auth.uid() = user_id AND status = 'draft')
  with check (auth.uid() = user_id);
