import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { AppHeader } from "@/components/app-header";
import { ScheduleManager } from "./schedule-manager";

export default async function SchedulesPage({
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
  if (patients.length === 0) redirect("/today");

  const sp = await searchParams;
  const selectedId = sp.patient && patients.some((p) => p.id === sp.patient) ? sp.patient! : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;
  const canEdit = selected.role !== "viewer";

  const { data: schedules } = await supabase
    .from("schedules")
    .select("*")
    .eq("patient_id", selectedId)
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1 flex flex-col pb-24">
      <AppHeader title="ניהול לו״ז" backHref={`/today?patient=${selectedId}`} />
      <div className="max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {patients.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/schedules?patient=${p.id}`}
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

        <ScheduleManager
          patientId={selectedId}
          schedules={schedules ?? []}
          canEdit={canEdit}
        />
      </div>
    </main>
  );
}
