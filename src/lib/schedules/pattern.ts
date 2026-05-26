import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { addDays, startOfDay } from "date-fns";

export const PatternSchema = z.object({
  freq: z.enum(["daily", "weekly", "custom"]),
  days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1),
  every_n_days: z.number().int().min(1).optional(),
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
      const ymd = dateToYMD(day);
      for (const hhmm of pattern.times) {
        const local = `${ymd}T${hhmm}:00`;
        const utc = fromZonedTime(local, TZ);
        if (utc >= from && utc <= until) {
          result.push(utc);
        }
      }
    }
    day = addDays(day, 1);
  }

  return result;
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
