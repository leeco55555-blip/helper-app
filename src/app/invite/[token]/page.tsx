import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data: inv } = await svc
    .from("invitations")
    .select("id, kind, patient_id, target_name, target_email, proposed_role, status, expires_at, inviter_profile_id")
    .eq("token", token)
    .maybeSingle();

  if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="card max-w-md">
          <h1 className="text-2xl font-bold mb-3">ההזמנה לא בתוקף</h1>
          <p className="text-[var(--muted)]">ייתכן שפג תוקף ההזמנה או שהיא כבר נוצלה.</p>
          <Link href="/" className="btn-primary mt-4">חזרה</Link>
        </div>
      </main>
    );
  }

  const { data: inviter } = await svc
    .from("profiles")
    .select("full_name")
    .eq("id", inv.inviter_profile_id)
    .maybeSingle();
  const inviterName = inviter?.full_name ?? "";

  let patientName = "";
  if (inv.patient_id) {
    const { data: pat } = await svc
      .from("patients")
      .select("display_name")
      .eq("id", inv.patient_id)
      .maybeSingle();
    patientName = pat?.display_name ?? "";
  }

  // If user already signed in, accept immediately.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">הזמנה</h1>
          {inv.kind === "patient_to_family" ? (
            <p>הוזמנת להיות בן משפחה של <strong>{patientName}</strong> ע&quot;י {inviterName}.</p>
          ) : (
            <p>הוזמנת להירשם כמטופל. {inviterName} יחובר אליך כבן משפחה.</p>
          )}
          <form action="/api/invite/accept" method="POST">
            <input type="hidden" name="token" value={token} />
            <button className="btn-primary w-full">אישור</button>
          </form>
        </div>
      </main>
    );
  }

  const signupHref = `/signup?invite=${encodeURIComponent(token)}`;
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="card max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">הוזמנת לתזכורת</h1>
        {inv.kind === "patient_to_family" ? (
          <p>
            {inviterName ? `${inviterName} הזמין אותך ` : "הוזמנת "}
            להיות {inv.proposed_role === "admin" ? "מנהל" : inv.proposed_role === "editor" ? "עורך" : "צופה"} של {patientName || "מטופל"}.
          </p>
        ) : (
          <p>{inviterName} מבקש להוסיף אותך כמטופל באפליקציה.</p>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <Link href={signupHref} className="btn-primary w-full">יצירת חשבון</Link>
          <Link href={`/login?next=/invite/${token}`} className="btn-secondary w-full">כבר יש לי חשבון</Link>
        </div>
      </div>
    </main>
  );

  // unreachable
  redirect("/");
}
