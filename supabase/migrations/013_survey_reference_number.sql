-- Unique survey identification number, assigned when a survey is submitted, and
-- surfaced in the participant thank-you email + admin notification.
--
-- Format: IFFS-2026-00001 (zero-padded from a sequence). Assigned exactly once,
-- on the first draft→submitted transition, by a SECURITY DEFINER trigger (so the
-- sequence is reachable regardless of the submitting user's grants). Persists
-- thereafter (a later review or admin reset does not change or clear it).

alter table public.survey_submissions
  add column if not exists reference_no text unique;

create sequence if not exists public.survey_reference_seq;

-- Backfill existing completed surveys in submission order → IFFS-2026-00001…
with ordered as (
  select id, row_number() over (order by submitted_at nulls last, created_at) as rn
  from public.survey_submissions
  where status in ('submitted', 'reviewed') and reference_no is null
)
update public.survey_submissions s
set reference_no = 'IFFS-2026-' || lpad(o.rn::text, 5, '0')
from ordered o
where o.id = s.id;

-- Continue the sequence past whatever was backfilled.
select setval(
  'public.survey_reference_seq',
  greatest((select count(*) from public.survey_submissions where reference_no is not null), 1)
);

-- Assign on submit. BEFORE so the value persists on the same write; idempotent
-- via the `reference_no is null` guard.
create or replace function public.assign_survey_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text = 'submitted' and new.reference_no is null then
    new.reference_no := 'IFFS-2026-' || lpad(nextval('public.survey_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_survey_reference on public.survey_submissions;
create trigger trg_assign_survey_reference
  before insert or update on public.survey_submissions
  for each row execute function public.assign_survey_reference();

-- Include the reference number in the completion notification payload.
create or replace function public.on_submission_submitted_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_admins_event('completion', jsonb_build_object(
    'user_id',       new.user_id,
    'submission_id', new.id,
    'submitted_at',  new.submitted_at,
    'country',       new.data->>'Country',
    'reference_no',  new.reference_no
  ));
  return new;
end;
$$;
