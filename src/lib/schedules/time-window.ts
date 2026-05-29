import {
  addDays,
  addMonths,
  addWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";

const TZ = "Asia/Jerusalem";

/**
 * Difference (ms) between Jerusalem local time and UTC at the given instant.
 * Positive when JLM is ahead of UTC (i.e. summer time = +3h => 10_800_000).
 */
export function getJerusalemOffsetMs(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - d.getTime();
}

/** Convert a Jerusalem calendar date (YYYY-MM-DD) into UTC instants for that local day. */
function localCalendarRangeToUtc(
  startLocal: Date,
  endLocalExclusive: Date,
  reference: Date,
): { fromUtc: Date; toUtc: Date } {
  const offsetMs = getJerusalemOffsetMs(reference);
  return {
    fromUtc: new Date(startLocal.getTime() - offsetMs),
    toUtc: new Date(endLocalExclusive.getTime() - offsetMs),
  };
}

/** Parse a YYYY-MM-DD into a Date representing local-Jerusalem midnight (as a UTC value). */
export function parseYmdAsLocal(ymd: string): Date {
  // Interpret as a "naive" date at 00:00. Used only as a calendar anchor.
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Today's date (Jerusalem) as YYYY-MM-DD. */
export function todayYmd(): string {
  const now = new Date();
  const offset = getJerusalemOffsetMs(now);
  const local = new Date(now.getTime() + offset);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Tomorrow's date (Jerusalem) as YYYY-MM-DD. */
export function tomorrowYmd(): string {
  return shiftYmd(todayYmd(), "daily", 1);
}

export type Window = { fromUtc: Date; toUtc: Date; label: string };

export function dayWindow(ymd: string): Window {
  const anchor = parseYmdAsLocal(ymd);
  const end = new Date(anchor.getTime() + 24 * 3600 * 1000);
  const { fromUtc, toUtc } = localCalendarRangeToUtc(anchor, end, new Date());
  return { fromUtc, toUtc, label: formatHebDate(anchor) };
}

export function weekWindow(ymd: string): Window {
  const anchor = parseYmdAsLocal(ymd);
  // Sunday-start week (weekStartsOn: 0). Use UTC ops on the "naive" date.
  const dow = anchor.getUTCDay();
  const start = new Date(anchor.getTime() - dow * 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
  const { fromUtc, toUtc } = localCalendarRangeToUtc(start, end, new Date());
  const inclusiveEnd = new Date(end.getTime() - 24 * 3600 * 1000);
  return {
    fromUtc,
    toUtc,
    label: `${formatHebDate(start)} – ${formatHebDate(inclusiveEnd)}`,
  };
}

export function monthWindow(ymd: string): Window {
  const anchor = parseYmdAsLocal(ymd);
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  const { fromUtc, toUtc } = localCalendarRangeToUtc(start, end, new Date());
  const MONTHS_HE = [
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];
  return {
    fromUtc,
    toUtc,
    label: `${MONTHS_HE[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`,
  };
}

function formatHebDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/** Add/subtract one unit of the current view from `ymd`, returning a new YYYY-MM-DD. */
export function shiftYmd(ymd: string, view: "daily" | "weekly" | "monthly", dir: -1 | 1): string {
  const d = parseYmdAsLocal(ymd);
  let next: Date;
  if (view === "daily") next = addDays(d, dir);
  else if (view === "weekly") next = addWeeks(d, dir);
  else next = addMonths(d, dir);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Re-export a couple of date-fns helpers callers might want.
export { startOfWeek, endOfWeek, startOfMonth, endOfMonth };
