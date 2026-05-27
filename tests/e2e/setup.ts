import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase env vars for E2E setup");
}

export const TEST_EMAIL = `e2e+${Date.now()}@example.com`;
export const TEST_PASSWORD = "Test12345!";

export async function createTestPatient() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error("user not created");
  const userId = created.user.id;

  // Profile
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    full_name: "E2E Test User",
    role_type: "patient",
  });
  if (profErr) throw profErr;

  // Patient row
  const { data: patient, error: patientErr } = await admin
    .from("patients")
    .insert({
      profile_id: userId,
      display_name: "E2E Patient",
    })
    .select("id")
    .single();
  if (patientErr) throw patientErr;

  // Patient member: patient is admin of themself
  const { error: pmErr } = await admin.from("patient_members").insert({
    patient_id: patient.id,
    member_profile_id: userId,
    role: "admin",
    receive_reminders: true,
  });
  if (pmErr) throw pmErr;

  return { userId, patientId: patient.id };
}

export async function deleteTestUser(userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  await admin.auth.admin.deleteUser(userId);
}
