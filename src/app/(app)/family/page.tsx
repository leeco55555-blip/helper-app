import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { AppHeader } from "@/components/app-header";
import { FamilyManager } from "./family-manager";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const patients = await getAccessiblePatients();
  if (patients.length === 0) {
    return (
      <main className="flex-1 flex flex-col">
        <AppHeader title="משפחה" />
        <div className="max-w-2xl mx-auto w-full p-4">
          <div className="card text-center py-12 text-[var(--muted)]">
            <p>אין עדיין מטופל מקושר.</p>
          </div>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const selectedId = sp.patient && patients.some((p) => p.id === sp.patient) ? sp.patient! : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;

  const { data: members } = await supabase
    .from("patient_members")
    .select("role, receive_reminders, joined_at, member:profiles!patient_members_member_profile_id_fkey(id, full_name, phone)")
    .eq("patient_id", selectedId);

  const { data: pending } = await supabase
    .from("invitations")
    .select("id, kind, target_email, target_name, proposed_role, token, status, expires_at, created_at")
    .eq("patient_id", selectedId)
    .eq("status", "pending");

  return (
    <main className="flex-1 flex flex-col pb-24">
      <AppHeader title="משפחה" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {patients.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/family?patient=${p.id}`}
                className={`px-4 py-2 rounded-2xl border whitespace-nowrap text-base font-medium ${
                  p.id === selected.id
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--surface)] border-[var(--border)]"
                }`}
              >
                {p.display_name}
              </Link>
            ))}
          </div>
        )}

        <FamilyManager
          patientId={selectedId}
          isAdmin={selected.role === "admin"}
          members={(members ?? []).map((m) => ({
            role: m.role,
            receive_reminders: m.receive_reminders,
            joined_at: m.joined_at,
            member: m.member as unknown as { id: string; full_name: string; phone: string | null },
          }))}
          pending={pending ?? []}
        />
      </div>
    </main>
  );
}
