import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPatientRole, roleAtLeast } from "@/lib/schedules/access";

const Patch = z.object({
  patient_id: z.string().uuid(),
  member_profile_id: z.string().uuid(),
  role: z.enum(["admin", "editor", "viewer"]),
});

export async function PATCH(req: Request) {
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const { patient_id, member_profile_id, role } = parsed.data;

  if (!roleAtLeast(await getPatientRole(patient_id), "admin")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("patient_members")
    .update({ role })
    .eq("patient_id", patient_id)
    .eq("member_profile_id", member_profile_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const patient_id = url.searchParams.get("patient");
  const member = url.searchParams.get("member");
  if (!patient_id || !member) return NextResponse.json({ error: "missing" }, { status: 400 });

  if (!roleAtLeast(await getPatientRole(patient_id), "admin")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  // Don't allow removing yourself if you're the only admin? skip MVP edge.
  const svc = createServiceClient();
  const { error } = await svc
    .from("patient_members")
    .delete()
    .eq("patient_id", patient_id)
    .eq("member_profile_id", member);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
