import { expect, test } from "@playwright/test";

test.describe("Register form required hints", () => {
  test("blocks submit and shows inline hints when required fields are missing", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.getByRole("button", { name: /Submit application/i }).click();

    await expect(page).toHaveURL(/\/register(?:\?|$)/);
    await expect(page.getByText("Please enter your full name.")).toBeVisible();
    await expect(page.getByText("Please enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Please select your specialty.")).toBeVisible();
    await expect(page.getByText("Please select at least one spoken language.")).toBeVisible();
    await expect(page.getByText("Please upload and confirm your profile photo.")).toBeVisible();
    await expect(
      page.getByText("Please confirm the professional disclaimer to continue."),
    ).toBeVisible();
  });
});
