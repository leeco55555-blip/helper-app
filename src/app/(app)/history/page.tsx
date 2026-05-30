import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { AppHeader } from "@/components/app-header";
import { ALL_KINDS, type Kind } from "@/lib/schedules/kind-labels";
import {
  dayWindow,
  weekWindow,
  monthWindow,
  todayYmd,
} from "@/lib/schedules/time-window";
import { HistoryView } from "./history-view";
import type { HistoryOccurrence } from "./occurrence-row";
import { OccurrencesSkeleton } from "@/components/occurrences-skeleton";

type View = "daily" | "weekly" | "monthly";
type StatusKey = "taken" | "not_done" | "pending";
type RawStatus = HistoryOccurrence["status"];

const STATUS_MAP: Record<StatusKey, RawStatus[]> = {
  taken: ["taken"],
  not_done: ["skipped", "missed"],
  pending: ["pending"],
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

type HistorySearch = {
  patient?: string;
  view?: string;
  date?: string;
  kinds?: string;
  statuses?: string;
  q?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<HistorySearch>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="היסטוריה" />
      <Suspense fallback={<OccurrencesSkeleton />}>
        <HistoryBody sp={sp} />
      </Suspense>
    </main>
  );
}

async function HistoryBody({ sp }: { sp: HistorySearch }) {
  const supabase = await createClient();

  const patients = await getAccessiblePatients();
  if (patients.length === 0) redirect("/today");

  const view: View =
    sp.view === "daily" || sp.view === "weekly" || sp.view === "monthly"
      ? sp.view
      : "weekly";
  const date = sp.date && YMD_RE.test(sp.date) ? sp.date : todayYmd();
  const selectedId =
    sp.patient && patients.some((p) => p.id === sp.patient) ? sp.patient! : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;

  const kinds: Kind[] = (sp.kinds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Kind => ALL_KINDS.includes(s as Kind));
  const statuses: StatusKey[] = (sp.statuses ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is StatusKey => s === "taken" || s === "not_done" || s === "pending");
  const q = (sp.q ?? "").trim();

  const win =
    view === "daily" ? dayWindow(date) : view === "weekly" ? weekWindow(date) : monthWindow(date);

  let query = supabase
    .from("schedule_occurrences")
    .select(
      "id, due_at, status, taken_at, taken_by_profile_id, measurement_values, notes, schedule:schedules!inner(id, title, kind, dose_text, measurement_unit, measurement_value_count)",
    )
    .eq("patient_id", selectedId)
    .gte("due_at", win.fromUtc.toISOString())
    .lt("due_at", win.toUtc.toISOString())
    .order("due_at", { ascending: true })
    .limit(500);

  if (statuses.length > 0) {
    const flat = statuses.flatMap((s) => STATUS_MAP[s]);
    query = query.in("status", flat);
  }
  if (kinds.length > 0) {
    query = query.in("schedule.kind", kinds);
  }
  if (q.length > 0) {
    query = query.ilike("schedule.title", `%${q}%`);
  }

  const { data: rows } = await query;

  const normalized: HistoryOccurrence[] = (rows ?? []).map((r) => ({
    ...r,
    schedule: Array.isArray(r.schedule) ? r.schedule[0] ?? null : r.schedule,
  }));

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-4">
      {patients.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {patients.map((p, i) => (
            <Link
              key={p.id}
              href={buildHref({ ...sp, patient: p.id })}
              prefetch={i < 3 ? undefined : false}
              className="chip"
              data-active={p.id === selected.id}
            >
              {p.display_name}
            </Link>
          ))}
        </div>
      )}

      <HistoryView
        occurrences={normalized}
        view={view}
        date={date}
        rangeLabel={win.label}
        kinds={kinds}
        statuses={statuses}
        q={q}
      />
    </div>
  );
}

function buildHref(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  return `/history?${p.toString()}`;
}
