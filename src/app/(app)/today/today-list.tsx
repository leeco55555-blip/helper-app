"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL: Record<string, string> = {
  medication: "תרופה",
  measurement: "בדיקה ביתית",
  exam: "בדיקה רפואית",
  workout: "אימון",
};

const KIND_EMOJI: Record<string, string> = {
  medication: "💊",
  measurement: "🩺",
  exam: "🧪",
  workout: "🏃",
};

type Occurrence = {
  id: string;
  due_at: string;
  status: "pending" | "taken" | "skipped" | "missed";
  taken_at: string | null;
  measurement_values: number[] | null;
  notes: string | null;
  schedule: {
    id: string;
    title: string;
    kind: string;
    dose_text: string | null;
    measurement_unit: string | null;
    measurement_value_count: number;
  } | null;
};

export function TodayList({
  occurrences,
  patientId,
  canEdit,
  isSelf,
}: {
  occurrences: Occurrence[];
  patientId: string;
  canEdit: boolean;
  isSelf: boolean;
}) {
  if (occurrences.length === 0) {
    return (
      <div className="card text-center py-12 text-[var(--muted)]">
        <p className="text-lg">אין משימות להיום.</p>
        <p className="text-sm mt-2">תוכל להוסיף תזכורות חדשות במסך &quot;ניהול לו״ז&quot;.</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {occurrences.map((o) => (
        <OccurrenceCard key={o.id} occ={o} canEdit={canEdit} patientId={patientId} isSelf={isSelf} />
      ))}
    </ul>
  );
}

function OccurrenceCard({ occ, canEdit, patientId, isSelf }: { occ: Occurrence; canEdit: boolean; patientId: string; isSelf: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openMeasure, setOpenMeasure] = useState(false);
  const dueDate = new Date(occ.due_at);
  const time = new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dueDate);

  const isTaken = occ.status === "taken";
  const isSkipped = occ.status === "skipped";
  const k = occ.schedule?.kind ?? "medication";

  async function mark(status: "taken" | "skipped" | "pending", values?: number[]) {
    startTransition(async () => {
      const res = await fetch(`/api/occurrences/${occ.id}/mark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, values }),
      });
      if (!res.ok) {
        alert("שגיאה בעדכון");
        return;
      }
      router.refresh();
    });
  }

  const needsMeasurement = (occ.schedule?.measurement_value_count ?? 0) > 0;

  return (
    <li
      className={`card-elevated transition ${
        isTaken
          ? "bg-[var(--success-soft)]"
          : isSkipped
            ? "opacity-70"
            : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 size-14 rounded-2xl flex items-center justify-center text-3xl"
          style={{
            background: isTaken ? "rgba(19,122,74,0.12)" : "var(--primary-soft)",
          }}
          aria-hidden
        >
          {KIND_EMOJI[k] ?? "📌"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--muted)]">{KIND_LABEL[k] ?? k}</span>
            <span className="text-sm font-bold text-[var(--primary)]" dir="ltr">{time}</span>
          </div>
          <p className="text-xl font-bold mt-0.5 break-words">{occ.schedule?.title}</p>
          {occ.schedule?.dose_text && (
            <p className="text-base text-[var(--muted)] mt-0.5 break-words">{occ.schedule.dose_text}</p>
          )}
          {isTaken && occ.measurement_values && occ.schedule?.measurement_unit && (
            <p className="text-base mt-1 font-semibold">
              {occ.measurement_values.join(" / ")} {occ.schedule.measurement_unit}
            </p>
          )}
        </div>
      </div>

      {!isSelf && !isTaken && (
        <div className="mt-3">
          <RemindNowButton patientId={patientId} occurrenceId={occ.id} />
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 mt-4">
          {!isTaken && (
            <button
              type="button"
              disabled={pending}
              onClick={() => (needsMeasurement ? setOpenMeasure(true) : mark("taken"))}
              className="btn-primary flex-1"
            >
              {pending ? "..." : "בוצע ✓"}
            </button>
          )}
          {!isTaken && !isSkipped && (
            <button
              type="button"
              disabled={pending}
              onClick={() => mark("skipped")}
              className="btn-secondary"
            >
              דלג
            </button>
          )}
          {(isTaken || isSkipped) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => mark("pending")}
              className="btn-secondary flex-1"
            >
              ביטול
            </button>
          )}
        </div>
      )}

      {openMeasure && occ.schedule && (
        <MeasurementDialog
          schedule={occ.schedule}
          onClose={() => setOpenMeasure(false)}
          onSubmit={(values) => {
            setOpenMeasure(false);
            mark("taken", values);
          }}
        />
      )}
    </li>
  );
}

function RemindNowButton({ patientId, occurrenceId }: { patientId: string; occurrenceId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary w-full"
      disabled={pending || done}
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/reminders/push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ patient_id: patientId, occurrence_id: occurrenceId }),
          });
          if (res.ok) {
            setDone(true);
            setTimeout(() => setDone(false), 3000);
          } else {
            alert("שגיאה בשליחת התזכורת");
          }
        })
      }
    >
      {pending ? "שולח..." : done ? "נשלחה ✓" : "📣 תזכיר עכשיו"}
    </button>
  );
}

function MeasurementDialog({
  schedule,
  onClose,
  onSubmit,
}: {
  schedule: NonNullable<Occurrence["schedule"]>;
  onClose: () => void;
  onSubmit: (values: number[]) => void;
}) {
  const count = schedule.measurement_value_count;
  const [vals, setVals] = useState<string[]>(Array.from({ length: count }, () => ""));

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet flex flex-col gap-4">
        <div className="sheet-handle" aria-hidden />
        <h3 className="text-2xl font-bold">{schedule.title}</h3>
        <p className="text-[var(--muted)]">הזן את הערך{count > 1 ? "ים" : ""}.</p>
        <div className="flex gap-3">
          {vals.map((v, i) => (
            <div key={i} className="flex-1">
              <label className="label">
                {count === 2 ? (i === 0 ? "סיסטולי" : "דיאסטולי") : "ערך"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                className="input"
                dir="ltr"
                value={v}
                onChange={(e) => {
                  const next = [...vals];
                  next[i] = e.target.value;
                  setVals(next);
                }}
              />
            </div>
          ))}
        </div>
        {schedule.measurement_unit && (
          <p className="text-[var(--muted)]">יחידות: {schedule.measurement_unit}</p>
        )}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={vals.some((v) => v === "")}
            onClick={() => onSubmit(vals.map((v) => Number(v)))}
          >
            שמירה
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
