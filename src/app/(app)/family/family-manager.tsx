"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Member = {
  role: "admin" | "editor" | "viewer";
  receive_reminders: boolean;
  joined_at: string;
  member: { id: string; full_name: string; phone: string | null };
};

type Invitation = {
  id: string;
  kind: "family_to_patient" | "patient_to_family";
  target_email: string | null;
  target_name: string | null;
  proposed_role: "admin" | "editor" | "viewer" | null;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

const ROLE_LABEL = {
  admin: "מנהל",
  editor: "עורך",
  viewer: "צופה",
} as const;

export function FamilyManager({
  patientId,
  isAdmin,
  currentUserId,
  members,
  pending,
}: {
  patientId: string;
  isAdmin: boolean;
  currentUserId: string;
  members: Member[];
  pending: Invitation[];
}) {
  const router = useRouter();
  const [openInvite, setOpenInvite] = useState(false);

  return (
    <>
      {isAdmin && (
        <button className="btn-primary w-full" onClick={() => setOpenInvite(true)}>
          + הזמנת בן משפחה
        </button>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-[var(--muted)]">בני משפחה</h2>
        {members.length === 0 ? (
          <div className="card text-center text-[var(--muted)] py-8">
            אין בני משפחה מקושרים עדיין.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((m) => (
              <li key={m.member.id} className="card flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-lg font-bold">{m.member.full_name || "—"}</div>
                  <div className="text-base text-[var(--muted)]">
                    {ROLE_LABEL[m.role]}
                    {m.member.phone ? ` · ${m.member.phone}` : ""}
                  </div>
                </div>
                {isAdmin && m.member.id !== currentUserId && (
                  <RoleButtons
                    patientId={patientId}
                    memberId={m.member.id}
                    currentRole={m.role}
                    onChange={() => router.refresh()}
                  />
                )}
                {m.member.id === currentUserId && (
                  <span className="text-sm text-[var(--muted)]">זה אתה</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--muted)]">הזמנות פתוחות</h2>
          <ul className="flex flex-col gap-3">
            {pending.map((p) => (
              <li key={p.id} className="card flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold truncate">
                    {p.target_name || p.target_email || "הזמנה"}
                  </div>
                  <div className="text-base text-[var(--muted)]">
                    {p.proposed_role ? ROLE_LABEL[p.proposed_role] : "מטופל"}
                  </div>
                </div>
                <CopyInviteLink token={p.token} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {openInvite && (
        <InviteDialog
          patientId={patientId}
          onClose={() => setOpenInvite(false)}
          onSaved={() => {
            setOpenInvite(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function RoleButtons({
  patientId,
  memberId,
  currentRole,
  onChange,
}: {
  patientId: string;
  memberId: string;
  currentRole: Member["role"];
  onChange: () => void;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  function change(newRole: Member["role"]) {
    start(async () => {
      await fetch(`/api/family/members`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patient_id: patientId, member_profile_id: memberId, role: newRole }),
      });
      onChange();
    });
  }
  function remove() {
    start(async () => {
      await fetch(`/api/family/members?patient=${patientId}&member=${memberId}`, {
        method: "DELETE",
      });
      onChange();
    });
  }
  return (
    <div className="flex flex-col gap-1">
      <select
        className="input"
        value={currentRole}
        disabled={pending}
        onChange={(e) => change(e.target.value as Member["role"])}
      >
        <option value="admin">מנהל</option>
        <option value="editor">עורך</option>
        <option value="viewer">צופה</option>
      </select>
      <button onClick={() => setConfirming(true)} disabled={pending} className="btn-ghost text-[var(--danger)] text-sm">
        הסרה
      </button>
      {confirming && (
        <ConfirmDialog
          title="להסיר את בן המשפחה?"
          message="הוא לא יוכל יותר לצפות בלוחות הזמנים של המטופל."
          confirmLabel="הסר"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            remove();
          }}
        />
      )}
    </div>
  );
}

function CopyInviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn-secondary"
      onClick={() => {
        const url = `${window.location.origin}/invite/${token}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "הועתק ✓" : "העתק קישור"}
    </button>
  );
}

function InviteDialog({
  patientId,
  onClose,
  onSaved,
}: {
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("editor");
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/family/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        target_email: email || null,
        target_name: name || null,
        proposed_role: role,
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
          <p>שלח את הקישור לבן המשפחה. הוא תקף ל-14 ימים.</p>
          <div className="input break-all" style={{ whiteSpace: "normal", height: "auto", padding: "0.75rem 1rem" }}>
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
          <h3 className="text-xl font-bold">הזמנת בן משפחה</h3>
          <button onClick={onClose} className="btn-ghost">סגירה</button>
        </div>
        <div>
          <label className="label">שם (לא חובה)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">אימייל (לא חובה)</label>
          <input className="input" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">תפקיד</label>
          <div className="grid grid-cols-3 gap-2">
            {(["admin", "editor", "viewer"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-3 rounded-2xl border text-base font-medium ${
                  role === r
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--surface)] border-[var(--border)]"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--muted)] mt-2">
            <strong>מנהל</strong> — מוסיף ומסיר בני משפחה. <strong>עורך</strong> — מסמן וכותב. <strong>צופה</strong> — קריאה בלבד.
          </p>
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
