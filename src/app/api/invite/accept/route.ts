import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  if (!token) return NextResponse.redirect(new URL("/", req.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=/invite/${token}`, req.url));
  }

  const svc = createServiceClient();
  const { data: inv } = await svc
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();
  if (!inv) return NextResponse.redirect(new URL("/", req.url));
  if (new Date(inv.expires_at) < new Date()) {
    await svc.from("invitations").update({ status: "expired" }).eq("id", inv.id);
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (inv.kind === "patient_to_family" && inv.patient_id) {
    await svc.from("patient_members").upsert({
      patient_id: inv.patient_id,
      member_profile_id: user.id,
      role: inv.proposed_role ?? "viewer",
      invited_by: inv.inviter_profile_id,
    });
  } else if (inv.kind === "family_to_patient") {
    const { data: pat } = await svc
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (pat) {
      await svc.from("patient_members").upsert({
        patient_id: pat.id,
        member_profile_id: inv.inviter_profile_id,
        role: inv.proposed_role ?? "admin",
        invited_by: inv.inviter_profile_id,
      });
    }
  }

  await svc
    .from("invitations")
    .update({ status: "accepted", accepted_by_profile_id: user.id })
    .eq("id", inv.id);

  return NextResponse.redirect(new URL("/today", req.url));
}
