"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  type CalendarEvent,
  type CalendarGuest,
} from "@/lib/calendar/ics";

export function AddToCalendarButton({
  event,
  members,
  defaultGuests,
  className = "btn-ghost flex-1",
}: {
  event: Omit<CalendarEvent, "guests">;
  members?: CalendarGuest[];
  defaultGuests?: CalendarGuest[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Union of linked members and saved default guests (external emails included),
  // de-duplicated by email. Default guests keep the member's name when both exist.
  const allGuests = useMemo<CalendarGuest[]>(() => {
    const map = new Map<string, CalendarGuest>();
    for (const m of members ?? []) map.set(m.email, m);
    for (const g of defaultGuests ?? []) if (!map.has(g.email)) map.set(g.email, g);
    return [...map.values()];
  }, [members, defaultGuests]);

  const defaultEmails = useMemo(
    () => new Set((defaultGuests ?? []).map((g) => g.email)),
    [defaultGuests],
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultEmails));

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function guests(): CalendarGuest[] {
    return allGuests.filter((m) => selected.has(m.email));
  }

  function toggleGuest(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function openGoogle() {
    const url = buildGoogleCalendarUrl({ ...event, guests: guests() });
    window.open(url, "_blank", "noopener");
    setOpen(false);
  }

  function downloadIcs() {
    const content = buildIcsContent({ ...event, guests: guests() });
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(event.title) || "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        📅 הוספה ליומן
      </button>

      {open && (
        <div
          className="sheet-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="sheet flex flex-col gap-4">
            <div className="sheet-handle" aria-hidden />
            <h3 className="text-2xl font-bold">הוספה ליומן</h3>

            {allGuests.length > 0 && (
              <div className="subcard flex flex-col gap-2">
                <div className="text-sm font-semibold text-[var(--muted-strong)]">
                  הזמנת מוזמנים
                </div>
                {allGuests.map((m) => (
                  <label key={m.email} className="flex items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={selected.has(m.email)}
                      onChange={() => toggleGuest(m.email)}
                    />
                    <span className="break-words">{m.name || m.email}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button type="button" className="btn-primary" onClick={openGoogle}>
                Google Calendar
              </button>
              <button type="button" className="btn-secondary" onClick={downloadIcs}>
                הוסף ליומן Apple
              </button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function slug(s: string): string {
  return s
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
