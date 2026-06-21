import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiToken } from "@/lib/auth/api-tokens";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  occurrence_id: z.string().uuid(),
  status: z.enum(["pending", "taken", "skipped"]),
  // Numbers for standard measurements; "HH:MM" strings for time-of-day checks.
  values: z.array(z.union([z.number(), z.string()])).optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await verifyApiToken(req, "occurrences:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const { occurrence_id, status, values, notes } = parsed.data;

  const update: Record<string, unknown> = { status };
  if (status === "taken") {
    update.taken_at = new Date().toISOString();
    if (values) update.measurement_values = values;
  } else {
    update.taken_at = null;
    if (status === "pending") update.measurement_values = null;
  }
  if (notes !== undefined) update.notes = notes;

  const svc = createServiceClient();
  const { error } = await svc.from("schedule_occurrences").update(update).eq("id", occurrence_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
