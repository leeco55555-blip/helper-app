import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { AppHeader } from "@/components/app-header";
import { TodayList } from "../today/today-list";
import { dayWindow, tomorrowYmd } from "@/lib/schedules/time-window";

export default async function TomorrowPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="card max-w-md space-y-4">
          <h1 className="text-2xl font-bold">החשבון לא מוכן</h1>
          <p>נראה שהשלמת ההרשמה לא הסתיימה.</p>
          <Link href="/signup" className="btn-primary">השלמת הרשמה</Link>
        </div>
      </main>
    );
  }

  const patients = await getAccessiblePatients();
  if (patients.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="card max-w-md space-y-4">
          <h1 className="text-2xl font-bold">אין עדיין מטופל מקושר</h1>
          {profile.role_type === "family" ? (
            <>
              <p>הזמן את המטופל שלך להירשם — ברגע שיצטרף, תהפוך אוטומטית למנהל שלו.</p>
              <Link href="/family" className="btn-primary">הזמנת מטופל</Link>
            </>
          ) : (
            <p>נראה שהחשבון שלך לא הושלם. נסה להירשם מחדש.</p>
          )}
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const selectedId =
    sp.patient && patients.some((p) => p.id === sp.patient)
      ? sp.patient!
      : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;

  const { fromUtc, toUtc } = dayWindow(tomorrowYmd());

  const { data: occurrences } = await supabase
    .from("schedule_occurrences")
    .select("id, due_at, status, taken_at, taken_by_profile_id, measurement_values, notes, schedule:schedules(id, title, kind, dose_text, measurement_unit, measurement_value_count)")
    .eq("patient_id", selectedId)
    .gte("due_at", fromUtc.toISOString())
    .lt("due_at", toUtc.toISOString())
    .order("due_at", { ascending: true });

  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="מחר" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-4">
        {patients.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/tomorrow?patient=${p.id}`}
                className="chip"
                data-active={p.id === selected.id}
              >
                {p.display_name}
              </Link>
            ))}
          </div>
        )}

        <div className="card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[var(--muted)] text-sm font-semibold">הלו״ז של מחר עבור:</p>
            <p className="text-xl font-bold truncate">{selected.display_name}</p>
          </div>
          <Link href={`/schedules?patient=${selected.id}`} className="btn-secondary shrink-0">
            ניהול לו״ז
          </Link>
        </div>

        <TodayList
          occurrences={(occurrences ?? []).map((o) => ({
            ...o,
            schedule: Array.isArray(o.schedule) ? o.schedule[0] ?? null : o.schedule,
          }))}
          patientId={selected.id}
          canEdit={selected.role !== "viewer"}
          isSelf={selected.is_self}
          readOnly
          emptyText="אין משימות למחר."
        />
      </div>
    </main>
  );
}
