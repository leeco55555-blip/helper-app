import { fromZonedTime } from "date-fns-tz";
import type { Pattern } from "@/lib/schedules/pattern";
import { todayYmd } from "@/lib/schedules/time-window";

const TZ = "Asia/Jerusalem";
const DEFAULT_DURATION_MS = 60 * 60 * 1000; // 1 hour for timed events
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export type CalendarGuest = { name: string; email: string };

export type CalendarEvent = {
  title: string;
  location?: string | null;
  notes?: string | null;
  pattern: Pattern;
  /** Schedule id when saved; a random UID is generated otherwise. */
  uid?: string;
  guests?: CalendarGuest[];
};

/**
 * Map a schedule pattern to an iCal RRULE body (without the "RRULE:" prefix).
 * Returns null for one-time events (no recurrence).
 */
export function patternToRRule(pattern: Pattern): string | null {
  const parts: string[] = [];

  switch (pattern.freq) {
    case "once":
      return null;
    case "daily":
      parts.push("FREQ=DAILY");
      break;
    case "weekly": {
      parts.push("FREQ=WEEKLY");
      const days = (pattern.days_of_week ?? [])
        .filter((d) => d >= 0 && d <= 6)
        .map((d) => BYDAY[d]);
      if (days.length) parts.push(`BYDAY=${days.join(",")}`);
      break;
    }
    case "custom":
      parts.push("FREQ=DAILY", `INTERVAL=${pattern.every_n_days ?? 1}`);
      break;
    case "interval": {
      const n = pattern.interval_n ?? 1;
      const unit = pattern.interval_unit ?? "days";
      const freq = unit === "months" ? "MONTHLY" : unit === "years" ? "YEARLY" : "DAILY";
      parts.push(`FREQ=${freq}`, `INTERVAL=${n}`);
      break;
    }
  }

  if (pattern.ends_on) {
    // Over-inclusive bound at end-of-day, matching the app's ends_on convention.
    const time = firstTime(pattern);
    parts.push(
      time
        ? `UNTIL=${formatUtcStamp(fromZonedTime(`${pattern.ends_on}T23:59:59`, TZ))}`
        : `UNTIL=${pattern.ends_on.replace(/-/g, "")}`,
    );
  }

  return parts.join(";");
}

/** Build a Google Calendar "render template" deeplink for the event. */
export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
  const { start, end, allDay } = resolveStart(ev.pattern);
  const dates = allDay
    ? `${formatDateOnly(start)}/${formatDateOnly(end)}`
    : `${formatUtcStamp(start)}/${formatUtcStamp(end)}`;

  const params: string[] = [
    "action=TEMPLATE",
    `text=${encodeURIComponent(ev.title)}`,
    `dates=${dates}`,
  ];
  if (ev.notes) params.push(`details=${encodeURIComponent(ev.notes)}`);
  if (ev.location) params.push(`location=${encodeURIComponent(ev.location)}`);

  const rrule = patternToRRule(ev.pattern);
  if (rrule) params.push(`recur=${encodeURIComponent(`RRULE:${rrule}`)}`);

  const guests = (ev.guests ?? []).map((g) => g.email).filter(Boolean);
  if (guests.length) params.push(`add=${encodeURIComponent(guests.join(","))}`);

  return `https://calendar.google.com/calendar/render?${params.join("&")}`;
}

/** Build a valid .ics (RFC 5545) file body for the event. */
export function buildIcsContent(ev: CalendarEvent): string {
  const { start, end, allDay } = resolveStart(ev.pattern);
  const uid = `${ev.uid ?? randomUid()}@helper-app`;
  const stamp = formatUtcStamp(nowOrFixed());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//helper-app//he//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
  ];

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(end)}`);
  } else {
    lines.push(`DTSTART:${formatUtcStamp(start)}`);
    lines.push(`DTEND:${formatUtcStamp(end)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
  if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
  if (ev.notes) lines.push(`DESCRIPTION:${escapeIcsText(ev.notes)}`);

  const rrule = patternToRRule(ev.pattern);
  if (rrule) lines.push(`RRULE:${rrule}`);

  for (const g of ev.guests ?? []) {
    if (!g.email) continue;
    const cn = escapeIcsText(g.name || g.email);
    lines.push(`ATTENDEE;CN=${cn};RSVP=TRUE:mailto:${g.email}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function firstTime(pattern: Pattern): string | undefined {
  return pattern.times?.[0];
}

/**
 * Resolve the event start/end instants. Times in the pattern are Asia/Jerusalem
 * wall-time; we convert to UTC exactly like pattern.ts's pushDayTimes(), so DST
 * is handled for free. When the pattern has no time, the event is all-day.
 */
function resolveStart(pattern: Pattern): { start: Date; end: Date; allDay: boolean } {
  const startYmd = pattern.anchor_date ?? pattern.starts_on ?? todayYmd();
  const time = firstTime(pattern);

  if (time) {
    const start = fromZonedTime(`${startYmd}T${time}:00`, TZ);
    return { start, end: new Date(start.getTime() + DEFAULT_DURATION_MS), allDay: false };
  }

  // All-day: DTEND is exclusive, so it points at the next calendar day.
  const start = parseUtcDate(startYmd);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, allDay: true };
}

/** Parse a YYYY-MM-DD into a UTC midnight Date (used only for all-day date math). */
function parseUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Basic UTC timestamp: YYYYMMDDTHHMMSSZ */
function formatUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

/** Date-only value: YYYYMMDD (UTC fields). */
function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Escape per RFC 5545: backslash first, then ; , and newlines. */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets per RFC 5545 (CRLF + single space). */
function foldLine(line: string): string {
  if (byteLength(line) <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const chBytes = byteLength(ch);
    // 74 to leave room for the leading space on continuation lines.
    if (curBytes + chBytes > 74) {
      out.push(cur);
      cur = ch;
      curBytes = chBytes;
    } else {
      cur += ch;
      curBytes += chBytes;
    }
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

function byteLength(s: string): number {
  // TextEncoder is available in modern browsers and Node 11+.
  return new TextEncoder().encode(s).length;
}

function randomUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${todayYmd()}-${Math.round(performance.now())}`;
}

/** DTSTAMP "now". Date.now via new Date() is fine here (runtime-only, not a workflow). */
function nowOrFixed(): Date {
  return new Date();
}
