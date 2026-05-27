import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  target_name: z.string().min(1),
  target_email: z.string().email().nullable().optional(),
  target_phone: z.string().nullable().optional(),
  proposed_role: z.enum(["admin", "editor", "viewer"]).optional(),
});

function newToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "פרטים לא תקינים" }, { status: 400 });
  const { target_name, target_email, target_phone, proposed_role } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const token = newToken();
  const svc = createServiceClient();
  const { error } = await svc.from("invitations").insert({
    kind: "family_to_patient",
    inviter_profile_id: user.id,
    patient_id: null,
    target_email: target_email ?? null,
    target_phone: target_phone ?? null,
    target_name,
    proposed_role: proposed_role ?? "admin",
    token,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ token });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = createServiceClient();
  const { data: inv } = await svc
    .from("invitations")
    .select("id, inviter_profile_id, kind")
    .eq("id", id)
    .maybeSingle();
  if (!inv || inv.inviter_profile_id !== user.id || inv.kind !== "family_to_patient") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  await svc.from("invitations").update({ status: "revoked" }).eq("id", id);
  return NextResponse.json({ ok: true });
}
