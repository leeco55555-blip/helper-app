"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DefaultTimes = { morning: string; noon: string; evening: string };

export function DefaultTimesForm({ initial }: { initial: DefaultTimes }) {
  const router = useRouter();
  const [morning, setMorning] = useState(initial.morning);
  const [noon, setNoon] = useState(initial.noon);
  const [evening, setEvening] = useState(initial.evening);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        default_times: { morning, noon, evening },
      }),
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

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">שעות ברירת מחדל</h2>
        <p className="text-sm text-[var(--muted)] mt-1">
          השעות שייבחרו אוטומטית כשתסמן בוקר/צהריים/ערב ביצירת תזכורת.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <label className="label m-0 shrink-0 text-base">🌅 בוקר</label>
          <input
            type="time"
            className="input w-32"
            dir="ltr"
            value={morning}
            onChange={(e) => setMorning(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="label m-0 shrink-0 text-base">☀️ צהריים</label>
          <input
            type="time"
            className="input w-32"
            dir="ltr"
            value={noon}
            onChange={(e) => setNoon(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="label m-0 shrink-0 text-base">🌙 ערב</label>
          <input
            type="time"
            className="input w-32"
            dir="ltr"
            value={evening}
            onChange={(e) => setEvening(e.target.value)}
          />
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

      <button type="submit" disabled={busy} className="btn-primary self-start">
        {busy ? "..." : "שמירה"}
      </button>
    </form>
  );
}
