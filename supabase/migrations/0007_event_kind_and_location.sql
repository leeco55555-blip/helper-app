-- Add 'event' to schedule_kind enum and add an optional location column for events.

alter type public.schedule_kind add value if not exists 'event';

alter table public.schedules add column if not exists location text;
