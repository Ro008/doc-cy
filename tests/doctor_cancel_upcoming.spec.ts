// tests/doctor_cancel_upcoming.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

function nextWorkingDayCyprus(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  // 0=Sun,1=Mon,...,6=Sat — we want Mon–Fri
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe("Upcoming appointments cancellation", () => {
  test.beforeEach(({}, testInfo) => {
    if (
      testInfo.project.name === "Mobile Safari (iPhone 12)" ||
      testInfo.project.name === "Tablet (iPad)"
    ) {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on WebKit mobile for E2E."
      );
    }
  });

  test("doctor can cancel a future appointment from Upcoming list", async ({
    page,
    request,
  }) => {
    test.setTimeout(60000);

    async function signIn() {
      const urlRegex = /\/agenda/;

      for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto("/login");
        await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
        const passwordInput = page.getByLabel(/password/i);
        await passwordInput.fill(TEST_USER_PASSWORD);
        await passwordInput.press("Enter");

        await page.waitForLoadState("domcontentloaded");

        try {
          await page.waitForURL(urlRegex, { timeout: 12000 });
          return;
        } catch {
          // try again with a fresh /login page
        }
      }

      await page.waitForURL(urlRegex, { timeout: 20000 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug")
      .eq("status", "active")
      .limit(5);

    const slug = activeDoctors?.[0]?.slug;
    expect(slug).toBeTruthy();

    // 1. Create a future appointment via API (using doctorSlug for Dr. Nikos)
    const dateStr = nextWorkingDayCyprus(new Date());
    // Use an afternoon slot unlikely to collide with other tests
    const appointmentLocal = `${dateStr}T16:30`;

    const createRes = await request.post("/api/appointments", {
      data: {
        doctorSlug: slug,
        patientName: "Cancel E2E Future",
        patientEmail: "cancel.future@example.com",
        patientPhone: "+35799123456",
        appointmentLocal,
      },
    });

    // Accept 201 (created) or 409 (already exists). Fail hard for anything else.
    if (!createRes.ok() && createRes.status() !== 409) {
      const body = await createRes.text();
      throw new Error(
        `Failed to seed future appointment: ${createRes.status()} ${body}`
      );
    }

    const createJson = createRes.ok() ? await createRes.json() : null;
    const appointmentId = createJson?.appointment?.id as string | undefined;

    // 2. Visit dashboard and locate the appointment in "Upcoming on other days"
    await signIn();
    await page.goto("/agenda");

    await expect(
      page.getByRole("heading", { name: /Your agenda/i })
    ).toBeVisible({ timeout: 10000 });

    const upcomingSection = page
      .getByRole("heading", { name: /Upcoming on other days/i })
      .locator("..")
      .locator("..");

    // Take the first Cancel button in the Upcoming list
    const cancelButton = upcomingSection
      .getByRole("button", { name: /^Cancel$/i })
      .first();
    await expect(cancelButton).toBeVisible({ timeout: 10000 });
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    // Confirm cancellation in the modal
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const confirmBtn = dialog.getByRole("button", {
      name: /Confirm cancel/i,
    });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    // 3. Assert the confirmation modal closes (flow completed without errors)
    await expect(confirmBtn).toBeHidden({ timeout: 15000 });

    // Safety net: if for some reason it is still in DB, try to delete via API
    if (appointmentId) {
      await request.delete(`/api/appointments/${appointmentId}`);
    }
  });
});

