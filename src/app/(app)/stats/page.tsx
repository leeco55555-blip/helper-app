import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { AppHeader } from "@/components/app-header";
import { scoreBand } from "@/lib/stats/score";

type Row = {
  status: "pending" | "taken" | "skipped" | "missed";
  due_at: string;
  schedule: { kind: string } | { kind: string }[] | null;
};

function scheduleKind(s: Row["schedule"]): string | null {
  if (!s) return null;
  if (Array.isArray(s)) return s[0]?.kind ?? null;
  return s.kind;
}

export default async function StatsPage({
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
  const selectedId =
    sp.patient && patients.some((p) => p.id === sp.patient) ? sp.patient! : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const { data: occRaw } = await supabase
    .from("schedule_occurrences")
    .select("status, due_at, schedule:schedules(kind)")
    .eq("patient_id", selectedId)
    .gte("due_at", sevenDaysAgo.toISOString())
    .lt("due_at", now.toISOString());

  const rows: Row[] = (occRaw ?? []) as unknown as Row[];
  const medRows = rows.filter((r) => scheduleKind(r.schedule) === "medication");

  const taken = medRows.filter((r) => r.status === "taken").length;
  const missed = medRows.filter((r) => r.status === "missed").length;
  const skipped = medRows.filter((r) => r.status === "skipped").length;
  const total = taken + missed + skipped;
  const hasData = total > 0;
  const score = hasData ? Math.round((taken / total) * 100) : 0;
  const band = scoreBand(score);

  // Streak: count of consecutive days (ending yesterday) with 100% taken.
  const byDay = new Map<string, { taken: number; total: number }>();
  for (const r of medRows) {
    const d = new Date(r.due_at);
    const ymd = d.toISOString().slice(0, 10);
    const e = byDay.get(ymd) ?? { taken: 0, total: 0 };
    if (r.status === "taken") e.taken++;
    if (r.status === "taken" || r.status === "missed" || r.status === "skipped") e.total++;
    byDay.set(ymd, e);
  }
  let streak = 0;
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const ymd = cursor.toISOString().slice(0, 10);
    const e = byDay.get(ymd);
    if (!e || e.total === 0 || e.taken < e.total) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="סטטיסטיקה" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-4">
        {patients.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/stats?patient=${p.id}`}
                className="chip"
                data-active={p.id === selected.id}
              >
                {p.display_name}
              </Link>
            ))}
          </div>
        )}

        {!hasData ? (
          <div className="card text-center py-12">
            <p className="text-lg font-semibold">אין עדיין מספיק נתונים</p>
            <p className="text-[var(--muted)] mt-2">
              ברגע שתסמן כדורים בלו״ז של 7 הימים האחרונים — הציון יופיע כאן.
            </p>
          </div>
        ) : (
          <>
            <div
              className="card-elevated flex flex-col items-center gap-3 py-8"
              style={{ background: band.bg }}
            >
              <div className="text-sm font-semibold text-[var(--muted-strong)]">
                ציון 7 ימים אחרונים
              </div>
              <div
                className="text-7xl font-black tracking-tight leading-none"
                style={{ color: band.color }}
              >
                {score}
              </div>
              <div className="text-base font-bold" style={{ color: band.color }}>
                {band.label}
              </div>
              <div className="text-lg text-center px-4 mt-1 font-medium">
                {band.message}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatTile label="נלקחו" value={taken} color="var(--success, #16a34a)" />
              <StatTile label="פוספסו" value={missed} color="var(--danger, #dc2626)" />
              <StatTile label="דולגו" value={skipped} color="var(--muted)" />
            </div>

            {streak > 0 && (
              <div className="card flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  🔥
                </span>
                <div>
                  <div className="text-sm text-[var(--muted)] font-semibold">רצף מושלם</div>
                  <div className="text-xl font-bold">
                    {streak} {streak === 1 ? "יום" : "ימים"} ברצף עם 100%
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card flex flex-col items-center py-4">
      <div className="text-3xl font-black" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-[var(--muted)] font-semibold mt-1">{label}</div>
    </div>
  );
}
