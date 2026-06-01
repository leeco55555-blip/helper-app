"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarGuest } from "@/lib/calendar/ics";

type Status = "idle" | "saving" | "saved" | "error";

export function DefaultGuestsManager({
  patientId,
  members,
  initial,
  canEdit,
}: {
  patientId: string;
  members: CalendarGuest[];
  initial: CalendarGuest[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const memberEmails = useMemo(() => new Set(members.map((m) => m.email)), [members]);

  // Linked people selected by default (their email is in the saved list).
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initial.filter((g) => memberEmails.has(g.email)).map((g) => g.email)),
  );
  // External guests = saved entries that aren't linked people.
  const [external, setExternal] = useState<CalendarGuest[]>(
    () => initial.filter((g) => !memberEmails.has(g.email)),
  );

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Track the latest save so a slow earlier request can't overwrite a newer one.
  const saveSeq = useRef(0);

  async function persist(nextChecked: Set<string>, nextExternal: CalendarGuest[]) {
    const seq = ++saveSeq.current;
    setStatus("saving");
    setError(null);
    const guests: CalendarGuest[] = [
      ...members.filter((m) => nextChecked.has(m.email)),
      ...nextExternal,
    ];
    let ok = false;
    let errMsg = "שגיאה";
    try {
      const res = await fetch(`/api/patients/${patientId}/default-guests`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guests }),
      });
      ok = res.ok;
      if (!ok) errMsg = (await res.json().catch(() => ({}))).error || "שגיאה";
    } catch {
      errMsg = "שגיאת רשת";
    }
    if (seq !== saveSeq.current) return; // a newer save superseded this one
    if (ok) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("error");
      setError(errMsg);
    }
  }

  function toggleMember(email: string) {
    const next = new Set(checked);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setChecked(next);
    persist(next, external);
  }

  function addExternal() {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setError("כתובת אימייל לא תקינה");
      return;
    }
    if (memberEmails.has(email) || external.some((g) => g.email === email)) {
      setStatus("error");
      setError("האימייל כבר ברשימה");
      return;
    }
    const next = [...external, { name: name || email, email }];
    setExternal(next);
    setNewName("");
    setNewEmail("");
    persist(checked, next);
  }

  function removeExternal(email: string) {
    const next = external.filter((g) => g.email !== email);
    setExternal(next);
    persist(checked, next);
  }

  if (!canEdit) {
    return (
      <div className="card text-[var(--muted)]">
        רק עורך או מנהל יכול לערוך את רשימת המוזמנים.
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-4">
      {members.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="label m-0">בני משפחה מקושרים</div>
          {members.map((m) => (
            <label key={m.email} className="flex items-center gap-2 text-base">
              <input
                type="checkbox"
                className="size-5"
                checked={checked.has(m.email)}
                onChange={() => toggleMember(m.email)}
              />
              <span className="break-words">
                {m.name}
                <span className="text-[var(--muted)] text-sm"> · {m.email}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="label m-0">אימיילים נוספים</div>
        {external.length > 0 && (
          <ul className="flex flex-col gap-2">
            {external.map((g) => (
              <li
                key={g.email}
                className="subcard flex items-center justify-between gap-2"
              >
                <span className="break-words min-w-0">
                  {g.name}
                  <span className="text-[var(--muted)] text-sm"> · {g.email}</span>
                </span>
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() => removeExternal(g.email)}
                >
                  הסר
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="שם (לא חובה)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="input flex-1"
            placeholder="email@example.com"
            dir="ltr"
            inputMode="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExternal()}
          />
          <button type="button" className="btn-secondary shrink-0" onClick={addExternal}>
            הוסף
          </button>
        </div>
      </div>

      <div className="min-h-6 text-sm">
        {status === "saving" && <span className="text-[var(--muted)]">שומר…</span>}
        {status === "saved" && <span className="text-[var(--success)]">נשמר ✓</span>}
        {status === "error" && <span className="text-[var(--danger)]">{error}</span>}
      </div>
    </div>
  );
}
