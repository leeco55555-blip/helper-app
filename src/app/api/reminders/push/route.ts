import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPatientRole, roleAtLeast } from "@/lib/schedules/access";
import { sendPushToProfile } from "@/lib/push/send";

const Body = z.object({
  patient_id: z.string().uuid(),
  occurrence_id: z.string().uuid().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const { patient_id, occurrence_id, title, body } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  if (!roleAtLeast(await getPatientRole(patient_id), "viewer")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const svc = createServiceClient();
  const { data: pat } = await svc
    .from("patients")
    .select("profile_id, display_name")
    .eq("id", patient_id)
    .single();
  if (!pat) return NextResponse.json({ error: "not found" }, { status: 404 });

  let pushTitle = title || "תזכורת";
  let pushBody = body || "הגיע הזמן לתרופה";

  if (occurrence_id) {
    const { data: occ } = await svc
      .from("schedule_occurrences")
      .select("schedule:schedules(title, dose_text)")
      .eq("id", occurrence_id)
      .single();
    const sched = occ?.schedule as unknown as { title: string; dose_text: string | null } | undefined;
    if (sched) {
      pushTitle = sched.title;
      pushBody = sched.dose_text || "הגיע הזמן";
    }
  }

  const result = await sendPushToProfile(pat.profile_id, {
    title: pushTitle,
    body: pushBody,
    occurrence_id,
    url: "/today",
  });

  await svc.from("notification_log").insert({
    profile_id: pat.profile_id,
    occurrence_id: occurrence_id ?? null,
    trigger_source: "manual",
    payload: { title: pushTitle, body: pushBody, sent_by: user.id },
    success: result.sent > 0,
  });

  return NextResponse.json(result);
}
