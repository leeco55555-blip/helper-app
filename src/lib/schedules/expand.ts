import { addDays } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { expandOccurrences, PatternSchema, type Pattern } from "./pattern";

type OccurrenceRow = {
  schedule_id: string;
  patient_id: string;
  due_at: string;
  status: "pending";
};

/**
 * Expand occurrences for one schedule into the DB for `daysAhead` days starting from `from`.
 * Uses service role — caller is responsible for authorization.
 */
export async function expandSchedule(
  scheduleId: string,
  options: { daysAhead?: number; from?: Date } = {},
) {
  const svc = createServiceClient();
  const { from = new Date() } = options;

  const { data: schedule, error } = await svc
    .from("schedules")
    .select("id, patient_id, pattern, active")
    .eq("id", scheduleId)
    .single();
  if (error || !schedule) throw error ?? new Error("Schedule not found");
  if (!schedule.active) return { inserted: 0 };

  const pattern = PatternSchema.parse(schedule.pattern as Pattern);
  // Low-frequency or one-time schedules can sit far in the future — extend the
  // window so the anchor occurrence is always materialized.
  const isLowFrequency =
    pattern.freq === "once" ||
    (pattern.freq === "interval" &&
      (pattern.interval_unit === "months" || pattern.interval_unit === "years"));
  const daysAhead =
    options.daysAhead ?? (isLowFrequency ? 400 : 7);
  const until = addDays(from, daysAhead);
  const dates = expandOccurrences(pattern, from, until);

  if (dates.length === 0) return { inserted: 0 };

  const rows = dates.map((d) => ({
    schedule_id: schedule.id,
    patient_id: schedule.patient_id,
    due_at: d.toISOString(),
    status: "pending" as const,
  }));

  // Upsert: unique(schedule_id, due_at) prevents duplicates.
  const { error: upErr, count } = await svc
    .from("schedule_occurrences")
    .upsert(rows, { onConflict: "schedule_id,due_at", ignoreDuplicates: true, count: "exact" });
  if (upErr) throw upErr;
  return { inserted: count ?? rows.length };
}

/**
 * Ensure occurrences for all of a patient's active schedules are materialized
 * for the exact [fromUtc, toUtc] window, then return how many new rows were
 * inserted. Idempotent: the unique(schedule_id, due_at) upsert ignores rows
 * that already exist, so this is safe to call on every page render.
 *
 * The daily/weekly/tomorrow views call this before reading occurrences, which
 * makes them resilient to a stalled reminder cron. Without it, if the cron that
 * rolls the 7-day window forward stops running, future days silently go blank.
 */
export async function ensureOccurrencesInWindow(
  patientId: string,
  fromUtc: Date,
  toUtc: Date,
) {
  const svc = createServiceClient();
  const { data: schedules, error } = await svc
    .from("schedules")
    .select("id, patient_id, pattern")
    .eq("patient_id", patientId)
    .eq("active", true);
  if (error || !schedules) return { inserted: 0 };

  const rows: OccurrenceRow[] = [];
  for (const s of schedules) {
    let pattern: Pattern;
    try {
      pattern = PatternSchema.parse(s.pattern as Pattern);
    } catch {
      continue; // skip malformed patterns rather than failing the whole render
    }
    for (const d of expandOccurrences(pattern, fromUtc, toUtc)) {
      rows.push({
        schedule_id: s.id,
        patient_id: s.patient_id,
        due_at: d.toISOString(),
        status: "pending",
      });
    }
  }
  if (rows.length === 0) return { inserted: 0 };

  const { error: upErr, count } = await svc
    .from("schedule_occurrences")
    .upsert(rows, { onConflict: "schedule_id,due_at", ignoreDuplicates: true, count: "exact" });
  if (upErr) return { inserted: 0 };
  return { inserted: count ?? 0 };
}

export async function expandAllActiveForPatient(patientId: string, daysAhead = 7) {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("schedules")
    .select("id")
    .eq("patient_id", patientId)
    .eq("active", true);
  if (error) throw error;
  let total = 0;
  for (const row of data ?? []) {
    const r = await expandSchedule(row.id, { daysAhead });
    total += r.inserted;
  }
  return { inserted: total };
}
