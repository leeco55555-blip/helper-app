import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/auth/current-user";
import { AppHeader } from "@/components/app-header";
import { ChangePasswordForm } from "./change-password-form";
import { DefaultTimesForm } from "./default-times-form";
import { FamilySection } from "./family-section";
import { DefaultGuestsSection } from "./default-guests-section";
import { OccurrencesSkeleton } from "@/components/occurrences-skeleton";

type DefaultTimes = { morning: string; noon: string; evening: string };

const FALLBACK: DefaultTimes = { morning: "08:00", noon: "14:00", evening: "20:00" };

function parseDefaultTimes(raw: unknown): DefaultTimes {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (
      typeof o.morning === "string" &&
      typeof o.noon === "string" &&
      typeof o.evening === "string"
    ) {
      return { morning: o.morning, noon: o.noon, evening: o.evening };
    }
  }
  return FALLBACK;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="הגדרות" />
      <Suspense fallback={<OccurrencesSkeleton />}>
        <SettingsBody patientParam={sp.patient} />
      </Suspense>
    </main>
  );
}

async function SettingsBody({ patientParam }: { patientParam?: string }) {
  const supabase = await createClient();
  const uid = await currentUserId();
  if (!uid) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  // Email comes from auth.user — keep this single auth-user lookup since it's
  // not in `profiles`. Run it in parallel with the FamilySection's queries by
  // not awaiting separately; instead grab the email lazily here.
  const { data: { user } } = await supabase.auth.getUser();

  const defaultTimes = parseDefaultTimes(profile?.default_times);

  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-4">
      <div className="card flex flex-col gap-1">
        <div className="text-[var(--muted)] text-sm font-semibold">חשבון</div>
        <div className="text-xl font-bold break-words">{profile?.full_name ?? "—"}</div>
        <div className="text-base text-[var(--muted)] break-all">{user?.email}</div>
        <div className="text-base text-[var(--muted)]">
          {profile?.role_type === "patient" ? "מטופל" : "בן משפחה"}
        </div>
      </div>

      <DefaultTimesForm initial={defaultTimes} />

      <ChangePasswordForm />

      <FamilySection userId={uid} selectedPatientParam={patientParam} />

      <DefaultGuestsSection selectedPatientParam={patientParam} />
    </div>
  );
}
