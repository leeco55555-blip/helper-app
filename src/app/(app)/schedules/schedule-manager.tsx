"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { KIND_LABEL, KIND_EMOJI, ALL_KINDS } from "@/lib/schedules/kind-labels";

const DAYS_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const DAYS_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const UNIT_LABEL: Record<string, string> = {
  days: "ימים",
  months: "חודשים",
  years: "שנים",
};

type DefaultTimes = { morning: string; noon: string; evening: string };

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
    freq: "daily" | "weekly" | "custom" | "interval";
    days_of_week?: number[];
    times: string[];
    every_n_days?: number;
    interval_unit?: "days" | "months" | "years";
    interval_n?: number;
    anchor_date?: string;
  };
};

export function ScheduleManager({
  patientId,
  schedules,
  canEdit,
  defaultTimes,
}: {
  patientId: string;
  schedules: Schedule[];
  canEdit: boolean;
  defaultTimes: DefaultTimes;
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
          <p className="text-lg">אין תזכורות עדיין.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {schedules.map((s) => (
            <li key={s.id} className={`card-elevated ${!s.active ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 size-12 rounded-2xl bg-[var(--primary-soft)] flex items-center justify-center text-2xl"
                  aria-hidden
                >
                  {KIND_EMOJI[s.kind as keyof typeof KIND_EMOJI] ?? "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--muted)]">
                    {KIND_LABEL[s.kind as keyof typeof KIND_LABEL] ?? s.kind}
                  </div>
                  <div className="text-xl font-bold mt-0.5 break-words">{s.title}</div>
                  {s.dose_text && (
                    <div className="text-base text-[var(--muted)] mt-0.5 break-words">
                      {s.dose_text}
                    </div>
                  )}
                  <div className="text-[15px] mt-2 text-[var(--muted-strong)]">
                    {patternSummary(s.pattern)}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                  <button
                    className="btn-ghost flex-1"
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
            </li>
          ))}
        </ul>
      )}

      {open && (
        <ScheduleDialog
          patientId={patientId}
          schedule={editing}
          defaultTimes={defaultTimes}
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
  if (p.freq === "daily") return `כל יום • ${times}`;
  if (p.freq === "weekly") {
    const days = (p.days_of_week ?? []).map((d) => DAYS_FULL[d]).join(", ");
    return `${days} • ${times}`;
  }
  if (p.freq === "custom") return `כל ${p.every_n_days} ימים • ${times}`;
  if (p.freq === "interval") {
    const unit = UNIT_LABEL[p.interval_unit ?? "days"] ?? "";
    const n = p.interval_n ?? 1;
    const anchor = p.anchor_date ? ` • הבא: ${formatHebDate(p.anchor_date)}` : "";
    return `כל ${n} ${unit}${anchor} • ${times}`;
  }
  return times;
}

function formatHebDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger"
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

type Slot = "morning" | "noon" | "evening";

function ScheduleDialog({
  patientId,
  schedule,
  defaultTimes,
  onClose,
  onSaved,
}: {
  patientId: string;
  schedule: Schedule | null;
  defaultTimes: DefaultTimes;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<string>(schedule?.kind ?? "medication");
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [dose, setDose] = useState(schedule?.dose_text ?? "");
  const [unit, setUnit] = useState(schedule?.measurement_unit ?? "");
  const [valueCount, setValueCount] = useState(schedule?.measurement_value_count ?? 0);
  const [freq, setFreq] = useState<"daily" | "weekly" | "custom" | "interval">(
    schedule?.pattern.freq ?? "daily",
  );
  const [days, setDays] = useState<number[]>(
    schedule?.pattern.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
  );
  const [everyN, setEveryN] = useState<number>(schedule?.pattern.every_n_days ?? 2);
  const [intervalUnit, setIntervalUnit] = useState<"days" | "months" | "years">(
    schedule?.pattern.interval_unit ?? "months",
  );
  const [intervalN, setIntervalN] = useState<number>(schedule?.pattern.interval_n ?? 1);
  const [anchorDate, setAnchorDate] = useState<string>(
    schedule?.pattern.anchor_date ?? defaultAnchor(),
  );
  const [times, setTimes] = useState<string[]>(schedule?.pattern.times ?? [defaultTimes.morning]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMeasurement = kind === "measurement";

  function slotTime(slot: Slot): string {
    return defaultTimes[slot];
  }
  function slotActive(slot: Slot): boolean {
    return times.includes(slotTime(slot));
  }
  function toggleSlot(slot: Slot) {
    const t = slotTime(slot);
    if (times.includes(t)) {
      setTimes(times.filter((x) => x !== t));
    } else {
      setTimes([...times, t].sort());
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    if (freq === "interval" && !anchorDate) {
      setSaving(false);
      setError("בחר תאריך להפעם הקרובה");
      return;
    }
    if (times.length === 0) {
      setSaving(false);
      setError("יש לבחור לפחות שעה אחת");
      return;
    }
    const pattern: Schedule["pattern"] = {
      freq,
      times,
      ...(freq === "weekly" ? { days_of_week: days } : {}),
      ...(freq === "custom" ? { every_n_days: everyN } : {}),
      ...(freq === "interval"
        ? { interval_unit: intervalUnit, interval_n: intervalN, anchor_date: anchorDate }
        : {}),
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
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet flex flex-col gap-4">
        <div className="sheet-handle" aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-bold">
            {schedule ? "עריכת תזכורת" : "תזכורת חדשה"}
          </h3>
          <button onClick={onClose} className="btn-ghost" aria-label="סגירה">
            סגירה
          </button>
        </div>

        {/* Kind */}
        <div className="subcard">
          <label className="label">סוג</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  if (k === "measurement" && valueCount === 0) setValueCount(1);
                }}
                className="chip"
                data-active={kind === k}
              >
                <span aria-hidden>{KIND_EMOJI[k]}</span>
                <span>{KIND_LABEL[k]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title + dose */}
        <div className="subcard">
          <div>
            <label className="label">שם</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='למשל "אקמול" / "לחץ דם"'
            />
          </div>
          <div>
            <label className="label">מינון / פירוט (לא חובה)</label>
            <input
              className="input"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="למשל: 1 כדור, 10 דקות"
            />
          </div>
        </div>

        {isMeasurement && (
          <div className="subcard">
            <div>
              <label className="label">יחידת מידה</label>
              <input
                className="input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="mmHg / mg/dL / °C"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">מספר ערכים למדידה</label>
              <div className="flex gap-2">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setValueCount(n)}
                    className="chip flex-1"
                    data-active={valueCount === n}
                  >
                    {n === 1 ? "ערך יחיד" : "שני ערכים"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Frequency */}
        <div className="subcard">
          <label className="label">תדירות</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["daily", "כל יום"],
                ["weekly", "ימים בשבוע"],
                ["custom", "כל X ימים"],
                ["interval", "כל X חודשים/שנים"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFreq(f)}
                className="chip"
                data-active={freq === f}
              >
                {label}
              </button>
            ))}
          </div>

          {freq === "weekly" && (
            <div>
              <label className="label">ימים</label>
              <div className="flex gap-2 flex-wrap">
                {DAYS_SHORT.map((d, i) => {
                  const sel = days.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setDays(sel ? days.filter((x) => x !== i) : [...days, i].sort())
                      }
                      className="size-12 rounded-full text-base font-bold"
                      style={{
                        background: sel ? "var(--primary)" : "var(--surface)",
                        color: sel ? "var(--primary-foreground)" : "var(--foreground)",
                        border: sel ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                        boxShadow: sel ? "0 4px 12px rgba(45, 108, 223, 0.25)" : undefined,
                      }}
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

          {freq === "interval" && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">כל</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    className="input"
                    dir="ltr"
                    value={intervalN}
                    onChange={(e) => setIntervalN(Number(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="label">יחידה</label>
                  <select
                    className="input"
                    value={intervalUnit}
                    onChange={(e) => setIntervalUnit(e.target.value as "days" | "months" | "years")}
                  >
                    <option value="days">ימים</option>
                    <option value="months">חודשים</option>
                    <option value="years">שנים</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">התאריך הקרוב</label>
                <input
                  type="date"
                  className="input"
                  dir="ltr"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                />
                <p className="text-sm text-[var(--muted)] mt-2">
                  מהתאריך הזה האפליקציה תזכיר אוטומטית כל {intervalN} {UNIT_LABEL[intervalUnit]}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Times */}
        <div className="subcard">
          <label className="label">חלקי היום</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => toggleSlot("morning")}
              className="chip"
              data-active={slotActive("morning")}
            >
              <span aria-hidden>🌅</span> בוקר
              <span className="text-xs opacity-80">{defaultTimes.morning}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSlot("noon")}
              className="chip"
              data-active={slotActive("noon")}
            >
              <span aria-hidden>☀️</span> צהריים
              <span className="text-xs opacity-80">{defaultTimes.noon}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSlot("evening")}
              className="chip"
              data-active={slotActive("evening")}
            >
              <span aria-hidden>🌙</span> ערב
              <span className="text-xs opacity-80">{defaultTimes.evening}</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="label">שעות מדויקות</label>
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
              className="btn-ghost self-start"
              onClick={() => setTimes([...times, "20:00"].sort())}
            >
              + הוסף שעה
            </button>
          </div>
          <p className="text-sm text-[var(--muted)]">
            שינוי השעה ידנית מבטל את הצמדתה לחלק היום, ושומר את הערך הספציפי לתזכורת הזו בלבד.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 font-medium">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
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

function defaultAnchor(): string {
  // One year from today, formatted YYYY-MM-DD in local time.
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
