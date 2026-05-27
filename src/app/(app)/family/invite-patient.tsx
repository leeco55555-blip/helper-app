"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PendingInvite = {
  id: string;
  target_name: string | null;
  target_email: string | null;
  target_phone: string | null;
  token: string;
  expires_at: string;
};

export function InvitePatientSection({ pending }: { pending: PendingInvite[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <button className="btn-primary w-full" onClick={() => setOpen(true)}>
        + הזמנת מטופל
      </button>

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--muted)]">הזמנות פתוחות</h2>
          <ul className="flex flex-col gap-3">
            {pending.map((p) => (
              <PendingRow key={p.id} invite={p} onChange={() => router.refresh()} />
            ))}
          </ul>
        </section>
      )}

      {open && (
        <InviteDialog
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PendingRow({ invite, onChange }: { invite: PendingInvite; onChange: () => void }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${window.location.origin}/invite/${invite.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function cancel() {
    if (!confirm("לבטל את ההזמנה?")) return;
    start(async () => {
      await fetch(`/api/family/invite-patient?id=${invite.id}`, { method: "DELETE" });
      onChange();
    });
  }

  return (
    <li className="card flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold truncate">{invite.target_name || "מטופל"}</div>
        <div className="text-base text-[var(--muted)] truncate">
          {invite.target_email || invite.target_phone || "אין פרטי קשר"}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <button className="btn-secondary" onClick={copy}>
          {copied ? "הועתק ✓" : "העתק קישור"}
        </button>
        <button onClick={cancel} disabled={pending} className="btn-ghost text-[var(--danger)] text-sm">
          ביטול
        </button>
      </div>
    </li>
  );
}

function InviteDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("חובה לתת שם למטופל");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/family/invite-patient", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_name: name.trim(),
        target_email: email.trim() || null,
        target_phone: phone.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "שגיאה");
      return;
    }
    const j = await res.json();
    setLink(`${window.location.origin}/invite/${j.token}`);
  }

  if (link) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl p-6 flex flex-col gap-4">
          <h3 className="text-xl font-bold">קישור הזמנה</h3>
          <p>שלח את הקישור למטופל. הוא יירשם וייקשר אליך אוטומטית. תקף ל-14 ימים.</p>
          <div
            className="input break-all"
            style={{ whiteSpace: "normal", height: "auto", padding: "0.75rem 1rem" }}
          >
            {link}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(link);
              onSaved();
            }}
          >
            העתק וסיום
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">הזמנת מטופל</h3>
          <button onClick={onClose} className="btn-ghost">
            סגירה
          </button>
        </div>
        <p className="text-base text-[var(--muted)]">
          המטופל יקבל קישור הרשמה. ברגע שיירשם, תהפוך אוטומטית למנהל שלו ותוכל לנהל לו את הלו״ז.
        </p>
        <div>
          <label className="label">שם המטופל</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמא: סבתא רחל"
          />
        </div>
        <div>
          <label className="label">אימייל (לא חובה)</label>
          <input
            className="input"
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">טלפון (לא חובה)</label>
          <input
            className="input"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05X-XXXXXXX"
          />
        </div>
        {error && (
          <div className="rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3">{error}</div>
        )}
        <button className="btn-primary" disabled={saving} onClick={submit}>
          {saving ? "..." : "צור קישור הזמנה"}
        </button>
      </div>
    </div>
  );
}
