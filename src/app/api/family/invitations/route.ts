import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPatientRole, roleAtLeast } from "@/lib/schedules/access";

const Body = z.object({
  patient_id: z.string().uuid(),
  target_email: z.string().email().nullable().optional(),
  target_name: z.string().nullable().optional(),
  proposed_role: z.enum(["admin", "editor", "viewer"]),
});

function newToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });
  const { patient_id, target_email, target_name, proposed_role } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const role = await getPatientRole(patient_id);
  if (!roleAtLeast(role, "admin")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const token = newToken();
  const svc = createServiceClient();
  const { error } = await svc.from("invitations").insert({
    kind: "patient_to_family",
    inviter_profile_id: user.id,
    patient_id,
    target_email: target_email ?? null,
    target_name: target_name ?? null,
    proposed_role,
    token,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ token });
}
