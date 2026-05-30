import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { ChangePasswordForm } from "./change-password-form";
import { DefaultTimesForm } from "./default-times-form";
import { FamilySection } from "./family-section";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const defaultTimes = parseDefaultTimes(profile?.default_times);
  const sp = await searchParams;

  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="הגדרות" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-4">
        <div className="card flex flex-col gap-1">
          <div className="text-[var(--muted)] text-sm font-semibold">חשבון</div>
          <div className="text-xl font-bold break-words">{profile?.full_name ?? "—"}</div>
          <div className="text-base text-[var(--muted)] break-all">{user.email}</div>
          <div className="text-base text-[var(--muted)]">
            {profile?.role_type === "patient" ? "מטופל" : "בן משפחה"}
          </div>
        </div>

        <DefaultTimesForm initial={defaultTimes} />

        <ChangePasswordForm />

        <FamilySection userId={user.id} selectedPatientParam={sp.patient} />
      </div>
    </main>
  );
}
