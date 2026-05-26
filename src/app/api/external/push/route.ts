import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiToken } from "@/lib/auth/api-tokens";
import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push/send";

const Body = z.object({
  patient_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  occurrence_id: z.string().uuid().optional(),
  url: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await verifyApiToken(req, "push:send");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const { patient_id, title, body, occurrence_id, url } = parsed.data;

  const svc = createServiceClient();
  const { data: pat } = await svc.from("patients").select("profile_id").eq("id", patient_id).maybeSingle();
  if (!pat) return NextResponse.json({ error: "patient not found" }, { status: 404 });

  const result = await sendPushToProfile(pat.profile_id, {
    title,
    body,
    occurrence_id,
    url: url || "/today",
  });

  await svc.from("notification_log").insert({
    profile_id: pat.profile_id,
    occurrence_id: occurrence_id ?? null,
    trigger_source: "external",
    payload: { title, body },
    success: result.sent > 0,
  });

  return NextResponse.json(result);
}
