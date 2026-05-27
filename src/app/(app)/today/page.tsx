import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { AppHeader } from "@/components/app-header";
import { TodayList } from "./today-list";

export default async function TodayPage({
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

  // Today's window in Asia/Jerusalem
  const now = new Date();
  // Compute window: today 00:00 → tomorrow 00:00 in Jerusalem timezone, expressed in UTC.
  const tzOffsetMs = getJerusalemOffsetMs(now);
  const localNow = new Date(now.getTime() + tzOffsetMs);
  const localStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()));
  const localEnd = new Date(localStart.getTime() + 24 * 3600 * 1000);
  const fromUtc = new Date(localStart.getTime() - tzOffsetMs);
  const toUtc = new Date(localEnd.getTime() - tzOffsetMs);

  const { data: occurrences } = await supabase
    .from("schedule_occurrences")
    .select("id, due_at, status, taken_at, taken_by_profile_id, measurement_values, notes, schedule:schedules(id, title, kind, dose_text, measurement_unit, measurement_value_count)")
    .eq("patient_id", selectedId)
    .gte("due_at", fromUtc.toISOString())
    .lt("due_at", toUtc.toISOString())
    .order("due_at", { ascending: true });

  return (
    <main className="flex-1 flex flex-col pb-24">
      <AppHeader title="היום" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {patients.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/today?patient=${p.id}`}
                className={`px-4 py-2 rounded-2xl border whitespace-nowrap text-base font-medium ${p.id === selected.id
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--surface)] border-[var(--border)]"
                  }`}
              >
                {p.display_name}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--muted)]">המטופל</p>
            <p className="text-xl font-bold">{selected.display_name}</p>
          </div>
          <Link href={`/schedules?patient=${selected.id}`} className="btn-secondary">
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
        />
      </div>
    </main>
  );
}

function getJerusalemOffsetMs(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return asUtc - d.getTime();
}
