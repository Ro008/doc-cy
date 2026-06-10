import { expect, test } from "@playwright/test";

test.describe("Blog post images UI", { tag: "@pr-e2e" }, () => {
  test("blog post detail images render with src and alt text", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveURL(/\/blog(?:\?|$)/);

    const postLinks = page.locator("section article h2 a");
    const postCount = await postLinks.count();
    expect(postCount).toBeGreaterThan(0);

    const hrefs = await postLinks.evaluateAll((elements) =>
      elements
        .map((element) => (element as HTMLAnchorElement).getAttribute("href"))
        .filter((href): href is string => Boolean(href && href.startsWith("/blog/"))),
    );

    const uniquePostHrefs = Array.from(new Set(hrefs));
    expect(uniquePostHrefs.length).toBeGreaterThan(0);

    for (const href of uniquePostHrefs) {
      await page.goto(href);
      await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?|$)`));

      const article = page.locator("article").first();
      await expect(article).toBeVisible();

      const images = article.locator("img");
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i += 1) {
        const img = images.nth(i);
        await expect(img, `Image ${i + 1} in ${href} should have src`).toHaveAttribute("src", /.+/);
        await expect(img, `Image ${i + 1} in ${href} should have alt`).toHaveAttribute("alt", /.+/);
        await expect(img).toBeVisible();
      }
    }
  });
});
