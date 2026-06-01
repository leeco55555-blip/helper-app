import Link from "next/link";
import { getAccessiblePatients } from "@/lib/schedules/access";
import { loadPatientMembers, loadDefaultGuests } from "@/lib/calendar/guests";
import { DefaultGuestsManager } from "./default-guests-manager";

export async function DefaultGuestsSection({
  userId,
  selectedPatientParam,
}: {
  userId: string;
  selectedPatientParam?: string;
}) {
  const patients = await getAccessiblePatients();
  if (patients.length === 0) return null;

  const selectedId =
    selectedPatientParam && patients.some((p) => p.id === selectedPatientParam)
      ? selectedPatientParam
      : patients[0].id;
  const selected = patients.find((p) => p.id === selectedId)!;
  const canEdit = selected.role !== "viewer";

  const [members, defaults] = await Promise.all([
    loadPatientMembers(selectedId, userId),
    loadDefaultGuests(selectedId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-1">
        <div className="text-[var(--muted)] text-sm font-semibold">יומן</div>
        <div className="text-xl font-bold">מוזמנים ברירת מחדל</div>
        <p className="text-sm text-[var(--muted)]">
          מי שייבחר כאן יסומן אוטומטית כשמוסיפים אירוע ליומן (Google / קובץ .ics).
        </p>
      </div>

      {patients.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/settings?patient=${p.id}`}
              className="chip"
              data-active={p.id === selected.id}
            >
              {p.display_name}
            </Link>
          ))}
        </div>
      )}

      <DefaultGuestsManager
        patientId={selectedId}
        members={members}
        initial={defaults}
        canEdit={canEdit}
      />
    </div>
  );
}
