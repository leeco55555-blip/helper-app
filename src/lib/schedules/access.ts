import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/auth/current-user";

export type MemberRole = "admin" | "editor" | "viewer";

export const getAccessiblePatients = cache(async function _getAccessiblePatients() {
  const uid = await currentUserId();
  if (!uid) return [];
  const supabase = await createClient();

  const [ownRes, linkedRes] = await Promise.all([
    supabase
      .from("patients")
      .select("id, display_name, profile_id")
      .eq("profile_id", uid),
    supabase
      .from("patient_members")
      .select("role, patient:patients(id, display_name, profile_id)")
      .eq("member_profile_id", uid),
  ]);

  const list: Array<{ id: string; display_name: string; role: MemberRole; is_self: boolean }> = [];
  for (const p of ownRes.data ?? []) {
    list.push({ id: p.id, display_name: p.display_name, role: "admin", is_self: true });
  }
  for (const m of linkedRes.data ?? []) {
    const pat = m.patient as unknown as { id: string; display_name: string; profile_id: string } | null;
    if (pat) list.push({ id: pat.id, display_name: pat.display_name, role: m.role as MemberRole, is_self: false });
  }
  return list;
});

export async function getPatientRole(patientId: string): Promise<MemberRole | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const supabase = await createClient();

  const [patRes, memRes] = await Promise.all([
    supabase.from("patients").select("id, profile_id").eq("id", patientId).maybeSingle(),
    supabase
      .from("patient_members")
      .select("role")
      .eq("patient_id", patientId)
      .eq("member_profile_id", uid)
      .maybeSingle(),
  ]);
  if (patRes.data && patRes.data.profile_id === uid) return "admin";
  return (memRes.data?.role as MemberRole) ?? null;
}

export function roleAtLeast(role: MemberRole | null, min: MemberRole): boolean {
  if (!role) return false;
  const order = { viewer: 1, editor: 2, admin: 3 };
  return order[role] >= order[min];
}
