export type Kind = "medication" | "measurement" | "exam" | "workout" | "event";

export const KIND_LABEL: Record<Kind, string> = {
  medication: "תרופה",
  measurement: "בדיקה ביתית",
  exam: "בדיקה רפואית",
  workout: "אימון",
  event: "אירוע",
};

export const KIND_EMOJI: Record<Kind, string> = {
  medication: "💊",
  measurement: "🩺",
  exam: "🧪",
  workout: "🏃",
  event: "📌",
};

export const ALL_KINDS: Kind[] = ["medication", "measurement", "exam", "workout", "event"];

export function labelOf(k: string): string {
  return KIND_LABEL[k as Kind] ?? k;
}

export function emojiOf(k: string): string {
  return KIND_EMOJI[k as Kind] ?? "📌";
}
