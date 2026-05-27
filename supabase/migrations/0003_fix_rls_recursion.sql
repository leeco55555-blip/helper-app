-- Fix infinite recursion in RLS policies.
-- The previous policies on patients/patient_members/profiles referenced
-- each other in a way that caused recursive RLS checks. Rewrite them
-- using SECURITY DEFINER helper functions that bypass RLS internally.

-- =====================================================================
-- Helper functions (SECURITY DEFINER — bypass RLS when checking access)
-- =====================================================================

create or replace function public.is_patient_owner(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patients
     where id = p_patient and profile_id = auth.uid()
  );
$$;

create or replace function public.is_patient_member(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patient_members
     where patient_id = p_patient and member_profile_id = auth.uid()
  );
$$;

create or replace function public.shares_patient_with(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- True if auth.uid() shares a patient with p_profile
  -- (either as the patient or as a co-member).
  select exists (
    -- p_profile is a patient and auth.uid() is a member of that patient
    select 1
      from public.patients pa
      join public.patient_members pm on pm.patient_id = pa.id
     where pa.profile_id = p_profile
       and pm.member_profile_id = auth.uid()
  ) or exists (
    -- auth.uid() is a patient and p_profile is a member
    select 1
      from public.patients pa
      join public.patient_members pm on pm.patient_id = pa.id
     where pa.profile_id = auth.uid()
       and pm.member_profile_id = p_profile
  );
$$;

grant execute on function public.is_patient_owner(uuid)   to anon, authenticated, service_role;
grant execute on function public.is_patient_member(uuid)  to anon, authenticated, service_role;
grant execute on function public.shares_patient_with(uuid) to anon, authenticated, service_role;

-- =====================================================================
-- profiles
-- =====================================================================
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_linked_read" on public.profiles;
drop policy if exists "profiles_self_insert" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;

create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_linked_read" on public.profiles
  for select using (public.shares_patient_with(id));

create policy "profiles_self_insert" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- =====================================================================
-- patients
-- =====================================================================
drop policy if exists "patients_select" on public.patients;
drop policy if exists "patients_insert_self" on public.patients;
drop policy if exists "patients_update" on public.patients;

create policy "patients_select" on public.patients
  for select using (
    profile_id = auth.uid() or public.is_patient_member(id)
  );

create policy "patients_insert_self" on public.patients
  for insert with check (profile_id = auth.uid());

create policy "patients_update" on public.patients
  for update using (
    profile_id = auth.uid() or public.is_patient_member(id)
  ) with check (
    profile_id = auth.uid() or public.is_patient_member(id)
  );

-- =====================================================================
-- patient_members  (no self-reference!)
-- =====================================================================
drop policy if exists "pm_select" on public.patient_members;
drop policy if exists "pm_admin_write" on public.patient_members;

create policy "pm_select" on public.patient_members
  for select using (
    member_profile_id = auth.uid()
    or public.is_patient_owner(patient_id)
  );

create policy "pm_admin_write" on public.patient_members
  for all using (
    public.is_patient_owner(patient_id)
    or exists (
      select 1
        from public.patient_members me
       where me.patient_id = patient_members.patient_id
         and me.member_profile_id = auth.uid()
         and me.role = 'admin'
    )
  ) with check (
    public.is_patient_owner(patient_id)
    or exists (
      select 1
        from public.patient_members me
       where me.patient_id = patient_members.patient_id
         and me.member_profile_id = auth.uid()
         and me.role = 'admin'
    )
  );

-- =====================================================================
-- has_patient_access (existing helper) — keep but ensure it bypasses RLS
-- =====================================================================
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

grant execute on function public.has_patient_access(uuid, member_role) to anon, authenticated, service_role;
