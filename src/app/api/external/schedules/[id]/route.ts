import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiToken } from "@/lib/auth/api-tokens";
import { createServiceClient } from "@/lib/supabase/server";
import { PatternSchema } from "@/lib/schedules/pattern";
import { expandSchedule } from "@/lib/schedules/expand";

const Update = z.object({
  title: z.string().min(1).optional(),
  dose_text: z.string().nullable().optional(),
  measurement_unit: z.string().nullable().optional(),
  measurement_value_count: z.number().int().min(0).max(4).optional(),
  notes: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  pattern: PatternSchema.optional(),
  active: z.boolean().optional(),
});

async function scheduleExists(id: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("schedules").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyApiToken(req, "schedules:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (!(await scheduleExists(id))) {
    return NextResponse.json({ error: "schedule not found" }, { status: 404 });
  }

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
    await expandSchedule(id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyApiToken(req, "schedules:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  if (!(await scheduleExists(id))) {
    return NextResponse.json({ error: "schedule not found" }, { status: 404 });
  }

  const svc = createServiceClient();
  const { error } = await svc.from("schedules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
