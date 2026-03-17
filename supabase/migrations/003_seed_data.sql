-- ─── SEED DATA ───────────────────────────────────────────────────────────────
-- This migration seeds the initial required rows. It is idempotent: running it
-- more than once will not create duplicate rows.

-- ─── INITIAL ACTIVE SURVEY DEFINITION ────────────────────────────────────────
-- The `definition` JSON is intentionally empty here; the full survey schema
-- will be loaded through the Admin UI once the project is live.
insert into public.survey_definitions (id, name, definition, is_active)
values (
  '00000000-0000-0000-0000-000000000001',
  'IFFS 2026 Triennial Survey',
  '{}'::jsonb,
  true
)
on conflict (id) do nothing;

-- ─── WA SETTINGS SINGLETON ROW ───────────────────────────────────────────────
-- Credentials are populated via the Admin UI; never stored in source control.
-- The unique index wa_settings_singleton ensures only this one row ever exists.
insert into public.wa_settings (api_key, account_id, sync_enabled)
values ('', '', false)
on conflict do nothing;
