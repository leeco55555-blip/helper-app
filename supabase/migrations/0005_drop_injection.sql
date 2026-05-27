-- Migrate any existing 'injection' schedules to 'medication' and drop the enum value.

update public.schedules set kind = 'medication' where kind = 'injection';

-- Postgres doesn't allow removing enum values directly. Recreate the type.
alter type public.schedule_kind rename to schedule_kind_old;

create type public.schedule_kind as enum ('medication', 'measurement', 'exam', 'workout');

alter table public.schedules
  alter column kind type public.schedule_kind
  using kind::text::public.schedule_kind;

drop type public.schedule_kind_old;
