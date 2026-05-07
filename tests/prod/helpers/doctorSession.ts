import { expect, type Page } from "@playwright/test";
import { signInDoctorAndSetCookies } from "../../helpers/doctorAuth";

type DoctorSessionOptions = {
  email?: string;
  password?: string;
};

async function exposeSupabaseAuthCookiesToClient(page: Page): Promise<void> {
  const supabaseUrl = (
    process.env.PLAYWRIGHT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / PLAYWRIGHT_SUPABASE_URL");
  }

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").trim();
  const cookieDomain = new URL(baseUrl).hostname;
  const secure = baseUrl.startsWith("https://");

  const cookies = await page.context().cookies();
  const authCookies = cookies.filter(
    (cookie) => cookie.name === storageKey || cookie.name.startsWith(`${storageKey}.`),
  );
  if (authCookies.length === 0) {
    throw new Error("Supabase auth cookies were not set in browser context.");
  }

  await page.context().addCookies(
    authCookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookieDomain,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax",
    })),
  );
}

export async function authenticateDoctorViaSession(
  page: Page,
  options?: DoctorSessionOptions,
): Promise<void> {
  await signInDoctorAndSetCookies(page, undefined, options);
  await exposeSupabaseAuthCookiesToClient(page);
  await page.goto("/agenda", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 45_000 });
}
