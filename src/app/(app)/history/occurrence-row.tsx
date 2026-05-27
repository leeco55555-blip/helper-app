import { KIND_LABEL, KIND_EMOJI } from "@/lib/schedules/kind-labels";

export type HistoryOccurrence = {
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

const TIME_FMT = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_PILL: Record<
  HistoryOccurrence["status"],
  { label: string; bg: string; fg: string }
> = {
  taken: { label: "✓ בוצע", bg: "var(--success-soft)", fg: "var(--success)" },
  skipped: { label: "✗ לא בוצע", bg: "var(--surface-muted)", fg: "var(--muted-strong)" },
  missed: { label: "⏰ פוספס", bg: "var(--warning-soft)", fg: "var(--warning)" },
  pending: { label: "⏳ ממתין", bg: "var(--surface-muted)", fg: "var(--muted)" },
};

export function OccurrenceRow({ occ }: { occ: HistoryOccurrence }) {
  const dueDate = new Date(occ.due_at);
  const dueLabel = TIME_FMT.format(dueDate);
  const pill = STATUS_PILL[occ.status];
  const k = occ.schedule?.kind ?? "medication";

  const takenAt = occ.taken_at ? new Date(occ.taken_at) : null;
  const takenLate =
    takenAt && Math.abs(takenAt.getTime() - dueDate.getTime()) > 30 * 60 * 1000;

  return (
    <li className="card-elevated">
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 size-12 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "var(--primary-soft)" }}
          aria-hidden
        >
          {KIND_EMOJI[k as keyof typeof KIND_EMOJI] ?? "📌"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--muted)]">
              {KIND_LABEL[k as keyof typeof KIND_LABEL] ?? k}
            </span>
            <span className="text-sm font-bold text-[var(--primary)]" dir="ltr">
              {dueLabel}
            </span>
          </div>
          <p className="text-lg font-bold mt-0.5 break-words">{occ.schedule?.title}</p>
          {occ.schedule?.dose_text && (
            <p className="text-base text-[var(--muted)] mt-0.5 break-words">
              {occ.schedule.dose_text}
            </p>
          )}
          {occ.status === "taken" &&
            occ.measurement_values &&
            occ.schedule?.measurement_unit && (
              <p className="text-base mt-1 font-semibold">
                {occ.measurement_values.join(" / ")} {occ.schedule.measurement_unit}
              </p>
            )}
          {takenLate && (
            <p className="text-xs text-[var(--muted)] mt-1" dir="ltr">
              {TIME_FMT.format(takenAt!)} :סומן ב
            </p>
          )}
        </div>
        <span
          className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap"
          style={{ background: pill.bg, color: pill.fg }}
        >
          {pill.label}
        </span>
      </div>
    </li>
  );
}
