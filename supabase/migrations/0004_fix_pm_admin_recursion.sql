-- Fix infinite recursion in patient_members RLS.
-- The previous pm_admin_write policy is FOR ALL and its USING clause runs a
-- subquery against patient_members itself. Because policies are re-checked
-- on every row scan, that subquery re-triggers RLS → infinite recursion.
-- Fix: route the admin check through a SECURITY DEFINER helper that bypasses RLS.

create or replace function public.is_patient_admin(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.patients
     where id = p_patient and profile_id = auth.uid()
  ) or exists (
    select 1 from public.patient_members
     where patient_id = p_patient
       and member_profile_id = auth.uid()
       and role = 'admin'
  );
$$;

grant execute on function public.is_patient_admin(uuid) to anon, authenticated, service_role;

drop policy if exists "pm_admin_write" on public.patient_members;

-- Split into INSERT/UPDATE/DELETE so it does not apply to SELECT
-- (pm_select already covers SELECT).
create policy "pm_admin_insert" on public.patient_members
  for insert with check (public.is_patient_admin(patient_id));

create policy "pm_admin_update" on public.patient_members
  for update using (public.is_patient_admin(patient_id))
  with check (public.is_patient_admin(patient_id));

create policy "pm_admin_delete" on public.patient_members
  for delete using (public.is_patient_admin(patient_id));
