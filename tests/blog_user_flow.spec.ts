import { expect, test } from "@playwright/test";

test.describe("Blog natural user flow", () => {
  test("user browses posts, opens one, then moves to finder", async ({ page }, testInfo) => {
    await page.goto("/blog");

    // Header brand link from blog should drive users to finder.
    const brandLink = page.getByRole("link", { name: "DocCy" }).first();
    await expect(brandLink).toBeVisible();

    // Typical blog behavior: browse list and open an article.
    const firstPostLink = page.locator("section article h2 a").first();
    await expect(firstPostLink).toBeVisible();
    await firstPostLink.click();

    await expect(page).toHaveURL(/\/blog\/[^/]+$/);
    await expect(page.locator("article h1")).toBeVisible();

    // Typical exit path from content towards marketplace/finder.
    const paphosCta = page.getByRole("link", { name: /Browse Paphos Professionals/i });
    const isMobileProject = testInfo.project.name.includes("Mobile");
    if (!isMobileProject && (await paphosCta.count())) {
      await paphosCta.click();
      await expect(page).toHaveURL(/\/finder\/paphos(?:\?|$)/);
      return;
    }

    // Mobile-safe route: use header brand link from the post detail.
    const postBrandLink = page.getByRole("link", { name: "DocCy" }).first();
    await expect(postBrandLink).toBeVisible();
    await postBrandLink.click();
    await expect(page).toHaveURL(/\/finder(?:\?|$)/);
  });
});
