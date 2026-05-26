import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  full_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  role_type: z.enum(["patient", "family"]),
  invite_token: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "פרטים לא תקינים" }, { status: 400 });
  }
  const { full_name, phone, role_type, invite_token } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const svc = createServiceClient();

  // Upsert profile
  const { error: profileErr } = await svc.from("profiles").upsert({
    id: user.id,
    full_name,
    phone: phone || null,
    role_type,
  });
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  let redirectTo = "/today";

  if (role_type === "patient") {
    // Create patient row
    const { data: existing } = await svc
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error: patErr } = await svc.from("patients").insert({
        profile_id: user.id,
        display_name: full_name,
      });
      if (patErr) {
        return NextResponse.json({ error: patErr.message }, { status: 500 });
      }
    }

    // If signing up via an invite (family member previously invited this patient),
    // accept the invite which links the inviter as a family member.
    if (invite_token) {
      await acceptInvite(svc, invite_token, user.id);
    }
    redirectTo = "/today";
  } else {
    // family
    if (invite_token) {
      await acceptInvite(svc, invite_token, user.id);
    }
  }

  return NextResponse.json({ ok: true, redirect: redirectTo });
}

async function acceptInvite(
  svc: ReturnType<typeof createServiceClient>,
  token: string,
  acceptingUserId: string,
): Promise<boolean> {
  const { data: inv } = await svc
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (!inv) return false;
  if (new Date(inv.expires_at) < new Date()) {
    await svc.from("invitations").update({ status: "expired" }).eq("id", inv.id);
    return false;
  }

  if (inv.kind === "patient_to_family") {
    // Patient invited a family member. Accepting user becomes family member.
    if (!inv.patient_id) return false;
    await svc.from("patient_members").upsert({
      patient_id: inv.patient_id,
      member_profile_id: acceptingUserId,
      role: inv.proposed_role ?? "viewer",
      invited_by: inv.inviter_profile_id,
    });
  } else {
    // family_to_patient: family member invited patient. Inviter becomes family member of accepting user.
    const { data: pat } = await svc
      .from("patients")
      .select("id")
      .eq("profile_id", acceptingUserId)
      .maybeSingle();
    if (!pat) return false;
    await svc.from("patient_members").upsert({
      patient_id: pat.id,
      member_profile_id: inv.inviter_profile_id,
      role: inv.proposed_role ?? "admin",
      invited_by: inv.inviter_profile_id,
    });
  }

  await svc
    .from("invitations")
    .update({ status: "accepted", accepted_by_profile_id: acceptingUserId })
    .eq("id", inv.id);
  return true;
}
