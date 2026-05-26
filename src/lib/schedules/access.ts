import { createClient } from "@/lib/supabase/server";

export type MemberRole = "admin" | "editor" | "viewer";

export async function getAccessiblePatients() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Own patient (if any)
  const { data: own } = await supabase
    .from("patients")
    .select("id, display_name, profile_id")
    .eq("profile_id", user.id);

  // Patients via membership
  const { data: linked } = await supabase
    .from("patient_members")
    .select("role, patient:patients(id, display_name, profile_id)")
    .eq("member_profile_id", user.id);

  const list: Array<{ id: string; display_name: string; role: MemberRole; is_self: boolean }> = [];
  for (const p of own ?? []) {
    list.push({ id: p.id, display_name: p.display_name, role: "admin", is_self: true });
  }
  for (const m of linked ?? []) {
    const pat = m.patient as unknown as { id: string; display_name: string; profile_id: string } | null;
    if (pat) list.push({ id: pat.id, display_name: pat.display_name, role: m.role as MemberRole, is_self: false });
  }
  return list;
}

export async function getPatientRole(patientId: string): Promise<MemberRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: pat } = await supabase
    .from("patients")
    .select("id, profile_id")
    .eq("id", patientId)
    .maybeSingle();
  if (pat && pat.profile_id === user.id) return "admin";

  const { data: mem } = await supabase
    .from("patient_members")
    .select("role")
    .eq("patient_id", patientId)
    .eq("member_profile_id", user.id)
    .maybeSingle();
  return (mem?.role as MemberRole) ?? null;
}

export function roleAtLeast(role: MemberRole | null, min: MemberRole): boolean {
  if (!role) return false;
  const order = { viewer: 1, editor: 2, admin: 3 };
  return order[role] >= order[min];
}
