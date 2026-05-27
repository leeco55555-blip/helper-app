import { test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  createTestPatient,
  deleteTestUser,
  TEST_EMAIL,
  TEST_PASSWORD,
} from "./setup";

let userId: string;
let patientId: string;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.beforeAll(async () => {
  const r = await createTestPatient();
  userId = r.userId;
  patientId = r.patientId;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 2 schedules: one will be taken, one pending.
  for (const cfg of [
    { title: "אקמול", status: "taken" as const, hour: 8 },
    { title: "כדור כולסטרול", status: "pending" as const, hour: 21 },
    { title: "ויטמין D", status: "taken" as const, hour: 14 },
  ]) {
    const { data: sched } = await admin
      .from("schedules")
      .insert({
        patient_id: patientId,
        kind: "medication",
        title: cfg.title,
        dose_text: "1 כדור",
        pattern: { freq: "daily", times: [`${cfg.hour}:00`] },
        created_by: userId,
      })
      .select("id")
      .single();
    const due = new Date();
    due.setHours(cfg.hour, 0, 0, 0);
    await admin.from("schedule_occurrences").insert({
      schedule_id: sched!.id,
      patient_id: patientId,
      due_at: due.toISOString(),
      status: cfg.status,
      taken_at: cfg.status === "taken" ? due.toISOString() : null,
      taken_by_profile_id: cfg.status === "taken" ? userId : null,
    });
  }
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test("screenshot today with mixed taken/pending", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("אימייל").fill(TEST_EMAIL);
  await page.getByLabel("סיסמא").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await page.waitForURL(/\/today/);
  await page.goto("/today");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/08-today-compact-taken.png", fullPage: true });
});
