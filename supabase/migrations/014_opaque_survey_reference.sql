-- Make the survey reference number opaque (non-sequential) so participants
-- cannot infer how many surveys have been submitted. Admins still track the
-- true submission count via COUNT of submitted rows (Reports panel) — that is
-- independent of the reference and unchanged.
--
-- Format: IFFS-2026-XXXXXX, 6 chars from an unambiguous alphabet (no 0/O/1/I/L).
-- ~31^6 ≈ 8.8e8 combinations; uniqueness enforced by loop + unique constraint.

create or replace function public.generate_survey_reference()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
  i int;
  attempts int := 0;
begin
  loop
    candidate := 'IFFS-2026-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.survey_submissions where reference_no = candidate
    );
    attempts := attempts + 1;
    -- Astronomically unlikely; lengthen the code rather than loop forever.
    if attempts > 20 then
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

-- Assign an opaque reference on submit (replaces the sequential version).
create or replace function public.assign_survey_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text = 'submitted' and new.reference_no is null then
    new.reference_no := public.generate_survey_reference();
  end if;
  return new;
end;
$$;

-- Replace the existing sequential references (00001…) with opaque codes. These
-- participants predate the thank-you email and were never shown a number.
update public.survey_submissions
set reference_no = public.generate_survey_reference()
where reference_no is not null;

-- The sequential counter is no longer used.
drop sequence if exists public.survey_reference_seq;
