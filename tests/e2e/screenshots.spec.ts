import { test } from "@playwright/test";
import {
  createTestPatient,
  deleteTestUser,
  TEST_EMAIL,
  TEST_PASSWORD,
} from "./setup";

let userId: string;
let patientId: string;

test.beforeAll(async () => {
  const r = await createTestPatient();
  userId = r.userId;
  patientId = r.patientId;
});

test.afterAll(async () => {
  if (userId) await deleteTestUser(userId);
});

test("capture screenshots of redesigned pages", async ({ page }) => {
  // Login
  await page.goto("/login");
  await page.screenshot({ path: "screenshots/01-login.png", fullPage: true });

  await page.getByLabel("אימייל").fill(TEST_EMAIL);
  await page.getByLabel("סיסמא").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await page.waitForURL(/\/today/);

  // Seed a few schedules for visual variety
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  await page.request.post("http://localhost:3000/api/schedules", {
    headers: { "content-type": "application/json", cookie: cookieHeader },
    data: {
      patient_id: patientId,
      kind: "medication",
      title: "אקמול",
      dose_text: "1 כדור",
      pattern: { freq: "daily", times: ["08:00", "20:00"] },
    },
  });
  await page.request.post("http://localhost:3000/api/schedules", {
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
  await page.request.post("http://localhost:3000/api/schedules", {
    headers: { "content-type": "application/json", cookie: cookieHeader },
    data: {
      patient_id: patientId,
      kind: "measurement",
      title: "לחץ דם",
      measurement_unit: "mmHg",
      measurement_value_count: 2,
      pattern: { freq: "daily", times: ["07:00"] },
    },
  });

  await page.goto("/today");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/02-today.png", fullPage: true });

  await page.goto("/schedules");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/03-schedules.png", fullPage: true });

  // New schedule sheet
  await page.getByRole("button", { name: /הוספת תזכורת חדשה/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "screenshots/04-new-schedule.png", fullPage: true });

  // Pick interval frequency to show the new section
  await page.getByRole("button", { name: /כל X חודשים\/שנים/ }).click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "screenshots/05-interval-freq.png", fullPage: true });
  await page.keyboard.press("Escape");

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/06-settings.png", fullPage: true });

  await page.goto("/history");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/07-history.png", fullPage: true });
});
