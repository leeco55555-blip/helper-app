import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { ChangePasswordForm } from "./change-password-form";

export default async function SettingsPage() {
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

  return (
    <main className="flex-1 flex flex-col pb-24">
      <AppHeader title="הגדרות" />
      <div className="max-w-2xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        <div className="card flex flex-col gap-1">
          <div className="text-[var(--muted)] text-sm">חשבון</div>
          <div className="text-xl font-bold">{profile?.full_name ?? "—"}</div>
          <div className="text-base text-[var(--muted)] break-all">{user.email}</div>
          <div className="text-base text-[var(--muted)]">{profile?.role_type === "patient" ? "מטופל" : "בן משפחה"}</div>
        </div>

        <ChangePasswordForm />
      </div>
    </main>
  );
}
