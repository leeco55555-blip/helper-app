// Measurement value helpers shared by the schedule form, the daily list,
// and history.
//
// Most home measurements are numeric (e.g. blood pressure 120/80 mmHg). Some
// instead ask for a clock time — e.g. the CPAP check "עד איזו שעה היית עם
// ה-CPAP בלילה הקודם?". Those are entered with the same <input type="time">
// UX used elsewhere in the app and stored verbatim as an "HH:MM" string in the
// existing `measurement_values` JSONB array. The sentinel lives in
// `measurement_unit`, so no schema change is needed.

export const TIME_MEASUREMENT_UNIT = "time";

export type MeasurementValue = number | string;

/** True when a schedule's measurement answer is a clock time ("HH:MM"). */
export function isTimeMeasurement(unit: string | null | undefined): boolean {
  return unit === TIME_MEASUREMENT_UNIT;
}

/**
 * Human-readable rendering of stored measurement values, or null when there is
 * nothing to show. Time values are already "HH:MM" and carry no unit suffix;
 * numeric values are only shown when a (real) unit is set — matching the
 * app's existing display gating.
 */
export function formatMeasurementValues(
  values: MeasurementValue[] | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (!values || values.length === 0) return null;
  if (isTimeMeasurement(unit)) return values.join(" / ");
  if (!unit) return null;
  return `${values.join(" / ")} ${unit}`;
}
