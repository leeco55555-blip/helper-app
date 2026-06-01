import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { CalendarGuest } from "@/lib/calendar/ics";

/**
 * Other members linked to the patient, with emails resolved from auth.users
 * (emails live there, not in `profiles`). Excludes the current user and anyone
 * without an email. Used to populate the calendar guest picker.
 */
export async function loadPatientMembers(
  patientId: string,
  currentUserId: string,
): Promise<CalendarGuest[]> {
  const supabase = await createClient();
  const [patientRes, membersRes] = await Promise.all([
    // The patient's own profile (owner) — not stored in patient_members.
    supabase
      .from("patients")
      .select("owner:profiles!patients_profile_id_fkey(id, full_name)")
      .eq("id", patientId)
      .maybeSingle(),
    supabase
      .from("patient_members")
      .select("member:profiles!patient_members_member_profile_id_fkey(id, full_name)")
      .eq("patient_id", patientId),
  ]);

  type Profile = { id: string; full_name: string | null };
  const candidates: Profile[] = [];
  const owner = patientRes.data?.owner as unknown as Profile | null;
  if (owner) candidates.push(owner);
  for (const row of membersRes.data ?? []) {
    const m = row.member as unknown as Profile | null;
    if (m) candidates.push(m);
  }

  // De-duplicate by id and drop the current user (no point inviting yourself).
  const byId = new Map<string, Profile>();
  for (const p of candidates) {
    if (p.id !== currentUserId) byId.set(p.id, p);
  }
  const others = [...byId.values()];
  if (others.length === 0) return [];

  const svc = createServiceClient();
  const resolved = await Promise.all(
    others.map(async (m) => {
      const { data: u } = await svc.auth.admin.getUserById(m.id);
      const email = u.user?.email;
      if (!email) return null;
      return { name: m.full_name ?? email, email };
    }),
  );

  return resolved.filter((m): m is CalendarGuest => m !== null);
}

/** The patient's saved default calendar guests ({ name, email }[]). */
export async function loadDefaultGuests(patientId: string): Promise<CalendarGuest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("default_calendar_guests")
    .eq("id", patientId)
    .maybeSingle();

  const raw = data?.default_calendar_guests;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (g): g is CalendarGuest =>
        !!g && typeof g.email === "string" && typeof g.name === "string",
    )
    .map((g) => ({ name: g.name, email: g.email }));
}
