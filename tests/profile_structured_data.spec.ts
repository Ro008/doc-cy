import { expect, test } from "@playwright/test";

test.describe("Public profile structured data", () => {
  test("profile page exposes healthcare JSON-LD with CY address country", async ({ page }) => {
    const slug = (process.env.TEST_BOOKING_DOCTOR_SLUG ?? "andreas-nikos").trim();
    await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });

    const structuredData = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );

      const parsed = scripts
        .map((s) => s.textContent?.trim() ?? "")
        .filter(Boolean)
        .map((raw) => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })
        .filter((v): v is Record<string, unknown> => v !== null);

      return parsed.find((entry) => {
        const type = String(entry["@type"] ?? "");
        return type === "Physician" || type === "MedicalBusiness";
      });
    });

    expect(structuredData).toBeTruthy();
    expect(String(structuredData?.["@context"] ?? "")).toBe("https://schema.org");
    expect(["Physician", "MedicalBusiness"]).toContain(
      String(structuredData?.["@type"] ?? "")
    );

    const address = (structuredData?.["address"] ?? null) as
      | Record<string, unknown>
      | null;
    expect(address).toBeTruthy();
    expect(String(address?.["addressCountry"] ?? "")).toBe("CY");
  });
});
