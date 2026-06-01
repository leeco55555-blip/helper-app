-- Per-patient default guest list for "Add to Calendar".
-- Array of { name, email } objects, pre-selected when adding an event to a calendar.

alter table public.patients
  add column if not exists default_calendar_guests jsonb not null default '[]'::jsonb;
