import { expect, type Page } from "@playwright/test";

type LoginOutcome = "agenda" | "invalid-credentials" | "timeout";

async function submitAndWaitForOutcome(page: Page): Promise<LoginOutcome> {
  const invalidCredentialsNotice = page.getByText(/Invalid email or password/i);

  try {
    await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });
    return "agenda";
  } catch {
    // Continue below to classify why we did not reach /agenda.
  }

  if (await invalidCredentialsNotice.isVisible()) {
    return "invalid-credentials";
  }

  return "timeout";
}

export async function loginDoctorToAgenda(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const normalizedEmail = email.trim();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error(
      "Doctor login credentials are empty after trimming TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD."
    );
  }

  await page.goto("/login");

  // CI can occasionally miss the first submit due to transient rendering/network timing.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.getByLabel("Email").fill(normalizedEmail);
    await page.getByLabel("Password").fill(normalizedPassword);
    await page.getByRole("button", { name: /Sign in/i }).click();

    const outcome = await submitAndWaitForOutcome(page);
    if (outcome === "agenda") {
      await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 15_000 });
      return;
    }

    if (outcome === "invalid-credentials") {
      throw new Error(
        "Doctor login failed due to invalid credentials. Verify TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD in CI secrets."
      );
    }
  }

  throw new Error(
    `Doctor login did not reach /agenda after 2 attempts (current URL: ${page.url()}). This indicates CI auth latency/throttling or provider-side issues.`
  );
}
