"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { OccurrenceRow, type HistoryOccurrence } from "./occurrence-row";
import { ALL_KINDS, KIND_LABEL, type Kind } from "@/lib/schedules/kind-labels";
import { shiftYmd, todayYmd } from "@/lib/schedules/time-window";

type View = "daily" | "weekly" | "monthly";
type StatusKey = "taken" | "not_done" | "pending";

const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: "taken", label: "בוצע" },
  { key: "not_done", label: "לא בוצע" },
  { key: "pending", label: "ממתין" },
];

const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function HistoryView({
  occurrences,
  view,
  date,
  rangeLabel,
  kinds,
  statuses,
  q,
}: {
  occurrences: HistoryOccurrence[];
  view: View;
  date: string;
  rangeLabel: string;
  kinds: Kind[];
  statuses: StatusKey[];
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(q);

  // Debounce search input → URL
  useEffect(() => {
    if (searchInput === q) return;
    const t = setTimeout(() => updateParam("q", searchInput || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateParam(key: string, value: string | null) {
    const p = new URLSearchParams(search.toString());
    if (value === null || value === "") p.delete(key);
    else p.set(key, value);
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  }

  function setView(v: View) {
    updateParam("view", v);
  }
  function setDate(d: string) {
    updateParam("date", d);
  }
  function toggleKind(k: Kind) {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    updateParam("kinds", next.length === 0 ? null : next.join(","));
  }
  function toggleStatus(s: StatusKey) {
    const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
    updateParam("statuses", next.length === 0 ? null : next.join(","));
  }
  function clearAllFilters() {
    const p = new URLSearchParams(search.toString());
    p.delete("kinds");
    p.delete("statuses");
    p.delete("q");
    setSearchInput("");
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  }

  const groups = useMemo(() => groupByDay(occurrences), [occurrences]);

  return (
    <div className="flex flex-col gap-4">
      {/* View toggle */}
      <div className="flex gap-2">
        {([
          ["daily", "יומי"],
          ["weekly", "שבועי"],
          ["monthly", "חודשי"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="chip flex-1"
            data-active={view === v}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary px-3"
          onClick={() => setDate(shiftYmd(date, view, -1))}
          aria-label="הקודם"
        >
          ‹
        </button>
        <div className="flex-1 text-center">
          <p className="text-base font-bold break-words">{rangeLabel}</p>
          {date !== todayYmd() && (
            <button
              type="button"
              className="text-sm text-[var(--primary)] font-semibold mt-0.5"
              onClick={() => setDate(todayYmd())}
            >
              חזרה להיום
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary px-3"
          onClick={() => setDate(shiftYmd(date, view, 1))}
          aria-label="הבא"
        >
          ›
        </button>
      </div>

      {/* Search */}
      <input
        type="search"
        className="input"
        placeholder="חיפוש בשם או מינון…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      {/* Kind filter */}
      <div>
        <div className="text-sm font-semibold text-[var(--muted-strong)] mb-2">
          סוג תזכורת
        </div>
        <div className="flex gap-2 flex-wrap">
          {ALL_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleKind(k)}
              className="chip"
              data-active={kinds.includes(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div>
        <div className="text-sm font-semibold text-[var(--muted-strong)] mb-2">סטטוס</div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleStatus(s.key)}
              className="chip"
              data-active={statuses.includes(s.key)}
            >
              {s.label}
            </button>
          ))}
          {(kinds.length > 0 || statuses.length > 0 || q) && (
            <button type="button" onClick={clearAllFilters} className="btn-ghost">
              נקה מסננים
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {occurrences.length === 0 ? (
        <div className="card text-center py-10 text-[var(--muted)] flex flex-col gap-3 items-center">
          <p className="text-lg">אין רישומים בטווח הזה.</p>
          {(kinds.length > 0 || statuses.length > 0 || q) && (
            <button onClick={clearAllFilters} className="btn-ghost">
              נקה מסננים
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.ymd} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-[var(--muted-strong)] px-1">
                {dayHeader(g.ymd)}
              </h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((o) => (
                  <OccurrenceRow key={o.id} occ={o} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Link href="/schedules" className="text-sm text-[var(--primary)] text-center mt-2">
        ניהול תזכורות »
      </Link>
    </div>
  );
}

function groupByDay(
  occurrences: HistoryOccurrence[],
): { ymd: string; items: HistoryOccurrence[] }[] {
  const buckets = new Map<string, HistoryOccurrence[]>();
  for (const o of occurrences) {
    const d = new Date(o.due_at);
    const ymd = jerusalemYmd(d);
    const arr = buckets.get(ymd) ?? [];
    arr.push(o);
    buckets.set(ymd, arr);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ymd, items]) => ({ ymd, items }));
}

function jerusalemYmd(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // YYYY-MM-DD
}

function dayHeader(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = DOW_HE[dt.getUTCDay()];
  return `יום ${dow}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
