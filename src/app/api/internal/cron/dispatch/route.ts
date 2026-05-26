import { NextResponse } from "next/server";
import { addDays, addMinutes, subMinutes } from "date-fns";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push/send";
import { expandAllActiveForPatient } from "@/lib/schedules/expand";

/**
 * Called by n8n (or pg_cron) every minute.
 * - Sends push for occurrences due within +/- 2 minutes that haven't been reminded yet.
 * - Marks long-overdue (>60min) pending occurrences as "missed".
 * - Extends future occurrences daily by expanding active schedules out to 7 days.
 *
 * Auth: header `x-cron-secret: <CRON_SECRET>`.
 */

function checkAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-cron-secret") === secret;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return run();
}
export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return run();
}

async function run() {
  const svc = createServiceClient();
  const now = new Date();
  const windowStart = subMinutes(now, 2).toISOString();
  const windowEnd = addMinutes(now, 2).toISOString();

  const { data: due } = await svc
    .from("schedule_occurrences")
    .select("id, patient_id, due_at, schedule:schedules(title, dose_text), patient:patients(profile_id, display_name)")
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .gte("due_at", windowStart)
    .lte("due_at", windowEnd);

  let totalSent = 0;
  for (const occ of due ?? []) {
    const pat = occ.patient as unknown as { profile_id: string; display_name: string } | null;
    const sched = occ.schedule as unknown as { title: string; dose_text: string | null } | null;
    if (!pat || !sched) continue;

    const r = await sendPushToProfile(pat.profile_id, {
      title: sched.title,
      body: sched.dose_text || "הגיע הזמן",
      occurrence_id: occ.id,
      url: "/today",
    });
    totalSent += r.sent;

    // Notify family members who opted in
    const { data: members } = await svc
      .from("patient_members")
      .select("member_profile_id")
      .eq("patient_id", occ.patient_id)
      .eq("receive_reminders", true);
    for (const m of members ?? []) {
      await sendPushToProfile(m.member_profile_id, {
        title: `${sched.title} — ${pat.display_name}`,
        body: sched.dose_text || "הגיע הזמן",
        occurrence_id: occ.id,
        url: `/today?patient=${occ.patient_id}`,
      });
    }

    await svc
      .from("schedule_occurrences")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", occ.id);

    await svc.from("notification_log").insert({
      profile_id: pat.profile_id,
      occurrence_id: occ.id,
      trigger_source: "cron",
      payload: { title: sched.title, body: sched.dose_text },
      success: r.sent > 0,
    });
  }

  // Mark missed occurrences (older than 60min, still pending)
  const missedCutoff = subMinutes(now, 60).toISOString();
  const { data: missed } = await svc
    .from("schedule_occurrences")
    .update({ status: "missed" })
    .lt("due_at", missedCutoff)
    .eq("status", "pending")
    .select("id");

  // Daily window extension (cheap to run every minute thanks to upsert dedupe)
  // Limit to once every minute by checking minute %15 == 0 → reduce DB churn.
  let extended = 0;
  if (now.getMinutes() % 15 === 0) {
    const { data: patients } = await svc.from("patients").select("id");
    for (const p of patients ?? []) {
      const r = await expandAllActiveForPatient(p.id, 7).catch(() => ({ inserted: 0 }));
      extended += r.inserted;
    }
  }

  return NextResponse.json({
    sent: totalSent,
    missed: missed?.length ?? 0,
    extended,
    window: { start: windowStart, end: windowEnd },
  });
}
