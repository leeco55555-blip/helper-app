import { test, expect } from "@playwright/test";
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

  // Seed 3 schedules + 3 occurrences in different statuses.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(10, 0, 0, 0);

  async function seedSchedule(opts: {
    kind: "medication" | "exam" | "measurement";
    title: string;
    status: "taken" | "skipped" | "missed";
    minutesOffset?: number;
  }) {
    const { data: sched, error: sErr } = await admin
      .from("schedules")
      .insert({
        patient_id: patientId,
        kind: opts.kind,
        title: opts.title,
        pattern: { freq: "daily", times: ["10:00"] },
        created_by: userId,
      })
      .select("id")
      .single();
    if (sErr) throw sErr;
    const due = new Date(yesterday.getTime() + (opts.minutesOffset ?? 0) * 60_000);
    const { error: oErr } = await admin.from("schedule_occurrences").insert({
      schedule_id: sched.id,
      patient_id: patientId,
      due_at: due.toISOString(),
      status: opts.status,
      taken_at: opts.status === "taken" ? due.toISOString() : null,
      taken_by_profile_id: opts.status === "taken" ? userId : null,
    });
    if (oErr) throw oErr;
  }

  await seedSchedule({ kind: "medication", title: "אקמול", status: "taken" });
  await seedSchedule({
    kind: "exam",
    title: "בדיקת דם",
    status: "skipped",
    minutesOffset: 5,
  });
  await seedSchedule({
    kind: "measurement",
    title: "לחץ דם",
    status: "missed",
    minutesOffset: 10,
  });
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test("history page shows seeded items with status filter", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("אימייל").fill(TEST_EMAIL);
  await page.getByLabel("סיסמא").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await page.waitForURL(/\/today/);

  await page.goto("/history");

  // All three seeded items should be visible
  await expect(page.getByText("אקמול").first()).toBeVisible();
  await expect(page.getByText("בדיקת דם").first()).toBeVisible();
  await expect(page.getByText("לחץ דם").first()).toBeVisible();

  // Status pills render correctly
  await expect(page.getByText("✓ בוצע").first()).toBeVisible();
  await expect(page.getByText("✗ לא בוצע").first()).toBeVisible();
  await expect(page.getByText("⏰ פוספס").first()).toBeVisible();

  // Filter to "לא בוצע" → only skipped+missed remain (אקמול taken should disappear)
  await page.getByRole("button", { name: "לא בוצע", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("אקמול")).toHaveCount(0);
  await expect(page.getByText("בדיקת דם").first()).toBeVisible();
  await expect(page.getByText("לחץ דם").first()).toBeVisible();

  // Clear filters via "נקה מסננים"
  await page.getByRole("button", { name: "נקה מסננים" }).first().click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("אקמול").first()).toBeVisible();
});

test("today button label is 'לא בוצע' not 'דלג'", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("אימייל").fill(TEST_EMAIL);
  await page.getByLabel("סיסמא").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await page.waitForURL(/\/today/);

  // Seed a pending occurrence for *today* so the buttons are visible.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data: sched } = await admin
    .from("schedules")
    .insert({
      patient_id: patientId,
      kind: "medication",
      title: "כדור היום",
      pattern: { freq: "daily", times: ["10:00"] },
      created_by: userId,
    })
    .select("id")
    .single();
  const due = new Date();
  due.setHours(10, 0, 0, 0);
  await admin.from("schedule_occurrences").insert({
    schedule_id: sched!.id,
    patient_id: patientId,
    due_at: due.toISOString(),
    status: "pending",
  });

  await page.goto("/today");
  await expect(page.getByText("כדור היום")).toBeVisible();
  await expect(page.getByRole("button", { name: "דלג", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "לא בוצע", exact: true })).toBeVisible();
});
