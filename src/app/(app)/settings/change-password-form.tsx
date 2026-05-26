"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (pw !== confirm) {
      setError("הסיסמאות לא תואמות");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setMsg("הסיסמא שונתה.");
      setPw("");
      setConfirm("");
    }
  }
  return (
    <form onSubmit={submit} className="card flex flex-col gap-3">
      <h2 className="text-lg font-bold">החלפת סיסמא</h2>
      <div>
        <label className="label">סיסמא חדשה</label>
        <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div>
        <label className="label">אימות</label>
        <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <div className="rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3">{error}</div>}
      {msg && <div className="rounded-xl bg-[var(--success-soft)] text-[var(--success)] px-4 py-3">{msg}</div>}
      <button type="submit" disabled={busy || !pw} className="btn-primary">
        {busy ? "..." : "שמירה"}
      </button>
    </form>
  );
}
