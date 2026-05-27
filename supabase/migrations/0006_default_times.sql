-- Add default morning/noon/evening times to each profile.
-- These are used as quick-pick presets when creating schedules.

alter table public.profiles
  add column if not exists default_times jsonb
  not null
  default '{"morning":"08:00","noon":"14:00","evening":"20:00"}'::jsonb;
