import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PatternSchema } from "@/lib/schedules/pattern";
import { expandSchedule } from "@/lib/schedules/expand";
import { getPatientRole, roleAtLeast } from "@/lib/schedules/access";

const Create = z.object({
  patient_id: z.string().uuid(),
  kind: z.enum(["medication", "measurement", "exam", "workout", "event"]),
  title: z.string().min(1),
  dose_text: z.string().optional().nullable(),
  measurement_unit: z.string().optional().nullable(),
  measurement_value_count: z.number().int().min(0).max(4).default(0),
  notes: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  pattern: PatternSchema,
});

export async function POST(req: Request) {
  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const role = await getPatientRole(body.patient_id);
  if (!roleAtLeast(role, "editor")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("schedules")
    .insert({
      patient_id: body.patient_id,
      kind: body.kind,
      title: body.title,
      dose_text: body.dose_text ?? null,
      measurement_unit: body.measurement_unit ?? null,
      measurement_value_count: body.measurement_value_count,
      notes: body.notes ?? null,
      location: body.location ?? null,
      pattern: body.pattern,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await expandSchedule(data.id);
  return NextResponse.json({ id: data.id });
}
