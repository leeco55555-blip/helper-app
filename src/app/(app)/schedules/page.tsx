import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { loadPatientMembers, loadDefaultGuests } from "@/lib/calendar/guests";
import { currentUserId } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { ScheduleManager } from "./schedule-manager";
import { OccurrencesSkeleton } from "@/components/occurrences-skeleton";

type DefaultTimes = { morning: string; noon: string; evening: string };
const FALLBACK: DefaultTimes = { morning: "08:00", noon: "14:00", evening: "20:00" };

function parseDefaultTimes(raw: unknown): DefaultTimes {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (
      typeof o.morning === "string" &&
      typeof o.noon === "string" &&
      typeof o.evening === "string"
    ) {
      return { morning: o.morning, noon: o.noon, evening: o.evening };
    }
  }
  return FALLBACK;
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="ניהול לו״ז" />
      <Suspense fallback={<OccurrencesSkeleton />}>
        <SchedulesBody patientParam={sp.patient} />
      </Suspense>
    </main>
  );
}

async function SchedulesBody({ patientParam }: { patientParam?: string }) {
  const supabase = await createClient();
  const uid = await currentUserId();

  const patients = await getAccessiblePatients();
  if (patients.length === 0) redirect("/today");

  const selectedId =
    patientParam && patients.some((p) => p.id === patientParam) ? patientParam : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;
  const canEdit = selected.role !== "viewer";

  const [{ data: schedules }, { data: profile }] = await Promise.all([
    supabase
      .from("schedules")
      .select("*")
      .eq("patient_id", selectedId)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("default_times").eq("id", uid!).maybeSingle(),
  ]);

  const defaultTimes = parseDefaultTimes(profile?.default_times);
  const [members, defaultGuests] = await Promise.all([
    loadPatientMembers(selectedId),
    loadDefaultGuests(selectedId),
  ]);

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-4">
      {patients.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {patients.map((p, i) => (
            <Link
              key={p.id}
              href={`/schedules?patient=${p.id}`}
              prefetch={i < 3 ? undefined : false}
              className="chip"
              data-active={p.id === selected.id}
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
        defaultTimes={defaultTimes}
        members={members}
        defaultGuests={defaultGuests}
      />
    </div>
  );
}
