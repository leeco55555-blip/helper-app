import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { expandSchedule } from "@/lib/schedules/expand";

const Body = z.object({
  status: z.enum(["pending", "taken", "skipped"]),
  // Numbers for standard measurements; "HH:MM" strings for time-of-day checks.
  values: z.array(z.union([z.number(), z.string()])).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  const { status, values } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const update: Record<string, unknown> = { status };
  if (status === "taken") {
    update.taken_at = new Date().toISOString();
    update.taken_by_profile_id = user.id;
    if (values) update.measurement_values = values;
  } else {
    update.taken_at = null;
    update.taken_by_profile_id = null;
    if (status === "pending") update.measurement_values = null;
  }

  const { error } = await supabase
    .from("schedule_occurrences")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // For interval schedules (monthly/yearly etc.) the next occurrence may be
  // far in the future. After marking taken, ensure the following one exists.
  if (status === "taken") {
    try {
      const svc = createServiceClient();
      const { data: occ } = await svc
        .from("schedule_occurrences")
        .select("schedule_id, schedule:schedules(pattern)")
        .eq("id", id)
        .maybeSingle();
      const schedule = Array.isArray(occ?.schedule) ? occ?.schedule[0] : occ?.schedule;
      const pattern = schedule?.pattern as { freq?: string } | undefined;
      if (occ?.schedule_id && pattern?.freq === "interval") {
        await expandSchedule(occ.schedule_id);
      }
    } catch {
      // Roll-forward is best-effort; the main mark already succeeded.
    }
  }

  return NextResponse.json({ ok: true });
}
