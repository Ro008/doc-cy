import { expect, test, type Page } from "@playwright/test";
import { gotoRegisterPracticeStep } from "./helpers/goto-register-practice-step";

/**
 * The clinic field used to accept nothing but a Google Places pick, so a doctor
 * whose clinic Google does not know (new practice, home consulting room, a
 * building Google only resolves to street level) could not finish registration
 * at all. These cover the manual path and the district override.
 *
 * Google Places is not exercised here: the map and the autocomplete need a key
 * that allows the CI origin, and neither is required for the manual path.
 */
/**
 * Types character by character. `fill()` sets the value in one shot, which hid a
 * bug where every space was swallowed as it was typed: the input was fed back
 * the trimmed address, so the doctor could never get past the first word.
 */
async function typeAddress(page: Page, text: string): Promise<void> {
  const input = page.getByLabel("Address patients will see");
  await input.click();
  await input.pressSequentially(text, { delay: 10 });
}

test.describe("Integration UI: register clinic location", { tag: "@pr-e2e" }, () => {
  test.describe.configure({ timeout: 90_000 });
  const clinicField = "[data-field-key='clinic']";

  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await gotoRegisterPracticeStep(page);
  });

  test("lets a doctor place the clinic without a Google match", async ({ page }) => {
    await expect(page.locator(`${clinicField}[data-complete='1']`)).toHaveCount(0);

    await page.getByRole("button", { name: "Drop a pin instead" }).click();

    // The street address only appears once a district anchors the map.
    await expect(page.getByLabel("Address patients will see")).toBeHidden();

    await page.getByLabel("District").selectOption("Nicosia");
    await expect(page.getByLabel("Address patients will see")).toBeVisible();

    await typeAddress(page, "12 Makariou Avenue, 2nd floor");

    await expect(page.locator(`${clinicField}[data-complete='1']`)).toHaveCount(1);
    await expect(page.locator("input[name='district']")).toHaveValue("Nicosia");
    await expect(page.locator("input[name='clinicAddress']")).toHaveValue(
      "12 Makariou Avenue, 2nd floor",
    );
    // The pin starts on the district centre, so we always submit real coordinates.
    await expect(page.locator("input[name='clinicLatitude']")).toHaveValue("35.1856");
    await expect(page.locator("input[name='clinicLongitude']")).toHaveValue("33.3823");
    await expect(page.locator("input[name='clinicPlaceId']")).toHaveValue("");
  });

  test("keeps the spaces the doctor types in the address", async ({ page }) => {
    await page.getByRole("button", { name: "Drop a pin instead" }).click();
    await page.getByLabel("District").selectOption("Nicosia");

    await typeAddress(page, "Dikomou 8, Floor 2");

    await expect(page.getByLabel("Address patients will see")).toHaveValue("Dikomou 8, Floor 2");
    await expect(page.locator("input[name='clinicAddress']")).toHaveValue("Dikomou 8, Floor 2");
  });

  test("collapses to a summary once the location is saved", async ({ page }) => {
    await page.getByRole("button", { name: "Drop a pin instead" }).click();
    await page.getByLabel("District").selectOption("Limassol");
    await typeAddress(page, "5 Anexartisias Street");

    await page.getByRole("button", { name: "Save this location" }).click();

    await expect(page.getByText("5 Anexartisias Street")).toBeVisible();
    await expect(page.getByText(/District:\s*Limassol/i)).toBeVisible();
    await expect(page.getByLabel("Address patients will see")).toBeHidden();

    // Still editable afterwards, both ways.
    await expect(page.getByRole("button", { name: "Adjust pin on map" })).toBeVisible();
    await page.getByRole("button", { name: "Change clinic address" }).click();
    await expect(page.locator("#register-clinic-address")).toBeVisible();

    // Opening the search by mistake must not wipe the saved location.
    await expect(page.locator(`${clinicField}[data-complete='1']`)).toHaveCount(1);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("5 Anexartisias Street")).toBeVisible();
  });

  test("adjusts the pin in a full-screen sheet", async ({ page }) => {
    await page.getByRole("button", { name: "Drop a pin instead" }).click();
    await page.getByLabel("District").selectOption("Larnaca");

    const sheet = page.getByTestId("clinic-pin-sheet");
    await expect(sheet).toBeHidden();

    // Panning happens away from the form, so a one-finger drag cannot fight the
    // page scroll.
    await page.getByRole("button", { name: "Adjust on map" }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("clinic-pin-sheet-header")).toBeVisible();
    await expect(sheet.getByTestId("clinic-pin-sheet-footer")).toBeVisible();
    await expect(sheet.getByText("Put the pin on your clinic")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Use this location" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Cancel" })).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    const headerBox = await sheet.getByTestId("clinic-pin-sheet-header").boundingBox();
    const footerBox = await sheet.getByTestId("clinic-pin-sheet-footer").boundingBox();
    expect(headerBox).toBeTruthy();
    expect(footerBox).toBeTruthy();
    expect(headerBox!.y).toBeLessThan(64);
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport!.height + 2);

    await sheet.getByRole("button", { name: "Use this location" }).click();
    await expect(sheet).toBeHidden();

    // Cancelling gets out without touching the saved coordinates.
    const latitude = await page.locator("input[name='clinicLatitude']").inputValue();
    await page.getByRole("button", { name: "Adjust on map" }).click();
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("input[name='clinicLatitude']")).toHaveValue(latitude);
  });

  test("only offers a district override where it is the only source", async ({ page }) => {
    // A Google pick carries its own district. Overriding it produced records
    // like a Paphos address filed under Limassol, so the select exists only on
    // the manual path, where nothing else can tell us the district.
    await expect(page.getByLabel("District")).toHaveCount(0);

    await page.getByRole("button", { name: "Drop a pin instead" }).click();
    await expect(page.getByLabel("District")).toHaveCount(1);
  });

  test("moving the district re-anchors the pin", async ({ page }) => {
    await page.getByRole("button", { name: "Drop a pin instead" }).click();
    await page.getByLabel("District").selectOption("Nicosia");
    await expect(page.locator("input[name='clinicLatitude']")).toHaveValue("35.1856");

    await page.getByLabel("District").selectOption("Paphos");
    await expect(page.locator("input[name='district']")).toHaveValue("Paphos");
    await expect(page.locator("input[name='clinicLatitude']")).not.toHaveValue("35.1856");
  });

  test("the missing-fields summary still points at the clinic field", async ({ page }) => {
    await page.getByRole("button", { name: /Submit My Application/i }).click();

    const summary = page.getByTestId("register-missing-summary");
    await expect(summary).toBeVisible();
    await summary.getByRole("button", { name: "Clinic address" }).click();

    await expect(page.locator("#register-clinic-address")).toBeFocused();
  });
});
