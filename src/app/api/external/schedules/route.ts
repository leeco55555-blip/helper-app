import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiToken } from "@/lib/auth/api-tokens";
import { createServiceClient } from "@/lib/supabase/server";
import { PatternSchema } from "@/lib/schedules/pattern";
import { expandSchedule } from "@/lib/schedules/expand";

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
  const auth = await verifyApiToken(req, "schedules:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = Create.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const body = parsed.data;

  const svc = createServiceClient();

  // The token is the authorization; still verify the patient exists so a bad
  // patient_id fails clearly rather than inserting an orphan schedule.
  const { data: pat } = await svc
    .from("patients")
    .select("id")
    .eq("id", body.patient_id)
    .maybeSingle();
  if (!pat) return NextResponse.json({ error: "patient not found" }, { status: 404 });

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
      created_by: null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await expandSchedule(data.id);
  return NextResponse.json({ id: data.id });
}
