import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PatternSchema } from "@/lib/schedules/pattern";
import { expandSchedule } from "@/lib/schedules/expand";
import { getPatientRole, roleAtLeast } from "@/lib/schedules/access";

const Update = z.object({
  title: z.string().min(1).optional(),
  dose_text: z.string().nullable().optional(),
  measurement_unit: z.string().nullable().optional(),
  measurement_value_count: z.number().int().min(0).max(4).optional(),
  notes: z.string().nullable().optional(),
  pattern: PatternSchema.optional(),
  active: z.boolean().optional(),
});

async function checkAccess(scheduleId: string) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("schedules")
    .select("patient_id")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!row) return { ok: false as const, status: 404 };
  const role = await getPatientRole(row.patient_id);
  if (!roleAtLeast(role, "editor")) return { ok: false as const, status: 403 };
  return { ok: true as const, patient_id: row.patient_id };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await checkAccess(id);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: access.status });

  const parsed = Update.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc.from("schedules").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (parsed.data.pattern || parsed.data.active !== undefined) {
    // Wipe pending future occurrences and re-expand.
    await svc
      .from("schedule_occurrences")
      .delete()
      .eq("schedule_id", id)
      .eq("status", "pending")
      .gte("due_at", new Date().toISOString());
    await expandSchedule(id, { daysAhead: 7 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await checkAccess(id);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: access.status });

  const svc = createServiceClient();
  const { error } = await svc.from("schedules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
