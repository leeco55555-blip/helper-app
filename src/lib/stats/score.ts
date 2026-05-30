export type ScoreBand = {
  color: string;
  bg: string;
  message: string;
  label: string;
};

export function scoreBand(score: number): ScoreBand {
  if (score >= 90) {
    return {
      color: "var(--success, #16a34a)",
      bg: "color-mix(in oklab, var(--success, #16a34a) 14%, transparent)",
      label: "מצוין",
      message: "מצוין! הנכדים שלך גאים בך 💚",
    };
  }
  if (score >= 75) {
    return {
      color: "#65a30d",
      bg: "color-mix(in oklab, #65a30d 14%, transparent)",
      label: "טוב מאוד",
      message: "כמעט מושלם — עוד יום בריא עם סבא 💪",
    };
  }
  if (score >= 50) {
    return {
      color: "#ea580c",
      bg: "color-mix(in oklab, #ea580c 14%, transparent)",
      label: "אפשר יותר",
      message: "אפשר עוד קצת — הנכדים שלך מחכים 🙂",
    };
  }
  return {
    color: "var(--danger, #dc2626)",
    bg: "color-mix(in oklab, var(--danger, #dc2626) 14%, transparent)",
    label: "צריך לשפר",
    message: "בוא נשתפר יחד — כל כדור הוא עוד יום איתך ❤️",
  };
}
