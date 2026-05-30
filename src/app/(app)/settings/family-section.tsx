import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { FamilyManager } from "../family/family-manager";
import { InvitePatientSection } from "../family/invite-patient";

export async function FamilySection({
  userId,
  selectedPatientParam,
}: {
  userId: string;
  selectedPatientParam?: string;
}) {
  const supabase = await createClient();
  const patients = await getAccessiblePatients();

  if (patients.length === 0) {
    const { data: myPending } = await supabase
      .from("invitations")
      .select("id, target_name, target_email, target_phone, token, expires_at")
      .eq("inviter_profile_id", userId)
      .eq("kind", "family_to_patient")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return (
      <div className="flex flex-col gap-4">
        <div className="card flex flex-col gap-2">
          <h2 className="text-xl font-bold">משפחה</h2>
          <p className="text-[var(--muted)]">
            אין עדיין מטופל מקושר. הזמן את המטופל שלך להירשם — ברגע שיצטרף תהפוך אוטומטית למנהל שלו.
          </p>
        </div>
        <InvitePatientSection pending={myPending ?? []} />
      </div>
    );
  }

  const selectedId =
    selectedPatientParam && patients.some((p) => p.id === selectedPatientParam)
      ? selectedPatientParam
      : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;

  const [membersRes, pendingRes] = await Promise.all([
    supabase
      .from("patient_members")
      .select(
        "role, receive_reminders, joined_at, member:profiles!patient_members_member_profile_id_fkey(id, full_name, phone)",
      )
      .eq("patient_id", selectedId),
    supabase
      .from("invitations")
      .select("id, kind, target_email, target_name, proposed_role, token, status, expires_at, created_at")
      .eq("patient_id", selectedId)
      .eq("status", "pending"),
  ]);
  const members = membersRes.data;
  const pending = pendingRes.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-1">
        <div className="text-[var(--muted)] text-sm font-semibold">משפחה</div>
        <div className="text-xl font-bold">חברים מקושרים</div>
      </div>

      {patients.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/settings?patient=${p.id}`}
              className="chip"
              data-active={p.id === selected.id}
            >
              {p.display_name}
            </Link>
          ))}
        </div>
      )}

      <FamilyManager
        patientId={selectedId}
        isAdmin={selected.role === "admin"}
        currentUserId={userId}
        members={(members ?? []).map((m) => ({
          role: m.role,
          receive_reminders: m.receive_reminders,
          joined_at: m.joined_at,
          member: m.member as unknown as { id: string; full_name: string; phone: string | null },
        }))}
        pending={pending ?? []}
      />
    </div>
  );
}
