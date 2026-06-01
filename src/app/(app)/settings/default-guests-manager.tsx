"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarGuest } from "@/lib/calendar/ics";

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

  // Linked members selected by default (their email is in the saved list).
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initial.filter((g) => memberEmails.has(g.email)).map((g) => g.email)),
  );
  // External guests = saved entries that aren't linked members.
  const [external, setExternal] = useState<CalendarGuest[]>(
    () => initial.filter((g) => !memberEmails.has(g.email)),
  );

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleMember(email: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function addExternal() {
    const email = newEmail.trim().toLowerCase();
    const name = newName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("כתובת אימייל לא תקינה");
      return;
    }
    if (memberEmails.has(email) || external.some((g) => g.email === email)) {
      setError("האימייל כבר ברשימה");
      return;
    }
    setError(null);
    setExternal([...external, { name: name || email, email }]);
    setNewName("");
    setNewEmail("");
  }

  function removeExternal(email: string) {
    setExternal(external.filter((g) => g.email !== email));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const guests: CalendarGuest[] = [
      ...members.filter((m) => checked.has(m.email)),
      ...external,
    ];
    const res = await fetch(`/api/patients/${patientId}/default-guests`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guests }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "שגיאה");
      return;
    }
    setMsg("נשמר.");
    router.refresh();
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
          />
          <button type="button" className="btn-secondary shrink-0" onClick={addExternal}>
            הוסף
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl bg-[var(--success-soft)] text-[var(--success)] px-4 py-3">
          {msg}
        </div>
      )}

      <button type="button" disabled={busy} className="btn-primary self-start" onClick={save}>
        {busy ? "..." : "שמירה"}
      </button>
    </div>
  );
}
