import { test, expect } from "@playwright/test";
import {
  createTestPatient,
  deleteTestUser,
  TEST_EMAIL,
  TEST_PASSWORD,
} from "./setup";

let testUserId: string;

test.beforeAll(async () => {
  const r = await createTestPatient();
  testUserId = r.userId;
});

test.afterAll(async () => {
  if (testUserId) await deleteTestUser(testUserId);
});

test("login → schedules form has new features", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("אימייל").fill(TEST_EMAIL);
  await page.getByLabel("סיסמא").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();

  await page.waitForURL(/\/today/);
  await expect(page.getByRole("heading", { name: "היום" })).toBeVisible();

  // Settings: default times form is present
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "שעות ברירת מחדל" })).toBeVisible();
  await expect(page.getByText(/🌅 בוקר/)).toBeVisible();
  await expect(page.getByText(/☀️ צהריים/)).toBeVisible();
  await expect(page.getByText(/🌙 ערב/)).toBeVisible();
  // The settings form has three time inputs (morning/noon/evening)
  await expect(page.locator('form input[type="time"]')).toHaveCount(3);

  // Schedules: open new-schedule dialog
  await page.goto("/schedules");
  await page.getByRole("button", { name: /הוספת תזכורת חדשה/ }).click();

  // The "זריקה" (injection) chip must be gone
  await expect(page.getByRole("button", { name: /זריקה/ })).toHaveCount(0);
  // The "בדיקה ביתית" rename must be present
  await expect(page.getByRole("button", { name: /בדיקה ביתית/ })).toBeVisible();

  // The new interval frequency option is present
  await expect(page.getByRole("button", { name: /כל X חודשים\/שנים/ })).toBeVisible();

  // morning/noon/evening chips
  await expect(page.getByRole("button", { name: /בוקר/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /צהריים/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /ערב/ }).first()).toBeVisible();
});

test("create yearly interval schedule via API and confirm occurrence at anchor", async ({
  request,
  page,
}) => {
  // Login via UI first so the request context has the auth cookie.
  await page.goto("/login");
  await page.getByLabel("אימייל").fill(TEST_EMAIL);
  await page.getByLabel("סיסמא").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await page.waitForURL(/\/today/);

  // Grab the patient id from the UI's "ניהול לו״ז" link target
  await page.goto("/today");
  const link = page.locator('a[href*="/schedules?patient="]').first();
  const href = await link.getAttribute("href");
  const patientId = new URL(href!, "http://localhost").searchParams.get("patient");
  expect(patientId).toBeTruthy();

  // Create a yearly schedule anchored to 2027-04-15 via the app's API
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const create = await request.post("http://localhost:3000/api/schedules", {
    headers: { "content-type": "application/json", cookie: cookieHeader },
    data: {
      patient_id: patientId,
      kind: "exam",
      title: "בדיקת דם שנתית",
      pattern: {
        freq: "interval",
        interval_unit: "years",
        interval_n: 1,
        anchor_date: "2027-04-15",
        times: ["09:00"],
      },
    },
  });
  expect(create.ok()).toBeTruthy();

  // Open schedules page and verify the new card is rendered with the right summary
  await page.goto(`/schedules?patient=${patientId}`);
  await expect(page.getByText("בדיקת דם שנתית")).toBeVisible();
  await expect(page.getByText(/הבא: 15\/04\/2027/)).toBeVisible();
});
