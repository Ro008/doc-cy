import { expect, type Page, type Response } from "@playwright/test";

export type DoctorLoginResult = {
  outcome: "agenda" | "invalid-credentials" | "timeout";
  authStatus: number | null;
  authMessage: string | null;
  authHost: string | null;
};

function readAuthMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;
  if (typeof payload.msg === "string") return payload.msg;
  if (typeof payload.error_description === "string") return payload.error_description;
  if (typeof payload.error === "string") return payload.error;
  return null;
}

async function waitForAuthResponse(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && /\/auth\/v1\/token(\?|$)/.test(response.url()),
    { timeout: 25_000 }
  );
}

export async function attemptDoctorLoginViaUi(
  page: Page,
  email: string,
  password: string
): Promise<DoctorLoginResult> {
  const normalizedEmail = email.trim();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error(
      "Doctor login credentials are empty after trimming TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD."
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(normalizedEmail);
  await page.getByLabel("Password").fill(normalizedPassword);

  const authResponsePromise = waitForAuthResponse(page);
  await page.getByRole("button", { name: /Sign in/i }).click();

  let authStatus: number | null = null;
  let authMessage: string | null = null;
  let authHost: string | null = null;
  try {
    const authResponse = await authResponsePromise;
    authStatus = authResponse.status();
    authHost = new URL(authResponse.url()).host;
    try {
      authMessage = readAuthMessage(await authResponse.json());
    } catch {
      authMessage = null;
    }
  } catch {
    // Keep diagnostics nullable and continue with outcome checks.
  }

  try {
    await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 25_000 });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 10_000 });
    return { outcome: "agenda", authStatus, authMessage, authHost };
  } catch {
    // Check login failure UI before timing out fully.
  }

  const invalidCredentialsNotice = page.getByText(/Invalid email or password/i);
  if (await invalidCredentialsNotice.isVisible()) {
    return { outcome: "invalid-credentials", authStatus, authMessage, authHost };
  }

  return { outcome: "timeout", authStatus, authMessage, authHost };
}

export async function loginDoctorToAgendaOrThrow(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const result = await attemptDoctorLoginViaUi(page, email, password);
  if (result.outcome === "agenda") return;

  const authDetail =
    result.authStatus !== null
      ? ` auth status=${result.authStatus}${
          result.authMessage ? `, message="${result.authMessage}"` : ""
        }${result.authHost ? `, host="${result.authHost}"` : ""}.`
      : "";

  if (result.outcome === "invalid-credentials") {
    throw new Error(
      `UI login returned invalid credentials.${authDetail} Check deployed app env vars (NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY), TEST_DOCTOR_* secrets, and PLAYWRIGHT_BASE_URL target alignment.`
    );
  }

  throw new Error(
    `Doctor login did not reach /agenda in time (current URL: ${page.url()}).${authDetail}`
  );
}
