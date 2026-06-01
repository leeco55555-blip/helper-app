import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { addDays, addMonths, addYears, startOfDay } from "date-fns";

export const PatternSchema = z.object({
  freq: z.enum(["once", "daily", "weekly", "custom", "interval"]),
  days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1),
  // Event end time (HH:MM), paired with times[0] as the start. Only meaningful
  // for "event" schedules; used to set the calendar event's duration. If the
  // end is at or before the start it is treated as the next day (overnight).
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  every_n_days: z.number().int().min(1).optional(),
  // For freq === "interval": rolling intervals anchored to a known date.
  interval_unit: z.enum(["days", "months", "years"]).optional(),
  interval_n: z.number().int().min(1).optional(),
  anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  starts_on: z.string().optional(),
  ends_on: z.string().optional(),
});

export type Pattern = z.infer<typeof PatternSchema>;

const TZ = "Asia/Jerusalem";

/**
 * Generate UTC timestamps for every occurrence between `from` and `until` (inclusive),
 * given the pattern. Times in `pattern.times` are interpreted in Asia/Jerusalem.
 */
export function expandOccurrences(
  pattern: Pattern,
  from: Date,
  until: Date,
): Date[] {
  if (pattern.freq === "once") {
    return expandOnce(pattern, from, until);
  }
  if (pattern.freq === "interval") {
    return expandInterval(pattern, from, until);
  }

  const result: Date[] = [];
  const startsOn = pattern.starts_on ? new Date(pattern.starts_on + "T00:00:00") : null;
  const endsOn = pattern.ends_on ? new Date(pattern.ends_on + "T23:59:59") : null;

  let day = startOfDay(from);
  const stop = startOfDay(addDays(until, 1));

  while (day < stop) {
    if (startsOn && day < startOfDay(startsOn)) {
      day = addDays(day, 1);
      continue;
    }
    if (endsOn && day > endsOn) break;

    const dow = day.getDay();
    let include = false;

    if (pattern.freq === "daily") {
      include = true;
    } else if (pattern.freq === "weekly") {
      include = (pattern.days_of_week ?? []).includes(dow);
    } else if (pattern.freq === "custom") {
      const n = pattern.every_n_days ?? 1;
      const base = startsOn ? startOfDay(startsOn) : startOfDay(from);
      const diffDays = Math.round((day.getTime() - base.getTime()) / 86_400_000);
      include = diffDays >= 0 && diffDays % n === 0;
    }

    if (include) {
      pushDayTimes(result, day, pattern.times, from, until);
    }
    day = addDays(day, 1);
  }

  return result;
}

function expandOnce(pattern: Pattern, from: Date, until: Date): Date[] {
  const result: Date[] = [];
  if (!pattern.anchor_date) return result;
  const day = new Date(pattern.anchor_date + "T00:00:00");
  pushDayTimes(result, day, pattern.times, from, until);
  return result;
}

function expandInterval(pattern: Pattern, from: Date, until: Date): Date[] {
  const result: Date[] = [];
  if (!pattern.anchor_date || !pattern.interval_unit || !pattern.interval_n) return result;

  const endsOn = pattern.ends_on ? new Date(pattern.ends_on + "T23:59:59") : null;
  const anchor = new Date(pattern.anchor_date + "T00:00:00");
  const stop = startOfDay(addDays(until, 1));

  // Walk forward in steps of (interval_n * unit) starting from anchor.
  // Hard cap iterations so a misconfigured pattern can't loop forever.
  const MAX_STEPS = 5000;
  for (let k = 0; k < MAX_STEPS; k++) {
    const day = addInterval(anchor, pattern.interval_unit, pattern.interval_n * k);
    if (day >= stop) break;
    if (endsOn && day > endsOn) break;
    if (day >= startOfDay(from)) {
      pushDayTimes(result, day, pattern.times, from, until);
    }
  }

  return result;
}

function addInterval(d: Date, unit: "days" | "months" | "years", n: number): Date {
  if (unit === "days") return addDays(d, n);
  if (unit === "months") return addMonths(d, n);
  return addYears(d, n);
}

function pushDayTimes(out: Date[], day: Date, times: string[], from: Date, until: Date) {
  const ymd = dateToYMD(day);
  for (const hhmm of times) {
    const local = `${ymd}T${hhmm}:00`;
    const utc = fromZonedTime(local, TZ);
    if (utc >= from && utc <= until) out.push(utc);
  }
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
