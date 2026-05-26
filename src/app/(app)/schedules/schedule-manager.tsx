"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL: Record<string, string> = {
  medication: "תרופה",
  injection: "זריקה",
  measurement: "בדיקה",
  exam: "בדיקה רפואית",
  workout: "אימון",
};

const DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

type Schedule = {
  id: string;
  kind: string;
  title: string;
  dose_text: string | null;
  measurement_unit: string | null;
  measurement_value_count: number;
  notes: string | null;
  active: boolean;
  pattern: {
    freq: "daily" | "weekly" | "custom";
    days_of_week?: number[];
    times: string[];
    every_n_days?: number;
  };
};

export function ScheduleManager({
  patientId,
  schedules,
  canEdit,
}: {
  patientId: string;
  schedules: Schedule[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const router = useRouter();

  return (
    <>
      {canEdit && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          + הוספת תזכורת חדשה
        </button>
      )}

      {schedules.length === 0 ? (
        <div className="card text-center py-12 text-[var(--muted)]">
          <p>אין תזכורות עדיין.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {schedules.map((s) => (
            <li key={s.id} className={`card ${!s.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--muted)]">
                    {KIND_LABEL[s.kind] ?? s.kind}
                  </div>
                  <div className="text-xl font-bold mt-0.5">{s.title}</div>
                  {s.dose_text && <div className="text-base text-[var(--muted)]">{s.dose_text}</div>}
                  <div className="text-base mt-2">
                    {patternSummary(s.pattern)}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-2">
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      עריכה
                    </button>
                    <DeleteButton id={s.id} onDone={() => router.refresh()} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <ScheduleDialog
          patientId={patientId}
          schedule={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function patternSummary(p: Schedule["pattern"]): string {
  const times = p.times.join(", ");
  if (p.freq === "daily") return `כל יום בשעות: ${times}`;
  if (p.freq === "weekly") {
    const days = (p.days_of_week ?? []).map((d) => DAYS[d]).join(", ");
    return `ימים: ${days} בשעות: ${times}`;
  }
  return `כל ${p.every_n_days} ימים בשעות: ${times}`;
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-ghost text-[var(--danger)]"
      disabled={pending}
      onClick={() => {
        if (!confirm("למחוק תזכורת זו?")) return;
        start(async () => {
          await fetch(`/api/schedules/${id}`, { method: "DELETE" });
          onDone();
        });
      }}
    >
      מחיקה
    </button>
  );
}

function ScheduleDialog({
  patientId,
  schedule,
  onClose,
  onSaved,
}: {
  patientId: string;
  schedule: Schedule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<string>(schedule?.kind ?? "medication");
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [dose, setDose] = useState(schedule?.dose_text ?? "");
  const [unit, setUnit] = useState(schedule?.measurement_unit ?? "");
  const [valueCount, setValueCount] = useState(schedule?.measurement_value_count ?? 0);
  const [freq, setFreq] = useState<"daily" | "weekly" | "custom">(
    schedule?.pattern.freq ?? "daily",
  );
  const [days, setDays] = useState<number[]>(schedule?.pattern.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]);
  const [everyN, setEveryN] = useState<number>(schedule?.pattern.every_n_days ?? 2);
  const [times, setTimes] = useState<string[]>(schedule?.pattern.times ?? ["08:00"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMeasurement = kind === "measurement";

  async function save() {
    setSaving(true);
    setError(null);
    const pattern = {
      freq,
      times,
      ...(freq === "weekly" ? { days_of_week: days } : {}),
      ...(freq === "custom" ? { every_n_days: everyN } : {}),
    };
    const body = {
      patient_id: patientId,
      kind,
      title,
      dose_text: dose || null,
      measurement_unit: isMeasurement ? unit || null : null,
      measurement_value_count: isMeasurement ? valueCount : 0,
      pattern,
    };
    const res = schedule
      ? await fetch(`/api/schedules/${schedule.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            dose_text: body.dose_text,
            measurement_unit: body.measurement_unit,
            measurement_value_count: body.measurement_value_count,
            pattern,
          }),
        })
      : await fetch(`/api/schedules`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "שגיאה");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[var(--surface)] rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{schedule ? "עריכת תזכורת" : "תזכורת חדשה"}</h3>
          <button onClick={onClose} className="btn-ghost">סגירה</button>
        </div>

        <div>
          <label className="label">סוג</label>
          <div className="grid grid-cols-3 gap-2">
            {(["medication", "injection", "measurement", "exam", "workout"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  if (k === "measurement" && valueCount === 0) setValueCount(1);
                }}
                className={`py-3 rounded-2xl border text-base font-medium ${
                  kind === k
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--surface)] border-[var(--border)]"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">שם</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='למשל "אקמול" / "לחץ דם" / "הליכה"' />
        </div>

        <div>
          <label className="label">מינון / פירוט (לא חובה)</label>
          <input className="input" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="למשל: 1 כדור, 10 דקות" />
        </div>

        {isMeasurement && (
          <>
            <div>
              <label className="label">יחידת מידה</label>
              <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mmHg / mg/dL / °C" dir="ltr" />
            </div>
            <div>
              <label className="label">מספר ערכים למדידה</label>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setValueCount(n)}
                    className={`flex-1 py-3 rounded-2xl border text-base font-medium ${
                      valueCount === n
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "bg-[var(--surface)] border-[var(--border)]"
                    }`}
                  >
                    {n === 1 ? "ערך יחיד" : "שני ערכים (לחץ דם)"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="label">תדירות</label>
          <div className="flex gap-2">
            {(["daily", "weekly", "custom"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFreq(f)}
                className={`flex-1 py-3 rounded-2xl border text-base font-medium ${
                  freq === f
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--surface)] border-[var(--border)]"
                }`}
              >
                {f === "daily" ? "כל יום" : f === "weekly" ? "בימים מסוימים" : "כל X ימים"}
              </button>
            ))}
          </div>
        </div>

        {freq === "weekly" && (
          <div>
            <label className="label">ימים</label>
            <div className="flex gap-2">
              {DAYS.map((d, i) => {
                const sel = days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setDays(sel ? days.filter((x) => x !== i) : [...days, i].sort())
                    }
                    className={`size-12 rounded-full text-base font-bold border ${
                      sel
                        ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                        : "bg-[var(--surface)] border-[var(--border)]"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {freq === "custom" && (
          <div>
            <label className="label">כל כמה ימים?</label>
            <input
              type="number"
              min={1}
              max={365}
              className="input"
              dir="ltr"
              value={everyN}
              onChange={(e) => setEveryN(Number(e.target.value) || 1)}
            />
          </div>
        )}

        <div>
          <label className="label">שעות</label>
          <div className="flex flex-col gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="time"
                  className="input flex-1"
                  dir="ltr"
                  value={t}
                  onChange={(e) => {
                    const next = [...times];
                    next[i] = e.target.value;
                    setTimes(next);
                  }}
                />
                {times.length > 1 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setTimes(times.filter((_, idx) => idx !== i))}
                  >
                    הסר
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setTimes([...times, "20:00"])}
            >
              + הוסף שעה
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={saving || !title.trim() || times.length === 0}
            onClick={save}
          >
            {saving ? "שומר..." : "שמירה"}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
