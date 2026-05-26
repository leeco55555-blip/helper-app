import { NextResponse } from "next/server";
import { addDays, subHours } from "date-fns";
import { verifyApiToken } from "@/lib/auth/api-tokens";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyApiToken(req, "patients:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const svc = createServiceClient();
  const { data: pat } = await svc
    .from("patients")
    .select("id, display_name")
    .eq("id", id)
    .maybeSingle();
  if (!pat) return NextResponse.json({ error: "not found" }, { status: 404 });

  const from = subHours(new Date(), 24).toISOString();
  const until = addDays(new Date(), 1).toISOString();

  const { data: occs } = await svc
    .from("schedule_occurrences")
    .select("id, due_at, status, taken_at, measurement_values, schedule:schedules(title, kind, dose_text, measurement_unit)")
    .eq("patient_id", id)
    .gte("due_at", from)
    .lte("due_at", until)
    .order("due_at", { ascending: true });

  return NextResponse.json({ patient: pat, occurrences: occs ?? [] });
}
