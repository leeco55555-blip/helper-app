-- Helper App — initial schema
-- Patients, family members with roles, schedules, occurrences, push subs, invitations, API tokens

set check_function_bodies = off;

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type profile_role_type as enum ('patient', 'family');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type schedule_kind as enum ('medication', 'injection', 'measurement', 'exam', 'workout');
exception when duplicate_object then null; end $$;

do $$ begin
  create type occurrence_status as enum ('pending', 'taken', 'skipped', 'missed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_kind as enum ('family_to_patient', 'patient_to_family');
exception when duplicate_object then null; end $$;

-- ============================================================
-- profiles — extends auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role_type profile_role_type not null,
  timezone text not null default 'Asia/Jerusalem',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role_type on public.profiles(role_type);

-- ============================================================
-- patients
-- ============================================================
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  birth_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- patient_members — family members linked to a patient
-- ============================================================
create table if not exists public.patient_members (
  patient_id uuid not null references public.patients(id) on delete cascade,
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'viewer',
  receive_reminders boolean not null default false,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (patient_id, member_profile_id)
);

create index if not exists idx_pm_member on public.patient_members(member_profile_id);
create index if not exists idx_pm_patient on public.patient_members(patient_id);

-- ============================================================
-- invitations
-- ============================================================
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  kind invitation_kind not null,
  inviter_profile_id uuid not null references public.profiles(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  target_email text,
  target_phone text,
  target_name text,
  proposed_role member_role,
  token text not null unique,
  status invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invitations_token on public.invitations(token);
create index if not exists idx_invitations_target on public.invitations(target_email, target_phone);

-- ============================================================
-- schedules
-- ============================================================
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind schedule_kind not null,
  title text not null,
  dose_text text,
  measurement_unit text,
  measurement_value_count smallint not null default 0 check (measurement_value_count between 0 and 4),
  notes text,
  pattern jsonb not null,
  -- pattern shape:
  -- { freq: 'daily'|'weekly'|'custom', days_of_week: [0..6], times: ['HH:MM',...], every_n_days?: int, starts_on?: 'YYYY-MM-DD', ends_on?: 'YYYY-MM-DD' }
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedules_patient on public.schedules(patient_id);
create index if not exists idx_schedules_active on public.schedules(patient_id, active);

-- ============================================================
-- schedule_occurrences
-- ============================================================
create table if not exists public.schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  due_at timestamptz not null,
  status occurrence_status not null default 'pending',
  taken_at timestamptz,
  taken_by_profile_id uuid references public.profiles(id) on delete set null,
  measurement_values jsonb,
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (schedule_id, due_at)
);

create index if not exists idx_occ_patient_due on public.schedule_occurrences(patient_id, due_at);
create index if not exists idx_occ_status on public.schedule_occurrences(status, due_at);

-- ============================================================
-- push_subscriptions
-- ============================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_push_profile on public.push_subscriptions(profile_id);

-- ============================================================
-- notification_log
-- ============================================================
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  occurrence_id uuid references public.schedule_occurrences(id) on delete set null,
  trigger_source text not null,
  payload jsonb,
  success boolean not null,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists idx_notif_profile on public.notification_log(profile_id, sent_at desc);

-- ============================================================
-- api_tokens — for external integrations (n8n, openclaw)
-- ============================================================
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  scopes text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- ============================================================
-- Helper functions
-- ============================================================

-- Check whether the currently-authenticated user has the required role for a patient.
create or replace function public.has_patient_access(
  p_patient uuid,
  p_min_role member_role default 'viewer'
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role member_role;
  v_is_self boolean;
begin
  if v_uid is null then return false; end if;

  select exists (
    select 1 from public.patients pa where pa.id = p_patient and pa.profile_id = v_uid
  ) into v_is_self;
  if v_is_self then return true; end if;

  select pm.role into v_role
    from public.patient_members pm
   where pm.patient_id = p_patient and pm.member_profile_id = v_uid;

  if v_role is null then return false; end if;

  return case p_min_role
    when 'viewer' then true
    when 'editor' then v_role in ('editor', 'admin')
    when 'admin'  then v_role = 'admin'
  end;
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.patient_members enable row level security;
alter table public.invitations enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_occurrences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;
alter table public.api_tokens enable row level security;

-- profiles: read your own, plus read profiles of members linked to you
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_linked_read" on public.profiles;
create policy "profiles_linked_read" on public.profiles
  for select using (
    exists (
      select 1
        from public.patients pa
        join public.patient_members pm on pm.patient_id = pa.id
       where (pa.profile_id = auth.uid() and pm.member_profile_id = profiles.id)
          or (pm.member_profile_id = auth.uid() and pa.profile_id = profiles.id)
    )
  );

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- patients
drop policy if exists "patients_select" on public.patients;
create policy "patients_select" on public.patients
  for select using (
    profile_id = auth.uid()
    or exists (select 1 from public.patient_members pm where pm.patient_id = patients.id and pm.member_profile_id = auth.uid())
  );

drop policy if exists "patients_insert_self" on public.patients;
create policy "patients_insert_self" on public.patients
  for insert with check (profile_id = auth.uid());

drop policy if exists "patients_update" on public.patients;
create policy "patients_update" on public.patients
  for update using (
    profile_id = auth.uid()
    or exists (select 1 from public.patient_members pm where pm.patient_id = patients.id and pm.member_profile_id = auth.uid() and pm.role in ('admin','editor'))
  );

-- patient_members
drop policy if exists "pm_select" on public.patient_members;
create policy "pm_select" on public.patient_members
  for select using (
    member_profile_id = auth.uid()
    or exists (select 1 from public.patients pa where pa.id = patient_members.patient_id and pa.profile_id = auth.uid())
    or exists (select 1 from public.patient_members pm2 where pm2.patient_id = patient_members.patient_id and pm2.member_profile_id = auth.uid())
  );

drop policy if exists "pm_admin_write" on public.patient_members;
create policy "pm_admin_write" on public.patient_members
  for all using (
    exists (select 1 from public.patients pa where pa.id = patient_members.patient_id and pa.profile_id = auth.uid())
    or exists (select 1 from public.patient_members pm where pm.patient_id = patient_members.patient_id and pm.member_profile_id = auth.uid() and pm.role = 'admin')
  ) with check (
    exists (select 1 from public.patients pa where pa.id = patient_members.patient_id and pa.profile_id = auth.uid())
    or exists (select 1 from public.patient_members pm where pm.patient_id = patient_members.patient_id and pm.member_profile_id = auth.uid() and pm.role = 'admin')
  );

-- invitations: inviter or target sees them
drop policy if exists "inv_select" on public.invitations;
create policy "inv_select" on public.invitations
  for select using (
    inviter_profile_id = auth.uid()
    or accepted_by_profile_id = auth.uid()
    or (patient_id is not null and public.has_patient_access(patient_id, 'admin'))
  );

drop policy if exists "inv_insert" on public.invitations;
create policy "inv_insert" on public.invitations
  for insert with check (inviter_profile_id = auth.uid());

drop policy if exists "inv_update" on public.invitations;
create policy "inv_update" on public.invitations
  for update using (
    inviter_profile_id = auth.uid()
    or accepted_by_profile_id = auth.uid()
  );

-- schedules
drop policy if exists "sched_select" on public.schedules;
create policy "sched_select" on public.schedules
  for select using (public.has_patient_access(patient_id, 'viewer'));

drop policy if exists "sched_write" on public.schedules;
create policy "sched_write" on public.schedules
  for all using (public.has_patient_access(patient_id, 'editor'))
       with check (public.has_patient_access(patient_id, 'editor'));

-- occurrences
drop policy if exists "occ_select" on public.schedule_occurrences;
create policy "occ_select" on public.schedule_occurrences
  for select using (public.has_patient_access(patient_id, 'viewer'));

drop policy if exists "occ_write" on public.schedule_occurrences;
create policy "occ_write" on public.schedule_occurrences
  for all using (public.has_patient_access(patient_id, 'editor'))
       with check (public.has_patient_access(patient_id, 'editor'));

-- push subscriptions: own only
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- notification log: read your own or for patients you have access to
drop policy if exists "notif_read" on public.notification_log;
create policy "notif_read" on public.notification_log
  for select using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.schedule_occurrences o
      where o.id = notification_log.occurrence_id
        and public.has_patient_access(o.patient_id, 'viewer')
    )
  );

-- api_tokens: no client access (service role only)
drop policy if exists "api_tokens_none" on public.api_tokens;
create policy "api_tokens_none" on public.api_tokens
  for select using (false);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_schedules_updated on public.schedules;
create trigger trg_schedules_updated before update on public.schedules
  for each row execute function public.set_updated_at();
